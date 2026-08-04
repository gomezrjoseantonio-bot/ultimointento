// ============================================================================
// Las reglas de una tarjeta, escritas una vez · VOCABULARIO §3
// ============================================================================
//
// Puras, sin base de datos. Aquí vive lo que el vocabulario decide, para que no
// se vuelva a repartir por los formularios como pasó con el efectivo y el
// Bizum: la misma regla escrita en tres pantallas acaba siendo tres reglas.
// ============================================================================

import type { Account } from './db';
import type { CicloTarjeta, Tarjeta } from '../types/tarjetas';

/**
 * De qué cuentas puede colgar una tarjeta (§3.2).
 *
 * Siempre una cuenta bancaria propia. Nunca el efectivo: el colchón no
 * domicilia recibos.
 *
 * Aquí también se descartaban las cuentas de tipo tarjeta. Ya no hace falta
 * comprobarlo: desde V88 no existen, porque una tarjeta nunca fue una cuenta.
 */
export function cuentasQuePuedenLiquidar(cuentas: Account[]): Account[] {
  return cuentas.filter((c) => c.tipo !== 'EFECTIVO');
}

/**
 * Si el gasto de esta tarjeta cuenta para bonificar una hipoteca (§3.6).
 *
 * Solo la del banco que bonifica. Las de fuera **nunca**: son externas
 * justamente por eso. Sumarlas diría que cumples un requisito que no cumples, y
 * eso se paga en el recibo.
 */
export function bonificaHipoteca(t: Pick<Tarjeta, 'origen'>): boolean {
  return t.origen === 'banco';
}

/**
 * Si mover la tarjeta de cuenta tiene sentido (§3.2).
 *
 * La del banco es del banco: cambiarla de cuenta no significa nada. La de fuera
 * se re-domicilia cuando quieras, y es una operación normal — no rehacer la
 * tarjeta, que perdería su historial de gasto.
 */
export function puedeCambiarDeCuenta(t: Pick<Tarjeta, 'origen'>): boolean {
  return t.origen === 'externa';
}

/** Solo el crédito acumula un periodo · el débito cobra al momento (§3.3). */
export function necesitaCiclo(t: Pick<Tarjeta, 'modalidad'>): boolean {
  return t.modalidad === 'credito';
}

// ─── Fechas · en UTC de extremo a extremo ───────────────────────────────────
//
// Mezclar hora local con `toISOString()` corre el día: en España (UTC+1/+2) la
// medianoche local es el día ANTERIOR en UTC, así que cada fecha calculada
// saldría un día antes. Y no lo cazaría ningún test, porque CI corre en UTC —
// el fallo aparecería solo en el navegador del usuario, que es el peor sitio.

/** El último día del mes · "día 31" no puede saltarse febrero (§3.4). */
function ultimoDiaDelMes(anio: number, mes0: number): number {
  return new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();
}

/** ISO `YYYY-MM-DD` → fecha UTC, sin que la zona del navegador la mueva. */
function desdeIso(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

const aIso = (d: Date): string => d.toISOString().slice(0, 10);

/** 1 lunes … 7 domingo · `getUTCDay()` da 0 para domingo. */
const diaDeLaSemana = (d: Date): number => d.getUTCDay() || 7;

/**
 * A qué día del mes cae un "día N" · 31 significa el último, no el 31 literal.
 */
export function diaDelMes(anio: number, mes0: number, dia: number): number {
  return Math.min(Math.max(1, dia), ultimoDiaDelMes(anio, mes0));
}

/** Fecha UTC a partir de año, mes y "día N" con la regla del último día. */
function conDiaDelMes(anio: number, mes0: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes0, diaDelMes(anio, mes0, dia)));
}

/**
 * En qué periodo cae una compra · devuelve la fecha de CORTE de ese periodo.
 *
 * Una compra pertenece a su periodo **por su fecha** (§3.4): con corte el 24,
 * la del 26 de enero no entra en el periodo que cierra ese mes, entra en el
 * siguiente. Confundirlo adelanta un mes el cargo previsto.
 *
 * `fecha` en ISO `YYYY-MM-DD`; devuelve ISO.
 */
export function corteQueLeToca(ciclo: CicloTarjeta, fecha: string): string {
  const d = desdeIso(fecha);
  if (ciclo.periodicidad === 'semanal') {
    const avance = ((ciclo.corte - diaDeLaSemana(d)) + 7) % 7;
    d.setUTCDate(d.getUTCDate() + avance);
    return aIso(d);
  }

  const anio = d.getUTCFullYear();
  const mes0 = d.getUTCMonth();
  if (d.getUTCDate() <= diaDelMes(anio, mes0, ciclo.corte)) {
    return aIso(conDiaDelMes(anio, mes0, ciclo.corte));
  }
  // Pasado el corte, la compra es del periodo siguiente.
  const siguiente = new Date(Date.UTC(anio, mes0 + 1, 1));
  return aIso(conDiaDelMes(siguiente.getUTCFullYear(), siguiente.getUTCMonth(), ciclo.corte));
}

/**
 * Cuándo se cobra el periodo que cierra en esa fecha de corte (§3.4).
 *
 * El día de cargo puede caer en otro mes que el corte —corte el 24 de enero,
 * cargo el 5 de febrero—, y ahí es donde se coloca la previsión: cuando el
 * dinero sale de la cuenta, no cuando se cierra la cuenta de la tarjeta.
 */
export function cuandoSeCobra(ciclo: CicloTarjeta, fechaCorte: string): string {
  const d = desdeIso(fechaCorte);
  if (ciclo.periodicidad === 'semanal') {
    const avance = ((ciclo.diaCargo - diaDeLaSemana(d)) + 7) % 7;
    d.setUTCDate(d.getUTCDate() + avance + 7 * ciclo.periodosHastaElCargo);
    return aIso(d);
  }

  const destino = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + ciclo.periodosHastaElCargo, 1)
  );
  return aIso(conDiaDelMes(destino.getUTCFullYear(), destino.getUTCMonth(), ciclo.diaCargo));
}
