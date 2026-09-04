import { initDB, Account, TreasuryEvent, Movement } from './db';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';

// ============================================================================
// E1.5 · el saldo cuenta las LÍNEAS del extracto que aún no tienen movimiento
// ============================================================================
//
// Tras el corte (E1.5) importar guarda la línea y NO crea el movimiento: el
// movimiento nace al resolver. Mientras tanto el dinero YA se movió en el
// banco, y el saldo tiene que decirlo (§20 · §29). Por eso el hub suma, además
// de los movimientos, las líneas HUÉRFANAS de la cuenta:
//
//   saldo = apertura + Σ eventos comprometidos + Σ movimientos
//         + Σ líneas con `movementIds` vacío Y sin `descarte`      ← nuevo
//
// Los dos candados del término nuevo:
//   · `movementIds` vacío · si la línea ya engendró movimiento, ese movimiento
//     es quien suma. Sin esto, doble conteo.
//   · sin `descarte` · una línea `duplicada` nace sin movimiento pero su dinero
//     ya está en la importación anterior; `sin_fecha` no se puede situar y
//     `sin_importe` vale 0. Sin esto, doble conteo de cada extracto solapado.
//
// Ignorar (§29) no crea movimiento → la línea sigue sumando. Correcto sin
// código extra: silenciar un recordatorio no es un estado de dinero.
//
// Antes del corte este término vale EXACTAMENTE 0 €: toda línea tiene
// movimiento o descarte. Se mergea probado y sin mover un euro.
// ============================================================================

/** Lo que el saldo necesita de una línea del extracto. */
export type LineaParaSaldo = Pick<
  LineaExtractoPersistida,
  'accountId' | 'fechaOperacion' | 'importe' | 'movementIds' | 'descarte'
>;

/**
 * ¿Suma esta línea por sí misma? · HUÉRFANA = sin movimiento detrás, sin
 * descarte y con fecha. Una vez resuelta (`movementIds` no vacío) deja de
 * sumar ella y suma su movimiento.
 */
export function esLineaHuerfana(l: LineaParaSaldo): boolean {
  return (l.movementIds?.length ?? 0) === 0 && !l.descarte && Boolean(l.fechaOperacion);
}

/**
 * Las líneas de `lineasExtracto`, para pasárselas al hub. Se leen UNA vez,
 * fuera de cualquier bucle por cuenta (el hub filtra por `accountId`). Si el
 * store no existe (base anterior a V91, mocks), no hay líneas: `[]`.
 */
export async function leerLineasParaSaldo(
  db: { getAll: (store: never) => Promise<unknown> }
): Promise<LineaParaSaldo[]> {
  try {
    return ((await db.getAll('lineasExtracto' as never)) ?? []) as LineaParaSaldo[];
  } catch {
    return [];
  }
}

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

/**
 * El día en que un evento MUEVE el dinero · para uno comprometido, el real
 * (`actualDate`, que estampa el punteo y el cuadre con el extracto); si no lo
 * tiene, el previsto.
 *
 * Antes se miraba siempre `predictedDate`, y un recibo previsto para el 4 que
 * el banco cargó el 1 se colocaba el 4: quedaba fuera del corte del día 2 (y
 * de la apertura anclada a ese día) mientras su movimiento del día 1 ya
 * estaba dentro del saldo del banco. Al llegar el día 4 el saldo bajaba por
 * segunda vez. Medido en la cuenta de Jose: 151,44 € de menos tres días
 * después de anclar.
 */
function fechaDelEvento(event: TreasuryEvent): string | undefined {
  return toDateOnly(isCommittedTreasuryEvent(event) ? event.actualDate || event.predictedDate : event.predictedDate);
}

/**
 * El movimiento que materializó el evento. El punteo (`confirmTreasuryEvent`),
 * el cuadre con el extracto (`confirmDecisions`) y las patas de traspaso
 * escriben `executedMovementId`; `movementId` es el nombre antiguo y nadie lo
 * escribe ya, pero se respeta. Sin esto el hub no reconocía NINGÚN vínculo y
 * caía siempre al casado implícito por fecha prevista e importe, que falla en
 * cuanto el banco carga otro día.
 */
function movimientoDelEvento(event: TreasuryEvent): number | undefined {
  // Datos antiguos pueden traer el id como texto ("7"); `Number(null)` y
  // `Number('')` darían 0, que NO es un id: se descartan antes de convertir.
  const crudo: unknown = event.executedMovementId ?? event.movementId;
  if (crudo == null || crudo === '') return undefined;
  const id = Number(crudo);
  return Number.isFinite(id) ? id : undefined;
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
  /**
   * SALDO VIVO · cuenta los movimientos REALES aunque el banco los haya
   * fechado por delante de hoy.
   *
   * Un movimiento es realidad: confirmado (lo vio el usuario) o conciliado (lo
   * dice el extracto) —nunca una previsión, que va por `treasuryEvents`—. Si ha
   * ocurrido, cuenta, aunque no estuviera previsto. Y el banco a veces valora un
   * apunte un par de días adelante: la remuneración mensual llega el 17 y ya
   * está en el extracto y en el saldo del banco el 15. Con el corte estricto
   * (`< cutoffDate`) ese ingreso quedaba fuera y el saldo no cuadraba con el
   * banco. Con este flag —solo en las vistas de saldo VIVO— la realidad manda
   * sobre la fecha de valor; los cortes históricos (cierres de mes, informes) lo
   * dejan en `false` para no colar en un mes algo del mes siguiente.
   */
  incluirRealesFuturos?: boolean;
  /**
   * E1.5 · las líneas del extracto (todas o las de la cuenta · el hub filtra).
   * Solo suman las HUÉRFANAS (`esLineaHuerfana`), con el mismo corte y la
   * misma frontera de apertura que los movimientos. Opcional: sin líneas el
   * cálculo es el de siempre.
   */
  lineas?: LineaParaSaldo[];
}): number {
  const { account, cutoffDate, treasuryEvents, movements, incluirRealesFuturos = false, lineas } = params;
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

  const priorAccountEvents = treasuryEvents.filter(e => {
    if (e.accountId !== account.id) return false;
    // Una PIEZA de tarjeta (`gasto_tarjeta`) no sale de ninguna cuenta: el dinero
    // sale en el recibo. Contarla aquí lo cobraría dos veces. Nace sin
    // `accountId` (ya no casaría), pero el guard explícito lo blinda.
    if (e.sourceType === 'gasto_tarjeta') return false;
    const fecha = fechaDelEvento(e);
    return fecha != null && fecha < cutoffDate && isAfterOpening(fecha);
  });

  const committedPriorEvents = priorAccountEvents.filter(isCommittedTreasuryEvent);

  const reconciledMovementIds = new Set(
    committedPriorEvents
      .map(movimientoDelEvento)
      .filter((movementId): movementId is number => movementId != null)
  );

  const rawMovements = movements.filter(m => (
    m.accountId === account.id &&
    // Una compra con tarjeta de CRÉDITO no mueve la cuenta el día de la compra:
    // sale entera en el recibo (§3.3). El recibo sí es un movimiento normal que
    // descuenta; contar además cada compra descontaría dos veces.
    !m.gastoTarjetaCredito &&
    !reconciledMovementIds.has(m.id ?? Number.NaN) &&
    !m.isOpeningBalance &&
    toDateOnly(m.date) &&
    // La realidad cuenta aunque el banco la valore por delante de hoy · solo en
    // saldo vivo (`incluirRealesFuturos`). Los cortes históricos siguen estrictos.
    (incluirRealesFuturos || toDateOnly(m.date)! < cutoffDate) &&
    isAfterOpening(toDateOnly(m.date)!)
  ));

  const implicitMovementMatches = new Map<string, number>();
  for (const event of committedPriorEvents) {
    if (movimientoDelEvento(event) != null) continue;
    const key = buildEntryKey(account.id as number, fechaDelEvento(event) as string, getSignedEventAmount(event));
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

  // E1.5 · lo que el banco ya movió y nadie ha resuelto todavía. Mismo corte
  // y misma frontera que los movimientos, para que el Panel y Tesorería sigan
  // cuadrando entre sí. Sin casado implícito: una línea no es una previsión.
  const lineasDelta = (lineas ?? []).reduce((sum, l) => {
    if (l.accountId !== account.id || !esLineaHuerfana(l)) return sum;
    const fecha = toDateOnly(l.fechaOperacion) as string;
    if (!(incluirRealesFuturos || fecha < cutoffDate)) return sum;
    if (!isAfterOpening(fecha)) return sum;
    return sum + l.importe;
  }, 0);

  return openingBalance + eventsDelta + movementsDelta + lineasDelta;
}

export async function calculateTotalInitialCash(cutoffDate: string): Promise<number> {
  const db = await initDB();
  const [accounts, treasuryEvents, movements, lineas] = await Promise.all([
    db.getAll('accounts'),
    db.getAll('treasuryEvents'),
    db.getAll('movements'),
    leerLineasParaSaldo(db),
  ]);

  return accounts
    .filter(a => a.id != null && (a.status === 'ACTIVE' || a.activa))
    .reduce((sum, account) => {
      return sum + calculateAccountBalanceAtDate({
        account,
        cutoffDate,
        treasuryEvents,
        movements,
        lineas,
      });
    }, 0);
}

export async function rollForwardAccountBalancesToMonth(year: number, month: number): Promise<void> {
  const db = await initDB();
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const [accounts, treasuryEvents, movements, lineas] = await Promise.all([
    db.getAll('accounts'),
    db.getAll('treasuryEvents'),
    db.getAll('movements'),
    leerLineasParaSaldo(db),
  ]);

  for (const account of accounts) {
    if (!account.id || (account.status !== 'ACTIVE' && !account.activa)) continue;

    const computedBalance = calculateAccountBalanceAtDate({
      account,
      cutoffDate: monthStart,
      treasuryEvents,
      movements,
      lineas,
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
