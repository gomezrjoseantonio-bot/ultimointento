import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Activity,
  Building2,
  CheckCircle2,
  Circle,
  X,
  Plus,
  RefreshCw,
  Briefcase,
  Home,
  User,
  Coins,
  BarChart2,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateDDMMYYYY } from '../../utils/formatUtils';
import { initDB } from '../../services/db';
import type { Account as DBAccount } from '../../services/db';
import { generateMonthlyForecasts } from '../../modules/horizon/tesoreria/services/treasurySyncService';
import { rollForwardAccountBalancesToMonth } from '../../services/accountBalanceService';
import { prestamosService } from '../../services/prestamosService';
import { cuentasService } from '../../services/cuentasService';
import './treasury-reconciliation.css';

/**
 * TreasuryEvent – view-model para el punteo mensual.
 * status 'previsto'   → solo cuenta en el sumatorio "Previsto".
 * status 'confirmado' → cuenta también en el sumatorio "Real".
 */
export interface TreasuryEvent {
  id: string;
  dbId?: number;
  accountId: string;
  concept: string;
  amount: number;
  date: string;
  type: 'income' | 'expense' | 'financing';
  status: 'previsto' | 'confirmado';
  sourceType?: string;
  parentId?: string;
  prestamoId?: string;
  numeroCuota?: number;
  rentalUnitType?: 'vivienda' | 'habitacion';
  rentalPropertyAlias?: string;
}

type EventListRow =
  | { kind: 'event'; event: TreasuryEvent; nested?: boolean }
  | { kind: 'rental-group'; groupId: string; propertyAlias: string; events: TreasuryEvent[] };

interface SimpleAccount {
  id: string;
  dbId: number;
  name: string;
  type: 'bank' | 'cash' | 'wallet';
  balance: number;
}

interface CardSettlementConfig {
  chargeAccountId: number;
}

const toNumericId = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

interface DesgloseLine {
  label: string;
  previsto: number;
  real: number;
}

interface GroupedDesglose {
  ingresos: DesgloseLine[];
  gastos: DesgloseLine[];
  financiacion: DesgloseLine[];
}

interface NewMovementForm {
  concept: string;
  amount: string;
  accountId: string;
  date: string;
  type: 'income' | 'expense';
}

const DEFAULT_NEW_MOVEMENT: NewMovementForm = {
  concept: '',
  amount: '',
  accountId: '',
  date: new Date().toISOString().substring(0, 10),
  type: 'expense',
};

const dbStatusToLocal = (s: string): 'previsto' | 'confirmado' =>
  s === 'predicted' ? 'previsto' : 'confirmado';

const getAccountType = (acc: DBAccount): 'bank' | 'cash' | 'wallet' => {
  const name = (acc.alias || acc.banco?.name || acc.name || '').toLowerCase();
  if (name.includes('metal') || name.includes('cash') || name.includes('efectivo')) return 'cash';
  if (name.includes('revolut') || name.includes('wallet') || name.includes('paypal')) return 'wallet';
  return 'bank';
};

/** Inline style for the letter-circle icon in bank filter pills */
const LETTER_ICON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: '50%',
  backgroundColor: '#f3f4f6',
  color: '#4b5563',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
  flexShrink: 0,
};

/** Semantic icon mapping for each desglose row label */
const DESGLOSE_ICONS: Record<string, React.ElementType> = {
  'Nómina': Briefcase,
  'Ingresos Autónomo': User,
  'Rentas de alquiler': Home,
  'Intereses posiciones': Coins,
  'Ingresos Activos': BarChart2,
  'Gastos Alquiler': Home,
  'Gastos personales': User,
  'Gastos Autónomo': Briefcase,
  'Gastos Activos': Building2,
  'IRPF a pagar': FileText,
  'Cuotas hipotecas': Home,
  'Cuotas préstamos': CreditCard,
};


/**
 * ATLAS HORIZON - Treasury Reconciliation View
 *
 * Dashboard de Control de Tesorería a 3 niveles:
 *   Nivel 1 – Resumen Ejecutivo (4 tarjetas estáticas)
 *   Nivel 2 – Selector Rápido de Bancos (filtro horizontal)
 *   Nivel 3 – Pizarra de Trabajo / Punteo Manual
 *
 * - Conectado a IndexedDB (cuentas y treasuryEvents reales)
 * - Punteo rápido inline (clic en ○ → confirmado, sin modales)
 * - Edición de importe inline con opciones "Ajustar previsión" / "Dejar pendiente"
 * - Botón "+ Movimiento Directo" para movimientos no previstos
 * - Solo iconos Lucide en AZUL ATLAS
 * - NO verde/rojo en valores (ATLAS Design Bible)
 */
const TreasuryReconciliationView: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [accounts, setAccounts] = useState<SimpleAccount[]>([]);
  const [events, setEvents] = useState<TreasuryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'income' | 'expense' | 'financing'>(
    'all',
  );

  // Inline amount editing
  const [editState, setEditState] = useState<{ eventId: string; amount: string } | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // "Ver desglose" inline section
  const [showDesglose, setShowDesglose] = useState(false);

  // "+ Movimiento Directo" modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMovementForm, setNewMovementForm] = useState<NewMovementForm>(DEFAULT_NEW_MOVEMENT);
  const [savingMovement, setSavingMovement] = useState(false);

  // "Generar Previsiones" sync state
  const [syncingForecasts, setSyncingForecasts] = useState(false);
  const [expandedRentalGroups, setExpandedRentalGroups] = useState<Record<string, boolean>>({});

  // Focus amount input when inline editing starts
  useEffect(() => {
    if (editState && amountInputRef.current) {
      amountInputRef.current.focus();
      amountInputRef.current.select();
    }
  }, [editState]);

  /** Load accounts and events from IndexedDB */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      await rollForwardAccountBalancesToMonth(year, month);

      const db = await initDB();
      const [dbAccounts, dbEvents, contracts, properties] = await Promise.all([
        db.getAll('accounts'),
        db.getAll('treasuryEvents'),
        db.getAll('contracts'),
        db.getAll('properties'),
      ]);

      const propertyAliasMap = new Map<number, string>();
      for (const property of properties) {
        if (property.id != null) {
          propertyAliasMap.set(property.id, property.alias ?? `Inmueble ${property.id}`);
        }
      }

      const contractMap = new Map<number, { unidadTipo: 'vivienda' | 'habitacion'; propertyAlias: string }>();
      for (const contract of contracts) {
        if (contract.id == null) continue;
        contractMap.set(contract.id, {
          unidadTipo: contract.unidadTipo,
          propertyAlias: propertyAliasMap.get(contract.inmuebleId) ?? `Inmueble ${contract.inmuebleId}`,
        });
      }

      const cardSettlementByAccountId = new Map<number, CardSettlementConfig>();
      const dbAccountIdSet = new Set<number>(
        dbAccounts
          .map(account => toNumericId(account.id))
          .filter((id): id is number => id != null),
      );

      const localToDbAccountId = new Map<number, number>();
      try {
        const localAccounts = await cuentasService.list();
        for (const localAcc of localAccounts) {
          const localId = toNumericId(localAcc.id);
          if (localId == null || !localAcc.iban) continue;
          const dbMatch = dbAccounts.find(acc => acc.iban === localAcc.iban);
          const dbId = toNumericId(dbMatch?.id);
          if (dbId != null) {
            localToDbAccountId.set(localId, dbId);
          }
        }
      } catch {
        // Ignore mapping failures and keep existing IDs.
      }

      const resolveCanonicalAccountId = (rawId: unknown): number | undefined => {
        const parsedId = toNumericId(rawId);
        if (parsedId == null) return undefined;
        const mappedId = localToDbAccountId.get(parsedId);
        if (mappedId != null) return mappedId;
        if (dbAccountIdSet.has(parsedId)) return parsedId;
        return undefined;
      };

      for (const account of dbAccounts) {
        if (account.id == null) continue;
        if (account.cardConfig?.chargeAccountId != null) {
          cardSettlementByAccountId.set(account.id, {
            chargeAccountId: account.cardConfig.chargeAccountId,
          });
        }
      }

      const simpleAccounts: SimpleAccount[] = dbAccounts
        .filter(a => a.id != null && a.activa !== false && a.status !== 'DELETED' && a.tipo !== 'TARJETA_CREDITO')
        .map(a => ({
          id: String(a.id),
          dbId: a.id as number,
          name: a.alias || a.banco?.name || a.name || `Cuenta ${a.id}`,
          type: getAccountType(a),
          balance: a.balance || 0,
        }));

      const localEvents: TreasuryEvent[] = dbEvents
        .filter(e => {
          const d = new Date(e.predictedDate);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        })
        .map(e => {
          const contractInfo = e.sourceType === 'contrato' && e.sourceId != null
            ? contractMap.get(Number(e.sourceId))
            : undefined;

          const sourceId = toNumericId(e.sourceId);
          const sourceCardConfig = sourceId != null
            ? cardSettlementByAccountId.get(sourceId)
            : undefined;

          const eventAccountId = toNumericId(e.accountId);
          const eventCardConfig = eventAccountId != null
            ? cardSettlementByAccountId.get(eventAccountId)
            : undefined;

          const displayAccountId = sourceCardConfig?.chargeAccountId
            ?? eventCardConfig?.chargeAccountId
            ?? eventAccountId;

          return {
            id: String(e.id),
            dbId: e.id as number,
            accountId: String(displayAccountId ?? ''),
            concept: e.description,
            amount: e.amount,
            date: e.predictedDate,
            type: e.type as 'income' | 'expense' | 'financing',
            status: dbStatusToLocal(e.status),
            sourceType: e.sourceType,
            prestamoId: e.prestamoId,
            numeroCuota: e.numeroCuota,
            rentalUnitType: contractInfo?.unidadTipo,
            rentalPropertyAlias: contractInfo?.propertyAlias,
          };
        });

      setAccounts(simpleAccounts);
      setEvents(localEvents);
    } catch (err) {
      console.error('Error loading treasury data:', err);
      toast.error('Error al cargar datos de tesorería');
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2, 1);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month, 1);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonthYear = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  /** Generate forecast events for the current month from projection rules */
  const handleGenerateForecasts = async () => {
    setSyncingForecasts(true);
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      const result = await generateMonthlyForecasts(year, month);
      if (result.created > 0 || result.updated > 0) {
        const messages: string[] = [];
        if (result.created > 0) {
          messages.push(result.created === 1 ? '1 previsión creada' : `${result.created} previsiones creadas`);
        }
        if (result.updated > 0) {
          messages.push(result.updated === 1 ? '1 previsión actualizada' : `${result.updated} previsiones actualizadas`);
        }
        toast.success(messages.join(' · '));
        await loadData();
      } else {
        toast.success('El mes ya está sincronizado');
      }
    } catch (err) {
      console.error('Error generating forecasts:', err);
      toast.error('Error al generar previsiones');
    } finally {
      setSyncingForecasts(false);
    }
  };

  /**
   * Punteo rápido inline: alterna previsto ↔ confirmado y persiste en DB.
   * Cero modales, cero fricción.
   */
  const handleToggleStatus = async (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const originalStatus = ev.status;
    const newStatus = originalStatus === 'previsto' ? 'confirmado' : 'previsto';
    const dbStatus = newStatus === 'confirmado' ? 'confirmed' : 'predicted';

    // Optimistic update
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: newStatus } : e));

    try {
      if (ev.dbId) {
        const db = await initDB();
        const dbEvent = await db.get('treasuryEvents', ev.dbId);
        if (dbEvent) {
          await db.put('treasuryEvents', {
            ...dbEvent,
            status: dbStatus,
            actualDate: newStatus === 'confirmado' ? new Date().toISOString().substring(0, 10) : undefined,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // If this event belongs to a loan installment, propagate the status to the payment plan
      const isLoanEvent = ev.sourceType === 'hipoteca' || ev.sourceType === 'prestamo';
      if (isLoanEvent && ev.prestamoId && ev.numeroCuota != null) {
        try {
          await prestamosService.marcarCuotaManual(ev.prestamoId, ev.numeroCuota, {
            pagado: newStatus === 'confirmado',
          });
          toast.success(
            newStatus === 'confirmado'
              ? 'Cuota punteada ✓ — Plan de pagos actualizado'
              : 'Punteo retirado — Cuota desmarcada del plan',
          );
        } catch (loanErr) {
          console.error('Error updating payment plan:', loanErr);
          toast.success(newStatus === 'confirmado' ? 'Evento punteado ✓' : 'Punteo retirado');
        }
      } else {
        toast.success(newStatus === 'confirmado' ? 'Evento punteado ✓' : 'Punteo retirado');
      }
    } catch (err) {
      console.error('Error updating event status:', err);
      // Rollback to original status on DB error
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: originalStatus } : e));
      toast.error('Error al actualizar el evento');
    }
  };

  const handleBankFilterClick = (accountId: string) => {
    setSelectedBankFilter(prev => (prev === accountId ? null : accountId));
  };

  /** Start inline amount edit (only for previsto events) */
  const handleAmountClick = (ev: TreasuryEvent) => {
    if (ev.status === 'confirmado') return;
    setEditState({ eventId: ev.id, amount: String(ev.amount) });
  };

  /**
   * "Ajustar previsión": cobra/paga el importe editado y cierra el evento.
   * La previsión original queda finalizada por el nuevo importe.
   */
  const handleAjustarPrevision = async () => {
    if (!editState) return;
    const ev = events.find(e => e.id === editState.eventId);
    if (!ev) return;
    const newAmount = parseFloat(editState.amount);
    if (isNaN(newAmount) || newAmount <= 0) return;

    setEvents(prev => prev.map(e =>
      e.id === editState.eventId ? { ...e, amount: newAmount, status: 'confirmado' } : e
    ));
    setEditState(null);

    try {
      if (ev.dbId) {
        const db = await initDB();
        const dbEvent = await db.get('treasuryEvents', ev.dbId);
        if (dbEvent) {
          await db.put('treasuryEvents', {
            ...dbEvent,
            amount: newAmount,
            status: 'confirmed',
            actualAmount: newAmount,
            actualDate: new Date().toISOString().substring(0, 10),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      toast.success(`Previsión ajustada a ${newAmount} €`);
    } catch (err) {
      console.error('Error adjusting event:', err);
      toast.error('Error al ajustar la previsión');
    }
  };

  /**
   * "Dejar pendiente": cobra/paga parcialmente y crea un evento hijo por la diferencia.
   */
  const handleDejarPendiente = async () => {
    if (!editState) return;
    const ev = events.find(e => e.id === editState.eventId);
    if (!ev) return;
    const paidAmount = parseFloat(editState.amount);
    if (isNaN(paidAmount) || paidAmount <= 0) return;
    const remainingAmount = ev.amount - paidAmount;
    if (remainingAmount <= 0) { handleAjustarPrevision(); return; }

    const tempChildId = `child-${Date.now()}`;
    const childEvent: TreasuryEvent = {
      id: tempChildId,
      accountId: ev.accountId,
      concept: `${ev.concept} (pendiente)`,
      amount: remainingAmount,
      date: ev.date,
      type: ev.type,
      status: 'previsto',
      parentId: ev.id,
    };

    setEvents(prev => [
      ...prev.map(e => e.id === editState.eventId ? { ...e, amount: paidAmount, status: 'confirmado' as const } : e),
      childEvent,
    ]);
    setEditState(null);

    try {
      const db = await initDB();
      if (ev.dbId) {
        const dbEvent = await db.get('treasuryEvents', ev.dbId);
        if (dbEvent) {
          await db.put('treasuryEvents', {
            ...dbEvent,
            amount: paidAmount,
            status: 'confirmed',
            actualAmount: paidAmount,
            actualDate: new Date().toISOString().substring(0, 10),
            updatedAt: new Date().toISOString(),
          });
          const newChildDbId = await db.add('treasuryEvents', {
            type: dbEvent.type,
            amount: remainingAmount,
            predictedDate: dbEvent.predictedDate,
            description: `${dbEvent.description} (pendiente)`,
            sourceType: 'manual' as const,
            sourceId: ev.dbId,
            accountId: dbEvent.accountId,
            status: 'predicted' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setEvents(prev => prev.map(e =>
            e.id === tempChildId ? { ...e, id: String(newChildDbId), dbId: newChildDbId as number } : e
          ));
        }
      }
      toast.success(`${paidAmount} € confirmados · ${remainingAmount} € pendientes`);
    } catch (err) {
      console.error('Error splitting event:', err);
      toast.error('Error al dividir el evento');
    }
  };

  /** "+ Movimiento Directo": guarda un nuevo evento confirmado en DB */
  const handleSaveNewMovement = async () => {
    const amount = parseFloat(newMovementForm.amount);
    if (!newMovementForm.concept.trim() || isNaN(amount) || amount <= 0 || !newMovementForm.date) {
      toast.error('Completa todos los campos');
      return;
    }
    setSavingMovement(true);
    try {
      const db = await initDB();
      const now = new Date().toISOString();
      const rawAccountId = newMovementForm.accountId ? parseInt(newMovementForm.accountId, 10) : undefined;
      const accountId = rawAccountId !== undefined && !isNaN(rawAccountId) ? rawAccountId : undefined;
      const newId = await db.add('treasuryEvents', {
        type: newMovementForm.type as 'income' | 'expense',
        amount,
        predictedDate: newMovementForm.date,
        description: newMovementForm.concept.trim(),
        sourceType: 'manual' as const,
        accountId,
        status: 'confirmed' as const,
        actualDate: newMovementForm.date,
        actualAmount: amount,
        createdAt: now,
        updatedAt: now,
      });

      // Add to local state if the event falls within the current month
      const [year, month] = currentMonth.split('-').map(Number);
      const evDate = new Date(newMovementForm.date);
      if (evDate.getFullYear() === year && evDate.getMonth() + 1 === month) {
        setEvents(prev => [...prev, {
          id: String(newId),
          dbId: newId as number,
          accountId: String(accountId ?? ''),
          concept: newMovementForm.concept.trim(),
          amount,
          date: newMovementForm.date,
          type: newMovementForm.type as 'income' | 'expense',
          status: 'confirmado',
        }]);
      }
      toast.success('Movimiento añadido');
      setShowAddModal(false);
      setNewMovementForm(prev => ({ ...DEFAULT_NEW_MOVEMENT, accountId: prev.accountId }));
    } catch (err) {
      console.error('Error saving new movement:', err);
      toast.error('Error al guardar el movimiento');
    } finally {
      setSavingMovement(false);
    }
  };

  /**
   * Nivel 1 – Totales globales (TODOS los bancos).
   * previsto = suma de todos los eventos del mes.
   * real     = suma solo de eventos 'confirmado'.
   */
  const globalTotals = useMemo(() => {
    const base = {
      ingresos: { previsto: 0, real: 0 },
      gastos: { previsto: 0, real: 0 },
      financiacion: { previsto: 0, real: 0 },
    };
    events.forEach(ev => {
      const key = ev.type === 'income' ? 'ingresos' : ev.type === 'expense' ? 'gastos' : 'financiacion';
      base[key].previsto += ev.amount;
      if (ev.status === 'confirmado') base[key].real += ev.amount;
    });
    return {
      ...base,
      cashflow: {
        previsto: base.ingresos.previsto - base.gastos.previsto - base.financiacion.previsto,
        real: base.ingresos.real - base.gastos.real - base.financiacion.real,
      },
    };
  }, [events]);

  /** Nivel 3 – Eventos filtrados por banco seleccionado, ordenados por fecha y concepto */
  const filteredEvents = useMemo(() => {
    const list = selectedBankFilter ? events.filter(e => e.accountId === selectedBankFilter) : events;
    const listByType =
      selectedTypeFilter === 'all'
        ? list
        : list.filter(e => e.type === selectedTypeFilter);
    return [...listByType].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.concept.localeCompare(b.concept, 'es');
    });
  }, [events, selectedBankFilter, selectedTypeFilter]);

  const selectedBankName = accounts.find(a => a.id === selectedBankFilter)?.name;

  const eventListRows = useMemo<EventListRow[]>(() => {
    const rows: EventListRow[] = [];
    const rentalGroupIndex = new Map<string, number>();

    for (const event of filteredEvents) {
      const shouldGroupRental =
        event.type === 'income' &&
        event.sourceType === 'contrato' &&
        event.rentalUnitType === 'habitacion';

      if (!shouldGroupRental) {
        rows.push({ kind: 'event', event });
        continue;
      }

      const groupId = `${event.rentalPropertyAlias ?? 'Sin inmueble'}|${event.accountId}|${event.date}`;
      const existingIdx = rentalGroupIndex.get(groupId);
      if (existingIdx == null) {
        rentalGroupIndex.set(groupId, rows.length);
        rows.push({
          kind: 'rental-group',
          groupId,
          propertyAlias: event.rentalPropertyAlias ?? 'Sin inmueble',
          events: [event],
        });
      } else {
        const existing = rows[existingIdx];
        if (existing.kind === 'rental-group') {
          existing.events.push(event);
        }
      }
    }

    return rows;
  }, [filteredEvents]);

  const formatAmount = (value: number): string =>
    value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Format amount with 2 decimal places in Spanish locale: "1.302,59 €" */
  const formatDesglose = (v: number): string => `${formatAmount(v)} €`;

  /** Build desglose breakdown grouped into fixed categories */
  const buildGroupedDesglose = (evList: TreasuryEvent[]): GroupedDesglose => {
    const inc: DesgloseLine[] = [
      { label: 'Nómina', previsto: 0, real: 0 },
      { label: 'Ingresos Autónomo', previsto: 0, real: 0 },
      { label: 'Rentas de alquiler', previsto: 0, real: 0 },
      { label: 'Intereses posiciones', previsto: 0, real: 0 },
      { label: 'Ingresos Activos', previsto: 0, real: 0 },
    ];
    const exp: DesgloseLine[] = [
      { label: 'Gastos Alquiler', previsto: 0, real: 0 },
      { label: 'Gastos personales', previsto: 0, real: 0 },
      { label: 'Gastos Autónomo', previsto: 0, real: 0 },
      { label: 'Gastos Activos', previsto: 0, real: 0 },
      { label: 'IRPF a pagar', previsto: 0, real: 0 },
    ];
    const fin: DesgloseLine[] = [
      { label: 'Cuotas hipotecas', previsto: 0, real: 0 },
      { label: 'Cuotas préstamos', previsto: 0, real: 0 },
    ];

    for (const ev of evList) {
      const isReal = ev.status === 'confirmado';
      const c = ev.concept.toLowerCase();
      let line: DesgloseLine | undefined;

      if (ev.type === 'income') {
        if (ev.sourceType === 'nomina') line = inc[0];
        // 'contrato' sourceType comes from rental contracts (alquiler)
        else if (ev.sourceType === 'contrato' || c.includes('renta') || c.includes('alquiler')) line = inc[2];
        else if (ev.sourceType === 'inversion' || c.includes('inter') || c.includes('cupón') || c.includes('cupon') || c.includes('dividendo')) line = inc[3];
        else if (c.includes('venta')) line = inc[4];
        else if (ev.sourceType === 'autonomo_ingreso' || c.includes('freelance') || c.includes('autónom') || c.includes('autonom')) line = inc[1];
        else if (ev.sourceType === 'otros_ingresos') line = inc[4];
        else line = inc[0]; // fallback: bucket unclassified income with Nómina
      } else if (ev.type === 'expense') {
        if (ev.sourceType === 'opex_rule') line = exp[0];
        else if (c.includes('irpf') || c.includes('retenci')) line = exp[4];
        else if (c.includes('venta')) line = exp[3];
        else if (ev.sourceType === 'autonomo' || c.includes('freelance') || c.includes('autónom') || c.includes('autonom')) line = exp[2];
        else if (ev.sourceType === 'gasto_recurrente') line = exp[1];
        else line = exp[1]; // fallback: bucket unclassified expenses with Gastos personales
      } else if (ev.type === 'financing') {
        line = (ev.sourceType === 'hipoteca' || c.includes('hipotec')) ? fin[0] : fin[1];
      }

      if (line) {
        line.previsto += ev.amount;
        if (isReal) line.real += ev.amount;
      }
    }

    return { ingresos: inc, gastos: exp, financiacion: fin };
  };

  return (
    <div className="treasury-view-decision">
      {/* Header con título y navegación de mes */}
      <div className="treasury-decision-header">
        <h1 className="treasury-decision-title">Conciliación mensual</h1>
        <div className="treasury-decision-controls">
          <button
            className="treasury-decision-nav-button"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="treasury-decision-month-text">
            {formatMonthYear(currentMonth)}
          </span>
          <button
            className="treasury-decision-nav-button"
            onClick={handleNextMonth}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={20} />
          </button>
          <button
            className="treasury-decision-sync-button"
            onClick={handleGenerateForecasts}
            disabled={syncingForecasts}
            aria-label="Generar previsiones del mes"
            title="Sincronizar previsiones del mes desde el motor de proyecciones"
          >
            <RefreshCw size={16} className={syncingForecasts ? 'treasury-decision-sync-button__icon--spinning' : ''} />
            {syncingForecasts ? 'Sincronizando…' : 'Generar previsiones'}
          </button>
        </div>
      </div>

      {/* ── NIVEL 1: Resumen Ejecutivo – panel unificado compacto ────── */}
      <div className="summary-panel-unified">
        <div className="summary-panel-row">
          {/* Ingresos */}
          <div className="summary-panel-col">
            <div className="summary-panel-col__hd">
              <TrendingUp className="summary-panel-col__icon" size={14} />
              <span className="summary-panel-col__title">Ingresos</span>
            </div>
            <div className="summary-panel-col__val">
              {formatAmount(globalTotals.ingresos.previsto)} € / {formatAmount(globalTotals.ingresos.real)} €
            </div>
            <div className="summary-panel-col__lbl">PREV. / REAL</div>
            <div className="summary-panel-col__bar">
              <div
                className="summary-panel-col__bar-fill"
                style={{ width: `${Math.min(100, globalTotals.ingresos.previsto !== 0 ? Math.abs(globalTotals.ingresos.real / globalTotals.ingresos.previsto) * 100 : (globalTotals.ingresos.real !== 0 ? 100 : 0))}%` }}
              />
            </div>
          </div>
          <div className="summary-panel-sep" />

          {/* Gastos */}
          <div className="summary-panel-col">
            <div className="summary-panel-col__hd">
              <TrendingDown className="summary-panel-col__icon" size={14} />
              <span className="summary-panel-col__title">Gastos</span>
            </div>
            <div className="summary-panel-col__val">
              {formatAmount(globalTotals.gastos.previsto)} € / {formatAmount(globalTotals.gastos.real)} €
            </div>
            <div className="summary-panel-col__lbl">PREV. / REAL</div>
            <div className="summary-panel-col__bar">
              <div
                className="summary-panel-col__bar-fill"
                style={{ width: `${Math.min(100, globalTotals.gastos.previsto !== 0 ? Math.abs(globalTotals.gastos.real / globalTotals.gastos.previsto) * 100 : (globalTotals.gastos.real !== 0 ? 100 : 0))}%` }}
              />
            </div>
          </div>
          <div className="summary-panel-sep" />

          {/* Financiación */}
          <div className="summary-panel-col">
            <div className="summary-panel-col__hd">
              <CreditCard className="summary-panel-col__icon" size={14} />
              <span className="summary-panel-col__title">Financiación</span>
            </div>
            <div className="summary-panel-col__val">
              {formatAmount(globalTotals.financiacion.previsto)} € / {formatAmount(globalTotals.financiacion.real)} €
            </div>
            <div className="summary-panel-col__lbl">PREV. / REAL</div>
            <div className="summary-panel-col__bar">
              <div
                className="summary-panel-col__bar-fill"
                style={{ width: `${Math.min(100, globalTotals.financiacion.previsto !== 0 ? Math.abs(globalTotals.financiacion.real / globalTotals.financiacion.previsto) * 100 : (globalTotals.financiacion.real !== 0 ? 100 : 0))}%` }}
              />
            </div>
          </div>
          <div className="summary-panel-sep" />

          {/* Cashflow */}
          <div className="summary-panel-col">
            <div className="summary-panel-col__hd">
              <Activity className="summary-panel-col__icon" size={14} />
              <span className="summary-panel-col__title">Cashflow</span>
            </div>
            <div className="summary-panel-col__val">
              {formatAmount(globalTotals.cashflow.previsto)} € / {formatAmount(globalTotals.cashflow.real)} €
            </div>
            <div className="summary-panel-col__lbl">PREV. / REAL</div>
            <div className="summary-panel-col__bar">
              <div
                className="summary-panel-col__bar-fill"
                style={{ width: `${Math.min(100, globalTotals.cashflow.previsto !== 0 ? Math.abs(globalTotals.cashflow.real / globalTotals.cashflow.previsto) * 100 : (globalTotals.cashflow.real !== 0 ? 100 : 0))}%` }}
              />
            </div>
          </div>
        </div>
        <div className="summary-panel-footer">
          <button
            className="summary-panel-desglose-btn"
            onClick={() => setShowDesglose(p => !p)}
          >
            {showDesglose ? 'Ocultar desglose' : 'Ver desglose'}
          </button>
        </div>
      </div>

      {/* ── Desglose inline – agrupado por categorías ─────────────────── */}
      {showDesglose && (() => {
        const grouped = buildGroupedDesglose(events);
        const renderGroup = (title: string, GroupIcon: React.ElementType, lines: DesgloseLine[]) => (
          <div className="desglose-inline__group">
            <div className="desglose-inline__group-header">
              <GroupIcon size={16} className="desglose-inline__group-icon" />
              <span className="desglose-inline__group-title">{title}</span>
            </div>
            {lines.map(line => {
              const RowIcon = DESGLOSE_ICONS[line.label] ?? Activity;
              return (
                <div key={line.label} className="desglose-inline__row">
                  <RowIcon size={14} className="desglose-inline__row-icon" />
                  <span className="desglose-inline__row-label">{line.label}</span>
                  <span className="desglose-inline__row-values">
                    {formatDesglose(line.previsto)} / {formatDesglose(line.real)}
                  </span>
                </div>
              );
            })}
          </div>
        );
        return (
          <div className="desglose-inline">
            <div className="desglose-inline__header">
              <span className="desglose-inline__title">Desglose del mes — Previsto / Real</span>
              <button
                className="desglose-inline__close"
                onClick={() => setShowDesglose(false)}
                aria-label="Cerrar desglose"
              >
                <X size={16} />
              </button>
            </div>
            <div className="desglose-inline__groups">
              {renderGroup('Ingresos', TrendingUp, grouped.ingresos)}
              {renderGroup('Gastos', TrendingDown, grouped.gastos)}
              {renderGroup('Financiación', CreditCard, grouped.financiacion)}
            </div>
          </div>
        );
      })()}

      {/* ── NIVEL 2: Selector Rápido de Bancos ────────────────────────── */}
      <div className="bank-filter-strip" role="group" aria-label="Filtro por banco">
        {loading ? (
          <span className="bank-filter-strip__msg">Cargando cuentas…</span>
        ) : accounts.length === 0 ? (
          <span className="bank-filter-strip__msg">Sin cuentas configuradas</span>
        ) : (
          accounts.map(account => {
            const isActive = selectedBankFilter === account.id;
            const acctEvents = events.filter(e => e.accountId !== '' && e.accountId === account.id);
            const acctNetPrevisto = account.balance + acctEvents.reduce((sum, e) =>
              e.type === 'income' ? sum + e.amount : sum - e.amount, 0);
            const acctNetReal = account.balance + acctEvents
              .filter(e => e.status === 'confirmado')
              .reduce((sum, e) => e.type === 'income' ? sum + e.amount : sum - e.amount, 0);
            return (
              <button
                key={account.id}
                className={`bank-filter-card${isActive ? ' bank-filter-card--active' : ''}`}
                onClick={() => handleBankFilterClick(account.id)}
                aria-pressed={isActive}
                title={`Filtrar por ${account.name}`}
              >
                <span style={LETTER_ICON_STYLE}>
                  {account.name.charAt(0).toUpperCase()}
                </span>
                <span className="bank-filter-card__name">{account.name}</span>
                <span className="bank-filter-card__saldo">{formatAmount(acctNetPrevisto)} € / {formatAmount(acctNetReal)} €</span>
              </button>
            );
          })
        )}
      </div>

      {/* ── NIVEL 3: Pizarra de Trabajo – Punteo Manual ───────────────── */}
      <div className="events-panel">
        <div className="events-panel__header">
          <h2 className="events-panel__title">
            {selectedBankFilter ? `Eventos — ${selectedBankName}` : 'Todos los eventos previstos'}
          </h2>
          <div className="events-panel__header-right">
            <div className="events-type-pills" role="group" aria-label="Filtrar movimientos por tipo">
              <button
                className={`events-type-pill${selectedTypeFilter === 'all' ? ' events-type-pill--active' : ''}`}
                onClick={() => setSelectedTypeFilter('all')}
                aria-pressed={selectedTypeFilter === 'all'}
              >
                Todas
              </button>
              <button
                className={`events-type-pill${selectedTypeFilter === 'income' ? ' events-type-pill--active' : ''}`}
                onClick={() => setSelectedTypeFilter('income')}
                aria-pressed={selectedTypeFilter === 'income'}
              >
                Ingresos
              </button>
              <button
                className={`events-type-pill${selectedTypeFilter === 'expense' ? ' events-type-pill--active' : ''}`}
                onClick={() => setSelectedTypeFilter('expense')}
                aria-pressed={selectedTypeFilter === 'expense'}
              >
                Gastos
              </button>
              <button
                className={`events-type-pill${selectedTypeFilter === 'financing' ? ' events-type-pill--active' : ''}`}
                onClick={() => setSelectedTypeFilter('financing')}
                aria-pressed={selectedTypeFilter === 'financing'}
              >
                Financiación
              </button>
            </div>
            <span className="events-panel__count">
              {filteredEvents.filter(e => e.status === 'confirmado').length} / {filteredEvents.length} punteados
            </span>
            <button
              className="events-panel__add-btn"
              onClick={() => {
                setNewMovementForm({ ...DEFAULT_NEW_MOVEMENT, accountId: selectedBankFilter || '' });
                setShowAddModal(true);
              }}
            >
              <Plus size={14} />
              Movimiento directo
            </button>
          </div>
        </div>

        <div className="events-list">
          {loading ? (
            <div className="events-list__empty">Cargando eventos…</div>
          ) : filteredEvents.length === 0 ? (
            <div className="events-list__empty">Sin eventos para este periodo</div>
          ) : (
            eventListRows.map(row => {
              if (row.kind === 'rental-group') {
                const isExpanded = !!expandedRentalGroups[row.groupId];
                const totalAmount = row.events.reduce((sum, ev) => sum + ev.amount, 0);
                const confirmedCount = row.events.filter(ev => ev.status === 'confirmado').length;
                const allConfirmed = confirmedCount === row.events.length;

                return (
                  <React.Fragment key={row.groupId}>
                    <div className={`event-item event-item--group${allConfirmed ? ' event-item--confirmed' : ''}`}>
                      <button
                        className="event-group-toggle"
                        onClick={() => setExpandedRentalGroups(prev => ({ ...prev, [row.groupId]: !prev[row.groupId] }))}
                        aria-label={isExpanded ? 'Ocultar rentas individuales' : 'Mostrar rentas individuales'}
                        title={isExpanded ? 'Ocultar rentas individuales' : 'Mostrar rentas individuales'}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <Home size={16} className="event-item__type-icon" />
                      <span className="event-item__concept">Rentas alquiler — {row.propertyAlias}</span>
                      <span className="event-item__date">{formatDateDDMMYYYY(row.events[0].date)}</span>
                      <span className="event-item__amount">{formatAmount(totalAmount)} €</span>
                      <span className={`event-item__status${allConfirmed ? ' event-item__status--confirmed' : ''}`}>
                        {confirmedCount}/{row.events.length} punteados
                      </span>
                    </div>

                    {isExpanded && row.events.map(event => {
                      const isConfirmed = event.status === 'confirmado';
                      const isEditing = editState?.eventId === event.id;
                      return (
                        <div
                          key={event.id}
                          className={`event-item event-item--nested${isConfirmed ? ' event-item--confirmed' : ''}`}
                        >
                          <button
                            className={`event-toggle-btn${isConfirmed ? ' event-toggle-btn--confirmed' : ''}`}
                            onClick={() => handleToggleStatus(event.id)}
                            aria-label={isConfirmed ? 'Quitar punteo' : 'Puntear como visto en banco'}
                            title={isConfirmed ? 'Quitar punteo' : 'Puntear como visto en banco'}
                          >
                            {isConfirmed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </button>

                          <TrendingUp size={16} className="event-item__type-icon" />
                          <span className="event-item__concept">{event.concept}</span>
                          <span className="event-item__date">{formatDateDDMMYYYY(event.date)}</span>

                          {isEditing ? (
                            <>
                              <input
                                ref={amountInputRef}
                                className="event-item__amount-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={editState.amount}
                                onChange={e => setEditState(prev => prev ? { ...prev, amount: e.target.value } : null)}
                                onKeyDown={e => { if (e.key === 'Escape') setEditState(null); }}
                                aria-label="Importe editado"
                              />
                              <div className="event-item__inline-actions">
                                <button className="event-item__inline-btn" onClick={handleAjustarPrevision} title="Confirmar este importe; la previsión original queda finalizada">Ajustar previsión</button>
                                <button className="event-item__inline-btn event-item__inline-btn--pending" onClick={handleDejarPendiente} title="Confirmar este importe y crear un evento pendiente por la diferencia">Dejar pendiente</button>
                                <button className="event-item__inline-btn event-item__inline-btn--cancel" onClick={() => setEditState(null)} aria-label="Cancelar edición"><X size={12} /></button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span
                                className={`event-item__amount${!isConfirmed ? ' event-item__amount--editable' : ''}`}
                                onClick={() => !isConfirmed && handleAmountClick(event)}
                                title={!isConfirmed ? 'Clic para editar el importe' : undefined}
                                role={!isConfirmed ? 'button' : undefined}
                                tabIndex={!isConfirmed ? 0 : undefined}
                                onKeyDown={!isConfirmed ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAmountClick(event); } } : undefined}
                              >
                                {formatAmount(event.amount)} €
                              </span>
                              <span className={`event-item__status${isConfirmed ? ' event-item__status--confirmed' : ''}`}>
                                {isConfirmed ? 'Confirmado' : 'Previsto'}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              }

              const event = row.event;
              const isConfirmed = event.status === 'confirmado';
              const isEditing = editState?.eventId === event.id;
              const EventTypeIcon =
                event.type === 'income' ? TrendingUp :
                event.type === 'expense' ? TrendingDown : CreditCard;
              return (
                <div
                  key={event.id}
                  className={`event-item${isConfirmed ? ' event-item--confirmed' : ''}`}
                >
                  {/* Quick check button */}
                  <button
                    className={`event-toggle-btn${isConfirmed ? ' event-toggle-btn--confirmed' : ''}`}
                    onClick={() => handleToggleStatus(event.id)}
                    aria-label={isConfirmed ? 'Quitar punteo' : 'Puntear como visto en banco'}
                    title={isConfirmed ? 'Quitar punteo' : 'Puntear como visto en banco'}
                  >
                    {isConfirmed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>

                  <EventTypeIcon size={16} className="event-item__type-icon" />
                  <span className="event-item__concept">{event.concept}</span>
                  <span className="event-item__date">{formatDateDDMMYYYY(event.date)}</span>

                  {/* Inline amount editing */}
                  {isEditing ? (
                    <>
                      <input
                        ref={amountInputRef}
                        className="event-item__amount-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editState.amount}
                        onChange={e => setEditState(prev => prev ? { ...prev, amount: e.target.value } : null)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditState(null); }}
                        aria-label="Importe editado"
                      />
                      <div className="event-item__inline-actions">
                        <button
                          className="event-item__inline-btn"
                          onClick={handleAjustarPrevision}
                          title="Confirmar este importe; la previsión original queda finalizada"
                        >
                          Ajustar previsión
                        </button>
                        <button
                          className="event-item__inline-btn event-item__inline-btn--pending"
                          onClick={handleDejarPendiente}
                          title="Confirmar este importe y crear un evento pendiente por la diferencia"
                        >
                          Dejar pendiente
                        </button>
                        <button
                          className="event-item__inline-btn event-item__inline-btn--cancel"
                          onClick={() => setEditState(null)}
                          aria-label="Cancelar edición"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        className={`event-item__amount${!isConfirmed ? ' event-item__amount--editable' : ''}`}
                        onClick={() => !isConfirmed && handleAmountClick(event)}
                        title={!isConfirmed ? 'Clic para editar el importe' : undefined}
                        role={!isConfirmed ? 'button' : undefined}
                        tabIndex={!isConfirmed ? 0 : undefined}
                        onKeyDown={!isConfirmed ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAmountClick(event); } } : undefined}
                      >
                        {event.type !== 'income' && '−\u202F'}{formatAmount(event.amount)} €
                      </span>
                      <span className={`event-item__status${isConfirmed ? ' event-item__status--confirmed' : ''}`}>
                        {isConfirmed ? 'Confirmado' : 'Previsto'}
                      </span>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Modal "+ Movimiento Directo" ───────────────────────────────── */}
      {showAddModal && (
        <div className="add-movement-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="add-movement-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Añadir movimiento directo">
            <div className="add-movement-modal__header">
              <h3 className="add-movement-modal__title">Movimiento directo</h3>
              <button className="add-movement-modal__close" onClick={() => setShowAddModal(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="add-movement-modal__field">
              <label className="add-movement-modal__label">Concepto</label>
              <input
                className="add-movement-modal__input"
                type="text"
                placeholder="Ej: Comisión bancaria"
                value={newMovementForm.concept}
                onChange={e => setNewMovementForm(p => ({ ...p, concept: e.target.value }))}
              />
            </div>

            <div className="add-movement-modal__field">
              <label className="add-movement-modal__label">Tipo</label>
              <select
                className="add-movement-modal__select"
                value={newMovementForm.type}
                onChange={e => setNewMovementForm(p => ({ ...p, type: e.target.value as 'income' | 'expense' }))}
              >
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>

            <div className="add-movement-modal__field">
              <label className="add-movement-modal__label">Importe (€)</label>
              <input
                className="add-movement-modal__input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={newMovementForm.amount}
                onChange={e => setNewMovementForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>

            <div className="add-movement-modal__field">
              <label className="add-movement-modal__label">Cuenta</label>
              <select
                className="add-movement-modal__select"
                value={newMovementForm.accountId}
                onChange={e => setNewMovementForm(p => ({ ...p, accountId: e.target.value }))}
              >
                <option value="">Sin cuenta específica</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="add-movement-modal__field">
              <label className="add-movement-modal__label">Fecha</label>
              <input
                className="add-movement-modal__input"
                type="date"
                value={newMovementForm.date}
                onChange={e => setNewMovementForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>

            <div className="add-movement-modal__footer">
              <button className="add-movement-modal__btn add-movement-modal__btn--secondary" onClick={() => setShowAddModal(false)}>
                Cancelar
              </button>
              <button
                className="add-movement-modal__btn add-movement-modal__btn--primary"
                onClick={handleSaveNewMovement}
                disabled={savingMovement}
              >
                {savingMovement ? 'Guardando…' : 'Confirmar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasuryReconciliationView;
