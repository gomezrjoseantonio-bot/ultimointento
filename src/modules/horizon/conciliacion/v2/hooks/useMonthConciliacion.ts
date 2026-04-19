import { useCallback, useEffect, useMemo, useState } from 'react';
import { initDB } from '../../../../../services/db';
import type {
  Account,
  Document,
  Property,
  TreasuryEvent,
} from '../../../../../services/db';
import {
  computeDocStatus,
  computeSlotState,
  getDocDefaultsForCategory,
  type DocRequirement,
} from '../../../../../services/documentRequirementsService';
import { dayOfMonth, extractDate, weekdayLabel } from '../utils/conciliacionFormatters';

export type AmountType = 'income' | 'expense' | 'financing';
export type RowState = 'predicted' | 'confirmed';

export interface DocSlotState {
  documentId?: number;
  docName?: string;
  docSize?: number;
  docUploadedAt?: string;
  noAplica: boolean;
  requirement: DocRequirement;
  state: 'attached' | 'missing' | 'not_applicable';
}

export interface SingleRow {
  type: 'single';
  id: string;
  eventId: number;
  movementId?: number;

  date: string;
  state: RowState;
  concept: string;
  counterparty: string;
  accountId?: number;
  accountLabel: string;
  amount: number;            // importe con signo (positivo = ingreso; negativo = gasto/financiación)
  amountType: AmountType;

  categoryLabel: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: number;
  inmuebleAlias?: string;

  fractional?: { paid: number; total: number };

  factura: DocSlotState;
  justificante: DocSlotState;
  docStatus: 'complete' | 'incomplete';

  // Referencia al source para edición (raw event)
  _event: TreasuryEvent;
}

export interface RentGroupRow {
  type: 'rent_group';
  id: string;
  propertyId: number;
  propertyAlias: string;
  date: string;
  accountLabel: string;
  totalAmount: number;
  checkState: 'none' | 'some' | 'all';
  children: SingleRow[];
}

export type RowItem = SingleRow | RentGroupRow;

export interface DayBucket {
  date: string;
  dayLabel: string;       // "05"
  weekdayLabel: string;   // "domingo"
  monthLabel: string;     // "abril"
  items: RowItem[];
  totalIncome: number;
  totalExpense: number;
  totalFinancing: number;
  count: number;
}

export interface MonthKpis {
  predictedNet: number;
  confirmedNet: number;
  predictedIncome: number;
  confirmedIncome: number;
  predictedExpense: number;
  confirmedExpense: number;
  predictedFinancing: number;
  confirmedFinancing: number;
}

export interface Filters {
  year: number;
  month0: number;          // 0-11
  accountId: number | 'all';
  ambito: 'all' | 'PERSONAL' | 'INMUEBLE';
  stateFilter: 'all' | 'pending' | 'confirmed';
  search: string;
}

export interface UseMonthConciliacionResult {
  loading: boolean;
  days: DayBucket[];
  kpis: MonthKpis;
  accounts: Account[];
  properties: Property[];
  reload: () => Promise<void>;
}

// ─── helpers ────────────────────────────────────────────────────────────

function accountLabelOf(account: Account | undefined): string {
  if (!account) return '—';
  if (account.alias) return account.alias;
  const bank = account.banco?.name ?? account.bank ?? '';
  const iban = account.iban ?? '';
  const tail = iban ? iban.slice(-4) : '';
  return bank && tail ? `${bank} ·${tail}` : bank || `Cuenta ${account.id ?? ''}`;
}

function resolveCounterpartyFromSource(
  event: TreasuryEvent,
  contractsById: Map<number, any>,
  prestamosById: Map<string, any>,
): string {
  if (event.counterparty && event.counterparty.trim()) {
    return event.counterparty.trim();
  }

  if (event.sourceType === 'contract' || event.sourceType === 'contrato') {
    if (event.sourceId != null) {
      const c = contractsById.get(event.sourceId);
      if (c) {
        const full = `${c.inquilino?.nombre ?? c.tenant?.name ?? ''} ${c.inquilino?.apellidos ?? ''}`.trim();
        if (full) return full;
        if (c.inquilino?.dni) return c.inquilino.dni;
        if (c.tenant?.nif) return c.tenant.nif;
      }
    }
  }
  if (event.contratoId != null) {
    const c = contractsById.get(event.contratoId);
    if (c) {
      const full = `${c.inquilino?.nombre ?? c.tenant?.name ?? ''} ${c.inquilino?.apellidos ?? ''}`.trim();
      if (full) return full;
    }
  }

  if (event.sourceType === 'prestamo' || event.sourceType === 'hipoteca') {
    const id = event.prestamoId ?? (event.sourceId != null ? String(event.sourceId) : '');
    if (id) {
      const loan = prestamosById.get(id);
      if (loan?.nombre) return loan.nombre;
    }
  }
  if (event.prestamoId) {
    const loan = prestamosById.get(event.prestamoId);
    if (loan?.nombre) return loan.nombre;
  }

  if (event.sourceType === 'irpf_prevision') return 'AEAT';
  if (event.sourceType === 'nomina') return 'Empleador';

  return '';
}

function eventToSingleRow(
  event: TreasuryEvent,
  opts: {
    accountsById: Map<number, Account>;
    propertiesById: Map<number, Property>;
    docsById: Map<number, Document>;
    contractsById: Map<number, any>;
    prestamosById: Map<string, any>;
  },
): SingleRow {
  const {
    accountsById,
    propertiesById,
    docsById,
    contractsById,
    prestamosById,
  } = opts;

  const account = event.accountId != null ? accountsById.get(event.accountId) : undefined;
  const property = event.inmuebleId != null ? propertiesById.get(event.inmuebleId) : undefined;

  const amountType: AmountType = event.type;
  const magnitude = Math.abs(event.actualAmount ?? event.amount);
  const amount = event.type === 'income' ? magnitude : -magnitude;

  const effectiveDate = event.status === 'executed'
    ? (event.actualDate ?? event.predictedDate)
    : event.predictedDate;

  const rowState: RowState = event.status === 'executed' ? 'confirmed' : 'predicted';

  const defaults = getDocDefaultsForCategory(event.categoryLabel);

  const facturaDoc = event.facturaId != null ? docsById.get(event.facturaId) : undefined;
  const justificanteDoc = event.justificanteId != null ? docsById.get(event.justificanteId) : undefined;

  const facturaState = computeSlotState(defaults.factura, !!facturaDoc, !!event.facturaNoAplica);
  const justificanteState = computeSlotState(defaults.justificante, !!justificanteDoc, !!event.justificanteNoAplica);

  const counterparty = resolveCounterpartyFromSource(event, contractsById, prestamosById);

  return {
    type: 'single',
    id: `event:${event.id}`,
    eventId: event.id!,
    movementId: event.executedMovementId ?? event.movementId,
    date: extractDate(effectiveDate),
    state: rowState,
    concept: event.description,
    counterparty,
    accountId: event.accountId,
    accountLabel: accountLabelOf(account),
    amount,
    amountType,
    categoryLabel: event.categoryLabel ?? '',
    ambito: event.ambito ?? 'PERSONAL',
    inmuebleId: event.inmuebleId,
    inmuebleAlias: property?.alias,
    factura: {
      documentId: event.facturaId,
      docName: facturaDoc?.filename,
      docSize: facturaDoc?.size,
      docUploadedAt: facturaDoc?.uploadDate,
      noAplica: !!event.facturaNoAplica,
      requirement: defaults.factura,
      state: facturaState,
    },
    justificante: {
      documentId: event.justificanteId,
      docName: justificanteDoc?.filename,
      docSize: justificanteDoc?.size,
      docUploadedAt: justificanteDoc?.uploadDate,
      noAplica: !!event.justificanteNoAplica,
      requirement: defaults.justificante,
      state: justificanteState,
    },
    docStatus: computeDocStatus(
      event.categoryLabel,
      !!facturaDoc,
      !!event.facturaNoAplica,
      !!justificanteDoc,
      !!event.justificanteNoAplica,
    ),
    _event: event,
  };
}

function isRentalCategory(label?: string): boolean {
  if (!label) return false;
  const n = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return n.includes('alquiler') || n.includes('renta');
}

/**
 * Agrupa rentas del mismo inmueble y mismo día (>= 2 hijas → grupo).
 * Deja el resto intactas como filas singulares.
 */
function groupRentsByPropertyAndDay(rows: SingleRow[]): RowItem[] {
  const buckets = new Map<string, SingleRow[]>();
  const others: SingleRow[] = [];

  for (const row of rows) {
    if (
      row.amountType === 'income' &&
      isRentalCategory(row.categoryLabel) &&
      row.inmuebleId != null
    ) {
      const key = `${row.inmuebleId}:${row.date}`;
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    } else {
      others.push(row);
    }
  }

  const result: RowItem[] = [...others];

  for (const [, children] of buckets) {
    if (children.length >= 2) {
      const first = children[0];
      const allConfirmed = children.every((c) => c.state === 'confirmed');
      const anyConfirmed = children.some((c) => c.state === 'confirmed');
      const checkState: 'all' | 'some' | 'none' =
        allConfirmed ? 'all' : anyConfirmed ? 'some' : 'none';
      const uniqAccounts = new Set(children.map((c) => c.accountLabel));
      result.push({
        type: 'rent_group',
        id: `group:property:${first.inmuebleId}:${first.date}`,
        propertyId: first.inmuebleId!,
        propertyAlias: first.inmuebleAlias ?? '',
        date: first.date,
        accountLabel: uniqAccounts.size === 1 ? first.accountLabel : 'Varias',
        totalAmount: children.reduce((s, c) => s + c.amount, 0),
        checkState,
        children,
      });
    } else {
      result.push(...children);
    }
  }

  return result;
}

const MONTHS_ES_SHORT = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function bucketByDay(rows: SingleRow[]): DayBucket[] {
  const byDate = new Map<string, SingleRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  const days: DayBucket[] = [];
  const sortedDates = [...byDate.keys()].sort();

  for (const date of sortedDates) {
    const singles = byDate.get(date)!;
    const items = groupRentsByPropertyAndDay(singles);
    const totalIncome = singles
      .filter((r) => r.amountType === 'income')
      .reduce((s, r) => s + r.amount, 0);
    const totalExpense = singles
      .filter((r) => r.amountType === 'expense')
      .reduce((s, r) => s + r.amount, 0);
    const totalFinancing = singles
      .filter((r) => r.amountType === 'financing')
      .reduce((s, r) => s + r.amount, 0);
    const monthIdx = Number(date.slice(5, 7)) - 1;

    days.push({
      date,
      dayLabel: dayOfMonth(date),
      weekdayLabel: weekdayLabel(date),
      monthLabel: MONTHS_ES_SHORT[monthIdx] ?? '',
      items,
      totalIncome,
      totalExpense,
      totalFinancing,
      count: singles.length,
    });
  }

  return days;
}

function computeKpis(rows: SingleRow[]): MonthKpis {
  const kpis: MonthKpis = {
    predictedNet: 0,
    confirmedNet: 0,
    predictedIncome: 0,
    confirmedIncome: 0,
    predictedExpense: 0,
    confirmedExpense: 0,
    predictedFinancing: 0,
    confirmedFinancing: 0,
  };

  for (const r of rows) {
    const confirmed = r.state === 'confirmed';

    // Totales previstos = TODOS los eventos del mes, con o sin punteo (la
    // previsión sigue siendo válida aunque ya esté punteada).
    if (r.amountType === 'income') {
      kpis.predictedIncome += r.amount;
      if (confirmed) kpis.confirmedIncome += r.amount;
    } else if (r.amountType === 'expense') {
      kpis.predictedExpense += r.amount;
      if (confirmed) kpis.confirmedExpense += r.amount;
    } else if (r.amountType === 'financing') {
      kpis.predictedFinancing += r.amount;
      if (confirmed) kpis.confirmedFinancing += r.amount;
    }
  }

  kpis.predictedNet = kpis.predictedIncome + kpis.predictedExpense + kpis.predictedFinancing;
  kpis.confirmedNet = kpis.confirmedIncome + kpis.confirmedExpense + kpis.confirmedFinancing;

  return kpis;
}

function applyFilters(rows: SingleRow[], filters: Filters): SingleRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.accountId !== 'all' && row.accountId !== filters.accountId) return false;
    if (filters.ambito !== 'all' && row.ambito !== filters.ambito) return false;
    if (filters.stateFilter === 'pending' && row.state !== 'predicted') return false;
    if (filters.stateFilter === 'confirmed' && row.state !== 'confirmed') return false;
    if (q) {
      const hay =
        `${row.concept} ${row.counterparty} ${row.categoryLabel} ${row.inmuebleAlias ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Hook principal de Conciliación v2.
 */
export function useMonthConciliacion(filters: Filters): UseMonthConciliacionResult {
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState<SingleRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const db = await initDB();

      const [events, accountsAll, propertiesAll, documentsAll, contractsAll, prestamosAll] =
        await Promise.all([
          db.getAll('treasuryEvents') as Promise<TreasuryEvent[]>,
          db.getAll('accounts') as Promise<Account[]>,
          db.getAll('properties') as Promise<Property[]>,
          db.getAll('documents') as Promise<Document[]>,
          // Contracts / prestamos: coerción suave — algunos entornos pueden no tenerlos.
          (db as any).getAll('contracts').catch(() => []),
          (db as any).getAll('prestamos').catch(() => []),
        ]);

      if (cancelled) return;

      const accountsById = new Map<number, Account>();
      for (const a of accountsAll) if (a.id != null) accountsById.set(a.id, a);

      const propertiesById = new Map<number, Property>();
      for (const p of propertiesAll) if (p.id != null) propertiesById.set(p.id, p);

      const docsById = new Map<number, Document>();
      for (const d of documentsAll) if (d.id != null) docsById.set(d.id, d);

      const contractsById = new Map<number, any>();
      for (const c of contractsAll as any[]) if (c?.id != null) contractsById.set(c.id, c);

      const prestamosById = new Map<string, any>();
      for (const p of prestamosAll as any[]) if (p?.id != null) prestamosById.set(String(p.id), p);

      const year = filters.year;
      const month0 = filters.month0;

      const monthEvents = events.filter((e) => {
        const iso = e.actualDate ?? e.predictedDate;
        if (!iso) return false;
        const y = Number(iso.slice(0, 4));
        const m = Number(iso.slice(5, 7)) - 1;
        return y === year && m === month0;
      });

      const rows = monthEvents.map((e) =>
        eventToSingleRow(e, {
          accountsById,
          propertiesById,
          docsById,
          contractsById,
          prestamosById,
        }),
      );

      setAllRows(rows);
      setAccounts(accountsAll);
      setProperties(propertiesAll);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.year, filters.month0, reloadToken]);

  const filteredRows = useMemo(() => applyFilters(allRows, filters), [allRows, filters]);

  const days = useMemo(() => bucketByDay(filteredRows), [filteredRows]);

  // Los KPIs se calculan sobre el MES sin filtros de estado/cuenta/ámbito — así,
  // al filtrar por "Pendientes", los KPIs siguen mostrando el mes completo.
  const kpis = useMemo(() => computeKpis(allRows), [allRows]);

  const reload = useCallback(async () => {
    setReloadToken((n) => n + 1);
  }, []);

  return { loading, days, kpis, accounts, properties, reload };
}
