// ============================================================================
// Lecturas del cuadro POR FECHA · §4 de la UI de Financiación
// ============================================================================
//
// Las pantallas preguntaban «¿cuánto pago?» a `modules/financiacion/helpers.ts`,
// que rehacía la cuota con la fórmula francesa sobre `principalVivo` y el plazo
// que quedara. Esa cuenta no es la del banco: cambia cada vez que se marca una
// cuota como pagada, no sabe de tramos y congela los mixtos en su tipo de
// arranque. De ahí venían los números que bailan.
//
// Aquí no se calcula nada nuevo: se LEE del cuadro que ya generó el motor
// (`generarCuadro`). Si el cuadro dice que la cuota de agosto son 454,57 €, eso
// es lo que se enseña — aunque la escritura diga 454,66 € porque el motor
// todavía liquida 30/360 en vez de ACT/365. Ese desajuste se arregla en el
// motor, no compensándolo aquí.
//
// Todo va contra fechas ISO `YYYY-MM-DD` y ninguna función mira el reloj: el
// día se pasa de fuera, igual que hace el resto de `services/prestamos/`.
// ============================================================================

import type { Prestamo, PeriodoPago } from '../../types/prestamos';
import type { Cuadro } from './cuadro';
import { tinDelTramo } from './tinDelTramo';
import { tramoVigente } from './tramosDeTipo';
import { interesesTotalDeducible } from '../prestamosService';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Las líneas que son CUOTA · sin la línea 0.
 *
 * La carencia técnica es un cargo suelto por los días entre la firma y el
 * primer mes de cobro. Contarla como cuota diría que ese mes pagas dos veces, y
 * su ventana de devengo se solapa un día con la de la primera cuota, así que
 * también haría ambigua la pregunta «¿qué periodo contiene esta fecha?».
 */
const cuotas = (cuadro: Cuadro): PeriodoPago[] =>
  cuadro.plan.periodos.filter((p) => p.periodo > 0);

/**
 * El periodo que contiene una fecha · por su ventana de DEVENGO.
 *
 * Por devengo y no por fecha de cargo porque un recibo cobra el mes que ya ha
 * pasado: preguntar «¿a qué cuota voy hoy?» es preguntar por el mes que se está
 * devengando, que es el que se cobrará al final.
 *
 * `null` si el préstamo ya está vencido en esa fecha. Antes de la primera
 * ventana se devuelve la primera cuota: el préstamo existe desde la firma.
 */
export function periodoEn(cuadro: Cuadro, fecha: string): PeriodoPago | null {
  const lineas = cuotas(cuadro);
  if (lineas.length === 0) return null;
  if (fecha < lineas[0].devengoDesde) return lineas[0];
  const dentro = lineas.find((p) => p.devengoDesde <= fecha && fecha <= p.devengoHasta);
  if (dentro) return dentro;
  // Fuera de toda ventana y después de la primera · o hay un hueco en el
  // calendario (no debería) o el préstamo ya venció.
  const siguiente = lineas.find((p) => p.devengoDesde > fecha);
  return siguiente ?? null;
}

/** La cuota del periodo que contiene la fecha · 0 si ya está vencido. */
export function getCuota(cuadro: Cuadro, fecha: string): number {
  return periodoEn(cuadro, fecha)?.cuota ?? 0;
}

/**
 * El capital vivo al INICIO del periodo que contiene la fecha.
 *
 * Se reconstruye del propio periodo (`principalFinal + amortizacion`) en vez de
 * mirar el `principalVivo` guardado en el préstamo: ese campo es una caché que
 * se actualiza al marcar cuotas pagadas, y era otra de las fuentes de números
 * que no cuadraban entre pantallas.
 */
export function getCapitalVivo(cuadro: Cuadro, fecha: string): number {
  const p = periodoEn(cuadro, fecha);
  if (!p) return 0;
  return round2(p.principalFinal + p.amortizacion);
}

/** Cuánto de la cuota es interés y cuánto capital · en el periodo de la fecha. */
export function getDesgloseCuota(
  cuadro: Cuadro,
  fecha: string,
): { interes: number; capital: number } {
  const p = periodoEn(cuadro, fecha);
  if (!p) return { interes: 0, capital: 0 };
  return { interes: p.interes, capital: p.amortizacion };
}

/**
 * El TIN que se paga en una fecha · bonificaciones y tope incluidos.
 *
 * Sale de `tinDelTramo` sobre el tramo vigente ese día, que es la regla única
 * de §6 ter — la misma que usa el generador del cuadro.
 */
export function getTinVigente(prestamo: Prestamo, fecha: string): number {
  return tinDelTramo(prestamo, tramoVigente(prestamo, fecha));
}

/** El TIN antes de bonificar · para poder enseñar el teórico tachado. */
export function getTinTeorico(prestamo: Prestamo, fecha: string): number {
  return tramoVigente(prestamo, fecha).tinBase;
}

/** La fecha de la última cuota del cuadro · `null` si el cuadro está vacío. */
export function getFechaVencimiento(cuadro: Cuadro): string | null {
  const lineas = cuotas(cuadro);
  if (lineas.length === 0) return null;
  return lineas[lineas.length - 1].fechaCargo;
}

/**
 * Qué parte del principal está amortizada en una fecha · 0..100.
 *
 * `1 − vivo/inicial` y no «cuotas pagadas / plazo»: con carencia, con cuota
 * prorrateada o con una amortización anticipada por medio, contar cuotas dice
 * un porcentaje que no es el de la deuda.
 */
export function getPctAmortizado(cuadro: Cuadro, fecha: string): number {
  const lineas = cuotas(cuadro);
  if (lineas.length === 0) return 0;
  const inicial = round2(lineas[0].principalFinal + lineas[0].amortizacion);
  if (inicial <= 0) return 0;
  const vivo = getCapitalVivo(cuadro, fecha);
  return Math.min(100, Math.max(0, (1 - vivo / inicial) * 100));
}

/** Los intereses que el cuadro carga en un año natural. */
export function getInteresDelAnio(cuadro: Cuadro, anio: number): number {
  const prefijo = `${anio}-`;
  return round2(
    cuadro.plan.periodos
      .filter((p) => p.fechaCargo.startsWith(prefijo))
      .reduce((s, p) => s + p.interes, 0),
  );
}

/**
 * Los intereses DEDUCIBLES de un año · solo la parte trazable a inmueble.
 *
 * El año ya declarado manda sobre el cuadro: si el usuario apuntó lo que dijo
 * el certificado del banco (`interesesAnualesDeclarados`), ese es el número que
 * fue a la renta, y una proyección no puede pisarlo.
 *
 * Qué fracción es deducible lo decide `interesesTotalDeducible`, que ya es la
 * regla única de destinos (ADQUISICIÓN/REFORMA con inmueble detrás).
 */
export function getInteresDeducible(
  prestamo: Prestamo,
  cuadro: Cuadro,
  anio: number,
): number {
  const declarado = prestamo.interesesAnualesDeclarados?.[anio];
  const total =
    typeof declarado === 'number' && Number.isFinite(declarado)
      ? declarado
      : getInteresDelAnio(cuadro, anio);
  if (total <= 0) return 0;
  return round2(interesesTotalDeducible(prestamo, total));
}

// ─── La revisión que viene ──────────────────────────────────────────────────

export interface RevisionQueViene {
  /** Fecha de cargo de la primera cuota ya revisada. */
  fecha: string;
  /** Lo que se paga hoy. */
  cuotaAntes: number;
  /** Lo que se pasará a pagar. */
  cuotaDespues: number;
  /** El TIN de hoy · bonificado. */
  tinAntes: number;
  /** El TIN al que se pasa · bonificado. */
  tinDespues: number;
}

/**
 * La primera revisión que MUEVE la cuota dentro de una ventana de días.
 *
 * El cuadro no marca sus líneas como «de revisión» —`PeriodoPago` no tiene ese
 * campo—, así que la revisión se detecta por lo único que el usuario nota: que
 * la cuota deja de ser la de hoy. Eso cubre el fin del tramo fijo de un mixto y
 * cualquier revisión de índice apuntada, sin inventar un dato que no existe.
 *
 * La última cuota queda fuera: siempre es distinta porque se lleva el resto, y
 * anunciarla como una revisión sería un aviso falso en todos los préstamos.
 */
export function getProximaRevision(
  prestamo: Prestamo,
  cuadro: Cuadro,
  hoy: string,
  dentroDeDias = 90,
): RevisionQueViene | null {
  const lineas = cuotas(cuadro);
  if (lineas.length < 2) return null;

  const actual = periodoEn(cuadro, hoy);
  if (!actual) return null;

  const limite = new Date(`${hoy}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + dentroDeDias);
  const hasta = limite.toISOString().slice(0, 10);

  const ultima = lineas[lineas.length - 1];
  const cambio = lineas.find(
    (p) =>
      p.periodo > actual.periodo &&
      p.periodo !== ultima.periodo &&
      p.fechaCargo <= hasta &&
      Math.abs(p.cuota - actual.cuota) >= 0.5,
  );
  if (!cambio) return null;

  return {
    fecha: cambio.fechaCargo,
    cuotaAntes: actual.cuota,
    cuotaDespues: cambio.cuota,
    tinAntes: getTinVigente(prestamo, hoy),
    tinDespues: getTinVigente(prestamo, cambio.devengoDesde),
  };
}

// ─── La escalera de liberación ──────────────────────────────────────────────

export interface PuntoEscalera {
  /** Mes en `YYYY-MM`. */
  mes: string;
  /** La cuota total del hogar ese mes · suma de los préstamos vivos. */
  total: number;
}

export interface PeldanoEscalera {
  /** Mes en que vence un préstamo · `YYYY-MM`. */
  mes: string;
  anio: number;
  /** La cuota total del hogar DESPUÉS de que ese préstamo deje de sumar. */
  nuevoTotal: number;
}

export interface Escalera {
  puntos: PuntoEscalera[];
  peldanos: PeldanoEscalera[];
  /** La cuota total de este mes · el arranque de la escalera. */
  totalHoy: number;
  /** El mes del último vencimiento · cuando quedas libre. */
  mesLibre: string | null;
}

const mesDe = (iso: string): string => iso.slice(0, 7);

const siguienteMes = (mes: string): string => {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
};

/**
 * Tu cuota bajando hacia cero · §5.2.
 *
 * Se recorre mes a mes desde hoy hasta el último vencimiento sumando lo que
 * cada préstamo carga ESE mes según su cuadro. Los escalones salen solos:
 * cuando un préstamo se acaba, su cuota deja de sumar. No es una tabla
 * congelada — un mixto que revisa por el camino sube su peldaño y se ve.
 */
export function escaleraDeLiberacion(
  cuadros: Array<{ cuadro: Cuadro }>,
  hoy: string,
): Escalera {
  const mesHoy = mesDe(hoy);

  // Cuánto carga cada préstamo en cada mes · de la fecha de cargo del cuadro.
  const porMes = new Map<string, number>();
  const vencimientos: string[] = [];

  for (const { cuadro } of cuadros) {
    const lineas = cuotas(cuadro);
    if (lineas.length === 0) continue;
    const vence = lineas[lineas.length - 1].fechaCargo;
    if (mesDe(vence) < mesHoy) continue; // ya vencido · no suma ni hace peldaño
    vencimientos.push(vence);
    for (const p of lineas) {
      const mes = mesDe(p.fechaCargo);
      if (mes < mesHoy) continue;
      porMes.set(mes, (porMes.get(mes) ?? 0) + p.cuota);
    }
  }

  if (vencimientos.length === 0) {
    return { puntos: [], peldanos: [], totalHoy: 0, mesLibre: null };
  }

  const mesLibre = mesDe(vencimientos.reduce((a, b) => (a > b ? a : b)));

  const puntos: PuntoEscalera[] = [];
  for (let mes = mesHoy; mes <= mesLibre; mes = siguienteMes(mes)) {
    puntos.push({ mes, total: round2(porMes.get(mes) ?? 0) });
  }

  const totalPorMes = new Map(puntos.map((p) => [p.mes, p.total]));
  const peldanos: PeldanoEscalera[] = [...new Set(vencimientos.map(mesDe))]
    .sort()
    .map((mes) => {
      const despues = siguienteMes(mes);
      return {
        mes,
        anio: Number(mes.slice(0, 4)),
        nuevoTotal: totalPorMes.get(despues) ?? 0,
      };
    });

  return {
    puntos,
    peldanos,
    totalHoy: totalPorMes.get(mesHoy) ?? 0,
    mesLibre,
  };
}
