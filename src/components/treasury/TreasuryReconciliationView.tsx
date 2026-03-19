import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Activity,
  CheckCircle2,
  Circle,
  X,
  Plus,
  RefreshCw,
  Home,
  AlertTriangle,
  MoreHorizontal,
  Calendar,
  Landmark,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeText } from '../../utils/normalizeText';
import { initDB } from '../../services/db';
import type { Account as DBAccount } from '../../services/db';
import { generateMonthlyForecasts } from '../../modules/horizon/tesoreria/services/treasurySyncService';
import { calculateAccountBalanceAtDate } from '../../services/accountBalanceService';
import { prestamosService } from '../../services/prestamosService';
import { finalizePropertySaleLoanCancellationFromTreasuryEvent } from '../../services/propertySaleService';
import { calculateAccountTreasurySummary } from './treasuryBalanceSummary';
import './treasury-reconciliation.css';

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

interface DisplayAccountResolverInput {
  eventAccountId?: number;
  eventSourceId?: number;
  sourceType?: string;
  cardSettlementByAccountId: Map<number, CardSettlementConfig>;
}

const toNumericId = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export const resolveDisplayAccountId = ({
  eventAccountId,
  eventSourceId,
  sourceType,
  cardSettlementByAccountId,
}: DisplayAccountResolverInput): number | undefined => {
  const eventCardConfig = eventAccountId != null
    ? cardSettlementByAccountId.get(eventAccountId)
    : undefined;
  const sourceCardConfig =
    eventAccountId == null &&
    sourceType === 'personal_expense' &&
    eventSourceId != null
      ? cardSettlementByAccountId.get(eventSourceId)
      : undefined;
  return eventCardConfig?.chargeAccountId
    ?? sourceCardConfig?.chargeAccountId
    ?? eventAccountId;
};

interface NewMovementForm {
  concept: string;
  amount: string;
  accountId: string;
  targetAccountId: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
}

const DEFAULT_NEW_MOVEMENT: NewMovementForm = {
  concept: '',
  amount: '',
  accountId: '',
  targetAccountId: '',
  date: new Date().toISOString().substring(0, 10),
  type: 'expense',
};

const dbStatusToLocal = (s: string): 'previsto' | 'confirmado' =>
  s === 'predicted' ? 'previsto' : 'confirmado';

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr.includes('/')
    ? dateStr.split('/').reverse().join('-')
    : dateStr
  );
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace('.', '');
}

const getAccountType = (acc: DBAccount): 'bank' | 'cash' | 'wallet' => {
  const name = normalizeText(acc.alias || acc.banco?.name || acc.name || '');
  if (name.includes('metal') || name.includes('cash') || name.includes('efectivo')) return 'cash';
  if (name.includes('revolut') || name.includes('wallet') || name.includes('paypal')) return 'wallet';
  return 'bank';
};

const TreasuryReconciliationView: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [accounts, setAccounts] = useState<SimpleAccount[]>([]);
  const [events, setEvents] = useState<TreasuryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBankFilter, setSelectedBankFilter] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'income' | 'expense' | 'financing'>('all');
  const [editState, setEditState] = useState<{ eventId: string; amount: string } | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMovementForm, setNewMovementForm] = useState<NewMovementForm>(DEFAULT_NEW_MOVEMENT);
  const [savingMovement, setSavingMovement] = useState(false);
  const [syncingForecasts, setSyncingForecasts] = useState(false);
  const [expandedRentalGroups, setExpandedRentalGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (editState && amountInputRef.current) {
      amountInputRef.current.focus();
      amountInputRef.current.select();
    }
  }, [editState]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      const monthStart = `${currentMonth}-01`;

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
      for (const account of dbAccounts) {
        if (account.id == null) continue;
        if (account.cardConfig?.chargeAccountId != null) {
          const config = { chargeAccountId: account.cardConfig.chargeAccountId };
          cardSettlementByAccountId.set(account.id, config);
        }
      }

      const simpleAccounts: SimpleAccount[] = dbAccounts
        .filter(a => a.id != null && a.activa !== false && a.status !== 'DELETED' && a.tipo !== 'TARJETA_CREDITO')
        .map(a => ({
          id: String(a.id),
          dbId: a.id as number,
          name: a.alias || a.banco?.name || a.name || `Cuenta ${a.id}`,
          type: getAccountType(a),
          balance: calculateAccountBalanceAtDate({
            account: a,
            cutoffDate: monthStart,
            treasuryEvents: dbEvents,
            movements: [],
          }),
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
          const eventAccountId = toNumericId(e.accountId);
          const eventSourceId = toNumericId(e.sourceId);
          const displayAccountId = resolveDisplayAccountId({
            eventAccountId,
            eventSourceId,
            sourceType: e.sourceType,
            cardSettlementByAccountId,
          });
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

  useEffect(() => { loadData(); }, [loadData]);

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

  const formatAmount = (value: number): string =>
    value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleGenerateForecasts = async () => {
    setSyncingForecasts(true);
    try {
      const [year, month] = currentMonth.split('-').map(Number);
      const result = await generateMonthlyForecasts(year, month);
      if (result.created > 0 || result.updated > 0) {
        const messages: string[] = [];
        if (result.created > 0) messages.push(`${result.created} previsión${result.created > 1 ? 'es' : ''} creada${result.created > 1 ? 's' : ''}`);
        if (result.updated > 0) messages.push(`${result.updated} previsión${result.updated > 1 ? 'es' : ''} actualizada${result.updated > 1 ? 's' : ''}`);
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

  const handleToggleStatus = async (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    const originalStatus = ev.status;
    const newStatus = originalStatus === 'previsto' ? 'confirmado' : 'previsto';
    const dbStatus = newStatus === 'confirmado' ? 'confirmed' : 'predicted';
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

          if (newStatus === 'confirmado') {
            await finalizePropertySaleLoanCancellationFromTreasuryEvent(ev.dbId);
          }
        }
      }
      const isLoanEvent = ev.sourceType === 'hipoteca' || ev.sourceType === 'prestamo';
      if (isLoanEvent && ev.prestamoId && ev.numeroCuota != null) {
        try {
          await prestamosService.marcarCuotaManual(ev.prestamoId, ev.numeroCuota, { pagado: newStatus === 'confirmado' });
          toast.success(newStatus === 'confirmado' ? 'Cuota punteada ✓ — Plan actualizado' : 'Punteo retirado');
        } catch {
          toast.success(newStatus === 'confirmado' ? 'Evento punteado ✓' : 'Punteo retirado');
        }
      } else {
        toast.success(newStatus === 'confirmado' ? 'Evento punteado ✓' : 'Punteo retirado');
      }
    } catch (err) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: originalStatus } : e));
      toast.error('Error al actualizar el evento');
    }
  };

  const handleBankFilterClick = (accountId: string) => {
    setSelectedBankFilter(prev => (prev === accountId ? null : accountId));
  };

  const handleAllBanksClick = () => {
    setSelectedBankFilter(null);
    setSelectedTypeFilter('all');
  };

  const handleAmountClick = (ev: TreasuryEvent) => {
    if (ev.status === 'confirmado') return;
    setEditState({ eventId: ev.id, amount: String(ev.amount) });
  };

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
            ...dbEvent, amount: newAmount, status: 'confirmed',
            actualAmount: newAmount, actualDate: new Date().toISOString().substring(0, 10),
            updatedAt: new Date().toISOString(),
          });

          await finalizePropertySaleLoanCancellationFromTreasuryEvent(ev.dbId);
        }
      }
      toast.success(`Previsión ajustada a ${newAmount} €`);
    } catch {
      toast.error('Error al ajustar la previsión');
    }
  };

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
      id: tempChildId, accountId: ev.accountId,
      concept: `${ev.concept} (pendiente)`,
      amount: remainingAmount, date: ev.date,
      type: ev.type, status: 'previsto', parentId: ev.id,
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
            ...dbEvent, amount: paidAmount, status: 'confirmed',
            actualAmount: paidAmount, actualDate: new Date().toISOString().substring(0, 10),
            updatedAt: new Date().toISOString(),
          });
          const newChildDbId = await db.add('treasuryEvents', {
            type: dbEvent.type, amount: remainingAmount,
            predictedDate: dbEvent.predictedDate,
            description: `${dbEvent.description} (pendiente)`,
            sourceType: 'manual' as const, sourceId: ev.dbId,
            accountId: dbEvent.accountId, status: 'predicted' as const,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          });
          setEvents(prev => prev.map(e =>
            e.id === tempChildId ? { ...e, id: String(newChildDbId), dbId: newChildDbId as number } : e
          ));
        }
      }
      toast.success(`${paidAmount} € confirmados · ${remainingAmount} € pendientes`);
    } catch {
      toast.error('Error al dividir el evento');
    }
  };

  const handleSaveNewMovement = async () => {
    const amount = parseFloat(newMovementForm.amount);
    if (isNaN(amount) || amount <= 0 || !newMovementForm.date) {
      toast.error('Completa todos los campos'); return;
    }
    const rawAccountId = newMovementForm.accountId ? parseInt(newMovementForm.accountId, 10) : undefined;
    const accountId = rawAccountId !== undefined && !isNaN(rawAccountId) ? rawAccountId : undefined;
    const rawTargetAccountId = newMovementForm.targetAccountId ? parseInt(newMovementForm.targetAccountId, 10) : undefined;
    const targetAccountId = rawTargetAccountId !== undefined && !isNaN(rawTargetAccountId) ? rawTargetAccountId : undefined;

    if (newMovementForm.type === 'transfer') {
      if (!accountId || !targetAccountId) { toast.error('Selecciona cuenta origen y destino'); return; }
      if (accountId === targetAccountId) { toast.error('La cuenta origen y destino deben ser diferentes'); return; }
    } else {
      if (!newMovementForm.concept.trim()) { toast.error('Completa todos los campos'); return; }
    }

    setSavingMovement(true);
    try {
      const db = await initDB();
      const now = new Date().toISOString();
      const baseConcept = newMovementForm.concept.trim();
      if (newMovementForm.type === 'transfer') {
        const fromAccount = accounts.find(a => a.id === String(accountId));
        const toAccount = accounts.find(a => a.id === String(targetAccountId));
        const sourceConcept = baseConcept || `Transferencia a ${toAccount?.name ?? 'cuenta destino'}`;
        const targetConcept = baseConcept || `Transferencia desde ${fromAccount?.name ?? 'cuenta origen'}`;
        const [fromId, toId] = await Promise.all([
          db.add('treasuryEvents', { type: 'expense' as const, amount, predictedDate: newMovementForm.date, description: sourceConcept, sourceType: 'manual' as const, accountId, status: 'confirmed' as const, actualDate: newMovementForm.date, actualAmount: amount, createdAt: now, updatedAt: now }),
          db.add('treasuryEvents', { type: 'income' as const, amount, predictedDate: newMovementForm.date, description: targetConcept, sourceType: 'manual' as const, accountId: targetAccountId, status: 'confirmed' as const, actualDate: newMovementForm.date, actualAmount: amount, createdAt: now, updatedAt: now }),
        ]);
        const [year, month] = currentMonth.split('-').map(Number);
        const evDate = new Date(newMovementForm.date);
        if (evDate.getFullYear() === year && evDate.getMonth() + 1 === month) {
          setEvents(prev => ([...prev,
            { id: String(fromId), dbId: fromId as number, accountId: String(accountId), concept: sourceConcept, amount, date: newMovementForm.date, type: 'expense', status: 'confirmado' },
            { id: String(toId), dbId: toId as number, accountId: String(targetAccountId), concept: targetConcept, amount, date: newMovementForm.date, type: 'income', status: 'confirmado' },
          ]));
        }
        toast.success('Transferencia creada');
      } else {
        const eventType: 'income' | 'expense' = newMovementForm.type;
        const newId = await db.add('treasuryEvents', { type: eventType, amount, predictedDate: newMovementForm.date, description: baseConcept, sourceType: 'manual' as const, accountId, status: 'confirmed' as const, actualDate: newMovementForm.date, actualAmount: amount, createdAt: now, updatedAt: now });
        const [year, month] = currentMonth.split('-').map(Number);
        const evDate = new Date(newMovementForm.date);
        if (evDate.getFullYear() === year && evDate.getMonth() + 1 === month) {
          setEvents(prev => [...prev, { id: String(newId), dbId: newId as number, accountId: String(accountId ?? ''), concept: baseConcept, amount, date: newMovementForm.date, type: eventType, status: 'confirmado' }]);
        }
        toast.success('Movimiento añadido');
      }
      setShowAddModal(false);
      setNewMovementForm(prev => ({ ...DEFAULT_NEW_MOVEMENT, accountId: prev.accountId, targetAccountId: '' }));
    } catch {
      toast.error('Error al guardar el movimiento');
    } finally {
      setSavingMovement(false);
    }
  };

  // ─── COMPUTED ──────────────────────────────────────────────────────────────

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

  const filteredEvents = useMemo(() => {
    const list = selectedBankFilter ? events.filter(e => e.accountId === selectedBankFilter) : events;
    const listByType = selectedTypeFilter === 'all' ? list : list.filter(e => e.type === selectedTypeFilter);
    return [...listByType].sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.concept.localeCompare(b.concept, 'es');
    });
  }, [events, selectedBankFilter, selectedTypeFilter]);

  const selectedBankName = accounts.find(a => a.id === selectedBankFilter)?.name;

  const accountBreakdown = useMemo(() => {
    const today = new Date();

    return new Map(accounts.map(account => {
      const acctEvents = events.filter(e => e.accountId !== '' && e.accountId === account.id);
      const summary = calculateAccountTreasurySummary({
        account: { id: account.id, balance: account.balance },
        events: acctEvents,
        selectedMonth: currentMonth,
        today,
      });

      const ingresosPrevistos = acctEvents.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const ingresosReales = acctEvents.filter(e => e.type === 'income' && e.status === 'confirmado').reduce((s, e) => s + e.amount, 0);
      const gastosPrevistos = acctEvents.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
      const gastosReales = acctEvents.filter(e => e.type !== 'income' && e.status === 'confirmado').reduce((s, e) => s + e.amount, 0);

      return [account.id, {
        ingresosPrevistos,
        ingresosReales,
        gastosPrevistos,
        gastosReales,
        hoy: summary.hoy,
        saldoFinalPrevisto: summary.finMes,
        saldoFinalReal: summary.totalPunteado,
        totalPunteado: summary.totalPunteado,
      }] as const;
    }));
  }, [accounts, currentMonth, events]);

  const totalGlobalPunteado = useMemo(() =>
    accounts.reduce((sum, a) => sum + (accountBreakdown.get(a.id)?.totalPunteado ?? a.balance), 0),
    [accounts, accountBreakdown]
  );

  const allBanksSummary = useMemo(() => {
    const totalEvents = events.length;
    const doneEvents = events.filter(e => e.status === 'confirmado').length;
    const pct = totalEvents > 0 ? Math.round((doneEvents / totalEvents) * 100) : 0;
    const hoy = accounts.reduce((sum, account) => sum + (accountBreakdown.get(account.id)?.hoy ?? account.balance), 0);
    const finMes = accounts.reduce((sum, account) => sum + (accountBreakdown.get(account.id)?.saldoFinalPrevisto ?? account.balance), 0);

    return { totalEvents, doneEvents, pct, hoy, finMes };
  }, [accounts, accountBreakdown, events]);

  const totalFiltradoPendiente = useMemo(() =>
    filteredEvents
      .filter(e => e.status !== 'confirmado')
      .reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0),
  [filteredEvents]);

  const eventListRows = useMemo<EventListRow[]>(() => {
    const rows: EventListRow[] = [];
    const rentalGroupIndex = new Map<string, number>();
    for (const event of filteredEvents) {
      const shouldGroupRental = event.type === 'income' && event.sourceType === 'contrato' && event.rentalUnitType === 'habitacion';
      if (!shouldGroupRental) { rows.push({ kind: 'event', event }); continue; }
      const groupId = `${event.rentalPropertyAlias ?? 'Sin inmueble'}|${event.accountId}|${event.date}`;
      const existingIdx = rentalGroupIndex.get(groupId);
      if (existingIdx == null) {
        rentalGroupIndex.set(groupId, rows.length);
        rows.push({ kind: 'rental-group', groupId, propertyAlias: event.rentalPropertyAlias ?? 'Sin inmueble', events: [event] });
      } else {
        const existing = rows[existingIdx];
        if (existing.kind === 'rental-group') existing.events.push(event);
      }
    }
    return rows;
  }, [filteredEvents]);

  // Group rows by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventListRow[]>();
    for (const row of eventListRows) {
      const date = row.kind === 'event' ? row.event.date : (row.events[0]?.date ?? '');
      const key = date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  }, [eventListRows]);

  const pctConciliado = events.length > 0
    ? Math.round((events.filter(e => e.status === 'confirmado').length / events.length) * 100)
    : 0;

  const bankosNegativos = accounts.filter(a => {
    const bd = accountBreakdown.get(a.id);
    return bd && bd.saldoFinalPrevisto < 0;
  });

  // ─── HELPERS FOR ROW RENDER ─────────────────────────────────────────────────

  const today = new Date(new Date().toDateString());

  const renderEventRow = (event: TreasuryEvent, nested = false) => {
    const isConfirmed = event.status === 'confirmado';
    const isEditing = editState?.eventId === event.id;
    const isVencido = event.status === 'previsto' && new Date(event.date) < today;
    const bankName = accounts.find(a => a.id === event.accountId)?.name ?? '';

    const EventTypeIcon =
      event.type === 'income' ? TrendingUp :
      event.type === 'expense' ? TrendingDown : CreditCard;

    return (
      <div
        key={event.id}
        className={[
          'tv3-event-row',
          isConfirmed ? 'tv3-event-row--confirmed' : '',
          isVencido ? 'tv3-event-row--vencido' : '',
          nested ? 'tv3-event-row--nested' : '',
        ].join(' ')}
      >
        {/* Barra lateral urgencia */}
        <div className={`tv3-event-row__bar ${isVencido ? 'tv3-event-row__bar--vencido' : ''}`} />

        {/* Toggle punteo */}
        <button
          className={`tv3-punteo-btn ${isConfirmed ? 'tv3-punteo-btn--done' : ''}`}
          onClick={() => handleToggleStatus(event.id)}
          aria-label={isConfirmed ? 'Quitar punteo' : 'Puntear'}
          title={isConfirmed ? 'Quitar punteo' : 'Marcar como visto en banco'}
        >
          {isConfirmed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>

        {/* Tipo icono */}
        <div className={`tv3-evt-icon tv3-evt-icon--${event.type}`}>
          <EventTypeIcon size={13} />
        </div>

        {/* Concepto + meta */}
        <div className="tv3-event-body">
          <div className="tv3-event-concept">{event.concept}</div>
          <div className="tv3-event-meta">
            {event.sourceType === 'contrato' && (
              <span className="tv3-tag tv3-tag--contrato">Contrato</span>
            )}
            {(event.sourceType === 'hipoteca' || event.sourceType === 'prestamo') && (
              <span className="tv3-tag tv3-tag--hipoteca">
                Hipoteca{event.numeroCuota ? ` · Cuota ${event.numeroCuota}` : ''}
              </span>
            )}
            {event.sourceType === 'manual' && (
              <span className="tv3-tag tv3-tag--manual">Manual</span>
            )}
            {bankName && <span className="tv3-event-bank">{bankName}</span>}
          </div>
        </div>

        {/* Importe */}
        {isEditing ? (
          <>
            <input
              ref={amountInputRef}
              className="tv3-amount-input"
              type="number"
              min="0"
              step="0.01"
              value={editState.amount}
              onChange={e => setEditState(prev => prev ? { ...prev, amount: e.target.value } : null)}
              onKeyDown={e => {
                if (e.key === 'Escape') setEditState(null);
                if (e.key === 'Enter') handleAjustarPrevision();
              }}
              aria-label="Importe editado"
            />
            <div className="tv3-inline-actions">
              <button className="tv3-iab tv3-iab--ok" onClick={handleAjustarPrevision} title="Confirmar este importe">Ajustar previsión</button>
              <button className="tv3-iab tv3-iab--pend" onClick={handleDejarPendiente} title="Confirmar parcialmente">Dejar pendiente</button>
              <button className="tv3-iab tv3-iab--cancel" onClick={() => setEditState(null)} aria-label="Cancelar"><X size={12} /></button>
            </div>
          </>
        ) : (
          <span
            className={`tv3-event-amount ${!isConfirmed ? 'tv3-event-amount--editable' : ''}`}
            onClick={() => !isConfirmed && handleAmountClick(event)}
            title={!isConfirmed ? 'Clic para editar el importe' : undefined}
            role={!isConfirmed ? 'button' : undefined}
            tabIndex={!isConfirmed ? 0 : undefined}
            onKeyDown={!isConfirmed ? e => { if (e.key === 'Enter') handleAmountClick(event); } : undefined}
          >
            {event.type !== 'income' && '−\u202F'}{formatAmount(event.amount)} €
          </span>
        )}

        {/* Estado */}
        <span className={`tv3-estado tv3-estado--${isConfirmed ? 'conf' : isVencido ? 'venc' : 'prev'}`}>
          {isConfirmed ? 'Confirmado' : isVencido ? 'Vencido' : 'Previsto'}
        </span>

        {/* Kebab */}
        <button className="tv3-kebab" aria-label="Más acciones">
          <MoreHorizontal size={14} />
        </button>
      </div>
    );
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="tv3-view">

      {/* ══ TOPBAR ══ */}
      <div className="tv3-topbar">
        <div className="tv3-topbar-left">
          <div className="tv3-page-icon"><Landmark size={18} /></div>
          <div>
            <div className="tv3-page-label">Tesorería</div>
            <div className="tv3-page-sub">Conciliación mensual</div>
          </div>
        </div>
        <div className="tv3-topbar-right">
          <button className="tv3-btn tv3-btn--ghost tv3-btn--sm">
            <Upload size={14} /> Importar CSV
          </button>
          <button className="tv3-btn tv3-btn--ghost tv3-btn--sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Movimiento directo
          </button>
          <button
            className="tv3-btn tv3-btn--primary tv3-btn--sm"
            onClick={handleGenerateForecasts}
            disabled={syncingForecasts}
          >
            <RefreshCw size={14} className={syncingForecasts ? 'tv3-spin' : ''} />
            {syncingForecasts ? 'Sincronizando…' : 'Generar previsiones'}
          </button>
        </div>
      </div>

      <div className="tv3-content">

        {/* ══ ALERTA SALDOS NEGATIVOS ══ */}
        {bankosNegativos.length > 0 && (
          <div className="tv3-alert-banner">
            <AlertTriangle size={16} />
            <span>
              <strong>{bankosNegativos.map(b => b.name).join(' y ')}</strong>
              {' '}cerrarán el mes en negativo. Revisa los movimientos pendientes.
            </span>
          </div>
        )}

        {/* ══ ZONA 1 — MES HERO ══ */}
        <section className="tv3-mes-hero">
          {/* CF Neto */}
          <div className="tv3-hero-cf">
            <div className="tv3-hero-cf-eye">
              <Activity size={10} /> Cashflow neto
            </div>
            <div className="tv3-hero-cf-val">
              {globalTotals.cashflow.previsto >= 0 ? '+' : '−'}
              {formatAmount(Math.abs(globalTotals.cashflow.previsto))} €
            </div>
            <div className="tv3-hero-cf-label">
              Previsto · Real:{' '}
              <span>{globalTotals.cashflow.real >= 0 ? '+' : '−'}{formatAmount(Math.abs(globalTotals.cashflow.real))} €</span>
            </div>
          </div>

          {/* 4 columnas métricas */}
          <div className="tv3-hero-cols">
            {([
              { key: 'ingresos' as const, label: 'Ingresos', Icon: TrendingUp },
              { key: 'gastos' as const, label: 'Gastos', Icon: TrendingDown },
              { key: 'financiacion' as const, label: 'Financiación', Icon: CreditCard },
            ]).map(({ key, label, Icon }) => {
              const pct = globalTotals[key].previsto > 0
                ? Math.min(100, (globalTotals[key].real / globalTotals[key].previsto) * 100)
                : 0;
              return (
                <div className="tv3-hero-col" key={key}>
                  <div className="tv3-hero-col-title"><Icon size={11} /> {label}</div>
                  <div className="tv3-hero-col-prev">{formatAmount(globalTotals[key].previsto)} €</div>
                  <div className="tv3-hero-col-real">{formatAmount(globalTotals[key].real)} €</div>
                  <div className="tv3-hero-col-bar">
                    <div className="tv3-hero-col-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {/* Punteado */}
            <div className="tv3-hero-col">
              <div className="tv3-hero-col-title"><CheckCircle2 size={11} /> Punteado</div>
              <div className="tv3-hero-col-prev">
                {events.filter(e => e.status === 'confirmado').length} / {events.length} mov.
              </div>
              <div className="tv3-hero-col-real tv3-hero-col-real--teal">{pctConciliado}%</div>
              <div className="tv3-hero-col-bar">
                <div className="tv3-hero-col-bar-fill tv3-hero-col-bar-fill--white" style={{ width: `${pctConciliado}%` }} />
              </div>
            </div>
          </div>

          {/* Nav + progreso */}
          <div className="tv3-hero-right">
            <div className="tv3-mes-nav">
              <button className="tv3-mes-nav-btn" onClick={handlePrevMonth} aria-label="Mes anterior">
                <ChevronLeft size={16} />
              </button>
              <span className="tv3-mes-month">{formatMonthYear(currentMonth)}</span>
              <button className="tv3-mes-nav-btn" onClick={handleNextMonth} aria-label="Mes siguiente">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="tv3-concil-wrap">
              <div className="tv3-concil-track">
                <div className="tv3-concil-fill" style={{ width: `${pctConciliado}%` }} />
              </div>
              <span className="tv3-concil-pct">{pctConciliado}%</span>
              <span className="tv3-concil-label">conciliado</span>
            </div>
          </div>
        </section>

        {/* ══ ZONA 2 — BALANCE BANCARIO ══ */}
        <div>
          <div className="tv3-section-head">
            <div className="tv3-section-label"><Landmark size={13} /> Balance bancario</div>
            <div className="tv3-section-meta">
              Total punteado: <strong>{formatAmount(totalGlobalPunteado)} €</strong>
            </div>
          </div>

          <div className="tv3-banks">
            {loading ? (
              <span className="tv3-loading-msg">Cargando cuentas…</span>
            ) : (
              [
                <div
                  key="all-banks"
                  className={[
                    'tv3-bank-chip',
                    'tv3-bank-chip--all',
                    selectedBankFilter === null ? 'tv3-bank-chip--active' : '',
                    allBanksSummary.pct === 100 && allBanksSummary.totalEvents > 0 ? 'tv3-bank-chip--ok' : '',
                    allBanksSummary.finMes < 0 ? 'tv3-bank-chip--warn' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={handleAllBanksClick}
                >
                  <div className="tv3-bank-chip-head">
                    <span className="tv3-bank-name">Todos</span>
                    <span className={`tv3-bank-status ${allBanksSummary.pct === 100 && allBanksSummary.totalEvents > 0 ? 'ok' : allBanksSummary.finMes < 0 ? 'warn' : 'pending'}`}>
                      {allBanksSummary.pct === 100 && allBanksSummary.totalEvents > 0
                        ? <CheckCircle2 size={14} />
                        : allBanksSummary.finMes < 0
                          ? <AlertTriangle size={14} />
                          : <Circle size={14} />
                      }
                    </span>
                  </div>

                  <div className="tv3-bank-amounts">
                    <div className="tv3-bank-hoy">
                      Hoy&nbsp;<span>{formatAmount(allBanksSummary.hoy)} €</span>
                    </div>
                    <div className={`tv3-bank-finmes ${allBanksSummary.finMes < 0 ? 'tv3-bank-finmes--neg' : ''}`}>
                      Fin mes&nbsp;<span>{formatAmount(allBanksSummary.finMes)} €</span>
                    </div>
                  </div>

                  <div className="tv3-bank-track">
                    <div
                      className={[
                        'tv3-bank-fill',
                        allBanksSummary.pct === 100 && allBanksSummary.totalEvents > 0 ? 'tv3-bank-fill--full' : '',
                        allBanksSummary.finMes < 0 ? 'tv3-bank-fill--neg' : 'tv3-bank-fill--blue',
                      ].filter(Boolean).join(' ')}
                      style={{ width: `${Math.min(allBanksSummary.pct, 100)}%` }}
                    />
                  </div>

                  <span className={`tv3-bank-badge ${allBanksSummary.pct === 100 && allBanksSummary.totalEvents > 0 ? 'tv3-bank-badge--done' : 'tv3-bank-badge--pend'}`}>
                    {allBanksSummary.pct === 100 && allBanksSummary.totalEvents > 0
                      ? '100% ✓'
                      : `${allBanksSummary.doneEvents} / ${allBanksSummary.totalEvents}`}
                  </span>
                </div>,
                ...accounts.map(account => {
                const bd = accountBreakdown.get(account.id);
                const isActive = selectedBankFilter === account.id;
                const totalEvts = events.filter(e => e.accountId === account.id).length;
                const doneEvts = events.filter(e => e.accountId === account.id && e.status === 'confirmado').length;
                const pct = totalEvts > 0 ? Math.round((doneEvts / totalEvts) * 100) : 0;
                const isNeg = bd && bd.saldoFinalPrevisto < 0;
                const isFull = pct === 100 && totalEvts > 0;
                const displayedHoy = bd?.hoy ?? account.balance;
                const displayedFinMes = bd?.saldoFinalPrevisto ?? account.balance;

                return (
                  <div
                    key={account.id}
                    className={[
                      'tv3-bank-chip',
                      isActive ? 'tv3-bank-chip--active' : '',
                      isFull ? 'tv3-bank-chip--ok' : '',
                      isNeg ? 'tv3-bank-chip--warn' : '',
                    ].join(' ')}
                    onClick={() => handleBankFilterClick(account.id)}
                  >
                    {/* Cabecera */}
                    <div className="tv3-bank-chip-head">
                      <span className="tv3-bank-name">{account.name}</span>
                      <span className={`tv3-bank-status ${isFull ? 'ok' : isNeg ? 'warn' : 'pending'}`}>
                        {isFull
                          ? <CheckCircle2 size={14} />
                          : isNeg
                            ? <AlertTriangle size={14} />
                            : <Circle size={14} />
                        }
                      </span>
                    </div>

                    {/* Importes — dos filas separadas */}
                    <div className="tv3-bank-amounts">
                      <div className="tv3-bank-hoy">
                        Hoy&nbsp;<span>{formatAmount(displayedHoy)} €</span>
                      </div>
                      <div className={`tv3-bank-finmes ${isNeg ? 'tv3-bank-finmes--neg' : ''}`}>
                        Fin mes&nbsp;<span>{formatAmount(displayedFinMes)} €</span>
                      </div>
                    </div>

                    {/* Barra progreso */}
                    <div className="tv3-bank-track">
                      <div
                        className={[
                          'tv3-bank-fill',
                          isFull ? 'tv3-bank-fill--full' : '',
                          isNeg  ? 'tv3-bank-fill--neg'  : 'tv3-bank-fill--blue',
                        ].filter(Boolean).join(' ')}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    {/* Badge */}
                    <span className={`tv3-bank-badge ${isFull ? 'tv3-bank-badge--done' : 'tv3-bank-badge--pend'}`}>
                      {isFull ? '100% ✓' : `${doneEvts} / ${totalEvts}`}
                    </span>
                  </div>
                );
              })
              ]
            )}
          </div>
        </div>

        {/* ══ ZONA 3 — MOVIMIENTOS ══ */}
        <div className="tv3-mov-panel">
          {/* Toolbar */}
          <div className="tv3-mov-toolbar">
            <div className="tv3-mov-toolbar-left">
              <h2 className="tv3-mov-title">
                {selectedBankFilter ? `Movimientos — ${selectedBankName}` : 'Movimientos a conciliar'}
              </h2>
              <div className="tv3-filter-pills">
                {([
                  { key: 'all', label: 'Todas' },
                  { key: 'income', label: 'Ingresos' },
                  { key: 'expense', label: 'Gastos' },
                  { key: 'financing', label: 'Financiación' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`tv3-fpill ${selectedTypeFilter === key ? 'tv3-fpill--on' : ''}`}
                    onClick={() => setSelectedTypeFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="tv3-mov-toolbar-right">
              <span className="tv3-mov-stats">
                <strong>{filteredEvents.filter(e => e.status === 'confirmado').length}</strong>
                {' / '}{filteredEvents.length} punteados
              </span>
              <span className="tv3-mov-stats">
                Pendiente: <strong>{formatAmount(totalFiltradoPendiente)} €</strong>
              </span>
              <button className="tv3-btn tv3-btn--ghost tv3-btn--sm" onClick={() => setShowAddModal(true)}>
                <Plus size={14} /> Directo
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="tv3-mov-list">
            {loading ? (
              <div className="tv3-empty">Cargando eventos…</div>
            ) : filteredEvents.length === 0 ? (
              <div className="tv3-empty">Sin eventos para este periodo</div>
            ) : (
              Array.from(eventsByDate.entries()).map(([date, rows]) => {
                const dayIncome = rows.reduce((s, r) => {
                  if (r.kind === 'event') return s + (r.event.type === 'income' ? r.event.amount : 0);
                  return s + r.events.filter(e => e.type === 'income').reduce((ss, e) => ss + e.amount, 0);
                }, 0);
                const dayExpense = rows.reduce((s, r) => {
                  if (r.kind === 'event') return s + (r.event.type !== 'income' ? r.event.amount : 0);
                  return s + r.events.filter(e => e.type !== 'income').reduce((ss, e) => ss + e.amount, 0);
                }, 0);

                return (
                  <React.Fragment key={date}>
                    {/* Cabecera fecha */}
                    <div className="tv3-group-header">
                      <div className="tv3-group-date"><Calendar size={13} /> {formatGroupDate(date)}</div>
                      <div className="tv3-group-total">
                        {dayIncome - dayExpense >= 0 ? '+' : "−"}{formatAmount(Math.abs(dayIncome - dayExpense))} €
                      </div>
                    </div>

                    {/* Filas */}
                    {rows.map(row => {
                      if (row.kind === 'event') {
                        return renderEventRow(row.event);
                      }

                      // Rental group
                      const isExpanded = !!expandedRentalGroups[row.groupId];
                      const totalAmount = row.events.reduce((s, e) => s + e.amount, 0);
                      const confirmedCount = row.events.filter(e => e.status === 'confirmado').length;
                      const allConfirmed = confirmedCount === row.events.length;

                      return (
                        <React.Fragment key={row.groupId}>
                          <div
                            className={`tv3-rental-head ${allConfirmed ? 'tv3-rental-head--done' : ''}`}
                            onClick={() => setExpandedRentalGroups(prev => ({ ...prev, [row.groupId]: !prev[row.groupId] }))}
                          >
                            <button className="tv3-rental-toggle" aria-label={isExpanded ? 'Colapsar' : 'Expandir'}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div className="tv3-rental-icon"><Home size={13} /></div>
                            <div className="tv3-rental-body">
                              <div className="tv3-rental-label">Rentas alquiler — {row.propertyAlias}</div>
                              <div className="tv3-rental-sub">{row.events.length} habitaciones · {formatGroupDate(row.events[0]?.date ?? '')}</div>
                            </div>
                            <span className="tv3-rental-total">+{formatAmount(totalAmount)} €</span>
                            <span className={`tv3-bank-badge ${allConfirmed ? 'tv3-bank-badge--done' : 'tv3-bank-badge--pend'}`} style={{ marginLeft: 10 }}>
                              {confirmedCount}/{row.events.length}
                            </span>
                            <button className="tv3-kebab" onClick={e => e.stopPropagation()}><MoreHorizontal size={14} /></button>
                          </div>
                          {isExpanded && row.events.map(ev => renderEventRow(ev, true))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="tv3-mov-footer">
            <span className="tv3-mov-footer-note">
              Clic en ○ para puntear · Clic en el importe para editar inline
            </span>
          </div>
        </div>

      </div>

      {/* ══ DRAWER — MOVIMIENTO DIRECTO ══ */}
      <div
        className={`tv3-overlay ${showAddModal ? 'tv3-overlay--open' : ''}`}
        onClick={() => setShowAddModal(false)}
      />
      <aside className={`tv3-drawer ${showAddModal ? 'tv3-drawer--open' : ''}`}>
        <div className="tv3-drawer-header">
          <div className="tv3-drawer-title-wrap">
            <div className="tv3-drawer-icon"><Plus size={18} /></div>
            <div>
              <div className="tv3-drawer-title">Movimiento directo</div>
              <div className="tv3-drawer-sub">Añade un movimiento no planificado</div>
            </div>
          </div>
          <button className="tv3-drawer-close" onClick={() => setShowAddModal(false)} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="tv3-drawer-body">
          {/* Tipo */}
          <div>
            <label className="tv3-field-label">Tipo</label>
            <div className="tv3-tipo-sel">
              {([
                { val: 'expense', label: 'Gasto', Icon: TrendingDown },
                { val: 'income', label: 'Ingreso', Icon: TrendingUp },
                { val: 'transfer', label: 'Transferencia', Icon: ChevronRight },
              ] as const).map(({ val, label, Icon }) => (
                <button
                  key={val}
                  className={`tv3-tipo-opt ${newMovementForm.type === val ? 'tv3-tipo-opt--on' : ''}`}
                  onClick={() => setNewMovementForm(p => ({ ...p, type: val }))}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Concepto */}
          <div>
            <label className="tv3-field-label">Concepto</label>
            <input
              className="tv3-field-input"
              type="text"
              placeholder="Ej: Comisión bancaria"
              value={newMovementForm.concept}
              onChange={e => setNewMovementForm(p => ({ ...p, concept: e.target.value }))}
            />
          </div>

          {/* Importe */}
          <div>
            <label className="tv3-field-label">Importe (€)</label>
            <input
              className="tv3-field-input tv3-field-input--mono"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={newMovementForm.amount}
              onChange={e => setNewMovementForm(p => ({ ...p, amount: e.target.value }))}
            />
          </div>

          {/* Cuenta (origen) */}
          <div>
            <label className="tv3-field-label">
              {newMovementForm.type === 'transfer' ? 'Cuenta origen' : 'Cuenta'}
            </label>
            <select
              className="tv3-field-select"
              value={newMovementForm.accountId}
              onChange={e => setNewMovementForm(p => ({ ...p, accountId: e.target.value }))}
            >
              <option value="">Sin cuenta específica</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Cuenta destino (solo transferencia) */}
          {newMovementForm.type === 'transfer' && (
            <div>
              <label className="tv3-field-label">Cuenta destino</label>
              <select
                className="tv3-field-select"
                value={newMovementForm.targetAccountId}
                onChange={e => setNewMovementForm(p => ({ ...p, targetAccountId: e.target.value }))}
              >
                <option value="">Selecciona cuenta destino</option>
                {accounts
                  .filter(a => a.id !== newMovementForm.accountId)
                  .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* Fecha */}
          <div>
            <label className="tv3-field-label">Fecha</label>
            <input
              className="tv3-field-input"
              type="date"
              value={newMovementForm.date}
              onChange={e => setNewMovementForm(p => ({ ...p, date: e.target.value }))}
            />
          </div>
        </div>

        <div className="tv3-drawer-footer">
          <button className="tv3-btn tv3-btn--ghost" onClick={() => setShowAddModal(false)}>Cancelar</button>
          <button
            className="tv3-btn tv3-btn--primary"
            onClick={handleSaveNewMovement}
            disabled={savingMovement}
          >
            {savingMovement ? 'Guardando…' : <><CheckCircle2 size={14} /> Confirmar</>}
          </button>
        </div>
      </aside>
    </div>
  );
};

export default TreasuryReconciliationView;
