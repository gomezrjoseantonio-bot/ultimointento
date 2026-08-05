// ============================================================================
// El cuadro de amortización · UN SOLO MOTOR
// ============================================================================
//
// Hasta aquí había DOS, y el cuadro que acababas teniendo dependía de por qué
// puerta entrabas:
//
//   · `prestamosCalculationService` (el legacy) lo generaba `prestamosService`
//     en cada alta y en cada edición, y de él salían tesorería, la fiscalidad y
//     los informes.
//   · `prestamoCalculatorService` (el v2) lo calculaba el wizard para la vista
//     previa, y después PISABA el guardado… salvo si el préstamo era «pre-v2»,
//     o venía de una importación, o de la venta de un inmueble, o de una
//     edición hecha desde cualquier otro sitio.
//
// Los dos escribían en el mismo `planPagos`. Y no decían lo mismo: el v2 saca
// la carencia técnica como un cargo aparte —la línea 0— y el legacy la metía
// dentro de la primera cuota. Así que dos préstamos idénticos podían tener
// cuadros distintos según cómo se hubieran dado de alta.
//
// Esto es el único sitio donde se genera un cuadro. Lo que decide:
//
//   - **El tipo sale de `tinDelTramo`**, que aplica la regla de §6 ter con su
//     tope y sabe además desde qué tramo rebajan las bonificaciones. El wizard
//     sumaba los puntos por su cuenta y sin tope, así que la vista previa podía
//     enseñar un tipo más bajo que el que después se guardaba: la tercera
//     versión de la misma regla.
//   - **No mira el reloj.** El legacy resolvía el tipo con `new Date()`, de
//     modo que el mismo préstamo daba un cuadro distinto según el día en que lo
//     generaras. Aquí el cuadro es función del préstamo y de nada más.
//   - **La carencia técnica se lee, no se deduce.** Sale línea 0 solo si el
//     préstamo trae `carenciaTecnica` guardada. Deducirla al vuelo se la
//     inventaría en los préstamos antiguos, que se dieron de alta sin ella.
//   - **Céntimos de banco**: la cuota se redondea a céntimos —es lo que el
//     banco carga—, el interés se calcula sobre el capital vivo y la última
//     cuota se lleva lo que quede, para que el cuadro no acabe debiendo cuatro
//     céntimos.
//   - **El tipo NO es uno para toda la vida.** El cuadro se parte en tramos
//     (`tramosDeTipo`): un mixto cambia cuando acaba su tramo fijo y un
//     variable cambia en cada revisión apuntada. Cada tramo se aplica con
//     `recalcularDesde`, que es lo que hace el banco —lo pagado se queda como
//     está y la cuota nueva sale del capital vivo de ese día—. Lo que no se
//     sabe no se inventa: después de la última revisión conocida se sigue con
//     el último tipo, marcado como estimación.
//
//   - **La carencia inicial se aplica** (`carenciaDe`). De capital paga solo los
//     intereses y el capital se queda quieto; total no paga nada y los
//     intereses se capitalizan, así que al acabar se debe más de lo que se
//     pidió. Acabada la carencia, la cuota se recalcula sobre lo que se deba
//     ESE día y en los meses que queden (§6 bis · ter).
//
//   - **La base de cálculo la dice el préstamo** (`baseDeCalculo`). El interés
//     de cada periodo sale de contar días —`capital × TIN × días ÷ base`—, y la
//     base es una cláusula de la escritura: 365/360, 365/365 o el mes comercial
//     30/360. Ausente = 30/360, que es lo que ATLAS venía haciendo.
//
// Lo que este motor todavía NO hace, y hay que saberlo:
//
//   - **La TAE es la aproximación que traía el v2**, no la TIR de los flujos, y
//     no incluye los gastos de constitución.
// ============================================================================

import type { Prestamo, PeriodoPago, PlanPagos } from '../../types/prestamos';
import { tinDelTramo } from './tinDelTramo';
import { cuotaFrancesa } from './cuotaFrancesa';
import { diasEntre, esISO, partes, restarUnDia, sumarMeses } from './fechas';
import { recalcularDesde } from './cuadroPorTramos';
import { tramosDeTipo, type TramoDeTipo } from './tramosDeTipo';
import { carenciaDe } from './carencia';
import { baseDe, interesDelPeriodo, interesPorDias } from './baseDeCalculo';

export { cuotaFrancesa } from './cuotaFrancesa';
export type { TramoDeTipo } from './tramosDeTipo';

const aCentimos = (euros: number): number => Math.round(euros * 100);
const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface ResumenCuadro {
  /** La cuota constante del tramo francés · lo que se ve en pantalla. */
  cuotaMensual: number;
  /** Todo lo que se pagará de intereses, carencia técnica incluida. */
  totalIntereses: number;
  /** Solo los de las cuotas · sin la carencia técnica. */
  interesesCuadro: number;
  /** Los del cargo separado de la línea 0 · 0 si no hay. */
  interesesCarenciaTecnica: number;
  /**
   * TAE aproximada, en porcentaje.
   *
   * Es una APROXIMACIÓN heredada del motor v2, no la TIR de los flujos: suma
   * la capitalización del TIN, la comisión de apertura prorrateada y la
   * carencia técnica. Queda pendiente hacerla de verdad.
   */
  tae: number;
  /** El TIN que se paga, bonificaciones y tope incluidos · en porcentaje. */
  tinEfectivo: number;
  fechaUltimaCuota: string;
  /** Cuántas líneas tiene el cuadro · la carencia técnica cuenta como una. */
  numLineas: number;
  /**
   * A qué tipo va cada trozo del préstamo, con el tipo YA bonificado.
   *
   * Uno solo en un fijo. En un mixto o un variable, tantos como cambios de
   * tipo: los `estimado` son proyecciones, no datos de un papel, y la pantalla
   * tiene que poder decirlo.
   */
  tramos: Array<TramoDeTipo & { tin: number }>;
}

export interface Cuadro {
  plan: PlanPagos;
  resumen: ResumenCuadro;
}

// ─── El generador ───────────────────────────────────────────────────────────

/** El día en que se cobra la primera cuota. */
function primerCargo(prestamo: Prestamo): string {
  if (esISO(prestamo.fechaPrimerCargo)) return prestamo.fechaPrimerCargo.slice(0, 10);

  // Sin fecha dicha se deduce de la firma: el mes siguiente, o los que diga el
  // diferimiento, en el día de cargo pactado.
  const meses = prestamo.diferirPrimeraCuotaMeses && prestamo.diferirPrimeraCuotaMeses > 0
    ? prestamo.diferirPrimeraCuotaMeses
    : 1;
  const [, , diaFirma] = partes(prestamo.fechaFirma);
  return sumarMeses(prestamo.fechaFirma, meses, prestamo.diaCargoMes || diaFirma);
}

/**
 * El cuadro de un préstamo.
 *
 * Función pura de sus datos: mismo préstamo, mismo cuadro, se genere hoy o
 * dentro de un año.
 */
export function generarCuadro(prestamo: Prestamo): Cuadro {
  const fechaFirma = esISO(prestamo.fechaFirma) ? prestamo.fechaFirma.slice(0, 10) : '';
  const cargoInicial = primerCargo(prestamo);

  // A qué tipo va cada trozo del préstamo · el fijo tiene uno, el mixto cambia
  // cuando acaba su tramo fijo y el variable cambia en cada revisión apuntada.
  //
  // Y cuánto rebajan las bonificaciones en cada uno lo decide `tinDelTramo`: no
  // se pierden al revisar el índice —eso solo pasa cuando el banco las retira
  // (§6 ter)—, pero hay escrituras que no las aplican hasta el segundo periodo
  // de interés, y entonces el tramo fijo de un mixto va sin rebajar.
  const tramos = tramosDeTipo(prestamo).map((t) => ({ ...t, tin: tinDelTramo(prestamo, t) }));

  // El cuadro nace al tipo del arranque y después se rehace tramo a tramo. Un
  // tramo que empieza ANTES de la primera cuota no parte nada: es el tipo del
  // arranque, y aplicarlo como corte reescribiría también la línea 0.
  const delArranque = tramos.filter((t) => !t.desde || t.desde <= cargoInicial);
  const porRehacer = tramos.filter((t) => t.desde && t.desde > cargoInicial);
  const tinEfectivo = delArranque.length > 0 ? delArranque[delArranque.length - 1].tin : 0;

  // El día objetivo de la serie es el PACTADO, no el del primer cargo: si la
  // primera cita ya viene recortada —un cargo el 31 que cae en febrero— leerlo
  // de ahí dejaría todos los cargos siguientes clavados en el 28.
  const diaCargo = prestamo.diaCargoMes || partes(cargoInicial)[2];

  const periodos: PeriodoPago[] = [];
  let vivoCentimos = aCentimos(prestamo.principalInicial);

  // ── Línea 0 · la carencia técnica ─────────────────────────────────────────
  //
  // Los días sueltos entre la firma y el primer mes de cobro. El banco los
  // liquida en un cargo SEPARADO —no como suplemento de la primera cuota—, y
  // por eso es una línea propia con capital amortizado cero.
  //
  // Solo si el préstamo la trae guardada. Deducirla aquí se la inventaría en
  // los préstamos antiguos, que nunca la tuvieron.
  const ct = prestamo.carenciaTecnica;
  let interesesCarenciaTecnica = 0;
  if (ct && ct.intereses > 0 && esISO(ct.fechaLiquidacion)) {
    interesesCarenciaTecnica = round2(ct.intereses);
    periodos.push({
      periodo: 0,
      devengoDesde: fechaFirma,
      devengoHasta: ct.fechaLiquidacion.slice(0, 10),
      fechaCargo: ct.fechaLiquidacion.slice(0, 10),
      cuota: interesesCarenciaTecnica,
      interes: interesesCarenciaTecnica,
      amortizacion: 0,
      principalFinal: vivoCentimos / 100,
      esSoloIntereses: true,
      diasDevengo: ct.dias > 0 ? ct.dias : undefined,
      pagado: false,
    });
  }

  // ── Irregularidades del arranque ──────────────────────────────────────────
  // Los campos explícitos mandan; si no están, se deducen de `esquemaPrimerRecibo`.
  //
  // La carencia · el periodo inicial en que NO se amortiza capital. De capital
  // se pagan los intereses del mes; total no se paga nada y los intereses se
  // capitalizan, así que al acabar se debe más de lo que se pidió (§6 bis·ter).
  const carencia = carenciaDe(prestamo);

  // Cómo cuenta los días el banco · de esto depende que el desglose
  // interés/capital cuadre con el recibo, aunque la cuota ya coincida.
  const base = baseDe(prestamo);

  // Con carencia técnica la primera cuota es una cuota ENTERA · los días
  // sueltos ya se han cobrado en la línea 0, y prorratearla además los cobraría
  // dos veces. No es hipotético: el wizard guardaba `esquemaPrimerRecibo:
  // 'PRORRATA'` justamente cuando había carencia técnica, porque su cuadro
  // pisaba después al del motor legacy y ese campo daba igual. Ahora no da
  // igual, y esos préstamos ya están guardados así.
  const hayCarenciaTecnica = periodos.length > 0;
  const prorratearPrimero = hayCarenciaTecnica
    ? false
    : (prestamo.prorratearPrimerPeriodo ?? (prestamo.esquemaPrimerRecibo === 'PRORRATA'));

  const plazo = prestamo.plazoMesesTotal;

  // La cuota sale del capital que quede vivo AL ACABAR la carencia, repartido
  // en los meses que amortizan. Con carencia de capital ese capital es el
  // inicial; con carencia total es mayor, porque los intereses del periodo se
  // han ido sumando. Por eso no se puede calcular antes del bucle.
  let cuotaCentimos = carencia.tipo === 'NINGUNA'
    ? aCentimos(cuotaFrancesa(prestamo.principalInicial, tinEfectivo, plazo))
    : 0;

  let cargo = cargoInicial;
  // De dónde arranca el devengo de la primera cuota · si hubo carencia técnica,
  // desde su liquidación: esos días ya se han cobrado aparte.
  let devengoPrevio = periodos.length > 0 ? periodos[0].fechaCargo : fechaFirma;

  for (let periodo = 1; periodo <= plazo; periodo++) {
    const enCarencia = periodo <= carencia.meses;
    const esSoloIntereses = enCarencia && carencia.tipo === 'CAPITAL';
    const enCarenciaTotal = enCarencia && carencia.tipo === 'TOTAL';
    const esProrrateado = periodo === 1 && prorratearPrimero;
    const esUltimo = periodo === plazo;

    const devengoHasta = restarUnDia(cargo);
    const dias = diasEntre(devengoPrevio, devengoHasta);

    // El interés del periodo · cómo se cuentan los días lo dice el préstamo
    // (§6 bis · bis). El arranque irregular —la prorrata y el primer mes de
    // carencia— se cuenta siempre por días: no es un mes.
    const porDias = esProrrateado || (periodo === 1 && enCarencia);
    const interesCentimos = porDias
      ? interesPorDias(vivoCentimos, tinEfectivo, dias, base)
      : interesDelPeriodo(vivoCentimos, tinEfectivo, dias, base);

    let amortizacionCentimos: number;
    let cuotaDelPeriodo: number;

    if (enCarenciaTotal) {
      // No se paga NADA · el interés se capitaliza y la deuda crece.
      amortizacionCentimos = -interesCentimos;
      cuotaDelPeriodo = 0;
    } else if (esSoloIntereses) {
      amortizacionCentimos = 0;
      cuotaDelPeriodo = interesCentimos;
    } else if (esUltimo) {
      // La última cierra el préstamo · se lleva lo que quede vivo.
      amortizacionCentimos = vivoCentimos;
      cuotaDelPeriodo = amortizacionCentimos + interesCentimos;
    } else {
      cuotaDelPeriodo = esProrrateado
        ? Math.round(cuotaCentimos * (dias / 30))
        : cuotaCentimos;
      amortizacionCentimos = cuotaDelPeriodo - interesCentimos;

      // Con un tipo alto y un plazo corto el interés puede comerse la cuota. No
      // se amortiza en negativo: se paga interés y el capital se queda quieto.
      if (amortizacionCentimos < 0) {
        amortizacionCentimos = 0;
        cuotaDelPeriodo = interesCentimos;
      }
    }

    vivoCentimos = Math.max(0, vivoCentimos - amortizacionCentimos);

    // Acabada la carencia se fija la cuota del resto de la vida del préstamo ·
    // sobre lo que se debe AHORA, que con carencia total es más de lo que se
    // pidió, y en los meses que quedan.
    if (carencia.meses > 0 && periodo === carencia.meses) {
      cuotaCentimos = aCentimos(
        cuotaFrancesa(vivoCentimos / 100, tinEfectivo, plazo - carencia.meses)
      );
    }

    periodos.push({
      periodo,
      devengoDesde: devengoPrevio,
      devengoHasta,
      fechaCargo: cargo,
      cuota: cuotaDelPeriodo / 100,
      interes: interesCentimos / 100,
      amortizacion: amortizacionCentimos / 100,
      principalFinal: vivoCentimos / 100,
      esProrrateado,
      esSoloIntereses,
      diasDevengo: porDias && dias > 0 ? dias : undefined,
      pagado: false,
    });

    devengoPrevio = cargo;
    cargo = sumarMeses(cargo, 1, diaCargo);
  }

  // ── Los tramos siguientes ─────────────────────────────────────────────────
  //
  // Cada uno se aplica con `recalcularDesde`, que es exactamente lo que hace el
  // banco al revisar: lo pagado se queda como está y la cuota nueva sale del
  // capital que quede vivo ese día, al tipo nuevo, en los meses que falten. No
  // se regenera desde el origen, que reescribiría intereses ya devengados.
  let plan: PlanPagos = {
    prestamoId: prestamo.id,
    fechaGeneracion: new Date().toISOString(),
    periodos,
    resumen: {
      totalIntereses: 0,
      totalCuotas: periodos.length,
      fechaFinalizacion: periodos[periodos.length - 1]?.fechaCargo ?? '',
    },
  };

  for (const tramo of porRehacer) {
    plan = recalcularDesde(plan, { desde: tramo.desde, tinAnual: tramo.tin, base });
  }

  // Las cifras se recuentan del cuadro FINAL · con tramos, los intereses que se
  // fueron sumando al generarlo son los del primer tipo y ya no valen.
  const finales = plan.periodos;
  const interesesCarencia = round2(finales.find((p) => p.periodo === 0)?.interes ?? 0);
  const interesesCuadro = round2(
    finales.filter((p) => p.periodo > 0).reduce((s, p) => s + p.interes, 0)
  );
  const ultima = finales[finales.length - 1];
  // La cuota que se enseña es la del ARRANQUE · con tramos no hay una sola, y
  // la de ahora mismo dependería de qué día es hoy, que es justo lo que este
  // motor no mira.
  const primeraCuota = finales.find((p) => p.periodo > 0)?.cuota ?? 0;

  return {
    plan: {
      ...plan,
      resumen: {
        totalIntereses: round2(interesesCuadro + interesesCarencia),
        totalCuotas: finales.length,
        fechaFinalizacion: ultima?.fechaCargo ?? '',
      },
    },
    resumen: {
      cuotaMensual: primeraCuota,
      totalIntereses: round2(interesesCuadro + interesesCarencia),
      interesesCuadro,
      interesesCarenciaTecnica: interesesCarencia,
      tae: taeAproximada(prestamo, tinEfectivo, interesesCarencia),
      tinEfectivo: round2(tinEfectivo),
      fechaUltimaCuota: ultima?.fechaCargo ?? '',
      numLineas: finales.length,
      tramos,
    },
  };
}

/**
 * El cuadro nuevo, con el punteo del viejo.
 *
 * Regenerar un cuadro no puede borrar lo que ya se cuadró contra el banco: el
 * enlace al movimiento (`movimientoTesoreriaId`) es trabajo del usuario, no un
 * dato calculado. Se busca la cuota equivalente por FECHA DE CARGO y, si el
 * calendario se ha movido, por número de periodo.
 *
 * Lo que no encuentre pareja nace sin puntear, y una cuota vencida se da por
 * pagada — que es lo que ya hacían el alta y la edición.
 *
 * Vivía dentro del wizard, así que solo se aplicaba si el préstamo se editaba
 * desde allí; cualquier otra puerta perdía el punteo entero.
 */
export function conservarPunteo(plan: PlanPagos, anterior: PlanPagos | null): PlanPagos {
  const porFecha = new Map<string, PeriodoPago>();
  const porPeriodo = new Map<number, PeriodoPago>();
  for (const p of anterior?.periodos ?? []) {
    if (p.fechaCargo) porFecha.set(p.fechaCargo.slice(0, 10), p);
    porPeriodo.set(p.periodo, p);
  }

  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);

  return {
    ...plan,
    periodos: plan.periodos.map((p) => {
      const previo = porFecha.get(p.fechaCargo.slice(0, 10)) ?? porPeriodo.get(p.periodo);
      const vencida = new Date(p.fechaCargo) <= hoy;
      const pagado = previo?.pagado ?? vencida;

      return {
        ...p,
        pagado,
        fechaPagoReal: previo?.fechaPagoReal ?? (pagado ? p.fechaCargo : undefined),
        movimientoTesoreriaId: previo?.movimientoTesoreriaId,
      };
    }),
  };
}

/**
 * La TAE, aproximada · heredada tal cual del motor v2.
 *
 * NO es la TIR de los flujos, que es lo que la TAE es por definición: suma la
 * capitalización del TIN, la comisión de apertura repartida por años y la
 * carencia técnica. Se conserva como estaba para que unificar los motores no
 * mueva además esta cifra; hacerla de verdad es trabajo aparte.
 */
function taeAproximada(prestamo: Prestamo, tinEfectivo: number, interesesCT: number): number {
  const capital = prestamo.principalInicial;
  const anios = prestamo.plazoMesesTotal / 12;
  if (capital <= 0 || anios <= 0) return 0;

  const i = tinEfectivo / 100 / 12;
  const comisionApertura = ((prestamo.comisionApertura || 0) * capital) / 100;

  const base = Math.pow(1 + i, 12) - 1;
  const porComision = comisionApertura / (capital * anios);
  const porCarencia = interesesCT / (capital * anios);

  return round2((base + porComision + porCarencia) * 100);
}
