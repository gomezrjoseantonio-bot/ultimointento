import { initDB, Account, TreasuryEvent, Movement } from './db';

function toDateOnly(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return date.includes('T') ? date.split('T')[0] : date;
}

function getSignedEventAmount(event: TreasuryEvent): number {
  if (event.type === 'income') return event.amount;
  return -event.amount;
}

export function calculateAccountBalanceAtDate(params: {
  account: Account;
  cutoffDate: string;
  treasuryEvents: TreasuryEvent[];
  movements: Movement[];
}): number {
  const { account, cutoffDate, treasuryEvents, movements } = params;
  const accountOpeningDate = toDateOnly(account.openingBalanceDate);
  const openingDateApplies = !accountOpeningDate || accountOpeningDate <= cutoffDate;
  const openingBalance = openingDateApplies ? (account.openingBalance ?? 0) : 0;

  const eventsDelta = treasuryEvents
    .filter(e => e.accountId === account.id && toDateOnly(e.predictedDate) && toDateOnly(e.predictedDate)! < cutoffDate)
    .reduce((sum, e) => sum + getSignedEventAmount(e), 0);

  const movementsDelta = movements
    .filter(m => m.accountId === account.id && toDateOnly(m.date) && toDateOnly(m.date)! < cutoffDate)
    .reduce((sum, m) => sum + m.amount, 0);

  return openingBalance + eventsDelta + movementsDelta;
}

export async function calculateTotalInitialCash(cutoffDate: string): Promise<number> {
  const db = await initDB();
  const [accounts, treasuryEvents, movements] = await Promise.all([
    db.getAll('accounts'),
    db.getAll('treasuryEvents'),
    db.getAll('movements'),
  ]);

  return accounts
    .filter(a => a.id != null && (a.status === 'ACTIVE' || a.activa))
    .reduce((sum, account) => {
      return sum + calculateAccountBalanceAtDate({
        account,
        cutoffDate,
        treasuryEvents,
        movements,
      });
    }, 0);
}

export async function rollForwardAccountBalancesToMonth(year: number, month: number): Promise<void> {
  const db = await initDB();
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const [accounts, treasuryEvents, movements] = await Promise.all([
    db.getAll('accounts'),
    db.getAll('treasuryEvents'),
    db.getAll('movements'),
  ]);

  for (const account of accounts) {
    if (!account.id || (account.status !== 'ACTIVE' && !account.activa)) continue;

    const computedBalance = calculateAccountBalanceAtDate({
      account,
      cutoffDate: monthStart,
      treasuryEvents,
      movements,
    });

    if (account.balance !== computedBalance) {
      await db.put('accounts', {
        ...account,
        balance: computedBalance,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
