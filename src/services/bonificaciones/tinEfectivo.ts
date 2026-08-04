// ============================================================================
// Cuánto rebajan las bonificaciones · VOCABULARIO §6 ter
// ============================================================================
//
// Una sola regla, porque había cuatro y no coincidían: el asistente restaba en
// puntos porcentuales, la pantalla multiplicaba por cien, el cuadro de
// amortización no restaba nada y las alertas hacían lo suyo. Resultado: la
// cuota que ATLAS preveía en tesorería y la que enseñaba en financiación eran
// distintas para cualquier préstamo con bonificaciones.
//
// Aquí vive **lo que rebajan**, en puntos porcentuales. El TIN base no: ese lo
// calcula cada quien a su manera —fijo, variable, mixto por tramos— y esas
// diferencias son legítimas. Lo que no era legítimo es que la rebaja se
// escribiera cuatro veces.
//
// Puro: no lee la base ni el reloj.
// ============================================================================

import type { Bonificacion } from '../../types/prestamos';
import type { Cumplimiento } from './cumplimiento';

/**
 * Si una bonificación está aplicada HOY.
 *
 * La pregunta no es «¿la estás cumpliendo?» sino «¿te la está aplicando el
 * banco?». Son distintas, y confundirlas cambia la cuota que se enseña: una
 * bonificación contratada se aplica desde la firma y **sigue aplicada hasta que
 * una revisión te la retire**. Lo que estés cumpliendo ahora decide la revisión
 * que viene, no el recibo de este mes (§6 ter).
 *
 * Por eso solo dos estados no cuentan: la que nunca contrataste y la que el
 * banco ya te quitó.
 *
 * Tabla exhaustiva a propósito: un estado nuevo no compila hasta que alguien
 * decida si se paga con él o sin él.
 */
const APLICADA: Record<Bonificacion['estado'], boolean> = {
  // Nunca se contrató · no hay nada que aplicar.
  INACTIVO: false,
  // El banco ya la retiró en una revisión · esto sí sube la cuota.
  PERDIDA: false,

  // Contratada en el alta. Antes esto NO contaba, y era el motivo de que las
  // bonificaciones no rebajaran nunca el TIN en pantalla.
  SELECCIONADO: true,
  // Regalada de entrada durante la gracia · se paga con ella.
  ACTIVO_POR_GRACIA: true,
  // Demostrada en la última revisión.
  ACTIVO_POR_CUMPLIMIENTO: true,
  CUMPLIDA: true,
  // Esperando revisión · hasta que la haya, se paga con ella.
  PENDIENTE: true,
  // Vas camino de perderla, pero todavía no la has perdido: el recibo de este
  // mes sigue llevándola. Lo que se pierde se avisa aparte, en euros.
  EN_RIESGO: true,
};

export function estaAplicada(b: Pick<Bonificacion, 'estado'>): boolean {
  return APLICADA[b.estado] ?? true;
}

/** Los dos topes que puede traer un préstamo · cada uno en SU unidad. */
export interface TopesDeBonificacion {
  /** Fracción · `0.006` son 0,60 puntos. Así está documentado en el tipo. */
  maximoBonificacionPorcentaje?: number;
  /** Ya en puntos porcentuales · «-1,00 p.p.». Se lee su magnitud. */
  topeBonificacionesTotal?: number;
}

/**
 * El tope, en puntos porcentuales, o `null` si el préstamo no dice ninguno.
 *
 * Son dos campos con dos unidades distintas, y antes se trataban igual. Ninguno
 * se escribe hoy desde ninguna pantalla, así que no hay datos que se muevan —
 * pero el día que se escriban, tratarlos igual habría dividido un tope por cien
 * o multiplicado el otro.
 */
function topeEnPuntos(topes: TopesDeBonificacion): number | null {
  const { maximoBonificacionPorcentaje: fraccion, topeBonificacionesTotal: puntos } = topes;
  if (typeof fraccion === 'number' && Number.isFinite(fraccion) && fraccion > 0) {
    return fraccion * 100;
  }
  if (typeof puntos === 'number' && Number.isFinite(puntos) && puntos !== 0) {
    return Math.abs(puntos);
  }
  return null;
}

/**
 * Lo que rebaja una bonificación, en puntos porcentuales.
 *
 * `reduccionPuntosPorcentuales` se guarda **en puntos**: el asistente escribe
 * `0.30` para «−0,30 p.p.». El nombre del campo lo dice y así lo leen el propio
 * asistente y el servicio de cálculo; solo la capa de presentación lo
 * multiplicaba por cien, y con ello una bonificación normal se habría comido
 * treinta puntos de TIN.
 */
function puntosDe(b: Bonificacion): number {
  const puntos = Number(b.reduccionPuntosPorcentuales);
  if (Number.isFinite(puntos) && puntos !== 0) return Math.abs(puntos);
  // Los `impacto.puntos` van firmados en negativo («−0,10 p.p.»).
  return Math.abs(Number(b.impacto?.puntos ?? 0)) || 0;
}

/**
 * Cuánto rebajan, en total y en puntos porcentuales, las que están aplicadas.
 *
 * Nunca negativo y nunca por encima del tope del préstamo.
 */
export function reduccionPorBonificaciones(
  bonificaciones: Bonificacion[] | undefined,
  topes: TopesDeBonificacion = {}
): number {
  const suma = (bonificaciones ?? [])
    .filter(estaAplicada)
    .reduce((total, b) => total + puntosDe(b), 0);

  const tope = topeEnPuntos(topes);
  const acotada = tope != null ? Math.min(suma, tope) : suma;
  // A céntimo de punto · sumar decimales deja 0.6000000000000001.
  return Math.max(0, Math.round(acotada * 10000) / 10000);
}

/**
 * El TIN que se paga · el base menos lo que rebajan.
 *
 * Nunca por debajo de cero: un banco no te paga a ti por deberle dinero.
 */
export function tinConBonificaciones(
  tinBase: number,
  bonificaciones: Bonificacion[] | undefined,
  topes: TopesDeBonificacion = {}
): number {
  const base = Number.isFinite(tinBase) ? tinBase : 0;
  return Math.max(0, Math.round((base - reduccionPorBonificaciones(bonificaciones, topes)) * 10000) / 10000);
}

/**
 * Los puntos que se perderían **si la revisión fuera hoy** · §6 ter.
 *
 * Aquí es donde el veredicto deja de ser informativo: son las bonificaciones
 * que hoy te aplican y que los movimientos dicen que NO estás cumpliendo. No
 * cambian el recibo de este mes —eso lo decide la revisión, no la tesorería—,
 * pero sí dicen a qué cuota vas.
 *
 * Lo que no se puede comprobar **no cuenta como perdido**: es la misma tercera
 * respuesta de §6 ter. Darlo por perdido pondría en pantalla un sobrecoste que
 * nadie sabe si existe, y a esa cifra se le hacen cuentas.
 */
export function puntosEnRiesgo(
  bonificaciones: Bonificacion[] | undefined,
  cumplimientos: Cumplimiento[]
): number {
  const incumplidas = new Set(
    cumplimientos.filter((c) => c.veredicto === 'no_cumple').map((c) => c.bonificacionId)
  );

  const suma = (bonificaciones ?? [])
    .filter(estaAplicada)
    .filter((b) => incumplidas.has(b.id))
    .reduce((total, b) => total + puntosDe(b), 0);

  return Math.max(0, Math.round(suma * 10000) / 10000);
}
