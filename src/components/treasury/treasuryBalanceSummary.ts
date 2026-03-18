import type { TreasuryEvent } from './TreasuryReconciliationView';

interface SummaryAccount {
  id: string;
  balance: number;
}

interface AccountTreasurySummaryInput {
  account: SummaryAccount;
  events: TreasuryEvent[];
  selectedMonth: string;
  today?: Date;
}

export interface AccountTreasurySummary {
  hoy: number;
  finMes: number;
  totalPunteado: number;
  confirmadoHastaHoy: number;
  confirmadoTotal: number;
  pendienteTotal: number;
}

const toDateOnlyString = (value: string): string => value.includes('T') ? value.split('T')[0] : value;

const toMonthKey = (value: string): string => toDateOnlyString(value).slice(0, 7);

const getSignedAmount = (event: TreasuryEvent): number => (event.type === 'income' ? event.amount : -event.amount);

const toLocalDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function calculateAccountTreasurySummary({
  account,
  events,
  selectedMonth,
  today = new Date(),
}: AccountTreasurySummaryInput): AccountTreasurySummary {
  const todayOnly = toLocalDateKey(today);
  const viewingCurrentMonth = selectedMonth === todayOnly.slice(0, 7);

  const accountEvents = events.filter((event) => (
    event.accountId === account.id && toMonthKey(event.date) === selectedMonth
  ));

  const confirmadoTotal = accountEvents
    .filter((event) => event.status === 'confirmado')
    .reduce((sum, event) => sum + getSignedAmount(event), 0);

  const confirmadoHastaHoy = accountEvents
    .filter((event) => event.status === 'confirmado')
    .filter((event) => !viewingCurrentMonth || toDateOnlyString(event.date) <= todayOnly)
    .reduce((sum, event) => sum + getSignedAmount(event), 0);

  const pendienteTotal = accountEvents
    .filter((event) => event.status !== 'confirmado')
    .reduce((sum, event) => sum + getSignedAmount(event), 0);

  return {
    hoy: account.balance + confirmadoHastaHoy,
    finMes: account.balance + confirmadoTotal + pendienteTotal,
    totalPunteado: account.balance + confirmadoTotal,
    confirmadoHastaHoy,
    confirmadoTotal,
    pendienteTotal,
  };
}
