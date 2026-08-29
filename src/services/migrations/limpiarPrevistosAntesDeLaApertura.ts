// ============================================================================
// Limpieza · previstos anteriores a la apertura de su cuenta
// ============================================================================
//
// Hermana del arreglo del motor, y van juntas a propósito: el motor deja de
// emitirlos y esto retira los que ya se escribieron. Limpiar sin arreglar los
// haría volver en la siguiente regeneración, y arreglar sin limpiar dejaría los
// viejos ahí para siempre.
//
// ── Qué se borra ────────────────────────────────────────────────────────────
//
// Una previsión con fecha ANTERIOR al día en que su cuenta abrió. De esa cuenta
// no pudo salir ese dinero, porque no había cuenta de la que saliera.
//
// El saldo nunca las contó —`accountBalanceService` descarta lo anterior a la
// apertura para no sumarlo dos veces sobre el saldo inicial—, pero la lista de
// pendientes sí: el saldo decía una cosa y el trabajo pendiente otra, y se
// pedía confirmar un cargo imposible.
//
// ── Qué se respeta ──────────────────────────────────────────────────────────
//
// Lo que ha tocado una persona, siempre. Y si el cargo llegó de verdad
// —confirmado, conciliado, con movimiento enlazado—, el hecho del banco manda
// sobre la fecha de apertura: será que la apertura está mal puesta, no que el
// dinero no salió.
//
// Y solo los gastos recurrentes, que es lo que emite el motor que se arregla.
// Una cuota de préstamo o un apunte a mano anteriores a la apertura también son
// raros, pero su generador —o su dueño— los volvería a poner, y estaríamos aquí
// otra vez. Se tratan cuando se toque su motor.
//
// En la duda no se borra: sin apertura, sin cuenta o sin fecha, se queda.
// ============================================================================

import type { IDBPDatabase } from 'idb';
import type { Account, TreasuryEvent } from '../db';
import { esPrevisionIntocable } from '../personal/previsionesIdempotencia';

/** `YYYY-MM-DD` de una fecha ISO · vacío si no la hay. */
const soloFecha = (iso: string | undefined): string => (iso ?? '').slice(0, 10);

/**
 * ¿Esta previsión es anterior a la apertura de su cuenta?
 *
 * `aperturas` · id de cuenta → su `openingBalanceDate`. Las cuentas sin fecha
 * de apertura NO entran en el mapa: no tienen frontera que aplicar.
 *
 * Pura y sin E/S, para poder fijar la frontera en tests antes de borrar nada.
 */
export function esPrevistoAnteriorALaApertura(
  ev: TreasuryEvent,
  aperturas: Map<number, string>,
): boolean {
  if (esPrevisionIntocable(ev)) return false;
  // Solo lo que emite el motor que se arregla · ver cabecera.
  if (ev.sourceType !== 'gasto_recurrente') return false;
  if (ev.generadoPor !== 'treasurySyncService') return false;

  if (ev.accountId == null) return false;
  const apertura = aperturas.get(ev.accountId);
  if (!apertura) return false;

  const fecha = soloFecha(ev.predictedDate);
  if (!fecha) return false;

  // El propio día de la apertura ya tiene cuenta · mismo corte que
  // `accountBalanceService.isAfterOpening`, para que los dos digan lo mismo.
  return fecha < soloFecha(apertura);
}

export interface ReciboDeLimpieza {
  borrados: number;
  /** Euros que dejan de figurar como pendientes. */
  importe: number;
  /** Por cuenta · para poder mirar de dónde salieron. */
  porCuenta: Record<number, number>;
  fecha: string;
}

/**
 * Borra los previstos anteriores a la apertura de su cuenta y deja el recibo.
 *
 * Borrar no se deshace, así que deja constancia — mismo criterio que la V88 de
 * tarjetas.
 */
export async function limpiarPrevistosAntesDeLaApertura(
  db: IDBPDatabase<any>,
): Promise<ReciboDeLimpieza> {
  const recibo: ReciboDeLimpieza = {
    borrados: 0,
    importe: 0,
    porCuenta: {},
    fecha: new Date().toISOString(),
  };

  const cuentas = ((await db.getAll('accounts')) ?? []) as Account[];
  const aperturas = new Map<number, string>();
  for (const c of cuentas) {
    const f = soloFecha(c.openingBalanceDate);
    if (c.id != null && f) aperturas.set(c.id, f);
  }
  // Sin ninguna cuenta con apertura no hay frontera que aplicar.
  if (aperturas.size === 0) return recibo;

  const tx = db.transaction('treasuryEvents', 'readwrite');
  let cursor = await tx.objectStore('treasuryEvents').openCursor();
  while (cursor) {
    const ev = cursor.value as TreasuryEvent;
    if (esPrevistoAnteriorALaApertura(ev, aperturas)) {
      recibo.borrados += 1;
      recibo.importe += ev.amount ?? 0;
      const k = ev.accountId as number;
      recibo.porCuenta[k] = (recibo.porCuenta[k] ?? 0) + 1;
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;

  return recibo;
}
