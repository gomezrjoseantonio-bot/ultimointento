// ============================================================================
// Preguntarle al cuadro · UNA respuesta por pregunta
// ============================================================================
//
// «¿Cuánto pago este mes?», «¿cuánto debo hoy?», «¿a qué tipo voy?», «¿cuándo
// acaba?». Cuatro preguntas que ATLAS respondía de dos maneras distintas según
// la pantalla, porque el asistente miraba el cuadro y las listas se lo
// aproximaban por su cuenta:
//
//   · el asistente enseña `generarCuadro(...).resumen.cuotaMensual`
//   · el Listado, el Panel, el Snowball y el Calendario enseñaban una anualidad
//     francesa recalculada sobre `principalVivo` **a un solo tipo**, el de hoy,
//     aplicado a todo el plazo que queda
//
// Y por eso un mixto se anunciaba a su tipo de teaser hasta el último recibo,
// el vencimiento era «firma + plazo» —sin carencia, sin días sueltos, sin
// amortizaciones— y, cuando no había plan guardado, el calendario se inventaba
// doce meses de cuota plana.
//
// Aquí no se calcula nada: se le pregunta al cuadro, que ya sabe. Todo lo de
// este fichero es una lectura de `generarCuadro`, memoizada para que preguntar
// mil veces cueste una.
// ============================================================================

import type { Prestamo, PeriodoPago } from '../../types/prestamos';
import { generarCuadro, type Cuadro } from './cuadro';
import { tramoVigente } from './tramosDeTipo';
import { tinDelTramo } from './tinDelTramo';

// ─── La caché ───────────────────────────────────────────────────────────────
//
// La huella es el préstamo ENTERO serializado, no una lista de los campos que
// hoy mira el motor. Una lista se queda corta el día que alguien añada un campo
// al cálculo y no se acuerde de esto, y entonces la caché devolvería el cuadro
// viejo de un préstamo que ya no es ese — en silencio, que es como duelen. Un
// préstamo son unos kilobytes; generar 240 periodos cuesta bastante más.
const cuadros = new Map<string, Cuadro>();
const TOPE = 64;

/** El cuadro de este préstamo · generado una vez y recordado. */
export function cuadroDe(prestamo: Prestamo): Cuadro {
  const huella = JSON.stringify(prestamo);
  const recordado = cuadros.get(huella);
  if (recordado) return recordado;

  const cuadro = generarCuadro(prestamo);
  // Sin política de expulsión fina a propósito: no hay «cuál es el más usado»
  // que valga la pena mantener, y vaciar cuesta lo mismo que un cuadro.
  if (cuadros.size >= TOPE) cuadros.clear();
  cuadros.set(huella, cuadro);
  return cuadro;
}

const dia = (iso?: string | null): string =>
  typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : '';

/** Las cuotas de verdad · la línea 0 es la carencia técnica, no una cuota. */
const cuotas = (cuadro: Cuadro): PeriodoPago[] =>
  cuadro.plan.periodos.filter((p) => p.periodo > 0);

/**
 * El recibo que rige un día · aquel cuyo DEVENGO lo contiene.
 *
 * Por devengo y no por fecha de cargo porque un recibo cobra el mes que acaba
 * de pasar: el 26 de agosto ya estás pagando el periodo que se girará en
 * septiembre. Es el mismo criterio con el que el motor reparte los tramos.
 *
 * `null` antes de que el préstamo arranque y después de la última cuota — que
 * es la respuesta honesta, y distinta de «cero».
 */
export function periodoVigente(prestamo: Prestamo, fecha: string): PeriodoPago | null {
  const d = dia(fecha);
  if (!d) return null;

  const lista = cuotas(cuadroDe(prestamo));
  for (const p of lista) {
    const desde = dia(p.devengoDesde) || dia(p.fechaCargo);
    const hasta = dia(p.devengoHasta) || dia(p.fechaCargo);
    if (desde <= d && d <= hasta) return p;
  }
  return null;
}

/**
 * La cuota que se paga en esa fecha · la del cuadro, no una aproximación.
 *
 * Fuera del calendario del préstamo devuelve la primera o la última, que es lo
 * que se quiere enseñar en una lista: un préstamo que aún no ha arrancado tiene
 * una cuota, y uno vencido tuvo la suya.
 */
export function getCuota(prestamo: Prestamo, fecha: string): number {
  const vigente = periodoVigente(prestamo, fecha);
  if (vigente) return vigente.cuota;

  const lista = cuotas(cuadroDe(prestamo));
  if (lista.length === 0) return 0;

  const d = dia(fecha);
  return d && d > dia(lista[lista.length - 1].devengoHasta)
    ? lista[lista.length - 1].cuota
    : lista[0].cuota;
}

/** Qué parte de esa cuota es capital y qué parte interés. */
export function getDesgloseCuota(
  prestamo: Prestamo,
  fecha: string
): { cuota: number; capital: number; interes: number } | null {
  const p = periodoVigente(prestamo, fecha);
  if (!p) return null;
  return { cuota: p.cuota, capital: p.amortizacion, interes: p.interes };
}

/**
 * Lo que se debe ese día · lo que quedó vivo tras el último recibo COBRADO.
 *
 * Por fecha de cargo, no por devengo: hasta que no te giran el recibo no has
 * amortizado. Antes del primer cargo se debe todo lo que se pidió.
 */
export function getCapitalVivo(prestamo: Prestamo, fecha: string): number {
  const d = dia(fecha);
  const lista = cuadroDe(prestamo).plan.periodos;
  if (!d || lista.length === 0) return prestamo.principalInicial ?? 0;

  let vivo = prestamo.principalInicial ?? 0;
  for (const p of lista) {
    if (dia(p.fechaCargo) > d) break;
    vivo = p.principalFinal;
  }
  return vivo;
}

/**
 * El TIN que rige ese día, bonificaciones y tope incluidos.
 *
 * Sale de los tramos, no del campo del arranque: un mixto cambia de tipo cuando
 * acaba su tramo fijo y un variable en cada revisión apuntada.
 */
export function getTinVigente(prestamo: Prestamo, fecha: string): number {
  return tinDelTramo(prestamo, tramoVigente(prestamo, dia(fecha) || fecha));
}

/**
 * Cuándo se paga la última cuota · la del cuadro.
 *
 * Era «firma + plazo en meses», que ignora la carencia —que corre los
 * vencimientos—, los días sueltos del arranque y cualquier amortización. De
 * ahí salía el «libre en enero de 2037» que no cuadraba con nada.
 */
export function getFechaVencimiento(prestamo: Prestamo): string | null {
  return dia(cuadroDe(prestamo).resumen.fechaUltimaCuota) || null;
}

/** Cuántas cuotas quedan por girar después de esa fecha. */
export function getCuotasRestantes(prestamo: Prestamo, fecha: string): number {
  const d = dia(fecha);
  if (!d) return cuotas(cuadroDe(prestamo)).length;
  return cuotas(cuadroDe(prestamo)).filter((p) => dia(p.fechaCargo) > d).length;
}

/** Los recibos de un año natural, por fecha de cargo · los que se pagan ese año. */
export function getCuotasDelAnio(prestamo: Prestamo, anio: number): PeriodoPago[] {
  const prefijo = String(anio);
  return cuadroDe(prestamo).plan.periodos.filter(
    (p) => dia(p.fechaCargo).slice(0, 4) === prefijo
  );
}

/**
 * Los intereses que se pagan en un año · sumados del cuadro.
 *
 * Incluye la línea de carencia técnica si cae ese año: es interés pagado, y se
 * declara igual. Lo que se hacía era `capitalVivo × TIN`, o sea el interés de
 * un año entero al tipo de hoy sobre el capital de hoy — ni el capital baja, ni
 * el tipo se queda quieto, ni el préstamo empieza en enero.
 */
export function getInteresesDelAnio(prestamo: Prestamo, anio: number): number {
  const total = getCuotasDelAnio(prestamo, anio).reduce((s, p) => s + (p.interes || 0), 0);
  return Math.round(total * 100) / 100;
}
