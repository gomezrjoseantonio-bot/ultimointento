import type { Movement } from '../../services/db';
import type { TreasuryEvent } from './TreasuryReconciliationView';

interface SummaryAccount {
  id: string;
  balance: number;
}

interface SummaryMovement extends Pick<Movement, 'id' | 'accountId' | 'amount' | 'date' | 'isOpeningBalance'> {}

interface AccountTreasurySummaryInput {
  account: SummaryAccount;
  events: TreasuryEvent[];
  movements?: SummaryMovement[];
  selectedMonth: string;
  today?: Date;
}

export interface AccountTreasurySummary {
  hoy: number;
  finMes: number;
  totalPunteado: number;
  confirmadoHastaHoy: number;
  confirmadoTotal: number;
  pendienteHastaHoy: number;
  pendienteTotal: number;
  movimientosHastaHoy: number;
  movimientosTotal: number;
}

const toDateOnlyString = (value: string): string => value.includes('T') ? value.split('T')[0] : value;

const toMonthKey = (value: string): string => toDateOnlyString(value).slice(0, 7);

const getSignedAmount = (event: TreasuryEvent): number => (event.type === 'income' ? event.amount : -event.amount);

const getMovementSignedAmount = (movement: SummaryMovement): number => movement.amount;

const buildEntryKey = (accountId: string, date: string, signedAmount: number): string => (
  `${accountId}|${toDateOnlyString(date)}|${signedAmount}`
);

const toLocalDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function calculateAccountTreasurySummary({
  account,
  events,
  movements = [],
  selectedMonth,
  today = new Date(),
}: AccountTreasurySummaryInput): AccountTreasurySummary {
  const todayOnly = toLocalDateKey(today);
  const viewingCurrentMonth = selectedMonth === todayOnly.slice(0, 7);

  const accountEvents = events.filter((event) => (
    event.accountId === account.id && toMonthKey(event.date) === selectedMonth
  ));

  const reconciledMovementIds = new Set(
    accountEvents
      .map((event) => event.movementId)
      .filter((movementId): movementId is number => Number.isFinite(movementId))
  );

  const rawAccountMovements = movements.filter((movement) => (
    String(movement.accountId) === account.id &&
    !reconciledMovementIds.has(movement.id ?? Number.NaN) &&
    !movement.isOpeningBalance &&
    toMonthKey(movement.date) === selectedMonth
  ));

  const implicitMovementMatchesForConfirmed = new Map<string, number>();
  for (const event of accountEvents) {
    if (event.status !== 'confirmado' || Number.isFinite(event.movementId)) continue;
    const key = buildEntryKey(account.id, event.date, getSignedAmount(event));
    implicitMovementMatchesForConfirmed.set(key, (implicitMovementMatchesForConfirmed.get(key) ?? 0) + 1);
  }

  const accountMovements: SummaryMovement[] = [];
  for (const movement of rawAccountMovements) {
    const key = buildEntryKey(account.id, movement.date, getMovementSignedAmount(movement));
    const remainingConfirmedMatches = implicitMovementMatchesForConfirmed.get(key) ?? 0;
    if (remainingConfirmedMatches > 0) {
      implicitMovementMatchesForConfirmed.set(key, remainingConfirmedMatches - 1);
      continue;
    }
    accountMovements.push(movement);
  }

  const matchedPendingKeys = new Map<string, number>();
  for (const movement of accountMovements) {
    const key = buildEntryKey(account.id, movement.date, getMovementSignedAmount(movement));
    matchedPendingKeys.set(key, (matchedPendingKeys.get(key) ?? 0) + 1);
  }

  const pendingEvents = accountEvents.filter((event) => event.status !== 'confirmado');
  const unmatchedPendingEvents = pendingEvents.filter((event) => {
    if (Number.isFinite(event.movementId)) return true;
    const key = buildEntryKey(account.id, event.date, getSignedAmount(event));
    const availableMatches = matchedPendingKeys.get(key) ?? 0;
    if (availableMatches <= 0) return true;
    matchedPendingKeys.set(key, availableMatches - 1);
    return false;
  });

  const confirmadoTotal = accountEvents
    .filter((event) => event.status === 'confirmado')
    .reduce((sum, event) => sum + getSignedAmount(event), 0);

  const confirmadoHastaHoy = accountEvents
    .filter((event) => event.status === 'confirmado')
    .filter((event) => !viewingCurrentMonth || toDateOnlyString(event.date) <= todayOnly)
    .reduce((sum, event) => sum + getSignedAmount(event), 0);

  const pendienteHastaHoy = unmatchedPendingEvents
    .filter((event) => !viewingCurrentMonth || toDateOnlyString(event.date) <= todayOnly)
    .reduce((sum, event) => sum + getSignedAmount(event), 0);

  const pendienteTotal = unmatchedPendingEvents
    .reduce((sum, event) => sum + getSignedAmount(event), 0);

  const movimientosTotal = accountMovements
    .reduce((sum, movement) => sum + getMovementSignedAmount(movement), 0);

  const movimientosHastaHoy = accountMovements
    .filter((movement) => !viewingCurrentMonth || toDateOnlyString(movement.date) <= todayOnly)
    .reduce((sum, movement) => sum + getMovementSignedAmount(movement), 0);

  return {
    hoy: account.balance + confirmadoHastaHoy + movimientosHastaHoy,
    finMes: account.balance + confirmadoTotal + pendienteTotal + movimientosTotal,
    totalPunteado: account.balance + confirmadoTotal + movimientosTotal,
    confirmadoHastaHoy,
    confirmadoTotal,
    pendienteHastaHoy,
    pendienteTotal,
    movimientosHastaHoy,
    movimientosTotal,
  };
}
