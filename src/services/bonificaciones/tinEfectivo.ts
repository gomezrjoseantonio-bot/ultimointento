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

import type {
  Bonificacion,
  ModoBonificaciones,
  ReglaBonificacion,
  TramoDeRebaja,
} from '../../types/prestamos';
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

/**
 * Un estado que no está en la tabla —datos viejos, un `as` de más— se lee como
 * **no aplicada**, no como aplicada.
 *
 * Las dos direcciones se equivocan, pero no cuestan lo mismo: darla por
 * aplicada rebaja el tipo y enseña una cuota **más baja de la que se paga**, y
 * sobre esa cifra se hacen cuentas. Al revés solo se enseña una cuota más alta
 * de la real, que es el error que no arruina un mes.
 */
export function estaAplicada(b: Pick<Bonificacion, 'estado'>): boolean {
  return APLICADA[b.estado] === true;
}

/**
 * Lo que el ANEXO dice sobre el conjunto · los topes y cómo cuentan entre sí.
 *
 * Se le pasa el `Prestamo` entero en todas las llamadas: sus campos encajan por
 * forma, y así no hay que acordarse de traer el modo aparte cada vez —que es
 * como se llega a que la mitad de la app capa y la otra mitad suma—.
 */
export interface ReglasDelAnexo {
  /** Fracción · `0.006` son 0,60 puntos. Así está documentado en el tipo. */
  maximoBonificacionPorcentaje?: number;
  /** Ya en puntos porcentuales · «-1,00 p.p.». Se lee su magnitud. */
  topeBonificacionesTotal?: number;
  /** Ausente = `INDEPENDIENTES`, que es lo que ATLAS venía haciendo. */
  modoBonificaciones?: ModoBonificaciones;
}

/**
 * El tope, en puntos porcentuales, o `null` si el préstamo no dice ninguno.
 *
 * Son dos campos con dos unidades distintas, y antes se trataban igual. Ninguno
 * se escribe hoy desde ninguna pantalla, así que no hay datos que se muevan —
 * pero el día que se escriban, tratarlos igual habría dividido un tope por cien
 * o multiplicado el otro.
 */
function topeEnPuntos(topes: ReglasDelAnexo): number | null {
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
 * La cifra que el anexo exige, cuando la exige · en la unidad de su regla.
 *
 * Es lo que decide qué escalón de `rebajaPorTramos` rige, y por eso vive aquí y
 * no en la pantalla: la rebaja que sale de un escalón es la que se paga, así que
 * quien la calcule tiene que leer el umbral por el mismo sitio que el resto.
 *
 * Exhaustiva a propósito, como las demás tablas de este módulo: una regla nueva
 * no compila hasta que alguien decida si trae cifra y cuál es.
 */
function umbralDeclarado(regla: ReglaBonificacion | undefined): number | null {
  if (!regla) return null;
  switch (regla.tipo) {
    case 'NOMINA':          return regla.minimoMensual ?? null;
    case 'RECIBOS':         return regla.minimoRecibos ?? null;
    case 'TARJETA':         return regla.importeMinimo ?? regla.movimientosMesMin ?? null;
    case 'PLAN_PENSIONES':  return regla.aportacionAnual ?? null;
    // Dos formas y una sola cifra · manda la prima, que es la que los anexos
    // escalonan («hasta 300 €, −0,10; desde 600 €, −0,25»). El número de
    // pólizas se usa cuando es lo único que dicen.
    case 'SEGUROS':         return regla.primaAnualMinima ?? regla.minimoPolizas ?? null;
    case 'SEGURO_HOGAR':    return regla.primaAnual ?? null;
    case 'SEGURO_VIDA':     return regla.capitalAseguradoPct ?? null;
    case 'FONDOS':          return regla.saldoMinimo ?? null;
    // La letra de un certificado no es una cantidad, y la alarma y la condición
    // escrita a mano no traen ninguna: no hay escalón que elegir.
    case 'CERTIFICADO_ENERGETICO':
    case 'ALARMA':
    case 'OTRA':            return null;
  }
}

/**
 * El escalón que rige · el mayor `desde` que el umbral declarado alcanza.
 *
 * Por debajo del primero no rebaja nada, que es lo que dice el anexo: «desde
 * 2.000 €» no promete nada a quien domicilie mil. Y sin umbral declarado
 * tampoco se elige ninguno — inventar el escalón alto enseñaría una cuota más
 * baja de la que se paga, que es el error que sí arruina un mes.
 */
function puntosDelEscalon(tramos: TramoDeRebaja[], umbral: number | null): number {
  if (umbral == null || !Number.isFinite(umbral)) return 0;

  return tramos
    .filter((t) => Number.isFinite(t?.desde) && Number.isFinite(t?.pp) && umbral >= t.desde)
    .reduce((mejor, t) => (t.desde >= mejor.desde ? t : mejor), { desde: -Infinity, pp: 0 })
    .pp;
}

/**
 * Lo que rebaja una bonificación, en puntos porcentuales.
 *
 * `reduccionPuntosPorcentuales` se guarda **en puntos**: el asistente escribe
 * `0.30` para «−0,30 p.p.». El nombre del campo lo dice y así lo leen el propio
 * asistente y el servicio de cálculo; solo la capa de presentación lo
 * multiplicaba por cien, y con ello una bonificación normal se habría comido
 * treinta puntos de TIN.
 *
 * Los escalones mandan sobre la cifra fija cuando los hay, y el sublímite capa
 * el resultado de las dos vías: un anexo puede pactar escalones y además decir
 * «por este concepto, hasta 0,30 p.p.».
 */
export function puntosDe(b: Bonificacion): number {
  const escalones = (b.rebajaPorTramos ?? []).filter(Boolean);
  const bruto = escalones.length > 0
    ? puntosDelEscalon(escalones, umbralDeclarado(b.regla))
    : puntosFijosDe(b);

  const sublimite = Number(b.sublimitePP);
  const acotado = Number.isFinite(sublimite) && sublimite > 0
    ? Math.min(bruto, sublimite)
    : bruto;

  return Math.max(0, Math.round(acotado * 10000) / 10000);
}

/** La cifra fija · con `impacto.puntos` como respaldo de los datos viejos. */
function puntosFijosDe(b: Bonificacion): number {
  const puntos = Number(b.reduccionPuntosPorcentuales);
  if (Number.isFinite(puntos) && puntos !== 0) return Math.abs(puntos);
  // Los `impacto.puntos` van firmados en negativo («−0,10 p.p.»).
  return Math.abs(Number(b.impacto?.puntos ?? 0)) || 0;
}

/**
 * Las que cuentan, en el orden en que cuentan · §6 ter.
 *
 * En `INDEPENDIENTES` son todas las aplicadas, y el orden da igual.
 *
 * En `CASCADA` el anexo las encadena, así que se recorren por `orden` y **la
 * primera que no está aplicada corta las de debajo**, cumplan o no. Sumarlas
 * como si fueran independientes es el error caro: enseña una cuota más baja de
 * la que el banco va a cobrar, y sobre ella se hacen cuentas.
 *
 * `orden` ausente se lee como la posición en la lista, que es el orden en que
 * se guardaron y en que se ven en pantalla.
 */
export function bonificacionesQueCuentan(
  bonificaciones: Bonificacion[] | undefined,
  modo: ModoBonificaciones | undefined,
): Bonificacion[] {
  const todas = bonificaciones ?? [];
  if (modo !== 'CASCADA') return todas.filter(estaAplicada);

  const enOrden = todas
    .map((b, i) => ({ b, orden: Number.isFinite(Number(b.orden)) ? Number(b.orden) : i }))
    .sort((x, y) => x.orden - y.orden);

  const cuentan: Bonificacion[] = [];
  for (const { b } of enOrden) {
    if (!estaAplicada(b)) break;
    cuentan.push(b);
  }
  return cuentan;
}

/**
 * Cuánto rebajan, en total y en puntos porcentuales, las que están aplicadas.
 *
 * Nunca negativo y nunca por encima del tope del préstamo.
 */
export function reduccionPorBonificaciones(
  bonificaciones: Bonificacion[] | undefined,
  topes: ReglasDelAnexo = {}
): number {
  const suma = bonificacionesQueCuentan(bonificaciones, topes.modoBonificaciones)
    .reduce((total, b) => total + puntosDe(b), 0);

  const tope = topeEnPuntos(topes);
  const acotada = tope != null ? Math.min(suma, tope) : suma;
  // A diezmilésima de punto · sumar decimales deja 0.6000000000000001, y un
  // tipo se cotiza con dos o tres, así que cuatro no pierden nada real.
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
  topes: ReglasDelAnexo = {}
): number {
  const base = Number.isFinite(tinBase) ? tinBase : 0;
  return Math.max(0, Math.round((base - reduccionPorBonificaciones(bonificaciones, topes)) * 10000) / 10000);
}

/**
 * El TIN que se pagaría **si la revisión fuera hoy** · §6 ter.
 *
 * Aquí es donde el veredicto deja de ser informativo: se quitan las que hoy te
 * aplican y los movimientos dicen que NO estás cumpliendo, y se vuelve a
 * calcular. No cambia el recibo de este mes —eso lo decide la revisión, no la
 * tesorería—, pero sí dice a qué cuota vas.
 *
 * Se recalcula entero, y no se suman «los puntos en riesgo» al TIN de hoy: con
 * un tope, el TIN de hoy ya viene acotado, así que perder una bonificación
 * puede no subirlo nada —las que quedan siguen llegando al tope—. Sumar habría
 * enseñado un sobrecoste que no va a ocurrir.
 *
 * Lo que no se puede comprobar **no cuenta como perdido**: es la misma tercera
 * respuesta de §6 ter. Darlo por perdido pondría en pantalla un sobrecoste que
 * nadie sabe si existe, y a esa cifra se le hacen cuentas.
 */
export function tinSiRevisaranHoy(
  tinBase: number,
  bonificaciones: Bonificacion[] | undefined,
  cumplimientos: Cumplimiento[],
  topes: ReglasDelAnexo = {}
): number {
  const incumplidas = new Set(
    cumplimientos.filter((c) => c.veredicto === 'no_cumple').map((c) => c.bonificacionId)
  );

  const sobreviven = (bonificaciones ?? []).filter((b) => !incumplidas.has(b.id));
  return tinConBonificaciones(tinBase, sobreviven, topes);
}
