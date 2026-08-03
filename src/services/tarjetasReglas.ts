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
 * Siempre una cuenta bancaria propia. Nunca el efectivo —el colchón no
 * domicilia recibos— ni otra tarjeta, que ni siquiera es una cuenta.
 */
export function cuentasQuePuedenLiquidar(cuentas: Account[]): Account[] {
  return cuentas.filter((c) => c.tipo !== 'EFECTIVO' && c.tipo !== 'TARJETA_CREDITO');
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

/** El último día del mes · "día 31" no puede saltarse febrero (§3.4). */
function ultimoDiaDelMes(anio: number, mes0: number): number {
  return new Date(anio, mes0 + 1, 0).getDate();
}

/**
 * A qué día del mes cae un "día N" · 31 significa el último, no el 31 literal.
 */
export function diaDelMes(anio: number, mes0: number, dia: number): number {
  return Math.min(Math.max(1, dia), ultimoDiaDelMes(anio, mes0));
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
  const d = new Date(`${fecha}T00:00:00`);
  if (ciclo.periodicidad === 'semanal') {
    // 1 lunes … 7 domingo · `getDay()` da 0 para domingo.
    const diaSemana = d.getDay() === 0 ? 7 : d.getDay();
    const corte = ((ciclo.corte - diaSemana) + 7) % 7;
    d.setDate(d.getDate() + corte);
    return d.toISOString().slice(0, 10);
  }

  const corteEsteMes = diaDelMes(d.getFullYear(), d.getMonth(), ciclo.corte);
  if (d.getDate() <= corteEsteMes) {
    return new Date(d.getFullYear(), d.getMonth(), corteEsteMes)
      .toISOString()
      .slice(0, 10);
  }
  // Pasado el corte, la compra es del periodo siguiente.
  const siguiente = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const corteSiguiente = diaDelMes(siguiente.getFullYear(), siguiente.getMonth(), ciclo.corte);
  return new Date(siguiente.getFullYear(), siguiente.getMonth(), corteSiguiente)
    .toISOString()
    .slice(0, 10);
}

/**
 * Cuándo se cobra el periodo que cierra en esa fecha de corte (§3.4).
 *
 * El día de cargo puede caer en otro mes que el corte —corte el 24 de enero,
 * cargo el 5 de febrero—, y ahí es donde se coloca la previsión: cuando el
 * dinero sale de la cuenta, no cuando se cierra la cuenta de la tarjeta.
 */
export function cuandoSeCobra(ciclo: CicloTarjeta, fechaCorte: string): string {
  const d = new Date(`${fechaCorte}T00:00:00`);
  if (ciclo.periodicidad === 'semanal') {
    const diaSemana = d.getDay() === 0 ? 7 : d.getDay();
    const avance = ((ciclo.diaCargo - diaSemana) + 7) % 7;
    d.setDate(d.getDate() + avance + 7 * ciclo.periodosHastaElCargo);
    return d.toISOString().slice(0, 10);
  }

  const destino = new Date(d.getFullYear(), d.getMonth() + ciclo.periodosHastaElCargo, 1);
  const dia = diaDelMes(destino.getFullYear(), destino.getMonth(), ciclo.diaCargo);
  return new Date(destino.getFullYear(), destino.getMonth(), dia).toISOString().slice(0, 10);
}
