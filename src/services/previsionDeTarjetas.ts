// ============================================================================
// De gastos con tarjeta a recibos previstos · VOCABULARIO §3.4 y §6 bis
// ============================================================================
//
// Un gasto que se paga CON UNA TARJETA de crédito no sale de la cuenta el día
// que se hace: se acumula hasta el corte y sale entero el día de cargo, en la
// cuenta donde la tarjeta está domiciliada. Así que lo que hay que prever no es
// el gasto: es el RECIBO.
//
// Lo que había antes ataba esto a que la tarjeta fuese una cuenta y agrupaba por
// mes natural con un único día. Aquí el gasto apunta a la TARJETA —que ya tiene
// su ciclo de verdad— y el cálculo es el de `recibosDeTarjeta`.
//
// Puro: no lee ni escribe la base. Quien llame decide qué hacer con el resultado.
// ============================================================================

import type { Tarjeta } from '../types/tarjetas';
import { recibosDeTarjeta } from './reciboDeTarjeta';
import type { ReciboDeTarjeta } from './reciboDeTarjeta';

/** Lo mínimo de un gasto previsto para saber si es una compra con tarjeta. */
export interface GastoPrevisto {
  /** Cuándo se hace la compra · ISO `YYYY-MM-DD`. */
  fecha: string;
  importe: number;
  /** Con qué tarjeta se paga · ausente = sale de la cuenta y punto. */
  tarjetaId?: number;
}

export interface PrevisionDeTarjetas<G extends GastoPrevisto> {
  /** Un apunte por periodo · va en la cuenta de liquidación, no en la tarjeta. */
  recibos: ReciboDeTarjeta[];
  /** Los que NO se pagan con tarjeta · siguen su camino de siempre. */
  sueltos: G[];
}

/**
 * Separa los gastos que se pagan con tarjeta de los que no, y convierte los
 * primeros en recibos.
 *
 * Un gasto cuya `tarjetaId` ya no existe —o apunta a una tarjeta de débito, que
 * cobra al momento— se trata como suelto: mejor una previsión en la cuenta que
 * un gasto desaparecido. Perder dinero de la vista no tiene arreglo.
 */
export function previsionDeTarjetas<G extends GastoPrevisto>(
  gastos: G[],
  tarjetas: Tarjeta[]
): PrevisionDeTarjetas<G> {
  const deCredito = new Map<number, Tarjeta & { id: number }>();
  for (const t of tarjetas) {
    if (t.id != null && t.modalidad === 'credito' && t.ciclo) {
      deCredito.set(t.id, t as Tarjeta & { id: number });
    }
  }

  const sueltos: G[] = [];
  const compras = new Map<number, { fecha: string; importe: number }[]>();

  for (const gasto of gastos) {
    const tarjeta = gasto.tarjetaId != null ? deCredito.get(gasto.tarjetaId) : undefined;
    if (!tarjeta) {
      sueltos.push(gasto);
      continue;
    }
    const suyas = compras.get(tarjeta.id) ?? [];
    suyas.push({ fecha: gasto.fecha, importe: gasto.importe });
    compras.set(tarjeta.id, suyas);
  }

  const recibos: ReciboDeTarjeta[] = [];
  for (const [tarjetaId, suyas] of Array.from(compras.entries())) {
    recibos.push(...recibosDeTarjeta(deCredito.get(tarjetaId)!, suyas));
  }

  return { recibos, sueltos };
}

/**
 * La identidad de un recibo previsto · (tarjeta · periodo).
 *
 * NO lleva el mes de la sincronización a propósito: el cargo puede caer en un
 * mes distinto al de las compras —corte el 24 de enero, cargo el 5 de febrero—
 * y si el identificador dependiera del mes en curso, cada pasada crearía otro
 * evento para el mismo recibo.
 */
export function claveDeRecibo(recibo: ReciboDeTarjeta): string {
  return `tarjeta-${recibo.tarjetaId}-${recibo.fechaCorte}`;
}
