import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart3, RefreshCw, Plus, Check, CheckCircle2,
  ChevronLeft, ChevronRight,
  AlertCircle, TrendingUp, TrendingDown, CreditCard,
  X, Edit2, Trash2, AlertTriangle,
} from 'lucide-react';
import PageHeader, { HeaderPrimaryButton, HeaderSecondaryButton } from '../shared/PageHeader';
import toast from 'react-hot-toast';
import { normalizeText } from '../../utils/normalizeText';
import { initDB } from '../../services/db';
import type { Account as DBAccount, Movement as DBMovement } from '../../services/db';
import { prestamosService } from '../../services/prestamosService';
import { finalizePropertySaleLoanCancellationFromTreasuryEvent } from '../../services/propertySaleService';
import { calculateAccountTreasurySummary } from './treasuryBalanceSummary';
import { calculateTreasuryMonthOpeningBalance } from './treasuryMonthOpeningBalance';
import { getCachedStoreRecords, invalidateCachedStores } from '../../services/indexedDbCacheService';
import { generateMonthlyForecasts } from '../../modules/horizon/tesoreria/services/treasurySyncService';
import { gastosPersonalesRealService } from '../../services/gastosPersonalesRealService';
import { patronGastosPersonalesService } from '../../services/patronGastosPersonalesService';
import type { PersonalExpenseCategory } from '../../types/personal';
import AccountFormModal from '../../modules/horizon/configuracion/cuentas/components/AccountFormModal';
import { cuentasService } from '../../services/cuentasService';
import './treasury-reconciliation.css';
import './treasury-v4.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiItem {
  label: string;
  valor: string;
  sub: string;
  dim?: boolean;
}

interface TreasuryEventLocal {
  id: string;
  dbId?: number;
  accountId: string;
  concept: string;
  amount: number;
  date: string;
  type: 'income' | 'expense' | 'financing';
  status: 'previsto' | 'confirmado';
  movementId?: number;
  sourceType?: string;
  parentId?: string;
  prestamoId?: string;
  numeroCuota?: number;
  rentalUnitType?: 'vivienda' | 'habitacion';
  rentalPropertyAlias?: string;
}

interface SimpleAccountV4 {
  id: string;
  dbId: number;
  name: string;
  ibanMask: string;
  type: 'bank' | 'cash' | 'wallet';
}

interface NewMovForm {
  concept: string;
  amount: string;
  accountId: string;
  targetAccountId: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const formatEur = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toNumId = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const p = Number(v);
    if (Number.isFinite(p)) return p;
  }
  return undefined;
};

const getAccType = (acc: DBAccount): 'bank' | 'cash' | 'wallet' => {
  const name = normalizeText((acc as any).alias || acc.banco?.name || (acc as any).name || '');
  if (name.includes('metal') || name.includes('cash') || name.includes('efectivo')) return 'cash';
  if (name.includes('revolut') || name.includes('wallet') || name.includes('paypal')) return 'wallet';
  return 'bank';
};

const DEFAULT_FORM: NewMovForm = {
  concept: '', amount: '', accountId: '', targetAccountId: '',
  date: new Date().toISOString().substring(0, 10), type: 'expense',
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TesoreriaV4: React.FC = () => {
  const nowInit = new Date();

  // ── UI state ──
  const [tab, setTab] = useState<'flujo' | 'cuentas'>('flujo');
  const [vista, setVista] = useState<'anual' | 'mensual'>('anual');
  const [año, setAño] = useState<number>(nowInit.getFullYear());
  const [mesActivo, setMesActivo] = useState<number>(nowInit.getMonth());
  const [cuentaSel, setCuentaSel] = useState<number>(-1);
  const [filtro, setFiltro] = useState<string>('pendiente');
  const [editState, setEditState] = useState<{ eventId: string; amount: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DBAccount | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    account: DBAccount;
    movementsCount: number;
    deleteMovements: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newMovForm, setNewMovForm] = useState<NewMovForm>(DEFAULT_FORM);
  const [savingMovement, setSavingMovement] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // ── Raw DB data ──
  const [loading, setLoading] = useState(true);
  const [rawAccounts, setRawAccounts] = useState<DBAccount[]>([]);
  const [allDbEvents, setAllDbEvents] = useState<any[]>([]);
  const [allDbMovements, setAllDbMovements] = useState<DBMovement[]>([]);
  const [cardSettlementMap, setCardSettlementMap] = useState<Map<number, { chargeAccountId: number }>>(new Map());
  const [contractMap, setContractMap] = useState<Map<number, { unidadTipo: 'vivienda' | 'habitacion'; propertyAlias: string }>>(new Map());

  // ── Mutable events state (for optimistic UI) ──
  const [events, setEvents] = useState<TreasuryEventLocal[]>([]);

  // ── Focus amount input on edit ──
  useEffect(() => {
    if (editState && amountInputRef.current) {
      amountInputRef.current.focus();
      amountInputRef.current.select();
    }
  }, [editState]);

  // ── Load all data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dbAccounts, dbEvents, dbMovements, contracts, properties] = await Promise.all([
        getCachedStoreRecords<DBAccount>('accounts'),
        getCachedStoreRecords<any>('treasuryEvents'),
        getCachedStoreRecords<DBMovement>('movements'),
        getCachedStoreRecords<any>('contracts'),
        getCachedStoreRecords<any>('properties'),
      ]);

      const propAliasMap = new Map<number, string>();
      for (const p of properties) {
        if (p.id != null) propAliasMap.set(p.id, p.alias ?? `Inmueble ${p.id}`);
      }

      const newContractMap = new Map<number, { unidadTipo: 'vivienda' | 'habitacion'; propertyAlias: string }>();
      for (const c of contracts) {
        if (c.id == null) continue;
        const propertyId = c.inmuebleId ?? c.propertyId;
        newContractMap.set(c.id, {
          unidadTipo: c.unidadTipo,
          propertyAlias: propAliasMap.get(propertyId) ?? `Inmueble ${propertyId}`,
        });
      }

      const newCardMap = new Map<number, { chargeAccountId: number }>();
      for (const a of dbAccounts) {
        if (a.id == null) continue;
        if (a.cardConfig?.chargeAccountId != null) {
          newCardMap.set(a.id, { chargeAccountId: a.cardConfig.chargeAccountId });
        }
      }

      setRawAccounts(dbAccounts);
      setAllDbEvents(dbEvents);
      setAllDbMovements(dbMovements);
      setCardSettlementMap(newCardMap);
      setContractMap(newContractMap);
    } catch (err) {
      console.error('Error loading treasury data:', err);
      toast.error('Error al cargar datos de tesorería');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Callback to reload accounts after account changes (invalidates cache first) ──
  const reloadAfterAccountChange = useCallback(async () => {
    invalidateCachedStores(['accounts', 'movements']);
    await loadData();
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Resolve card-settled account ──
  const resolveAccId = useCallback((e: any): number | undefined => {
    const eAcc = toNumId(e.accountId);
    const eSrc = toNumId(e.sourceId);
    const cardCfg = eAcc != null ? cardSettlementMap.get(eAcc) : undefined;
    const srcCfg = eAcc == null && e.sourceType === 'personal_expense' && eSrc != null
      ? cardSettlementMap.get(eSrc) : undefined;
    return cardCfg?.chargeAccountId ?? srcCfg?.chargeAccountId ?? eAcc;
  }, [cardSettlementMap]);

  // ── Map raw DB event to local format ──
  const mapEvent = useCallback((e: any): TreasuryEventLocal => {
    const contractInfo = e.sourceType === 'contrato' && e.sourceId != null
      ? contractMap.get(Number(e.sourceId)) : undefined;
    const displayAccId = resolveAccId(e);
    return {
      id: String(e.id),
      dbId: e.id as number,
      accountId: String(displayAccId ?? ''),
      concept: e.description,
      amount: e.amount,
      date: e.predictedDate,
      type: e.type as 'income' | 'expense' | 'financing',
      status: e.status === 'predicted' ? 'previsto' : 'confirmado',
      movementId: e.movementId,
      sourceType: e.sourceType,
      prestamoId: e.prestamoId,
      numeroCuota: e.numeroCuota,
      rentalUnitType: contractInfo?.unidadTipo,
      rentalPropertyAlias: contractInfo?.propertyAlias,
    };
  }, [contractMap, resolveAccId]);

  // ── Derived mutable events for current month ──
  useEffect(() => {
    const y = año, m = mesActivo + 1;
    const derived = allDbEvents
      .filter(e => {
        const d = new Date(e.predictedDate);
        return d.getFullYear() === y && d.getMonth() + 1 === m;
      })
      .map(mapEvent)
      .sort((a, b) => a.date.localeCompare(b.date) || a.concept.localeCompare(b.concept, 'es'));
    setEvents(derived);
  }, [allDbEvents, año, mesActivo, mapEvent]);

  // ── Computed: accounts list ──
  const accounts = useMemo((): SimpleAccountV4[] =>
    rawAccounts
      .filter(a => a.id != null && (a as any).activa !== false && (a as any).status !== 'DELETED')
      .map(a => ({
        id: String(a.id),
        dbId: a.id as number,
        name: (a as any).alias || a.banco?.name || (a as any).name || `Cuenta ${a.id}`,
        ibanMask: (a as any).ibanMasked || (a.iban ? `${a.iban.slice(0, 4)} **** ${a.iban.slice(-4)}` : ''),
        type: getAccType(a),
      })),
  [rawAccounts]);

  // ── Computed: year month data (for 12-month grid) ──
  const yearMonthData = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      ing: 0, gas: 0, fin: 0, punteados: 0, total: 0,
      fechaFin: new Date(año, i + 1, 0),
    }));
    for (const e of allDbEvents) {
      const d = new Date(e.predictedDate);
      if (d.getFullYear() !== año) continue;
      const m = d.getMonth();
      if (e.type === 'income') data[m].ing += e.amount;
      else if (e.type === 'expense') data[m].gas += e.amount;
      else data[m].fin += e.amount;
      data[m].total += 1;
      if (e.status === 'confirmed') data[m].punteados += 1;
    }
    return data.map(d => ({ ...d, excedente: d.ing - d.gas - d.fin }));
  }, [allDbEvents, año]);

  // ── Computed: monthStr ──
  const monthStr = useMemo(() =>
    `${año}-${String(mesActivo + 1).padStart(2, '0')}`, [año, mesActivo]);

  // ── Computed: account breakdown for monthly view ──
  const accountBreakdown = useMemo(() => {
    const today = new Date();
    const monthMovements = allDbMovements.filter(m => {
      const d = new Date(m.date);
      return d.getFullYear() === año && d.getMonth() + 1 === mesActivo + 1;
    });

    return new Map(
      rawAccounts
        .filter(a => a.id != null && (a as any).activa !== false && (a as any).status !== 'DELETED' && a.tipo !== 'TARJETA_CREDITO')
        .map(a => {
          const accId = String(a.id);
          const balance = calculateTreasuryMonthOpeningBalance({
            account: a,
            selectedMonth: monthStr,
            treasuryEvents: allDbEvents,
            movements: allDbMovements,
            resolveEventAccountId: resolveAccId,
          });
          const acctEvents = events.filter(e => e.accountId === accId);
          const summary = calculateAccountTreasurySummary({
            account: { id: accId, balance },
            events: acctEvents,
            movements: monthMovements,
            selectedMonth: monthStr,
            today,
          });
          return [accId, {
            saldoHoy: summary.hoy,
            finMesEstimado: summary.finMes,
            punteados: acctEvents.filter(e => e.status === 'confirmado').length,
            total: acctEvents.length,
          }] as const;
        })
    );
  }, [rawAccounts, allDbEvents, allDbMovements, events, monthStr, resolveAccId, año, mesActivo]);

  // ── Computed: KPIs ──
  const kpis = useMemo((): KpiItem[] => {
    const now = new Date();
    const mesLabel = `${MESES[mesActivo]} ${año}`;
    const mesActualLabel = MESES_CORTO[now.getMonth()];

    if (tab === 'flujo' && vista === 'anual') {
      const totals = yearMonthData.reduce(
        (acc, d) => ({ ing: acc.ing + d.ing, gas: acc.gas + d.gas, fin: acc.fin + d.fin }),
        { ing: 0, gas: 0, fin: 0 }
      );
      const cfNeto = totals.ing - totals.gas - totals.fin;
      return [
        { label: `CF neto ${año}`, valor: (cfNeto >= 0 ? '+' : '') + formatEur(cfNeto) + ' €', sub: `Acumulado hasta ${mesActualLabel}` },
        { label: `Ingresos ${año}`, valor: formatEur(totals.ing) + ' €', sub: 'Punteados + previstos' },
        { label: `Gastos ${año}`, valor: formatEur(totals.gas) + ' €', sub: 'Punteados + previstos', dim: true },
        { label: `Financiación ${año}`, valor: formatEur(totals.fin) + ' €', sub: 'Cuotas anualizadas', dim: true },
      ];
    } else {
      const ing = events.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const gas = events.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
      const fin = events.filter(e => e.type === 'financing').reduce((s, e) => s + e.amount, 0);
      const ingReal = events.filter(e => e.type === 'income' && e.status === 'confirmado').reduce((s, e) => s + e.amount, 0);
      const gasReal = events.filter(e => e.type === 'expense' && e.status === 'confirmado').reduce((s, e) => s + e.amount, 0);
      const cfNeto = ing - gas - fin;
      const cfReal = ingReal - gasReal;
      return [
        { label: `CF neto · ${mesLabel}`, valor: (cfNeto >= 0 ? '+' : '') + formatEur(cfNeto) + ' €', sub: `Real confirmado: ${cfReal >= 0 ? '+' : '-'}${formatEur(Math.abs(cfReal))} €` },
        { label: `Ingresos · ${mesLabel}`, valor: formatEur(ing) + ' €', sub: `Real: ${formatEur(ingReal)} €` },
        { label: `Gastos · ${mesLabel}`, valor: formatEur(gas) + ' €', sub: `Real: ${formatEur(gasReal)} €`, dim: true },
        { label: `Financiación · ${mesLabel}`, valor: formatEur(fin) + ' €', sub: 'Cuotas del mes', dim: true },
      ];
    }
  }, [tab, vista, año, mesActivo, yearMonthData, events]);

  // ── Computed: filtered movements ──
  const filteredMovements = useMemo(() => {
    let list = events;
    if (cuentaSel >= 0 && cuentaSel < accounts.length) {
      list = list.filter(e => e.accountId === accounts[cuentaSel].id);
    }
    switch (filtro) {
      case 'pendiente':    return list.filter(m => m.status !== 'confirmado');
      case 'confirmado':   return list.filter(m => m.status === 'confirmado');
      case 'ingresos':     return list.filter(m => m.type === 'income' && m.status !== 'confirmado');
      case 'gastos':       return list.filter(m => m.type === 'expense' && m.status !== 'confirmado');
      case 'financiacion': return list.filter(m => m.type === 'financing');
      default:             return list;
    }
  }, [events, accounts, cuentaSel, filtro]);


  // ── Navigation helpers ──
  const navMes = (dir: -1 | 1) => {
    let m = mesActivo + dir;
    let y = año;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMesActivo(m); setAño(y); setCuentaSel(-1); setFiltro('pendiente');
  };

  const goToMonth = (i: number) => {
    setMesActivo(i); setVista('mensual'); setCuentaSel(-1); setFiltro('pendiente');
  };

  // ── Generate forecasts ──
  const handleGenerateForecasts = async () => {
    try {
      const result = await generateMonthlyForecasts(año, mesActivo + 1);
      if (result.created > 0 || result.updated > 0) {
        const messages: string[] = [];
        if (result.created > 0) messages.push(`${result.created} previsión${result.created > 1 ? 'es' : ''} creada${result.created > 1 ? 's' : ''}`);
        if (result.updated > 0) messages.push(`${result.updated} previsión${result.updated > 1 ? 'es' : ''} actualizada${result.updated > 1 ? 's' : ''}`);
        toast.success(messages.join(' · '));
        invalidateCachedStores(['treasuryEvents']);
        await loadData();
      } else {
        toast.success('El mes ya está sincronizado');
      }
    } catch (err) {
      console.error('Error generating forecasts:', err);
      toast.error('Error al generar previsiones');
    }
  };

  // ── Toggle punteo ──
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
            ...dbEvent, status: dbStatus,
            actualDate: newStatus === 'confirmado' ? new Date().toISOString().substring(0, 10) : undefined,
            updatedAt: new Date().toISOString(),
          });
          invalidateCachedStores(['treasuryEvents']);

          if (newStatus === 'confirmado') {
            await finalizePropertySaleLoanCancellationFromTreasuryEvent(ev.dbId);

            if (dbEvent?.sourceType === 'personal_expense') {
              try {
                const tesoreriaEventoId = String(ev.dbId);
                const existingReal = await db.getAllFromIndex('gastosPersonalesReal', 'tesoreriaEventoId', tesoreriaEventoId);
                if (existingReal.length === 0) {
                  const fechaConf = dbEvent.actualDate || new Date().toISOString().substring(0, 10);
                  const patronId = typeof dbEvent.sourceId === 'number' ? dbEvent.sourceId : undefined;
                  let importeEstimado: number | undefined;
                  let categoria: PersonalExpenseCategory = 'otros';
                  if (patronId) {
                    const patrones = await patronGastosPersonalesService.getPatrones(dbEvent.personalDataId ?? 1);
                    const patron = patrones.find((p: any) => p.id === patronId);
                    if (patron) { importeEstimado = patron.importe; categoria = patron.categoria; }
                  }
                  await gastosPersonalesRealService.registrarGastoReal({
                    personalDataId: dbEvent.personalDataId ?? 1, patronId,
                    concepto: dbEvent.description ?? ev.concept, categoria,
                    importeReal: ev.amount, importeEstimado, fechaReal: fechaConf,
                    cuentaCargoId: typeof dbEvent.accountId === 'number' ? dbEvent.accountId : undefined,
                    tesoreriaEventoId,
                    ejercicio: new Date(fechaConf).getFullYear(), mes: new Date(fechaConf).getMonth() + 1,
                  });
                }
              } catch (realErr) { console.warn('[Treasury] Error writing gastosPersonalesReal:', realErr); }
            }
          }
        }
      }
      const isLoanEvent = ev.sourceType === 'hipoteca' || ev.sourceType === 'prestamo';
      if (isLoanEvent && ev.prestamoId && ev.numeroCuota != null) {
        try {
          await prestamosService.marcarCuotaManual(ev.prestamoId, ev.numeroCuota, { pagado: newStatus === 'confirmado' });
          toast.success(newStatus === 'confirmado' ? 'Cuota punteada ✓ — Plan actualizado' : 'Punteo retirado');
        } catch { toast.success(newStatus === 'confirmado' ? 'Evento punteado ✓' : 'Punteo retirado'); }
      } else {
        toast.success(newStatus === 'confirmado' ? 'Evento punteado ✓' : 'Punteo retirado');
      }
    } catch (err) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: originalStatus } : e));
      toast.error('Error al actualizar el evento');
    }
  };

  // ── Inline amount editing ──
  const handleAmountClick = (ev: TreasuryEventLocal) => {
    if (ev.status === 'confirmado') return;
    setEditState({ eventId: ev.id, amount: String(ev.amount) });
  };

  const handleAjustarPrevision = async () => {
    if (!editState) return;
    const ev = events.find(e => e.id === editState.eventId);
    if (!ev) return;
    const newAmount = parseFloat(editState.amount);
    if (isNaN(newAmount) || newAmount <= 0) return;
    setEvents(prev => prev.map(e => e.id === editState.eventId ? { ...e, amount: newAmount, status: 'confirmado' } : e));
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
          invalidateCachedStores(['treasuryEvents']);
          await finalizePropertySaleLoanCancellationFromTreasuryEvent(ev.dbId);
        }
      }
      toast.success(`Previsión ajustada a ${formatEur(newAmount)} €`);
    } catch { toast.error('Error al ajustar la previsión'); }
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
    const childEvent: TreasuryEventLocal = {
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
          invalidateCachedStores(['treasuryEvents']);
          setEvents(prev => prev.map(e =>
            e.id === tempChildId ? { ...e, id: String(newChildDbId), dbId: newChildDbId as number } : e
          ));
        }
      }
      toast.success(`${formatEur(paidAmount)} € confirmados · ${formatEur(remainingAmount)} € pendientes`);
    } catch { toast.error('Error al dividir el evento'); }
  };

  // ── Save new movement ──
  const handleSaveNewMovement = async () => {
    const amount = parseFloat(newMovForm.amount);
    if (isNaN(amount) || amount <= 0 || !newMovForm.date) { toast.error('Completa todos los campos'); return; }
    const rawAccountId = newMovForm.accountId ? parseInt(newMovForm.accountId, 10) : undefined;
    const accountId = rawAccountId !== undefined && !isNaN(rawAccountId) ? rawAccountId : undefined;
    const rawTargetId = newMovForm.targetAccountId ? parseInt(newMovForm.targetAccountId, 10) : undefined;
    const targetAccountId = rawTargetId !== undefined && !isNaN(rawTargetId) ? rawTargetId : undefined;

    if (newMovForm.type === 'transfer') {
      if (!accountId || !targetAccountId) { toast.error('Selecciona cuenta origen y destino'); return; }
      if (accountId === targetAccountId) { toast.error('La cuenta origen y destino deben ser diferentes'); return; }
    } else {
      if (!newMovForm.concept.trim()) { toast.error('Completa todos los campos'); return; }
      if (!accountId) { toast.error('Selecciona una cuenta'); return; }
    }

    setSavingMovement(true);
    try {
      const db = await initDB();
      const now = new Date().toISOString();
      const baseConcept = newMovForm.concept.trim();
      if (newMovForm.type === 'transfer') {
        const fromAcc = accounts.find(a => a.id === String(accountId));
        const toAcc = accounts.find(a => a.id === String(targetAccountId));
        const srcConcept = baseConcept || `Transferencia a ${toAcc?.name ?? 'cuenta destino'}`;
        const tgtConcept = baseConcept || `Transferencia desde ${fromAcc?.name ?? 'cuenta origen'}`;
        const [fromId, toId] = await Promise.all([
          db.add('treasuryEvents', { type: 'expense' as const, amount, predictedDate: newMovForm.date, description: srcConcept, sourceType: 'manual' as const, accountId, status: 'confirmed' as const, actualDate: newMovForm.date, actualAmount: amount, createdAt: now, updatedAt: now }),
          db.add('treasuryEvents', { type: 'income' as const, amount, predictedDate: newMovForm.date, description: tgtConcept, sourceType: 'manual' as const, accountId: targetAccountId, status: 'confirmed' as const, actualDate: newMovForm.date, actualAmount: amount, createdAt: now, updatedAt: now }),
        ]);
        invalidateCachedStores(['treasuryEvents']);
        const evDate = new Date(newMovForm.date);
        if (evDate.getFullYear() === año && evDate.getMonth() + 1 === mesActivo + 1) {
          setEvents(prev => ([...prev,
            { id: String(fromId), dbId: fromId as number, accountId: String(accountId), concept: srcConcept, amount, date: newMovForm.date, type: 'expense', status: 'confirmado' },
            { id: String(toId), dbId: toId as number, accountId: String(targetAccountId), concept: tgtConcept, amount, date: newMovForm.date, type: 'income', status: 'confirmado' },
          ]));
        }
        toast.success('Transferencia creada');
      } else {
        const eventType: 'income' | 'expense' = newMovForm.type as 'income' | 'expense';
        const newId = await db.add('treasuryEvents', { type: eventType, amount, predictedDate: newMovForm.date, description: baseConcept, sourceType: 'manual' as const, accountId, status: 'confirmed' as const, actualDate: newMovForm.date, actualAmount: amount, createdAt: now, updatedAt: now });
        invalidateCachedStores(['treasuryEvents']);
        const evDate = new Date(newMovForm.date);
        if (evDate.getFullYear() === año && evDate.getMonth() + 1 === mesActivo + 1) {
          setEvents(prev => [...prev, { id: String(newId), dbId: newId as number, accountId: String(accountId ?? ''), concept: baseConcept, amount, date: newMovForm.date, type: eventType, status: 'confirmado' }]);
        }
        toast.success('Movimiento añadido');
      }
      setShowAddModal(false);
      setNewMovForm(prev => ({ ...DEFAULT_FORM, accountId: prev.accountId, targetAccountId: '' }));
    } catch { toast.error('Error al guardar el movimiento'); }
    finally { setSavingMovement(false); }
  };


  // ── Render movement row ──
  const today = new Date(new Date().toDateString());

  const renderMovRow = (mov: TreasuryEventLocal) => {
    const isConfirmed = mov.status === 'confirmado';
    const isEditing = editState?.eventId === mov.id;
    const isVencido = mov.status === 'previsto' && new Date(mov.date) < today;
    const bankName = accounts.find(a => a.id === mov.accountId)?.name ?? '';

    const TypeIcon = mov.type === 'income' ? TrendingUp : mov.type === 'expense' ? TrendingDown : CreditCard;
    const typeClass = mov.type === 'income' ? 'tv4-tipo-icon--income' : mov.type === 'financing' ? 'tv4-tipo-icon--financing' : 'tv4-tipo-icon--expense';
    const typeColor = mov.type === 'income' ? 'var(--navy-700)' : mov.type === 'financing' ? 'var(--teal-600)' : 'var(--grey-700)';

    return (
      <div
        key={mov.id}
        className="tv4-mov-row"
        style={{ opacity: isConfirmed ? 0.55 : 1 }}
      >
        {/* Punteo circle */}
        <button
          type="button"
          className={`tv4-punteo-btn ${isConfirmed ? 'tv4-punteo-btn--done' : ''}`}
          onClick={() => handleToggleStatus(mov.id)}
          title={isConfirmed ? 'Quitar punteo' : 'Puntear'}
          aria-pressed={isConfirmed}
          style={{ cursor: 'pointer' }}
        >
          {isConfirmed && <Check size={10} color="var(--teal-600)" strokeWidth={2.5} />}
        </button>

        {/* Type icon */}
        <div className={`tv4-tipo-icon ${typeClass}`}>
          <TypeIcon size={11} color={typeColor} />
        </div>

        {/* Concept */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500,
            color: isConfirmed ? 'var(--grey-400)' : 'var(--grey-900)',
            textDecoration: isConfirmed ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {mov.concept}
          </div>
          <div style={{ fontSize: 11, color: 'var(--grey-400)', marginTop: 1 }}>
            {mov.sourceType === 'contrato' && <span style={{ color: '#1d4ed8', fontSize: 10, background: '#eff6ff', padding: '1px 6px', borderRadius: 99, marginRight: 4 }}>Contrato</span>}
            {(mov.sourceType === 'hipoteca' || mov.sourceType === 'prestamo') && (
              <span style={{ fontSize: 10, background: 'var(--grey-100)', color: 'var(--grey-500)', padding: '1px 6px', borderRadius: 99, marginRight: 4 }}>
                Hipoteca{mov.numeroCuota ? ` · Cuota ${mov.numeroCuota}` : ''}
              </span>
            )}
            {bankName && <span>{bankName}</span>}
          </div>
        </div>

        {/* Amount (editable inline) */}
        {isEditing ? (
          <>
            <input
              ref={amountInputRef}
              className="tv4-amount-input"
              type="number"
              min="0"
              step="0.01"
              value={editState!.amount}
              onChange={e => setEditState(prev => prev ? { ...prev, amount: e.target.value } : null)}
              onKeyDown={e => {
                if (e.key === 'Escape') setEditState(null);
                if (e.key === 'Enter') handleAjustarPrevision();
              }}
            />
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button className="tv3-iab tv3-iab--ok" onClick={handleAjustarPrevision}>Ajustar</button>
              <button className="tv3-iab tv3-iab--pend" onClick={handleDejarPendiente}>Parcial</button>
              <button className="tv3-iab tv3-iab--cancel" onClick={() => setEditState(null)}><X size={12} /></button>
            </div>
          </>
        ) : (
          <div
            onClick={() => !isConfirmed && handleAmountClick(mov)}
            style={{
              cursor: isConfirmed ? 'default' : 'pointer',
              textAlign: 'right', flexShrink: 0,
            }}
          >
            <div style={{
              fontSize: 13, fontWeight: 600, fontFamily: 'IBM Plex Mono',
              color: mov.type === 'income' ? 'var(--navy-900)' : 'var(--grey-700)',
              whiteSpace: 'nowrap',
            }}>
              {mov.type === 'income' ? '+' : '−'}{formatEur(mov.amount)} €
            </div>
          </div>
        )}

        {/* Status badge */}
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap', flexShrink: 0,
          background: isConfirmed ? 'var(--navy-100)' : mov.type === 'financing' ? 'var(--grey-50)' : 'var(--grey-100)',
          color: isConfirmed ? 'var(--navy-700)' : mov.type === 'financing' ? 'var(--grey-400)' : 'var(--grey-700)',
        }}>
          {isConfirmed ? 'Confirmado' : isVencido ? 'Vencido' : mov.type === 'financing' ? 'Previsto' : 'Previsto'}
        </span>
      </div>
    );
  };


  // ── Format date as Spanish header ──
  const formatDateHeader = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const mesesEs = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${dias[d.getDay()]}, ${d.getDate()} de ${mesesEs[d.getMonth()]}`;
  };

  // ── Render movements grouped by date ──
  const renderMovsByDate = (movs: TreasuryEventLocal[]) => {
    if (movs.length === 0) {
      return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--grey-400)', fontSize: 13 }}>Sin movimientos para este filtro</div>;
    }
    const result: React.ReactNode[] = [];
    let lastDate = '';
    for (const mov of movs) {
      if (mov.date !== lastDate) {
        lastDate = mov.date;
        result.push(
          <div key={`date-${mov.date}`} className="tv4-date-header">
            {formatDateHeader(mov.date)}
          </div>
        );
      }
      result.push(renderMovRow(mov));
    }
    return result;
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  const hoy = new Date();
  const mesActualGlobal = hoy.getMonth();
  const añoActualGlobal = hoy.getFullYear();

  const maxBarHeight = 52;
  const maxIngAnual = yearMonthData.length > 0
    ? Math.max(...yearMonthData.map(d => Math.max(d.ing, d.gas, d.fin)), 1)
    : 1;

  return (
    <div className="tv4-page">

      {/* ══ PAGE HEADER ══ */}
      <PageHeader
        icon={BarChart3}
        title="Tesorería"
        subtitle="Conciliación y flujo de caja"
        tabs={[
          { id: 'flujo', label: 'Flujo de caja' },
          { id: 'cuentas', label: 'Cuentas bancarias' },
        ]}
        activeTab={tab}
        onTabChange={(id) => setTab(id as 'flujo' | 'cuentas')}
        actions={
          <>
            <HeaderSecondaryButton icon={RefreshCw} label="Generar previsiones" onClick={handleGenerateForecasts} />
            <HeaderPrimaryButton icon={Plus} label="Añadir movimiento" onClick={() => setShowAddModal(true)} />
          </>
        }
      />

      {/* ══ KPI GRID ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, marginBottom: 20, border: '1px solid var(--grey-200)', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        {kpis.map((k, i) => (
          <div
            key={i}
            style={{
              padding: '12px 16px',
              borderRight: i < 3 ? '1px solid var(--grey-200)' : 'none',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--grey-400)', marginBottom: 4 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: k.dim ? 'var(--grey-500)' : 'var(--grey-900)', lineHeight: 1 }}>
              {k.valor}
            </div>
            <div style={{ fontSize: 11, color: 'var(--grey-400)', marginTop: 3 }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ══ TAB CONTENT ══ */}
      <div className="tv4-content">

        {/* ─ TAB: FLUJO DE CAJA ─ */}
        {tab === 'flujo' && (
          <>
            {/* Vista anual controls */}
            {vista === 'anual' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
                {/* Year selector */}
                <div style={{ display: 'flex' }}>
                  <button className="period-btn period-btn-left" onClick={() => setAño(año - 1)}>
                    &lt; {año - 1}
                  </button>
                  <button className="period-btn period-btn-active">{año}</button>
                  <button className="period-btn period-btn-right" onClick={() => setAño(año + 1)}>
                    {año + 1} &gt;
                  </button>
                </div>

                {/* Vista toggle */}
                <div style={{ display: 'flex', marginLeft: 'auto' }}>
                  <button className="toggle-vista on" onClick={() => setVista('anual')}>Vista anual</button>
                  <button className="toggle-vista" onClick={() => setVista('mensual')}>Vista mensual</button>
                </div>
              </div>
            )}

            {/* Vista mensual nav bar */}
            {vista === 'mensual' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn-ghost-small" onClick={() => { setVista('anual'); setCuentaSel(-1); }}>
                    <ChevronLeft size={13} /> Vista anual
                  </button>
                  <span style={{ color: 'var(--grey-300)' }}>·</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--grey-900)' }}>
                    {MESES[mesActivo]} {año}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button className="btn-icon-sm" onClick={() => navMes(-1)}><ChevronLeft size={13} /></button>
                  <button className="btn-icon-sm" onClick={() => navMes(1)}><ChevronRight size={13} /></button>
                </div>
              </div>
            )}

            {/* ── Vista anual: 12-month grid ── */}
            {vista === 'anual' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                {MESES.map((mes, i) => {
                  const d = yearMonthData[i];
                  const esActivo = i === mesActualGlobal && año === añoActualGlobal;
                  const esCerrado = d.fechaFin < hoy;
                  const esPrevisto = !esActivo && !esCerrado;
                  const op = esPrevisto ? 0.4 : 1;

                  return (
                    <div
                      key={i}
                      className="tv4-month-card"
                      role="button"
                      tabIndex={0}
                      aria-label={`Ir al mes de ${mes}`}
                      onClick={() => goToMonth(i)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToMonth(i); } }}
                      style={{ border: `1.5px solid ${esActivo ? 'var(--navy-900)' : 'var(--grey-200)'}` }}
                    >
                      {/* Month header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: esActivo ? 'var(--navy-900)' : esPrevisto ? 'var(--grey-400)' : 'var(--grey-700)',
                        }}>
                          {mes}
                        </span>
                        {esActivo && <span className="badge-teal-mini">Hoy</span>}
                        {esCerrado && !esActivo && <CheckCircle2 size={11} color="var(--teal-600)" />}
                        {esPrevisto && <span style={{ fontSize: 10, color: 'var(--grey-300)' }}>Prev.</span>}
                      </div>

                      {/* Mini bars */}
                      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: maxBarHeight, marginBottom: 7 }}>
                        <div style={{ flex: 1, background: 'var(--navy-900)', height: Math.max(3, d.ing / maxIngAnual * maxBarHeight), borderRadius: '2px 2px 0 0', opacity: op }} />
                        <div style={{ flex: 1, background: 'var(--grey-300)', height: Math.max(3, d.gas / maxIngAnual * maxBarHeight), borderRadius: '2px 2px 0 0', opacity: op }} />
                        <div style={{ flex: 1, background: 'var(--teal-600)', height: Math.max(3, d.fin / maxIngAnual * maxBarHeight), borderRadius: '2px 2px 0 0', opacity: op }} />
                      </div>

                      {/* Excedente */}
                      <div style={{
                        fontSize: 12, fontWeight: 700, fontFamily: 'IBM Plex Mono',
                        color: d.excedente >= 0 ? 'var(--navy-900)' : 'var(--grey-700)',
                      }}>
                        {d.excedente >= 0 ? '+' : '−'}{formatEur(Math.abs(d.excedente))} €
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--grey-400)', marginTop: 1 }}>
                        {formatEur(d.ing)} € ingresos
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Vista mensual ── */}
            {vista === 'mensual' && (
              <>
                {/* Bank account selector grid */}
                {loading ? (
                  <div style={{ fontSize: 13, color: 'var(--grey-400)', padding: '8px 0' }}>Cargando cuentas…</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7 }}>
                    {accounts.map((c, i) => {
                      const bd = accountBreakdown.get(c.id);
                      const saldoHoy = bd?.saldoHoy ?? 0;
                      const finMes = bd?.finMesEstimado ?? 0;
                      const punteados = bd?.punteados ?? 0;
                      const total = bd?.total ?? 0;
                      const isNeg = finMes < 0;
                      const isSelected = cuentaSel === i;

                      return (
                        <div
                          key={c.id}
                          className="tv4-bank-card"
                          onClick={() => setCuentaSel(isSelected ? -1 : i)}
                          style={{
                            border: `${isSelected ? 2 : 1.5}px solid ${isSelected ? 'var(--navy-900)' : 'var(--grey-200)'}`,
                            background: isSelected ? 'var(--navy-50)' : 'var(--white)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--grey-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                            {isNeg && <AlertCircle size={12} color="var(--grey-400)" />}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--grey-400)', marginBottom: 2 }}>Saldo hoy</div>
                          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--navy-900)', marginBottom: 6 }}>
                            {saldoHoy !== 0 ? formatEur(saldoHoy) + ' €' : '—'}
                          </div>
                          <div style={{ height: 1, background: 'var(--grey-100)', marginBottom: 6 }} />
                          <div style={{ fontSize: 10, color: 'var(--grey-400)' }}>Fin mes est.</div>
                          <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: isNeg ? 'var(--grey-700)' : 'var(--navy-900)' }}>
                            {isNeg ? '−' : ''}{formatEur(Math.abs(finMes))} €
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--grey-400)', marginTop: 4 }}>
                            {punteados}/{total} punteados
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Movement list — always visible */}
                {(() => {
                  const selAccName = cuentaSel >= 0 ? accounts[cuentaSel]?.name : 'Todos los movimientos';
                  const bd = cuentaSel >= 0 ? accountBreakdown.get(accounts[cuentaSel]?.id) : null;
                  const punteadosCount = bd != null
                    ? bd.punteados
                    : events.filter(e => e.status === 'confirmado').length;
                  const totalCount = bd != null
                    ? bd.total
                    : events.length;
                  return (
                  <>
                    {/* List header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--grey-900)' }}>
                          {selAccName} · {MESES[mesActivo]} {año}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--grey-400)' }}>
                          {punteadosCount}/{totalCount} punteados
                        </span>
                      </div>
                      {/* Filter buttons */}
                      <div style={{ display: 'flex', gap: 5 }}>
                        {[
                          { id: 'pendiente', label: 'Pendientes', cls: '' },
                          { id: 'ingresos', label: 'Ingresos', cls: 'filtro-btn-navy' },
                          { id: 'gastos', label: 'Gastos', cls: 'filtro-btn-grey' },
                          { id: 'financiacion', label: 'Financiación', cls: 'filtro-btn-teal' },
                          { id: 'todos', label: 'Todos', cls: '' },
                          { id: 'confirmado', label: 'Confirmados', cls: '' },
                        ].map(f => (
                          <button
                            key={f.id}
                            className={`filtro-btn ${f.cls} ${filtro === f.id ? 'on' : ''}`}
                            onClick={() => setFiltro(f.id)}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Movement rows */}
                    <div>
                      <div className="tv4-mov-panel">
                        {loading ? (
                          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--grey-400)', fontSize: 13 }}>Cargando…</div>
                        ) : (
                          renderMovsByDate(filteredMovements)
                        )}
                      </div>
                      <div style={{
                        padding: '9px 16px',
                        background: 'var(--white)',
                        border: '1px solid var(--grey-200)',
                        borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        fontSize: 11,
                        color: 'var(--grey-400)',
                      }}>
                        Clic en el círculo para puntear · Clic en el importe para editar inline
                      </div>
                    </div>
                  </>
                  );
                })()}
              </>
            )}
          </>
        )}

        {/* ─ TAB: CUENTAS BANCARIAS ─ */}
        {tab === 'cuentas' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--grey-400)' }}>
                Cuentas y tarjetas
              </div>
              <button className="btn-primary-v4" onClick={() => setShowAccountModal(true)}>
                <Plus size={13} /> Nueva cuenta
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {accounts.map(c => {
                const bd = accountBreakdown.get(c.id);
                const saldoHoy = bd?.saldoHoy ?? 0;
                const rawAccount = rawAccounts.find(a => a.id === c.dbId) ?? null;
                return (
                  <div key={c.id} className="tv4-cuenta-card">
                    {/* Inicial + nombre */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--navy-50)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: 'var(--navy-900)',
                        flexShrink: 0,
                      }}>
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--grey-900)' }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--grey-400)' }}>{c.ibanMask || '—'}</div>
                      </div>
                    </div>

                    {/* Saldo hoy */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--grey-500)' }}>Saldo hoy</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--navy-900)' }}>
                        {saldoHoy !== 0 ? formatEur(saldoHoy) + ' €' : '—'}
                      </span>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--grey-100)' }}>
                      <button
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--teal-600)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={() => {
                          if (rawAccount) {
                            setEditingAccount(rawAccount);
                            setShowAccountModal(true);
                          }
                        }}
                      >
                        <Edit2 size={11} />
                        Editar
                      </button>
                      <button
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={async () => {
                          if (!rawAccount) return;
                          try {
                            const allMovements = JSON.parse(localStorage.getItem('atlas_movimientos') || '[]');
                            const movementsCount = allMovements.filter((m: any) => m.cuentaId === rawAccount.id && !m.deleted_at).length;
                            setDeleteConfirmation({ account: rawAccount, movementsCount, deleteMovements: false });
                          } catch {
                            toast.error('Error al verificar la cuenta');
                          }
                        }}
                      >
                        <Trash2 size={11} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Dashed add card */}
              <div className="tv4-cuenta-dashed" onClick={() => setShowAccountModal(true)} style={{ cursor: 'pointer' }}>
                <Plus size={20} />
                <span style={{ fontSize: 12, fontWeight: 500, marginTop: 6 }}>Nueva cuenta</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ══ MODAL — NUEVA/EDITAR CUENTA BANCARIA ══ */}
      <AccountFormModal
        open={showAccountModal}
        onClose={() => { setShowAccountModal(false); setEditingAccount(null); }}
        onSuccess={reloadAfterAccountChange}
        editingAccount={editingAccount}
      />

      {/* ══ MODAL — ELIMINAR CUENTA BANCARIA ══ */}
      {deleteConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} style={{ color: 'var(--error)', flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--grey-900)' }}>Eliminar cuenta definitivamente</span>
            </div>
            <div style={{ background: 'rgba(220, 53, 69, 0.1)', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--error)', margin: 0 }}>
                <strong>Acción irreversible:</strong> La cuenta <strong>{deleteConfirmation.account.alias || deleteConfirmation.account.iban}</strong> será eliminada permanentemente.
              </p>
            </div>
            {deleteConfirmation.movementsCount > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--grey-700)' }}>
                  <input
                    type="checkbox"
                    checked={deleteConfirmation.deleteMovements}
                    onChange={(e) => setDeleteConfirmation({ ...deleteConfirmation, deleteMovements: e.target.checked })}
                    style={{ marginTop: 2 }}
                  />
                  También eliminar sus {deleteConfirmation.movementsCount} movimientos (irreversible)
                </label>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: '1px solid var(--grey-200)', background: 'var(--white)', cursor: 'pointer', color: 'var(--grey-700)' }}
                onClick={() => setDeleteConfirmation(null)}
              >
                Cancelar
              </button>
              <button
                disabled={deleting || (deleteConfirmation.movementsCount > 0 && !deleteConfirmation.deleteMovements)}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: 'none', background: 'var(--error)', color: '#fff', cursor: 'pointer', opacity: (deleting || (deleteConfirmation.movementsCount > 0 && !deleteConfirmation.deleteMovements)) ? 0.5 : 1 }}
                onClick={async () => {
                  if (!deleteConfirmation) return;
                  const accountId = deleteConfirmation.account.id;
                  if (!accountId) {
                    toast.error('No se puede eliminar: la cuenta no tiene identificador');
                    return;
                  }
                  setDeleting(true);
                  try {
                    await cuentasService.hardDelete(accountId, {
                      deleteMovements: deleteConfirmation.deleteMovements,
                      confirmCascade: true,
                    });
                    toast.success('Cuenta eliminada definitivamente');
                    setDeleteConfirmation(null);
                    await reloadAfterAccountChange();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Error al eliminar la cuenta');
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DRAWER — AÑADIR MOVIMIENTO ══ */}
      <div
        className={`tv4-overlay ${showAddModal ? 'tv4-overlay--open' : ''}`}
        onClick={() => setShowAddModal(false)}
      />
      <aside className={`tv4-drawer ${showAddModal ? 'tv4-drawer--open' : ''}`}>
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
                  className={`tv3-tipo-opt ${newMovForm.type === val ? 'tv3-tipo-opt--on' : ''}`}
                  onClick={() => setNewMovForm(p => ({ ...p, type: val }))}
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
              value={newMovForm.concept}
              onChange={e => setNewMovForm(p => ({ ...p, concept: e.target.value }))}
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
              value={newMovForm.amount}
              onChange={e => setNewMovForm(p => ({ ...p, amount: e.target.value }))}
            />
          </div>

          {/* Cuenta origen */}
          <div>
            <label className="tv3-field-label">{newMovForm.type === 'transfer' ? 'Cuenta origen' : 'Cuenta'}</label>
            <select
              className="tv3-field-select"
              value={newMovForm.accountId}
              onChange={e => setNewMovForm(p => ({ ...p, accountId: e.target.value }))}
            >
              <option value="">{newMovForm.type === 'transfer' ? 'Selecciona cuenta origen' : 'Selecciona cuenta'}</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Cuenta destino (solo transferencia) */}
          {newMovForm.type === 'transfer' && (
            <div>
              <label className="tv3-field-label">Cuenta destino</label>
              <select
                className="tv3-field-select"
                value={newMovForm.targetAccountId}
                onChange={e => setNewMovForm(p => ({ ...p, targetAccountId: e.target.value }))}
              >
                <option value="">Selecciona cuenta destino</option>
                {accounts.filter(a => a.id !== newMovForm.accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* Fecha */}
          <div>
            <label className="tv3-field-label">Fecha</label>
            <input
              className="tv3-field-input"
              type="date"
              value={newMovForm.date}
              onChange={e => setNewMovForm(p => ({ ...p, date: e.target.value }))}
            />
          </div>
        </div>

        <div className="tv3-drawer-footer">
          <button className="tv3-btn tv3-btn--ghost" onClick={() => setShowAddModal(false)}>Cancelar</button>
          <button className="tv3-btn tv3-btn--primary" onClick={handleSaveNewMovement} disabled={savingMovement}>
            {savingMovement ? 'Guardando…' : <><CheckCircle2 size={14} /> Confirmar</>}
          </button>
        </div>
      </aside>

    </div>
  );
};

export default TesoreriaV4;
