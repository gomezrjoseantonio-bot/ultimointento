import { initDB, Account, TreasuryEvent, Movement } from './db';

function toDateOnly(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return date.includes('T') ? date.split('T')[0] : date;
}

function getSignedEventAmount(event: TreasuryEvent): number {
  // Para un evento YA materializado (executed/confirmed) manda el importe REAL,
  // no el previsto: una previsión de 30 € que se confirmó en 13,38 € tiene que
  // descontar del saldo 13,38, no los 30. `actualAmount` se rellena al puntear
  // (confirmTreasuryEvent / confirmDecisions) y solo existe en lo ya cobrado, así
  // que un previsto puro cae a `amount` como antes.
  //
  // Magnitud SIEMPRE por |·| y dirección por `type`. Los generadores no comparten
  // convención de signo: treasurySyncService guarda gastos en POSITIVO y
  // compromisos/vivienda en NEGATIVO. Sin Math.abs, un gasto negativo se contaba
  // como INGRESO (`-(-100)=+100`) → saldos mal y que bailan al regenerar.
  const base = event.actualAmount != null ? event.actualAmount : event.amount;
  const magnitude = Math.abs(base);
  return event.type === 'income' ? magnitude : -magnitude;
}

function isCommittedTreasuryEvent(event: TreasuryEvent): boolean {
  return event.status == null || event.status === 'confirmed' || event.status === 'executed';
}

function buildEntryKey(accountId: number, date: string, signedAmount: number): string {
  return `${accountId}|${toDateOnly(date) ?? date}|${signedAmount}`;
}

/**
 * El corte para pedir el saldo VIVO de una cuenta · MAÑANA, no hoy.
 *
 * `calculateAccountBalanceAtDate` filtra por `< cutoffDate` ESTRICTAMENTE, así
 * que pasarle hoy deja fuera todo lo de hoy —justo lo que el usuario acaba de
 * confirmar—. El dinero que salió del banco esta mañana está fuera del banco
 * esta tarde, así que el saldo de hoy tiene que incluir lo de hoy.
 *
 * Vive aquí, exportado, para que Tesorería y el Panel usen EL MISMO corte: si
 * cada pantalla lo calculaba por su cuenta, el "hoy tienes" del Panel y el
 * "SALDO" de Tesorería podían no cuadrar. Recibe `hoy` en `YYYY-MM-DD`.
 */
export function corteParaSaldoVivo(hoy: string): string {
  const d = new Date(`${hoy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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

  // Frontera del saldo inicial. `openingBalance` es el saldo YA existente a la
  // fecha `openingBalanceDate`, así que todo movimiento o evento ANTERIOR a esa
  // fecha ya está incluido en él: sumarlo otra vez como delta lo contaría dos
  // veces. Excluimos, por tanto, lo estrictamente anterior a la apertura (el
  // movimiento sintético `isOpeningBalance` ya se excluye aparte). Sin
  // `openingBalanceDate` no hay frontera y se cuenta todo, como antes.
  const isAfterOpening = (dateOnly: string): boolean =>
    !accountOpeningDate || dateOnly >= accountOpeningDate;

  const priorAccountEvents = treasuryEvents.filter(e => (
    e.accountId === account.id &&
    toDateOnly(e.predictedDate) &&
    toDateOnly(e.predictedDate)! < cutoffDate &&
    isAfterOpening(toDateOnly(e.predictedDate)!)
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
    toDateOnly(m.date)! < cutoffDate &&
    isAfterOpening(toDateOnly(m.date)!)
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
