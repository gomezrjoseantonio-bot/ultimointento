import { initDB, Account, TreasuryEvent, Movement } from './db';

function toDateOnly(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return date.includes('T') ? date.split('T')[0] : date;
}

function getSignedEventAmount(event: TreasuryEvent): number {
  if (event.type === 'income') return event.amount;
  return -event.amount;
}

function isCommittedTreasuryEvent(event: TreasuryEvent): boolean {
  return event.status == null || event.status === 'confirmed' || event.status === 'executed';
}

function buildEntryKey(accountId: number, date: string, signedAmount: number): string {
  return `${accountId}|${toDateOnly(date) ?? date}|${signedAmount}`;
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

  const priorAccountEvents = treasuryEvents.filter(e => (
    e.accountId === account.id &&
    toDateOnly(e.predictedDate) &&
    toDateOnly(e.predictedDate)! < cutoffDate
  ));

  const committedPriorEvents = priorAccountEvents.filter(isCommittedTreasuryEvent);

  const reconciledMovementIds = new Set(
    committedPriorEvents
      .map(event => event.movementId)
      .filter((movementId): movementId is number => Number.isFinite(movementId))
  );

  const rawMovements = movements.filter(m => (
    m.accountId === account.id &&
    !reconciledMovementIds.has(m.id ?? Number.NaN) &&
    !m.isOpeningBalance &&
    toDateOnly(m.date) &&
    toDateOnly(m.date)! < cutoffDate
  ));

  const implicitMovementMatches = new Map<string, number>();
  for (const event of committedPriorEvents) {
    if (Number.isFinite(event.movementId)) continue;
    const key = buildEntryKey(account.id as number, event.predictedDate, getSignedEventAmount(event));
    implicitMovementMatches.set(key, (implicitMovementMatches.get(key) ?? 0) + 1);
  }

  const movementsDelta = rawMovements.reduce((sum, movement) => {
    const key = buildEntryKey(account.id as number, movement.date, movement.amount);
    const remainingMatches = implicitMovementMatches.get(key) ?? 0;
    if (remainingMatches > 0) {
      implicitMovementMatches.set(key, remainingMatches - 1);
      return sum;
    }
    return sum + movement.amount;
  }, 0);

  const eventsDelta = committedPriorEvents
    .reduce((sum, e) => sum + getSignedEventAmount(e), 0);

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
