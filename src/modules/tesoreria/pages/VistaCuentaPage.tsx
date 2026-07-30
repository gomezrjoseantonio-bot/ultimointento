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
} from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Plus,
  Search,
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
} from '../../../services/treasuryConfirmationService';
import PunteoList, {
  type CambiosPunteo,
} from '../../shared/components/Punteo/PunteoList';
import {
  eventoAItem,
  movimientoAItem,
} from '../../../services/punteo/punteoAdapter';
import type { ChipEstado, ItemPunteo } from '../../../services/punteo/punteoModel';
import { invalidateCachedStores } from '../../../services/indexedDbCacheService';
import {
  matchesAmountQuery,
  normalizeSearchText,
} from '../../../utils/tesoreriaSearch';
import { showToastV5 } from '../../../design-system/v5';
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


// ── Filters ──────────────────────────────────────────────────────────────────

type PeriodFilter = 'hoy' | '7d' | '15d' | '30d' | 'mes' | 'anio' | 'todo';
type TypeFilter = 'todos' | 'ingresos' | 'gastos';

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
  m.unifiedStatus === 'conciliado' ||
  m.status === 'conciliado';

// ── Pagination ───────────────────────────────────────────────────────────────

const MAX_FILAS = 250;

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
    // Magnitud por |amount|: el gasto se guarda con signo inconsistente entre
    // orígenes; sin Math.abs, `pendienteSalir` podía salir negativo y el saldo
    // final quedaba mal (sumaba el gasto en vez de restarlo).
    const pendienteEntrar = ingresos.reduce(
      (s, e) => s + Math.abs(e.amount ?? 0),
      0,
    );
    const pendienteSalir = gastos.reduce(
      (s, e) => s + Math.abs(e.amount ?? 0),
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
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);


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
  }, [accountRows, typeFilter, period, search]);

  // ── Items canónicos para PunteoList (P3 · pantalla B de punteo) ───────────
  // El eje de estado vive en los chips de PunteoList; aquí solo periodo/tipo/
  // búsqueda. Cap de seguridad (periodo «Todo» puede traer miles de filas).
  const [chip, setChip] = useState<ChipEstado>('previstos');
  const [busyPunteo, setBusyPunteo] = useState(false);

  const aliasInmueble = useMemo(() => {
    const m = new Map<string, string>();
    properties.forEach((p) => {
      if (p.id != null) m.set(String(p.id), p.alias);
    });
    return (id: number | string) => m.get(String(id));
  }, [properties]);

  const items = useMemo((): ItemPunteo[] => {
    const mapped = filtered.map((r) =>
      r.kind === 'movement'
        ? movimientoAItem(r.raw as Movement & { id: number }, aliasInmueble)
        : eventoAItem(r.raw as TreasuryEvent & { id: number }, aliasInmueble),
    );
    if (mapped.length <= MAX_FILAS) return mapped;
    return mapped
      .slice()
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, MAX_FILAS);
  }, [filtered, aliasInmueble]);

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

  const onConfirmarItem = async (item: ItemPunteo, cambios?: CambiosPunteo) => {
    if (item.kind !== 'evento' || busyPunteo) return;
    setBusyPunteo(true);
    try {
      await confirmTreasuryEvent(item.refId, {
        amount: cambios?.importe,
        date: cambios?.fecha,
        accountId: cambios?.cuentaId,
      });
      showToastV5('Punteado · movimiento real creado', 'success');
      invalidateCachedStores(['treasuryEvents', 'movements', 'accounts']);
      reload();
    } catch (err) {
      showToastV5(err instanceof Error ? err.message : 'No se pudo puntear', 'error');
    } finally {
      setBusyPunteo(false);
    }
  };

  const onNoPasoItem = async (item: ItemPunteo) => {
    if (item.kind !== 'evento' || busyPunteo) return;
    setBusyPunteo(true);
    try {
      await deleteTreasuryEventCompletely(item.refId);
      showToastV5('Previsión descartada · este mes no pasa', 'success');
      invalidateCachedStores(['treasuryEvents']);
      reload();
    } catch (err) {
      showToastV5(err instanceof Error ? err.message : 'No se pudo descartar', 'error');
    } finally {
      setBusyPunteo(false);
    }
  };

  // Puntear en lote TODAS las previsiones visibles del scope (sustituye a la
  // selección por checkbox · usa el mismo bulkConfirmTreasuryEvents real).
  const previstosVisibles = useMemo(
    () => items.filter((i) => i.kind === 'evento' && i.estado === 'previsto'),
    [items],
  );

  const handlePuntearTodos = async () => {
    if (previstosVisibles.length === 0 || busyPunteo) return;
    setBusyPunteo(true);
    try {
      const result = await bulkConfirmTreasuryEvents(previstosVisibles.map((i) => i.refId));
      invalidateCachedStores(['treasuryEvents', 'movements', 'accounts']);
      reload();
      const ok = result.ok.length;
      const failed = result.failed.length;
      if (failed === 0) {
        showToastV5(`${ok} previsi${ok === 1 ? 'ón punteada' : 'ones punteadas'}`, 'success');
      } else {
        showToastV5(`Punteadas: ${ok} · fallidas: ${failed} · ver consola`, 'error');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[VistaCuenta] puntear todos falló', err);
      showToastV5('Error al puntear · ver consola', 'error');
    } finally {
      setBusyPunteo(false);
    }
  };

  // ── Modal alta + navegación (conservados) ─────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSubirExtracto = () => {
    if (accountId == null) return;
    navigate(`/tesoreria/importar?accountId=${accountId}`);
  };

  const handleNuevoMovimiento = () => setShowAddModal(true);


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
            {previstosVisibles.length > 0 && (
              <button
                type="button"
                className={styles.bulkBtnPrimary}
                onClick={handlePuntearTodos}
                disabled={busyPunteo}
                title="Puntear todas las previsiones visibles"
              >
                Puntear {previstosVisibles.length} prevista{previstosVisibles.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>

        {/* Lista canónica de punteo (P3 · pantalla B · cuenta fijada) */}
        <div className={styles.movList} style={{ padding: '10px 14px' }}>
          <PunteoList
            items={items}
            chip={chip}
            onChipChange={setChip}
            cuentas={accounts
              .filter((a) => a.id != null)
              .map((a) => ({
                id: a.id as number,
                label: a.alias ?? a.banco?.name ?? a.name ?? `#${a.id}`,
              }))}
            ocultarCuenta
            onConfirmar={onConfirmarItem}
            onNoPaso={onNoPasoItem}
          />
          <div className={styles.movFooter}>
            <div className={styles.movFooterTotals}>
              <span>
                <span className={styles.movFooterLbl}>Mostrando</span>
                {items.length} de {filtered.length}
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
          </div>
        </div>
      </div>

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
