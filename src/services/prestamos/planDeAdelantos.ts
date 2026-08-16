// ============================================================================
// Amortizar SIEMPRE, no una vez · VOCABULARIO §6 bis · quater
// ============================================================================
//
// `amortizarAnticipado` contesta a «¿y si el día 25 meto 10.000 €?». La pregunta
// que se hace de verdad quien tiene una hipoteca es otra:
//
//   > Quiero meter 200 € todos los meses, y 3.000 € cada junio con la extra.
//   > ¿Cuándo acabo, y cuánto me ahorro de verdad?
//
// Eso no es una operación: es un CALENDARIO. Y no se puede contestar sumando
// adelantos por separado, porque cada uno cambia el capital vivo sobre el que
// trabaja el siguiente — el segundo adelanto amortiza sobre un préstamo que ya
// no es el mismo. Aquí se resuelve como lo que es: una regla se despliega en
// fechas, y las fechas se aplican EN ORDEN sobre el cuadro que va quedando.
//
// El motor sigue siendo uno solo: cada adelanto pasa por `amortizarAnticipado`,
// con su base de cálculo, sus tramos y sus bonificaciones. Aquí no se calcula
// ni un interés.
//
// ── Lo que se simula NO se confirma ─────────────────────────────────────────
//
// Esto no toca tesorería ni guarda cuadro. Un plan a diez años son ciento
// veinte movimientos que aún no han ocurrido, y darlos por hechos convertiría
// una intención en un saldo. Puro: no lee el reloj ni la base de datos.
// ============================================================================

import type { PlanPagos, Prestamo } from '../../types/prestamos';
import { amortizarAnticipado } from './amortizarAnticipado';
import {
  comisionDeReembolso,
  cupoAnualExento,
  ventanaAnual,
  type LimiteAnualExento,
} from './comisiones';
import { diasDelMes, esISO, partes, sumarMeses } from './fechas';
import { loQueQueda, ordenarPeriodos, type LoQueQueda } from './loQueQueda';

export type { LimiteAnualExento } from './comisiones';

/** Cada cuánto se repite un adelanto. */
export type Cadencia = 'UNICA' | 'MENSUAL' | 'CADA_N_MESES' | 'ANUAL';

/**
 * Una regla de amortización · «200 € todos los meses desde enero».
 *
 * Son varias a la vez a propósito. «200 €/mes **y** 3.000 € cada junio» es un
 * caso corriente —el ahorro del mes por un lado y la paga extra por otro—, y
 * con una sola regla habría que elegir cuál de los dos se simula.
 */
export interface ReglaDeAdelanto {
  /** Para poder editarla y borrarla en la pantalla. */
  id: string;
  cadencia: Cadencia;
  /** Lo que se mete CADA VEZ, en euros. */
  importe: number;
  /** El primer día en que se aplica · ISO `YYYY-MM-DD`. */
  desde: string;
  /** Último día en que puede aplicarse · ausente = hasta que se acabe el préstamo. */
  hasta?: string;
  /** Cuántas veces como mucho · ausente = las que quepan. */
  veces?: number;
  /** Cada cuántos meses, solo en `CADA_N_MESES` · 3 es trimestral. */
  cadaMeses?: number;
  /** En qué mes del año cae, solo en `ANUAL` · 1-12, 6 es junio. */
  mes?: number;
  /**
   * Cuánto sube el importe cada año, en % · para acompañar sueldo o IPC.
   *
   * Se aplica por años completos desde el primer adelanto de la regla, no por
   * año natural: la regla la escribe quien va a meter el dinero, y sube cuando
   * a esa persona le suben.
   */
  crecimientoAnual?: number;
}

/** Un adelanto concreto que la regla produce. */
export interface AdelantoPrevisto {
  fecha: string;
  importe: number;
  /** De qué regla salió · para poder explicarlo en la tabla. */
  reglaId: string;
}

/** Un adelanto ya aplicado sobre el cuadro, con lo que costó. */
export interface AdelantoAplicado {
  fecha: string;
  /** Lo que pedía la regla. */
  solicitado: number;
  /** Lo que cabía · el último adelanto se recorta a lo que quede vivo. */
  aplicado: number;
  /** La parte que entró en el cupo anual y no paga comisión. */
  exento: number;
  comision: number;
  gastos: number;
  /** Lo que sale de la cuenta ese día · capital + comisión + gastos. */
  salidaCaja: number;
  /** Lo que queda vivo justo después. */
  principalDespues: number;
  reglaIds: string[];
}

export interface OpcionesDelPlan {
  /** Qué se hace con lo amortizado · es la instrucción que se le da al banco. */
  modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  /** El cupo que la escritura deja adelantar gratis cada año. */
  limiteAnualExento?: LimiteAnualExento | null;
  /** Lo que cobra el banco por operación aparte de la comisión, en euros. */
  gastosFijosPorOperacion?: number;
  /**
   * Desde cuándo se compara · por defecto, el día del primer adelanto.
   *
   * El «antes» y el «después» tienen que mirar el mismo tramo de vida del
   * préstamo o la flecha no significa nada.
   */
  desde?: string;
}

export interface SimulacionDelPlan {
  modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  /** El día desde el que se compara. */
  desde: string;
  adelantos: AdelantoAplicado[];
  /** Cuántos adelantos preveían las reglas · puede ser más que los aplicados. */
  previstos: number;
  antes: LoQueQueda;
  despues: LoQueQueda;
  /** Capital adelantado en total. */
  totalAportado: number;
  totalComisiones: number;
  totalGastos: number;
  /** Todo lo que sale de la cuenta por el plan. */
  totalSalidaCaja: number;
  /** Intereses que ya no se pagan. */
  ahorroIntereses: number;
  /** Lo anterior, menos lo que cuesta amortizar. Es la cifra que decide. */
  ahorroNeto: number;
  /** Recibos que desaparecen. */
  mesesGanados: number;
  /**
   * Lo que se pagará dentro de un año · la pendiente, no el primer escalón.
   *
   * `despues.cuota` es la del recibo siguiente al primer adelanto, y con un plan
   * recurrente eso se queda cortísimo: en 200 €/mes sobre una hipoteca de 76.000
   * € el primer recibo baja 1,29 € y el de dentro de un año baja quince veces
   * más. Enseñar solo el primero haría parecer inútil justo el modo que se está
   * eligiendo.
   */
  cuotaEnUnAnio: number;
  /** El día en que se acaba de pagar, antes y después. */
  fechaFinAntes: string | null;
  fechaFinDespues: string | null;
  /** El cuadro resultante · NO se guarda, es para pintarlo. */
  plan: PlanPagos | null;
  /**
   * Lo que el plan no pudo hacer · para poder decirlo en pantalla.
   *
   * Un plan que se queda corto en silencio se lee como un plan que cabía.
   */
  avisos: string[];
}

const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

/** Tope de seguridad · un préstamo a 40 años son 480 recibos, y sobra. */
const MAX_ADELANTOS = 1200;

/**
 * La fecha como se lee en España · los avisos se enseñan tal cual.
 *
 * Es manipulación de cadena, no formato con locale: este módulo ya escribe la
 * frase en español, y dejar la fecha en ISO dentro de ella la delataría como
 * texto de programa en mitad de una pantalla.
 */
const enEspanol = (iso: string): string => {
  const [y, m, d] = partes(iso);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

const min = (a: string, b: string): string => (a < b ? a : b);

const meses = (r: ReglaDeAdelanto): number => {
  if (r.cadencia === 'MENSUAL') return 1;
  if (r.cadencia === 'ANUAL') return 12;
  if (r.cadencia === 'CADA_N_MESES') return Math.max(1, Math.floor(r.cadaMeses || 1));
  return 0;
};

/**
 * El primer día en que cae la regla.
 *
 * En la anual el mes lo manda `mes` y no `desde`: quien escribe «3.000 € cada
 * junio» a mitad de septiembre está diciendo «el junio que viene», no «ahora».
 * El día del mes sí sale de `desde`, recortado al último del mes para que un
 * «cada 31» no se desborde a marzo.
 */
function primerDia(regla: ReglaDeAdelanto): string {
  const [anio, mes, dia] = partes(regla.desde);
  if (regla.cadencia !== 'ANUAL' || !regla.mes) return regla.desde;

  const objetivo = Math.min(12, Math.max(1, Math.floor(regla.mes)));
  const anioDestino = objetivo >= mes ? anio : anio + 1;
  return `${anioDestino}-${String(objetivo).padStart(2, '0')}-${String(
    Math.min(dia, diasDelMes(anioDestino, objetivo))
  ).padStart(2, '0')}`;
}

/**
 * Las fechas y los importes que produce una regla, hasta el `horizonte`.
 *
 * El horizonte es el último recibo del préstamo: adelantar capital después de
 * haberlo pagado todo no es un plan agresivo, es una fecha mal escrita.
 */
export function adelantosDeLaRegla(regla: ReglaDeAdelanto, horizonte: string): AdelantoPrevisto[] {
  if (!esISO(regla.desde) || !(regla.importe > 0)) return [];

  const arranque = primerDia(regla);
  const paso = meses(regla);
  const tope = regla.hasta && esISO(regla.hasta) ? min(regla.hasta, horizonte) : horizonte;
  const cuantas = regla.veces && regla.veces > 0 ? Math.floor(regla.veces) : Infinity;
  const crece = 1 + (regla.crecimientoAnual || 0) / 100;
  const [, , diaObjetivo] = partes(regla.desde);

  const salida: AdelantoPrevisto[] = [];
  for (let i = 0; salida.length < cuantas && salida.length < MAX_ADELANTOS; i++) {
    const fecha = paso === 0 ? arranque : sumarMeses(arranque, i * paso, diaObjetivo);
    if (fecha > tope) break;

    // Años completos corridos desde el primero · la subida acompaña a quien
    // mete el dinero, no al calendario.
    const anios = Math.floor((i * paso) / 12);
    salida.push({
      fecha,
      importe: round2(regla.importe * Math.pow(crece, anios)),
      reglaId: regla.id,
    });

    if (paso === 0) break;
  }

  return salida;
}

/**
 * Lo que queda vivo justo antes de esa fecha, según el cuadro.
 *
 * Se lee del cuadro y no del préstamo porque en mitad de un plan el préstamo
 * sigue diciendo el capital de hoy, y el cuarto adelanto trabaja sobre el que
 * dejó el tercero.
 */
function vivoAntesDe(plan: PlanPagos | null, prestamo: Prestamo, fecha: string): number {
  const anterior = ordenarPeriodos(plan?.periodos ?? [])
    .filter((p) => p.fechaCargo <= fecha)
    .at(-1);
  if (anterior && Number.isFinite(anterior.principalFinal)) {
    return Math.max(0, anterior.principalFinal);
  }
  return Math.max(0, Number(prestamo.principalVivo || prestamo.principalInicial || 0));
}

/**
 * Todas las reglas juntas, en orden y sin repetir día.
 *
 * Dos adelantos el mismo día son UN adelanto: al banco le llega una
 * transferencia, y partirla en dos operaciones cobraría dos veces los gastos
 * fijos y partiría el cupo exento en dos trozos que se cuentan igual.
 */
export function calendarioDeAdelantos(
  reglas: ReglaDeAdelanto[],
  horizonte: string
): Array<{ fecha: string; importe: number; reglaIds: string[] }> {
  const porFecha = new Map<string, { fecha: string; importe: number; reglaIds: string[] }>();

  for (const regla of reglas) {
    for (const a of adelantosDeLaRegla(regla, horizonte)) {
      const previo = porFecha.get(a.fecha);
      if (previo) {
        previo.importe = round2(previo.importe + a.importe);
        if (!previo.reglaIds.includes(a.reglaId)) previo.reglaIds.push(a.reglaId);
      } else {
        porFecha.set(a.fecha, { fecha: a.fecha, importe: a.importe, reglaIds: [a.reglaId] });
      }
    }
  }

  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * El préstamo entero con el plan aplicado.
 *
 * Devuelve el cuadro resultante y, sobre todo, las dos cifras por las que se
 * abre esta pantalla: cuándo se acaba y cuánto se ahorra **neto de comisiones**.
 */
export function simularPlanDeAdelantos(
  prestamo: Prestamo,
  planOriginal: PlanPagos | null,
  reglas: ReglaDeAdelanto[],
  opciones: OpcionesDelPlan
): SimulacionDelPlan {
  const { modo } = opciones;
  const gastos = Math.max(0, Number(opciones.gastosFijosPorOperacion || 0));
  const avisos: string[] = [];

  const horizonte =
    ordenarPeriodos(planOriginal?.periodos ?? []).at(-1)?.fechaCargo ||
    planOriginal?.resumen?.fechaFinalizacion ||
    '';

  const calendario = horizonte ? calendarioDeAdelantos(reglas, horizonte) : [];
  const desde = opciones.desde || calendario[0]?.fecha || horizonte || '';

  const vacio: SimulacionDelPlan = {
    modo,
    desde,
    adelantos: [],
    previstos: calendario.length,
    antes: loQueQueda(planOriginal, desde),
    despues: loQueQueda(planOriginal, desde),
    totalAportado: 0,
    totalComisiones: 0,
    totalGastos: 0,
    totalSalidaCaja: 0,
    ahorroIntereses: 0,
    ahorroNeto: 0,
    mesesGanados: 0,
    cuotaEnUnAnio: loQueQueda(planOriginal, desde).cuota,
    fechaFinAntes: loQueQueda(planOriginal, desde).fechaFin,
    fechaFinDespues: loQueQueda(planOriginal, desde).fechaFin,
    plan: planOriginal,
    avisos: horizonte ? avisos : ['El préstamo no tiene cuadro sobre el que simular.'],
  };

  if (!planOriginal || calendario.length === 0) return vacio;

  // Un plan que arranca antes del último recibo pagado rehace historia: el
  // cuadro simulado sale bien, pero contesta a «qué habría pasado si», que no
  // es lo que se está preguntando. Se dice y se sigue — la fecha es del usuario.
  const ultimoPagado = ordenarPeriodos(planOriginal.periodos)
    .filter((p) => p.pagado)
    .at(-1);
  if (ultimoPagado && calendario[0] && calendario[0].fecha <= ultimoPagado.fechaCargo) {
    avisos.push(
      `El plan empieza el ${enEspanol(calendario[0].fecha)}, antes del último recibo pagado (${enEspanol(ultimoPagado.fechaCargo)}): lo que ves es qué habría pasado, no qué pasará.`
    );
  }

  const cupo = cupoAnualExento(prestamo, opciones.limiteAnualExento);
  const baseCupo = opciones.limiteAnualExento?.base ?? 'ANIO_NATURAL';
  const consumidoPorAnio = new Map<string, number>();

  let plan: PlanPagos | null = planOriginal;
  const aplicados: AdelantoAplicado[] = [];

  for (const cita of calendario) {
    const vivo = vivoAntesDe(plan, prestamo, cita.fecha);
    if (vivo <= 0) {
      avisos.push(
        `El préstamo queda saldado el ${enEspanol(aplicados.at(-1)?.fecha ?? cita.fecha)}: los ${
          calendario.length - aplicados.length
        } adelantos posteriores del plan ya no hacen falta.`
      );
      break;
    }

    const aplicado = round2(Math.min(cita.importe, vivo));

    // El cupo se consume con **todo** lo adelantado, no solo con la parte exenta:
    // gastarlo entero en enero es justo lo que deja el resto del año a
    // comisión completa, y esa es la decisión que el plan tiene que enseñar.
    const clave = ventanaAnual(prestamo, cita.fecha, baseCupo);
    const consumido = consumidoPorAnio.get(clave) ?? 0;
    const exento = cupo > 0 ? round2(Math.max(0, Math.min(aplicado, cupo - consumido))) : 0;
    consumidoPorAnio.set(clave, consumido + aplicado);

    const comision = comisionDeReembolso(prestamo, {
      tipo: 'PARCIAL',
      importe: round2(aplicado - exento),
      fecha: cita.fecha,
    }).importe;

    const siguiente = amortizarAnticipado(prestamo, plan, {
      desde: cita.fecha,
      importe: aplicado,
      modo,
    });

    // Un cuadro que no cambia es un adelanto que no ocurrió · seguir llamando
    // al motor con la misma fecha daría vueltas sin avanzar.
    if (!siguiente || siguiente === plan) {
      avisos.push(`El adelanto del ${enEspanol(cita.fecha)} no se pudo aplicar sobre el cuadro.`);
      continue;
    }
    plan = siguiente;

    aplicados.push({
      fecha: cita.fecha,
      solicitado: cita.importe,
      aplicado,
      exento,
      comision,
      gastos,
      salidaCaja: round2(aplicado + comision + gastos),
      principalDespues: round2(Math.max(0, vivo - aplicado)),
      reglaIds: cita.reglaIds,
    });

    if (aplicado < cita.importe) {
      avisos.push(
        `El adelanto del ${enEspanol(cita.fecha)} se recorta a ${aplicado.toFixed(
          2
        )} € porque es lo que quedaba vivo.`
      );
    }
  }

  const antes = loQueQueda(planOriginal, desde);
  const despues = loQueQueda(plan, desde);

  const totalAportado = round2(aplicados.reduce((s, a) => s + a.aplicado, 0));
  const totalComisiones = round2(aplicados.reduce((s, a) => s + a.comision, 0));
  const totalGastos = round2(aplicados.reduce((s, a) => s + a.gastos, 0));
  const ahorroIntereses = round2(Math.max(0, antes.intereses - despues.intereses));

  return {
    modo,
    desde,
    adelantos: aplicados,
    previstos: calendario.length,
    antes,
    despues,
    totalAportado,
    totalComisiones,
    totalGastos,
    totalSalidaCaja: round2(totalAportado + totalComisiones + totalGastos),
    ahorroIntereses,
    // Lo que de verdad se gana · el bruto ignora que cada adelanto puede llevar
    // comisión, y con doce al año esa diferencia decide.
    ahorroNeto: round2(ahorroIntereses - totalComisiones - totalGastos),
    mesesGanados: Math.max(0, antes.recibos - despues.recibos),
    cuotaEnUnAnio: loQueQueda(plan, sumarMeses(desde, 12)).cuota,
    fechaFinAntes: antes.fechaFin,
    fechaFinDespues: despues.fechaFin,
    plan,
    avisos,
  };
}

/**
 * El mismo plan por los dos caminos · reducir plazo y reducir cuota.
 *
 * Es LA decisión que se toma en esta pantalla, y enseñarla de una en una obliga
 * a apuntar la cifra anterior en un papel para compararla.
 */
export function compararModos(
  prestamo: Prestamo,
  planOriginal: PlanPagos | null,
  reglas: ReglaDeAdelanto[],
  opciones: Omit<OpcionesDelPlan, 'modo'>
): { reducirPlazo: SimulacionDelPlan; reducirCuota: SimulacionDelPlan } {
  return {
    reducirPlazo: simularPlanDeAdelantos(prestamo, planOriginal, reglas, {
      ...opciones,
      modo: 'REDUCIR_PLAZO',
    }),
    reducirCuota: simularPlanDeAdelantos(prestamo, planOriginal, reglas, {
      ...opciones,
      modo: 'REDUCIR_CUOTA',
    }),
  };
}
