import type { Account as DBAccount, Movement as DBMovement, TreasuryEvent as DBTreasuryEvent } from '../../services/db';
import { calculateAccountBalanceAtDate } from '../../services/accountBalanceService';

interface CalculateTreasuryMonthOpeningBalanceInput {
  account: DBAccount;
  selectedMonth: string;
  treasuryEvents: DBTreasuryEvent[];
  movements: DBMovement[];
  today?: Date;
  resolveEventAccountId?: (event: DBTreasuryEvent) => number | undefined;
}

const toMonthKey = (value: string): string => (value.includes('T') ? value.split('T')[0] : value).slice(0, 7);

const nextMonthKey = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthStart = (monthKey: string): string => `${monthKey}-01`;

const getEventSignedAmount = (event: DBTreasuryEvent): number => (event.type === 'income' ? event.amount : -event.amount);

export function calculateTreasuryMonthOpeningBalance({
  account,
  selectedMonth,
  treasuryEvents,
  movements,
  today = new Date(),
  resolveEventAccountId = (event) => event.accountId,
}: CalculateTreasuryMonthOpeningBalanceInput): number {
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  if (selectedMonth <= todayMonth) {
    return calculateAccountBalanceAtDate({
      account,
      cutoffDate: getMonthStart(selectedMonth),
      treasuryEvents,
      movements,
    });
  }

  let rollingBalance = calculateAccountBalanceAtDate({
    account,
    cutoffDate: getMonthStart(todayMonth),
    treasuryEvents,
    movements,
  });

  let monthCursor = todayMonth;
  while (monthCursor < selectedMonth) {
    const monthDelta = treasuryEvents
      .filter((event) => resolveEventAccountId(event) === account.id)
      .filter((event) => toMonthKey(event.predictedDate) === monthCursor)
      .reduce((sum, event) => sum + getEventSignedAmount(event), 0);

    rollingBalance += monthDelta;
    monthCursor = nextMonthKey(monthCursor);
  }

  return rollingBalance;
}
