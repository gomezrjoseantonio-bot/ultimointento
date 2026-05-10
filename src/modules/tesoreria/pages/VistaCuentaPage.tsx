/**
 * S-TESORERIA-FASE-B-VISTA-CUENTA · `/tesoreria/cuenta/:accountId`
 *
 * Página dedicada a una cuenta bancaria · estructura cuenta-céntrica según
 * mockup v8 (`docs/mockups/atlas-tesoreria-v8-completo.html`). Cada cuenta
 * tiene su propio banner navy (logo + nombre + IBAN + pager + 4 KPIs), su
 * toolbar de acciones (Subir extracto / Nuevo movimiento), sus filtros de
 * 3 ejes (Periodo · Tipo · Estado) + búsqueda con debounce, su tabla con
 * día agrupador (iconos ↑↓ + totales) y su bulk action bar sobrio.
 *
 * Reutiliza:
 *   - MovimientoDrawer (intacto · click en fila lo invoca con eventId)
 *   - AddMovementModal (con `defaultAccountId` añadido en sub-tarea 2)
 *   - BankStatementUploadPage (con `?accountId=N` añadido en sub-tarea 2)
 *   - tesoreriaSearch utils (matchesAmountQuery, normalizeSearchText)
 *   - confirmTreasuryEvent / bulkConfirmTreasuryEvents
 *   - deleteTreasuryEventCompletely
 *
 * NavLink "Tesorería" (Sidebar) sigue activa por prefix-match (default de
 * react-router NavLink sin `end`) y al click vuelve a `/tesoreria`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Upload,
  Plus,
  Search,
  TrendingUp,
  CreditCard,
  Home,
  Zap,
  Briefcase,
  ArrowDownLeft,
} from 'lucide-react';
import {
  initDB,
  type Account,
  type Movement,
  type Property,
  type TreasuryEvent,
} from '../../../services/db';
import { cuentasService } from '../../../services/cuentasService';
import {
  necesitaRegenerar,
  regenerateForecastsForward,
} from '../../../services/treasuryBootstrapService';
import {
  bulkConfirmTreasuryEvents,
  confirmTreasuryEvent,
  deleteTreasuryEventCompletely,
  updateTreasuryEventFields,
} from '../../../services/treasuryConfirmationService';
import { invalidateCachedStores } from '../../../services/indexedDbCacheService';
import {
  matchesAmountQuery,
  normalizeSearchText,
} from '../../../utils/tesoreriaSearch';
import { showToastV5 } from '../../../design-system/v5';
import MovimientoDrawer, {
  type MovimientoDrawerData,
  type MovimientoDrawerPatch,
} from '../../../components/treasury/MovimientoDrawer';
import AddMovementModal from '../../horizon/conciliacion/v2/components/AddMovementModal';
import styles from './VistaCuentaPage.module.css';

// ── Helpers · bank logo (reutilizamos lógica de BankAccountCard) ─────────────

const BANK_COLOR_MAP: Record<string, string> = {
  santander: 'var(--atlas-v5-brand-santander)',
  sabadell: 'var(--atlas-v5-brand-sabadell)',
  unicaja: 'var(--atlas-v5-brand-unicaja)',
  bbva: 'var(--atlas-v5-brand-bbva)',
  ing: 'var(--atlas-v5-brand-ing)',
  caixabank: 'var(--atlas-v5-brand-caixabank)',
  caixa: 'var(--atlas-v5-brand-caixabank)',
};

const inferLogoColor = (account: Account): string => {
  const brandColor = account.banco?.brand?.color;
  if (brandColor && brandColor.startsWith('#')) return brandColor;
  const bankName = (
    account.banco?.name ?? account.bank ?? ''
  ).toLowerCase();
  for (const key of Object.keys(BANK_COLOR_MAP)) {
    if (bankName.includes(key)) return BANK_COLOR_MAP[key];
  }
  return 'var(--atlas-v5-brand)';
};

const inferInitials = (account: Account): string => {
  const name =
    account.alias ??
    account.banco?.name ??
    account.bank ??
    account.name ??
    '??';
  return (
    name
      .replace(/[^A-Za-zÁÉÍÓÚÑ\s]/g, '')
      .trim()
      .split(/\s+/)
      .map((p) => p[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??'
  );
};

const last4 = (iban?: string): string => {
  if (!iban) return '';
  const digits = iban.replace(/\s+/g, '').slice(-4);
  return `···· ${digits}`;
};

// ── Format helpers ───────────────────────────────────────────────────────────

const formatEur0 = (v: number): string => {
  const abs = Math.abs(Math.round(v));
  return abs.toLocaleString('es-ES');
};

const formatSignedEur0 = (v: number): string => {
  if (v === 0) return '0 €';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${formatEur0(v)} €`;
};

const MONTH_NAMES_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const formatDayLabel = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dow = d.toLocaleDateString('es-ES', { weekday: 'long' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  const yyyy = d.getFullYear();
  return `${dow} · ${dd} ${mmm} ${yyyy}`;
};

// ── Filters ──────────────────────────────────────────────────────────────────

type PeriodFilter = 'hoy' | '7d' | '15d' | '30d' | 'mes' | 'anio' | 'todo';
type TypeFilter = 'todos' | 'ingresos' | 'gastos';
type StatusFilter = 'todos' | 'pendientes' | 'conciliados';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  hoy: 'Hoy',
  '7d': '7 días',
  '15d': '15 días',
  '30d': '30 días',
  mes: 'Este mes',
  anio: 'Año',
  todo: 'Todo',
};

const PERIODS: PeriodFilter[] = ['hoy', '7d', '15d', '30d', 'mes', 'anio', 'todo'];

const isWithinPeriod = (iso: string | undefined, period: PeriodFilter): boolean => {
  if (!iso) return false;
  if (period === 'todo') return true;
  const d = new Date(
    iso.length > 10 ? iso : `${iso}T00:00:00`,
  );
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === 'hoy') {
    const todayKey = today.toISOString().slice(0, 10);
    return iso.slice(0, 10) === todayKey;
  }

  if (period === 'mes') {
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth()
    );
  }

  if (period === 'anio') {
    return d.getFullYear() === today.getFullYear();
  }

  // Rolling windows · last N days incluyendo hoy.
  const days = period === '7d' ? 7 : period === '15d' ? 15 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return d >= start && d <= new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
};

// ── Unified row types ────────────────────────────────────────────────────────

type RowKind = 'movement' | 'event';
interface UnifiedRow {
  kind: RowKind;
  id: number;
  date: string; // YYYY-MM-DD
  amount: number; // signed (positive = income, negative = expense)
  isReconciled: boolean;
  description: string;
  counterparty: string;
  categoryLabel: string;
  type: 'income' | 'expense' | 'financing';
  raw: Movement | TreasuryEvent;
}

const isMovementReconciled = (m: Movement): boolean =>
  m.estado_conciliacion === 'conciliado' ||
  m.unifiedStatus === 'conciliado' ||
  m.status === 'conciliado';

// ── Icons per row type ───────────────────────────────────────────────────────

const getExpenseIcon = (categoryLabel: string | undefined): React.ReactElement => {
  const cat = (categoryLabel ?? '').toLowerCase();
  if (cat.includes('vivienda') || cat.includes('alquiler'))
    return <Home size={14} color="var(--atlas-v5-pos)" />;
  if (cat.includes('suministro') || cat.includes('gas') || cat.includes('luz'))
    return <Zap size={14} color="var(--atlas-v5-pos)" />;
  if (cat.includes('gestión') || cat.includes('gestion') || cat.includes('honorario'))
    return <Briefcase size={14} color="var(--atlas-v5-pos)" />;
  if (
    cat.includes('cuota') ||
    cat.includes('hipoteca') ||
    cat.includes('financiación') ||
    cat.includes('financiacion')
  )
    return <CreditCard size={14} color="var(--atlas-v5-pos)" />;
  return <ArrowDownLeft size={14} color="var(--atlas-v5-pos)" />;
};

const getRowIcon = (row: UnifiedRow): React.ReactElement => {
  if (row.type === 'income')
    return <TrendingUp size={14} color="var(--atlas-v5-ink)" />;
  if (row.type === 'financing')
    return <CreditCard size={14} color="var(--atlas-v5-pos)" />;
  return getExpenseIcon(row.categoryLabel);
};

// ── Pagination ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ── Debounce ─────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

// ─────────────────────────────────────────────────────────────────────────────

const VistaCuentaPage: React.FC = () => {
  const navigate = useNavigate();
  const { accountId: accountIdParam } = useParams<{ accountId: string }>();
  const [, setSearchParams] = useSearchParams();

  const accountId = useMemo(() => {
    const parsed = Number(accountIdParam);
    return Number.isFinite(parsed) ? parsed : null;
  }, [accountIdParam]);

  // ── Load data ─────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [treasuryEvents, setTreasuryEvents] = useState<TreasuryEvent[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const db = await initDB();
        const [accs, movs, evts, props] = await Promise.all([
          cuentasService.list(),
          db.getAll('movements') as Promise<Movement[]>,
          db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          db.getAll('properties') as Promise<Property[]>,
        ]);
        if (cancelled) return;
        setAccounts(accs);
        setMovements(movs);
        setTreasuryEvents(evts);
        setProperties(props);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[VistaCuenta] error cargando datos', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const unsubscribe = cuentasService.on((event) => {
      if (event === 'accounts:updated') load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [reloadTick]);

  // Forward-looking bootstrap (consistente con TesoreriaPage).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const necesita = await necesitaRegenerar(24);
        if (!necesita || cancelled) return;
        const resultado = await regenerateForecastsForward();
        if (cancelled) return;
        if (resultado.eventosCreados > 0) {
          reload();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[VistaCuenta] auto-regeneración falló', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Account context (current + pager neighbours) ──────────────────────────
  const account = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  const accountIndex = useMemo(() => {
    if (account == null) return -1;
    return accounts.findIndex((a) => a.id === account.id);
  }, [accounts, account]);

  const goToAccountByIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= accounts.length) return;
      const target = accounts[idx];
      if (target?.id != null) {
        navigate(`/tesoreria/cuenta/${target.id}`);
      }
    },
    [accounts, navigate],
  );

  // Si la cuenta no existe (eliminada o id inválido), redirige a vista general.
  useEffect(() => {
    if (loading) return;
    if (accountId == null || (accounts.length > 0 && account == null)) {
      navigate('/tesoreria', { replace: true });
    }
  }, [loading, accountId, account, accounts.length, navigate]);

  // ── KPIs · banner navy (filtrados por accountId) ──────────────────────────
  const kpis = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    const saldo = account?.balance ?? account?.openingBalance ?? 0;

    const eventosMesPredicted = treasuryEvents.filter((e) => {
      if (!e?.predictedDate) return false;
      if (e.status !== 'predicted') return false;
      if (e.executedMovementId) return false;
      if (e.accountId !== accountId) return false;
      const d = new Date(
        String(e.predictedDate).length > 10
          ? e.predictedDate
          : `${e.predictedDate}T00:00:00`,
      );
      return (
        !Number.isNaN(d.getTime()) &&
        d.getFullYear() === y &&
        d.getMonth() === m
      );
    });

    const ingresos = eventosMesPredicted.filter((e) => e.type === 'income');
    const gastos = eventosMesPredicted.filter(
      (e) => e.type === 'expense' || e.type === 'financing',
    );
    const pendienteEntrar = ingresos.reduce(
      (s, e) => s + (e.amount ?? 0),
      0,
    );
    const pendienteSalir = gastos.reduce(
      (s, e) => s + (e.amount ?? 0),
      0,
    );
    const saldoFinal = saldo + pendienteEntrar - pendienteSalir;

    // Pendientes de hoy = movements no conciliados + events predicted (cuenta).
    const pendientesHoyMov = movements.filter(
      (mv) => mv.accountId === accountId && !isMovementReconciled(mv),
    ).length;
    const pendientesHoyEvt = treasuryEvents.filter(
      (e) =>
        e.accountId === accountId &&
        e.status === 'predicted' &&
        !e.executedMovementId,
    ).length;

    return {
      saldo,
      pendienteEntrar,
      pendienteSalir,
      saldoFinal,
      ingresosCount: ingresos.length,
      gastosCount: gastos.length,
      pendientesHoy: pendientesHoyMov + pendientesHoyEvt,
      mesNombre: MONTH_NAMES_LONG[m],
    };
  }, [account, treasuryEvents, movements, accountId]);

  // ── Filters state ─────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<PeriodFilter>('hoy');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pendientes');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(0);

  // Resetear paginación al cambiar filtros.
  useEffect(() => {
    setPage(0);
  }, [period, typeFilter, statusFilter, search, accountId]);

  // ── Build unified rows for this account ───────────────────────────────────
  const accountRows = useMemo((): UnifiedRow[] => {
    if (accountId == null) return [];

    const movRows: UnifiedRow[] = movements
      .filter((m): m is Movement & { id: number } =>
        m.id != null && m.accountId === accountId,
      )
      .map((m) => {
        const reconciled = isMovementReconciled(m);
        const amount = m.amount ?? 0;
        const type: UnifiedRow['type'] = amount >= 0 ? 'income' : 'expense';
        const categoryLabel =
          [m.category?.tipo, m.category?.subtipo]
            .filter(Boolean)
            .join(' · ') || '';
        return {
          kind: 'movement',
          id: m.id,
          date: (m.date ?? '').slice(0, 10),
          amount,
          isReconciled: reconciled,
          description: m.description ?? '',
          counterparty: m.counterparty ?? m.providerName ?? '',
          categoryLabel,
          type,
          raw: m,
        };
      });

    const evtRows: UnifiedRow[] = treasuryEvents
      .filter(
        (e): e is TreasuryEvent & { id: number } =>
          e.id != null &&
          e.accountId === accountId &&
          e.status !== 'executed' &&
          !e.executedMovementId,
      )
      .map((e) => {
        const mag = Math.abs(e.actualAmount ?? e.amount ?? 0);
        const signed = e.type === 'income' ? mag : -mag;
        return {
          kind: 'event',
          id: e.id,
          date: (e.predictedDate ?? '').slice(0, 10),
          amount: signed,
          isReconciled: false,
          description: e.description ?? '',
          counterparty: e.counterparty ?? e.providerName ?? '',
          categoryLabel: e.categoryLabel ?? '',
          type: e.type,
          raw: e,
        };
      });

    return [...movRows, ...evtRows].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
  }, [movements, treasuryEvents, accountId]);

  // Counts para los pills "Estado" (sobre periodo+tipo+search aplicados).
  const counts = useMemo(() => {
    const matchesType = (r: UnifiedRow): boolean => {
      if (typeFilter === 'todos') return true;
      if (typeFilter === 'ingresos') return r.type === 'income';
      return r.type === 'expense' || r.type === 'financing';
    };
    const matchesPeriod = (r: UnifiedRow): boolean => isWithinPeriod(r.date, period);
    const matchesSearch = (r: UnifiedRow): boolean => {
      if (!search) return true;
      const needle = normalizeSearchText(search);
      if (!needle) return true;
      const haystack = [
        r.description,
        r.counterparty,
        r.categoryLabel,
        (r.raw as Movement).providerNif,
        (r.raw as Movement).invoiceNumber,
      ]
        .map(normalizeSearchText)
        .join(' ');
      if (haystack.includes(needle)) return true;
      return matchesAmountQuery(Math.abs(r.amount), search);
    };

    const base = accountRows
      .filter(matchesType)
      .filter(matchesPeriod)
      .filter(matchesSearch);

    return {
      todos: base.length,
      pendientes: base.filter((r) => !r.isReconciled).length,
      conciliados: base.filter((r) => r.isReconciled).length,
    };
  }, [accountRows, typeFilter, period, search]);

  // Filtered rows according to all 4 axes (estado included).
  const filtered = useMemo((): UnifiedRow[] => {
    return accountRows.filter((r) => {
      if (typeFilter === 'ingresos' && r.type !== 'income') return false;
      if (
        typeFilter === 'gastos' &&
        r.type !== 'expense' &&
        r.type !== 'financing'
      )
        return false;
      if (!isWithinPeriod(r.date, period)) return false;
      if (statusFilter === 'pendientes' && r.isReconciled) return false;
      if (statusFilter === 'conciliados' && !r.isReconciled) return false;
      if (search) {
        const needle = normalizeSearchText(search);
        if (needle) {
          const haystack = [
            r.description,
            r.counterparty,
            r.categoryLabel,
            (r.raw as Movement).providerNif,
            (r.raw as Movement).invoiceNumber,
          ]
            .map(normalizeSearchText)
            .join(' ');
          if (
            !haystack.includes(needle) &&
            !matchesAmountQuery(Math.abs(r.amount), search)
          ) {
            return false;
          }
        }
      }
      return true;
    });
  }, [accountRows, typeFilter, period, statusFilter, search]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  // ── Day grouping (over visibleRows) ───────────────────────────────────────
  const dayGroups = useMemo(() => {
    const map = new Map<string, UnifiedRow[]>();
    for (const r of visibleRows) {
      const key = r.date || '0000-00-00';
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([day, rows]) => {
      const totalIn = rows
        .filter((r) => r.amount > 0)
        .reduce((s, r) => s + r.amount, 0);
      const totalOut = rows
        .filter((r) => r.amount < 0)
        .reduce((s, r) => s + r.amount, 0);
      return { day, rows, totalIn, totalOut };
    });
  }, [visibleRows]);

  // Footer scope totals (over filtered, NOT just visibleRows).
  const scopeTotals = useMemo(() => {
    const totalIn = filtered
      .filter((r) => r.amount > 0)
      .reduce((s, r) => s + r.amount, 0);
    const totalOut = filtered
      .filter((r) => r.amount < 0)
      .reduce((s, r) => s + r.amount, 0);
    return { totalIn, totalOut };
  }, [filtered]);

  // ── Selection (bulk bar) ──────────────────────────────────────────────────
  // Key = `${kind}:${id}` para evitar colisiones entre movement.id y event.id.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rowKey = (r: UnifiedRow): string => `${r.kind}:${r.id}`;

  const toggleRow = (r: UnifiedRow) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = rowKey(r);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleSelectableKeys = useMemo(
    () => visibleRows.map(rowKey),
    [visibleRows],
  );

  const allVisibleSelected =
    visibleSelectableKeys.length > 0 &&
    visibleSelectableKeys.every((k) => selected.has(k));

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const k of visibleSelectableKeys) next.delete(k);
      } else {
        for (const k of visibleSelectableKeys) next.add(k);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // ── Drawer (movimiento previsto) ──────────────────────────────────────────
  const [drawerEventId, setDrawerEventId] = useState<number | null>(null);

  const drawerData = useMemo((): MovimientoDrawerData | null => {
    if (drawerEventId == null) return null;
    const ev = treasuryEvents.find((e) => e.id === drawerEventId);
    if (!ev) return null;
    const accountAlias =
      account?.alias ?? account?.banco?.name ?? account?.name;
    return {
      id: ev.id!,
      description: ev.description,
      predictedDate: ev.predictedDate,
      type: ev.type,
      amount: ev.amount,
      status: ev.status,
      accountAlias,
      inmuebleAlias: ev.inmuebleAlias,
      contratoAlias: (ev as any).contratoAlias,
      categoryLabel: ev.categoryLabel,
    };
  }, [drawerEventId, treasuryEvents, account]);

  const handleSaveEvent = async (
    id: number | string,
    patch: MovimientoDrawerPatch,
  ) => {
    const dbId = typeof id === 'number' ? id : Number(id);
    if (!Number.isFinite(dbId)) return;
    try {
      await updateTreasuryEventFields(dbId, patch);
      invalidateCachedStores(['treasuryEvents']);
      reload();
      setDrawerEventId(null);
      showToastV5('Cambios guardados', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar';
      showToastV5(msg, 'error');
    }
  };

  const handleConfirmFromDrawer = async (id: number | string) => {
    const dbId = typeof id === 'number' ? id : Number(id);
    if (!Number.isFinite(dbId)) return;
    try {
      await confirmTreasuryEvent(dbId);
      invalidateCachedStores(['treasuryEvents', 'movements']);
      reload();
      setDrawerEventId(null);
      showToastV5('Pago confirmado', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo confirmar';
      showToastV5(msg, 'error');
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const handleBulkConfirm = async () => {
    // Sólo afectamos a pendientes (events o movements no conciliados).
    const ids: number[] = [];
    for (const key of selected) {
      const [kind, idStr] = key.split(':');
      const id = Number(idStr);
      if (kind === 'event' && Number.isFinite(id)) {
        ids.push(id);
      }
    }
    if (ids.length === 0) {
      showToastV5(
        'No hay previsiones pendientes en la selección',
        'warn',
      );
      return;
    }
    try {
      const result = await bulkConfirmTreasuryEvents(ids);
      invalidateCachedStores(['treasuryEvents', 'movements', 'accounts']);
      reload();
      clearSelection();
      const ok = result.ok.length;
      const failed = result.failed.length;
      if (ok > 0 && failed === 0) {
        showToastV5(
          `${ok} movimiento${ok === 1 ? '' : 's'} conciliado${ok === 1 ? '' : 's'}`,
          'success',
        );
      } else if (ok > 0 && failed > 0) {
        showToastV5(
          `Conciliados: ${ok} · fallidos: ${failed} · ver consola`,
          'error',
        );
      } else {
        showToastV5('No se pudo conciliar · ver consola', 'error');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VistaCuenta] bulk confirm falló', err);
      showToastV5('Error al conciliar · ver consola', 'error');
    }
  };

  const handleBulkDelete = async () => {
    // Sólo afecta a pendientes · events sin executedMovementId o movements no
    // conciliados.
    const eventIds: number[] = [];
    const movementIds: number[] = [];
    for (const key of selected) {
      const [kind, idStr] = key.split(':');
      const id = Number(idStr);
      if (!Number.isFinite(id)) continue;
      if (kind === 'event') eventIds.push(id);
      else if (kind === 'movement') {
        const mv = movements.find((m) => m.id === id);
        if (mv && !isMovementReconciled(mv)) movementIds.push(id);
      }
    }
    const total = eventIds.length + movementIds.length;
    if (total === 0) {
      showToastV5(
        'No hay pendientes en la selección que se puedan eliminar',
        'warn',
      );
      return;
    }
    // Modal confirmación (window.confirm como mínimo · evita dependencia
    // adicional · spec pide "modal de confirmación con count").
    const ok = window.confirm(
      `¿Eliminar ${total} movimiento${total === 1 ? '' : 's'} pendiente${total === 1 ? '' : 's'}?\n\nLos movimientos conciliados no se eliminarán.`,
    );
    if (!ok) return;

    let okCount = 0;
    let failed = 0;
    try {
      for (const id of eventIds) {
        try {
          await deleteTreasuryEventCompletely(id);
          okCount += 1;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[VistaCuenta] delete event falló', id, err);
          failed += 1;
        }
      }
      if (movementIds.length > 0) {
        const db = await initDB();
        for (const id of movementIds) {
          try {
            await db.delete('movements', id);
            okCount += 1;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[VistaCuenta] delete movement falló', id, err);
            failed += 1;
          }
        }
      }
      invalidateCachedStores(['treasuryEvents', 'movements', 'accounts']);
      reload();
      clearSelection();
      if (okCount > 0 && failed === 0) {
        showToastV5(
          `${okCount} movimiento${okCount === 1 ? '' : 's'} eliminado${okCount === 1 ? '' : 's'}`,
          'success',
        );
      } else if (okCount > 0 && failed > 0) {
        showToastV5(
          `Eliminados: ${okCount} · fallidos: ${failed} · ver consola`,
          'error',
        );
      } else {
        showToastV5('No se pudo eliminar · ver consola', 'error');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VistaCuenta] bulk delete falló', err);
      showToastV5('Error al eliminar · ver consola', 'error');
    }
  };

  const selectedHasPendientes = useMemo(() => {
    for (const key of selected) {
      const [kind] = key.split(':');
      if (kind === 'event') return true;
      if (kind === 'movement') {
        const id = Number(key.split(':')[1]);
        const mv = movements.find((m) => m.id === id);
        if (mv && !isMovementReconciled(mv)) return true;
      }
    }
    return false;
  }, [selected, movements]);

  // ── AddMovementModal ──────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSubirExtracto = () => {
    if (accountId == null) return;
    navigate(`/tesoreria/importar?accountId=${accountId}`);
  };

  const handleNuevoMovimiento = () => setShowAddModal(true);

  const handleRowClick = (r: UnifiedRow) => {
    if (r.kind === 'event') {
      setDrawerEventId(r.id);
    } else {
      // Movements no abren el drawer Movimiento previsto · llevarlos al filtro
      // de movimientos para edición. Mantiene compat con el flujo actual.
      const params = new URLSearchParams();
      params.set('cuenta', String(accountId ?? ''));
      navigate(`/tesoreria/movimientos?${params.toString()}`);
    }
  };

  // Suprime el warning de unused `setSearchParams` cuando algún día se use
  // para persistir filtros en URL. Lo dejamos disponible para evolutivos.
  void setSearchParams;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Cargando cuenta…</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>Cuenta no encontrada</div>
      </div>
    );
  }

  const counterTotal = accounts.length;
  const counterCurrent = accountIndex + 1;
  const canPrev = accountIndex > 0;
  const canNext = accountIndex >= 0 && accountIndex < accounts.length - 1;

  return (
    <div className={styles.page}>
      {/* ─── Banner navy ─── */}
      <div className={styles.bannerNavy}>
        <div className={styles.bannerRow}>
          <div className={styles.bannerIdCompact}>
            <span
              className={styles.bankLogoMd}
              style={{ background: inferLogoColor(account) }}
              aria-hidden
            >
              {inferInitials(account)}
            </span>
            <div className={styles.bannerIdInfo}>
              <div className={styles.accountNameRow}>
                <h2 className={styles.accountName}>
                  {account.alias ??
                    account.banco?.name ??
                    account.bank ??
                    'Cuenta'}
                </h2>
                <div className={styles.pagerArrows}>
                  <button
                    type="button"
                    className={styles.pagerArrow}
                    onClick={() => goToAccountByIndex(accountIndex - 1)}
                    disabled={!canPrev}
                    aria-label="Cuenta anterior"
                    title="Cuenta anterior"
                  >
                    <ChevronLeft size={12} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    className={styles.pagerArrow}
                    onClick={() => goToAccountByIndex(accountIndex + 1)}
                    disabled={!canNext}
                    aria-label="Cuenta siguiente"
                    title="Cuenta siguiente"
                  >
                    <ChevronRight size={12} strokeWidth={2.5} />
                  </button>
                </div>
                <span className={styles.pagerCounter}>
                  {counterCurrent} de {counterTotal}
                </span>
              </div>
              {last4(account.iban) && (
                <div className={styles.accountIban}>{last4(account.iban)}</div>
              )}
            </div>
          </div>

          <div className={styles.kpiBanner}>
            <div className={styles.kpiBannerLabel}>Saldo hoy</div>
            <div className={styles.kpiBannerValue}>
              {formatEur0(kpis.saldo)} €
            </div>
            <div className={styles.kpiBannerSub}>
              {kpis.pendientesHoy} pendiente
              {kpis.pendientesHoy === 1 ? '' : 's'}
            </div>
          </div>
          <div className={styles.kpiBanner}>
            <div className={styles.kpiBannerLabel}>Pendiente entrar mes</div>
            <div
              className={`${styles.kpiBannerValue} ${styles.kpiBannerValuePos}`}
            >
              +{formatEur0(kpis.pendienteEntrar)} €
            </div>
            <div className={styles.kpiBannerSub}>
              {kpis.ingresosCount} movimiento
              {kpis.ingresosCount === 1 ? '' : 's'} · {kpis.mesNombre}
            </div>
          </div>
          <div className={styles.kpiBanner}>
            <div className={styles.kpiBannerLabel}>Pendiente salir mes</div>
            <div
              className={`${styles.kpiBannerValue} ${styles.kpiBannerValueNeg}`}
            >
              −{formatEur0(kpis.pendienteSalir)} €
            </div>
            <div className={styles.kpiBannerSub}>
              {kpis.gastosCount} movimiento
              {kpis.gastosCount === 1 ? '' : 's'} · {kpis.mesNombre}
            </div>
          </div>
          <div className={styles.kpiBanner}>
            <div className={styles.kpiBannerLabel}>Saldo final mes</div>
            <div className={styles.kpiBannerValue}>
              {formatEur0(kpis.saldoFinal)} €
            </div>
            <div className={styles.kpiBannerSub}>cierre proyectado</div>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className={styles.content}>
        {/* Toolbar acciones */}
        <div className={styles.actionsBar}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={handleSubirExtracto}
          >
            <Upload size={14} strokeWidth={2} />
            Subir extracto
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleNuevoMovimiento}
          >
            <Plus size={14} strokeWidth={2} />
            Nuevo movimiento
          </button>
        </div>

        {/* Filtros 3 ejes */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
            <span className={styles.toolbarLabel}>Periodo</span>
            <div className={styles.chipGroup} role="tablist">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.chip} ${period === p ? styles.chipActive : ''}`}
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <div className={styles.spacer} />
            <span className={styles.toolbarLabel}>Tipo</span>
            <div className={styles.pillGroup}>
              <button
                type="button"
                className={`${styles.pill} ${typeFilter === 'todos' ? styles.pillActive : ''}`}
                onClick={() => setTypeFilter('todos')}
                aria-pressed={typeFilter === 'todos'}
              >
                Todos
              </button>
              <button
                type="button"
                className={`${styles.pill} ${typeFilter === 'ingresos' ? styles.pillActive : ''}`}
                onClick={() => setTypeFilter('ingresos')}
                aria-pressed={typeFilter === 'ingresos'}
              >
                Ingresos
              </button>
              <button
                type="button"
                className={`${styles.pill} ${typeFilter === 'gastos' ? styles.pillActive : ''}`}
                onClick={() => setTypeFilter('gastos')}
                aria-pressed={typeFilter === 'gastos'}
              >
                Gastos
              </button>
            </div>
          </div>
          <div className={styles.toolbarRow}>
            <div className={styles.searchInput}>
              <span className={styles.searchInputIcon}>
                <Search size={14} strokeWidth={2} />
              </span>
              <input
                type="search"
                placeholder="Buscar por concepto · contraparte · NIF · importe..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar movimientos"
              />
            </div>
            <span className={styles.toolbarLabel}>Estado</span>
            <div className={styles.pillGroup}>
              <button
                type="button"
                className={`${styles.pill} ${statusFilter === 'todos' ? styles.pillActive : ''}`}
                onClick={() => setStatusFilter('todos')}
                aria-pressed={statusFilter === 'todos'}
              >
                Todos <span className={styles.pillCount}>{counts.todos}</span>
              </button>
              <button
                type="button"
                className={`${styles.pill} ${statusFilter === 'pendientes' ? styles.pillActive : ''}`}
                onClick={() => setStatusFilter('pendientes')}
                aria-pressed={statusFilter === 'pendientes'}
              >
                Pendientes{' '}
                <span className={styles.pillCount}>{counts.pendientes}</span>
              </button>
              <button
                type="button"
                className={`${styles.pill} ${statusFilter === 'conciliados' ? styles.pillActive : ''}`}
                onClick={() => setStatusFilter('conciliados')}
                aria-pressed={statusFilter === 'conciliados'}
              >
                Conciliados{' '}
                <span className={styles.pillCount}>{counts.conciliados}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className={styles.bulkBar} role="region" aria-label="Acciones en bloque">
            <div className={styles.bulkInfo}>
              <b>{selected.size}</b> movimiento
              {selected.size === 1 ? '' : 's'} seleccionado
              {selected.size === 1 ? '' : 's'}
            </div>
            <div className={styles.bulkActions}>
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={handleBulkDelete}
                disabled={!selectedHasPendientes}
                title={
                  selectedHasPendientes
                    ? 'Eliminar pendientes seleccionados'
                    : 'Sólo afecta a pendientes'
                }
              >
                Eliminar
              </button>
              <button
                type="button"
                className={styles.bulkBtnPrimary}
                onClick={handleBulkConfirm}
                disabled={!selectedHasPendientes}
              >
                Conciliar seleccionados
              </button>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className={styles.movList}>
          <div className={styles.movHeader}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              aria-label="Seleccionar todos los visibles"
            />
            <div>Concepto</div>
            <div>Contraparte</div>
            <div className={styles.movHeaderImporte}>Importe</div>
            <div>Estado</div>
          </div>

          {visibleRows.length === 0 ? (
            <div className={styles.emptyRow}>
              No hay movimientos para los filtros aplicados.
            </div>
          ) : (
            dayGroups.map(({ day, rows, totalIn, totalOut }) => (
              <React.Fragment key={day}>
                <div className={styles.daySep}>
                  <span className={styles.dayLabel}>{formatDayLabel(day)}</span>
                  <span className={styles.dayStats}>
                    <span className={`${styles.dayStat} ${styles.dayStatIn}`}>
                      <ChevronUp size={12} strokeWidth={2.5} />
                      {totalIn === 0 ? '0 €' : `+${formatEur0(totalIn)} €`}
                    </span>
                    <span className={`${styles.dayStat} ${styles.dayStatOut}`}>
                      <ChevronDown size={12} strokeWidth={2.5} />
                      {totalOut === 0 ? '0 €' : `−${formatEur0(totalOut)} €`}
                    </span>
                  </span>
                </div>
                {rows.map((r) => {
                  const key = rowKey(r);
                  const isSelected = selected.has(key);
                  const tagLabel =
                    r.type === 'income'
                      ? 'Ingreso'
                      : r.type === 'financing'
                        ? 'Financiación'
                        : 'Gasto';
                  return (
                    <div
                      key={key}
                      className={`${styles.movRow} ${isSelected ? styles.movRowSelected : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleRowClick(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(r);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleRow(r)}
                        aria-label="Seleccionar movimiento"
                      />
                      <div className={styles.movConcepto}>
                        <div className={styles.movConceptoMain}>
                          {r.description || '—'}
                        </div>
                        <div className={styles.movConceptoSub}>
                          <span className={styles.movTag}>
                            {tagLabel}
                            {r.categoryLabel ? ` · ${r.categoryLabel}` : ''}
                          </span>
                          <span aria-hidden style={{ display: 'inline-flex' }}>
                            {getRowIcon(r)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.movContraparte}>
                        {r.counterparty || '—'}
                      </div>
                      <div
                        className={`${styles.movImporte} ${r.amount >= 0 ? styles.movImporteIn : styles.movImporteOut}`}
                      >
                        {formatSignedEur0(r.amount)}
                      </div>
                      <div>
                        <span
                          className={`${styles.statePill} ${r.isReconciled ? styles.statePillConciliado : styles.statePillPendiente}`}
                        >
                          {r.isReconciled ? 'Conciliado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))
          )}

          {/* Footer · totales scope + paginación */}
          <div className={styles.movFooter}>
            <div className={styles.movFooterTotals}>
              <span>
                <span className={styles.movFooterLbl}>Mostrando</span>
                {visibleRows.length} de {filtered.length}
              </span>
              <span>
                <span className={styles.movFooterLbl}>Entradas</span>
                <span className={styles.movFooterIn}>
                  {scopeTotals.totalIn === 0
                    ? '0 €'
                    : `+${formatEur0(scopeTotals.totalIn)} €`}
                </span>
              </span>
              <span>
                <span className={styles.movFooterLbl}>Salidas</span>
                <span className={styles.movFooterOut}>
                  {scopeTotals.totalOut === 0
                    ? '0 €'
                    : `−${formatEur0(scopeTotals.totalOut)} €`}
                </span>
              </span>
            </div>
            <div className={styles.pagerFooter}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Página anterior"
              >
                ‹ Anterior
              </button>
              <span className={styles.pagerFooterPos}>
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={safePage >= totalPages - 1}
                aria-label="Página siguiente"
              >
                Siguiente ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer movimiento previsto */}
      <MovimientoDrawer
        open={drawerEventId !== null}
        data={drawerData}
        accounts={accounts}
        onClose={() => setDrawerEventId(null)}
        onSave={handleSaveEvent}
        onConfirmar={handleConfirmFromDrawer}
      />

      {/* Add movement modal */}
      {showAddModal && accountId != null && (
        <AddMovementModal
          accounts={accounts}
          properties={properties}
          defaultYear={new Date().getFullYear()}
          defaultMonth0={new Date().getMonth()}
          defaultAccountId={accountId}
          onClose={() => setShowAddModal(false)}
          onCreated={async () => {
            invalidateCachedStores(['movements', 'treasuryEvents', 'accounts']);
            reload();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
};

export default VistaCuentaPage;
