// ============================================================================
// El recibo previsto de una tarjeta · docs/VOCABULARIO-dinero.md §3.4 y §6 bis
// ============================================================================
//
// Un recibo de tarjeta NO pertenece a un gasto: pertenece a la TARJETA. Si
// pagas con la Carrefour la compra, la gasolina y la farmacia, el banco no
// carga tres recibos — carga UNO el día 5, con la suma de los tres.
//
// Por eso esto no cabía en la previsión de un compromiso, que se identifica por
// (gasto · mes · cuenta): el recibo cruza varios gastos y se identifica por
// (tarjeta · fecha de corte). Es la misma identidad que ya usa la
// sincronización de tesorería, así que los dos caminos hablan de lo mismo.
//
// El cálculo es puro —quien llame decide qué hacer con el resultado—; lo único
// que toca la base es `tarjetaDelCompromiso`, que lee la tarjeta.
// ============================================================================

import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import type { Tarjeta } from '../../types/tarjetas';
import type { Movement, TreasuryEvent } from '../db';
import { aplicarVariacion, calcularImporte, expandirPatron } from './patronCalendario';
import { claveDeRecibo, previsionDeTarjetas } from '../previsionDeTarjetas';
import { recibosDeTarjeta } from '../reciboDeTarjeta';
import type { ReciboDeTarjeta } from '../reciboDeTarjeta';
import { toISODateLocal } from '../../utils/recurrenceDateUtils';
import { listarTarjetas } from '../tarjetasService';
import { initDB } from '../db';
import { esPrevisionIntocable } from './previsionesIdempotencia';
import { metodoDeMovimiento } from '../metodoDePago';

/**
 * ¿Este gasto se paga con una tarjeta que ACUMULA?
 *
 * Solo el crédito con ciclo: el débito cobra el día de la compra, así que su
 * gasto sigue siendo un cargo normal en su fecha. Meterlo en un recibo lo
 * cobraría dos veces.
 */
export function pagaConCreditoAplazado(
  compromiso: Pick<CompromisoRecurrente, 'metodoPago' | 'tarjetaId'>,
  tarjetas: Tarjeta[]
): boolean {
  if (compromiso.metodoPago !== 'tarjeta' || compromiso.tarjetaId == null) return false;
  const t = tarjetas.find((x) => x.id === compromiso.tarjetaId);
  return t?.modalidad === 'credito' && t.ciclo != null;
}

/** Una compra que este gasto hará dentro de la ventana proyectada. */
function comprasDelCompromiso(
  compromiso: CompromisoRecurrente,
  desde: string,
  hasta: string
): { fecha: string; importe: number; tarjetaId?: number }[] {
  const inicio = new Date(compromiso.fechaInicio);
  return expandirPatron(compromiso.patron, desde, hasta)
    .map((fecha) => {
      const base = calcularImporte(compromiso.importe, fecha);
      const importe = aplicarVariacion(base, compromiso.variacion, inicio, fecha) ?? 0;
      return { fecha: toISODateLocal(fecha), importe, tarjetaId: compromiso.tarjetaId };
    })
    .filter((c) => c.importe > 0);
}

/**
 * Junta las compras de TODOS los gastos que pagan con tarjeta de crédito y las
 * convierte en un recibo por (tarjeta · periodo).
 *
 * Cruza compromisos a propósito: es lo que distingue un recibo de un cargo.
 */
export function recibosPrevistos(
  compromisos: CompromisoRecurrente[],
  tarjetas: Tarjeta[],
  desde: string,
  hasta: string
): ReciboDeTarjeta[] {
  const compras = compromisos
    .filter((c) => pagaConCreditoAplazado(c, tarjetas))
    .flatMap((c) => comprasDelCompromiso(c, desde, hasta));

  return previsionDeTarjetas(compras, tarjetas).recibos;
}

/**
 * Los recibos que forman las COMPRAS MANUALES de crédito · las que el usuario
 * anota sueltas (movimientos con `gastoTarjetaCredito`), agrupadas por
 * (tarjeta · corte).
 *
 * Solo periodos ABIERTOS (cargo aún por salir): lo ya cobrado viene por su
 * recibo confirmado, y volver a sumarlo aquí lo contaría dos veces. Es la otra
 * mitad del recibo: hasta ahora estas compras solo se veían en la tarjeta y NO
 * engordaban el cargo real del banco.
 */
export function recibosDeComprasManuales(
  movimientos: Movement[],
  tarjetas: Tarjeta[],
  hoy: string
): ReciboDeTarjeta[] {
  const credito = new Map<number, Tarjeta & { id: number }>();
  for (const t of tarjetas) {
    if (t.id != null && t.modalidad === 'credito' && t.ciclo) {
      credito.set(t.id, t as Tarjeta & { id: number });
    }
  }

  const porTarjeta = new Map<number, { fecha: string; importe: number }[]>();
  for (const m of movimientos) {
    if (m.tarjetaId == null || !m.gastoTarjetaCredito || !credito.has(m.tarjetaId)) continue;
    // Un ingreso/devolución en la tarjeta no suma consumo.
    if (m.amount >= 0) continue;
    const arr = porTarjeta.get(m.tarjetaId) ?? [];
    arr.push({ fecha: (m.date ?? '').slice(0, 10), importe: Math.abs(m.amount) });
    porTarjeta.set(m.tarjetaId, arr);
  }

  const out: ReciboDeTarjeta[] = [];
  for (const [tarjetaId, compras] of Array.from(porTarjeta.entries())) {
    for (const r of recibosDeTarjeta(credito.get(tarjetaId)!, compras)) {
      if (r.fechaCargo < hoy) continue; // ya cobrado · lo trae su recibo confirmado
      out.push(r);
    }
  }
  return out;
}

/**
 * Funde los recibos del mismo (tarjeta · corte) en uno solo, sumando importe y
 * número de compras. Así el recibo previsto (de los compromisos) y las compras
 * manuales del mismo periodo forman UN único cargo —que es lo que hace el
 * banco—, con la misma identidad `sourceId` para que no nazcan dos.
 */
export function fusionarRecibos(recibos: ReciboDeTarjeta[]): ReciboDeTarjeta[] {
  const porClave = new Map<string, ReciboDeTarjeta>();
  for (const r of recibos) {
    const clave = `${r.tarjetaId}|${r.fechaCorte}`;
    const previo = porClave.get(clave);
    if (!previo) {
      porClave.set(clave, { ...r });
      continue;
    }
    previo.importe = Math.round((previo.importe + r.importe) * 100) / 100;
    previo.compras += r.compras;
  }
  return [...porClave.values()];
}

/**
 * El evento de tesorería de un recibo.
 *
 * El importe va en NEGATIVO, como el resto de los gastos de este servicio, y la
 * fecha es la de CARGO — el día que sale el dinero—, no la del corte.
 */
export function eventoDeRecibo(
  recibo: ReciboDeTarjeta,
  tarjetas: Tarjeta[],
  ahora: string
): Omit<TreasuryEvent, 'id'> {
  const tarjeta = tarjetas.find((t) => t.id === recibo.tarjetaId);
  const alias = tarjeta?.alias || `#${recibo.tarjetaId}`;
  const [año, mes] = recibo.fechaCargo.split('-').map(Number);

  return {
    type: 'expense',
    amount: -recibo.importe,
    predictedDate: recibo.fechaCargo,
    description: `Recibo tarjeta ${alias}`,
    sourceType: 'tarjeta_recibo',
    // (tarjeta · fecha de corte) · SIN el mes en que se calcula: el cargo puede
    // caer en otro mes que las compras, y una identidad atada al mes en curso
    // haría nacer otro recibo en cada pasada.
    sourceId: claveDeRecibo(recibo),
    año,
    mes,
    certeza: 'estimado',
    generadoPor: 'treasurySyncService',
    // El dinero sale de donde la tarjeta está domiciliada, no de la tarjeta.
    accountId: recibo.cuentaLiquidacionId,
    paymentMethod: metodoDeMovimiento('tarjeta'),
    status: 'predicted',
    ambito: 'PERSONAL',
    categoryLabel: `Recibo tarjeta ${alias}`,
    counterparty: alias,
    createdAt: ahora,
    updatedAt: ahora,
  } as Omit<TreasuryEvent, 'id'>;
}

/**
 * La tarjeta con la que se paga este gasto · `undefined` si no va con una.
 *
 * Se lee AL PROYECTAR y no se confía en `compromiso.cuentaCargo`, que es una
 * copia del día que se guardó: si la tarjeta se re-domicilia después, la copia
 * apunta a una cuenta de la que ya no sale el dinero.
 */
export async function tarjetaDelCompromiso(
  compromiso: Pick<CompromisoRecurrente, 'metodoPago' | 'tarjetaId'>
): Promise<Tarjeta | undefined> {
  // El medio manda: un `tarjetaId` que sobrevive a un cambio de método es un
  // dato muerto. Mirarlo sin mirar el medio dejaría el gasto en tierra de nadie
  // — ni cargo propio ni parte del recibo—, o sea, desaparecido de tesorería.
  if (compromiso.metodoPago !== 'tarjeta' || compromiso.tarjetaId == null) return undefined;
  const tarjetas = await listarTarjetas();
  return tarjetas.find((t) => t.id === compromiso.tarjetaId);
}

/**
 * ¿Este gasto, con ESTA tarjeta, se cobra en un recibo?
 *
 * Mismo criterio que `pagaConCreditoAplazado`, para quien ya tiene la tarjeta
 * resuelta. Se escribe una vez: dos versiones del mismo criterio acaban
 * discrepando, y aquí discrepar significa que un gasto no lo emite nadie.
 */
export function vaEnRecibo(
  compromiso: Pick<CompromisoRecurrente, 'metodoPago' | 'tarjetaId'>,
  tarjeta: Tarjeta | undefined
): boolean {
  return tarjeta != null && pagaConCreditoAplazado(compromiso, [tarjeta]);
}

/**
 * La ventana que se materializa · del primer día del mes en curso al horizonte.
 *
 * El borde de abajo es el MISMO que usan las previsiones de compromiso y el
 * barrido del bootstrap: si empezara hoy, un recibo con cargo el día 3 creado
 * el día 5 no se emitiría y su cargo real se quedaría sin nada con que casar.
 */
export function ventanaDeRecibos(
  hasta: Date | undefined,
  horizonteMeses: number
): { desde: string; hasta: string } {
  const hoy = new Date();
  const fin =
    hasta ?? new Date(hoy.getFullYear(), hoy.getMonth() + horizonteMeses, 28);
  return {
    desde: toISODateLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: toISODateLocal(fin),
  };
}

/**
 * Escribe los recibos, retirando primero los vivos y respetando los intocables.
 *
 * El recibo se identifica por su `sourceId` —(tarjeta · corte)— y no por el mes
 * en que se calcula: su cargo puede caer en otro mes que las compras.
 */
export async function persistirRecibos(eventos: Array<Omit<TreasuryEvent, 'id'>>): Promise<number> {
  const db = await initDB();
  const tx = db.transaction('treasuryEvents', 'readwrite');
  const store = tx.objectStore('treasuryEvents');

  const ocupadas = new Set<string>();
  let cursor = await store.index('sourceType').openCursor(IDBKeyRange.only('tarjeta_recibo'));
  while (cursor) {
    const ev = cursor.value as TreasuryEvent;
    if (esPrevisionIntocable(ev)) ocupadas.add(String(ev.sourceId));
    else await cursor.delete();
    cursor = await cursor.continue();
  }

  let creados = 0;
  for (const ev of eventos) {
    const clave = String(ev.sourceId);
    if (ocupadas.has(clave)) continue;
    ocupadas.add(clave);
    await store.add(ev as TreasuryEvent);
    creados += 1;
  }
  await tx.done;
  return creados;
}
