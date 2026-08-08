// ============================================================================
// Adelantar capital · VOCABULARIO §6 bis · quater
// ============================================================================
//
// Amortizar antes de tiempo rehace el cuadro, y ese cuadro lo construía
// `loanSettlementService` con un bucle propio. Era el CUARTO motor de la casa,
// y el que peor calculaba:
//
//   · `interes = vivo × tipo ÷ 12` · siempre el mes comercial, ignorando la
//     base del préstamo. En un ACT/360 —la clásica española, un 1,39 % más
//     cara— el desglose dejaba de cuadrar con el recibo.
//   · El tipo salía de `calculateBaseRate`, o sea **sin bonificaciones y sin
//     tramos**. Amortizar en la mixta de Unicaja rehacía el cuadro al 2,600 %
//     hasta 2043 y borraba el paso a Euríbor del 25-08-2026.
//
// Aquí se hace con las mismas piezas que el resto: `tinDelTramo` para el tipo,
// la base del préstamo para los días, `cuotaFrancesa` para la cuota y
// `recalcularDesde` para los tramos que vengan después. Lo pagado no se toca.
//
// Puro: no lee el reloj ni la base de datos.
// ============================================================================

import type { PeriodoPago, PlanPagos, Prestamo } from '../../types/prestamos';
import {
  baseDe,
  baseDiasSueltosDe,
  diasSegunBase,
  interesDelPeriodo,
  interesPorDias,
} from './baseDeCalculo';
import { cuotaFrancesa } from './cuotaFrancesa';
import { recalcularDesde } from './cuadroPorTramos';
import { diasEntre } from './fechas';
import { tinDelTramo } from './tinDelTramo';
import { tramosDeTipo, tramoVigente } from './tramosDeTipo';

export interface Adelanto {
  /** El día en que entra el dinero · `YYYY-MM-DD`. */
  desde: string;
  /** Capital que se adelanta, en euros. */
  importe: number;
  /**
   * Qué se hace con lo que queda.
   *
   * `REDUCIR_CUOTA` mantiene la fecha de fin y baja el recibo; `REDUCIR_PLAZO`
   * mantiene el recibo y acorta. Es la elección que da el banco, y en la
   * escritura de Unicaja está con esas palabras: «podrá optar entre aplicar
   * dicho reembolso a la reducción del número de cuotas… o del importe».
   */
  modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  /**
   * Los intereses corridos que se liquidan ese día, en euros.
   *
   * En una cancelación TOTAL el banco los cobra junto al capital. Iban a cero
   * en el cuadro aunque el movimiento sí los cobrara, así que el total de
   * intereses del préstamo salía corto — y de ahí sale la deducción fiscal.
   */
  interesesCorridos?: number;
  /**
   * Qué decide qué se conserva · por defecto el DEVENGO.
   *
   * Adelantar capital no cancela nada, así que el corte es el mismo que el de
   * una revisión: el recibo que se gira ese día paga el mes que acaba de
   * terminar y se conserva entero.
   *
   * Cancelar es otra cosa: lo que manda es lo COBRADO. Un recibo con fecha
   * posterior a la cancelación **no se va a girar nunca**, así que no puede
   * quedarse en el cuadro ni servir de referencia para el capital que se salda
   * —su `principalFinal` está proyectado a una cuota que no va a existir—.
   */
  cortePor?: 'DEVENGO' | 'CARGO';
}

const aCentimos = (euros: number): number => Math.round(euros * 100);

/**
 * Desde cuándo devenga un periodo · el corte de §6 ter·ter.
 *
 * Comparar fechas como texto exige que TODAS estén en ISO, y hay planes viejos
 * con `devengoDesde` en `2025/09/28`. Contra un ISO ese formato sale siempre
 * por delante —la barra es mayor que el guion—, así que el corte se desordena
 * sin que nada avise.
 *
 * Se traduce en vez de descartarse. Caer en `fechaCargo`, que es lo que se
 * hacía, no es neutral: afirma que el devengo empieza el día del recibo, y en
 * un préstamo mensual empieza un mes antes. O sea que el periodo a caballo de
 * la operación se conservaba o se rehacía según el formato de su fecha.
 * `fechaCargo` queda solo para cuando no hay nada que traducir.
 *
 * Se exporta porque el resumen del modal hace este mismo corte, y tenía su
 * propia versión —la misma pregunta contestada de dos maneras, que es justo lo
 * que estas dos pantallas llevan arreglando.
 */
export const inicioDelDevengo = (p: PeriodoPago): string => {
  const apuntado = (p.devengoDesde ?? '').replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(apuntado) ? apuntado : p.fechaCargo;
};

const empieza = inicioDelDevengo;

/**
 * El cuadro después de adelantar capital.
 *
 * Devuelve el plan TAL CUAL cuando no hay nada que rehacer. Inventar un cuadro
 * es peor que dejar el que había: de él salen la cuota que se enseña y las
 * previsiones de tesorería de todo lo que queda.
 */
export function amortizarAnticipado(
  prestamo: Prestamo,
  plan: PlanPagos | null,
  adelanto: Adelanto
): PlanPagos | null {
  const { desde, importe, modo } = adelanto;
  if (!plan?.periodos?.length) return plan;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return plan;
  if (!(importe > 0)) return plan;

  // El recibo del día exacto se conserva solo si ya se pagó · si no, es uno de
  // los que la cancelación se lleva por delante.
  const seConserva = (p: PeriodoPago): boolean =>
    adelanto.cortePor === 'CARGO'
      ? p.fechaCargo < desde || (p.pagado === true && p.fechaCargo <= desde)
      : empieza(p) < desde;

  const corte = plan.periodos.findIndex((p) => !seConserva(p));
  const intactos = corte === -1 ? plan.periodos.slice() : plan.periodos.slice(0, corte);
  const porRehacer = corte === -1 ? [] : plan.periodos.slice(corte);

  const anterior = intactos[intactos.length - 1];
  const vivoAntes = anterior
    ? aCentimos(anterior.principalFinal)
    : aCentimos(prestamo.principalInicial);

  const base = baseDe(prestamo);
  const tramos = tramosDeTipo(prestamo).map((t) => ({ ...t, tin: tinDelTramo(prestamo, t) }));
  const tramoAhora = tramoVigente(prestamo, desde);
  const tinAhora = tinDelTramo(prestamo, tramoAhora);

  // ── La línea del adelanto · capital, sin cuota ───────────────────────────
  //
  // Se marca pagada porque el dinero ha salido: es un hecho, no una previsión.
  const aplicado = Math.min(aCentimos(importe), vivoAntes);
  const corridos = aCentimos(adelanto.interesesCorridos ?? 0);
  let vivo = vivoAntes - aplicado;

  const laDelAdelanto: PeriodoPago = {
    periodo: (anterior?.periodo ?? 0) + 1,
    // Un cuadro viejo puede no traer devengo apuntado —`empieza` ya lo
    // contempla en el corte—, y `devengoDesde` es obligatorio: dejarlo en
    // `undefined` guardaría un periodo que rompe cualquier comparación de
    // fechas posterior, empezando por el corte de la siguiente revisión.
    devengoDesde: anterior?.fechaCargo || empieza(plan.periodos[0]) || desde,
    devengoHasta: desde,
    fechaCargo: desde,
    cuota: (aplicado + corridos) / 100,
    interes: corridos / 100,
    amortizacion: aplicado / 100,
    principalFinal: vivo / 100,
    pagado: true,
    fechaPagoReal: desde,
  };

  // ── Lo que queda ─────────────────────────────────────────────────────────
  //
  // Reduciendo cuota se conservan las citas y baja el recibo; reduciendo plazo
  // se conserva el recibo y sobran citas al final. En los dos casos las fechas
  // salen del cuadro que ya había: son las del banco, no unas recalculadas.
  const cuotaCentimos =
    modo === 'REDUCIR_CUOTA'
      ? aCentimos(cuotaFrancesa(vivo / 100, tinAhora, Math.max(1, porRehacer.length)))
      : aCentimos(anterior?.cuota ?? porRehacer[0]?.cuota ?? 0);

  const rehechos: PeriodoPago[] = [];
  let devengoPrevio = desde;

  for (const p of porRehacer) {
    if (vivo <= 0) break;

    const interesCentimos = interesDelPeriodo(
      vivo,
      tinAhora,
      diasEntre(devengoPrevio, p.devengoHasta),
      base
    );

    let amortizacionCentimos = cuotaCentimos - interesCentimos;
    let cuotaDelPeriodo = cuotaCentimos;

    // La última se lleva lo que quede · un cuadro que termina debiendo cuatro
    // céntimos no es un cuadro.
    if (amortizacionCentimos >= vivo || p === porRehacer[porRehacer.length - 1]) {
      amortizacionCentimos = vivo;
      cuotaDelPeriodo = amortizacionCentimos + interesCentimos;
    } else if (amortizacionCentimos < 0) {
      // Con un tipo alto y poco plazo el interés puede comerse la cuota.
      amortizacionCentimos = 0;
      cuotaDelPeriodo = interesCentimos;
    }

    vivo = Math.max(0, vivo - amortizacionCentimos);

    rehechos.push({
      ...p,
      periodo: laDelAdelanto.periodo + rehechos.length + 1,
      devengoDesde: devengoPrevio,
      cuota: cuotaDelPeriodo / 100,
      interes: interesCentimos / 100,
      amortizacion: amortizacionCentimos / 100,
      principalFinal: vivo / 100,
      // Lo rehecho está POR VENIR · si constaba pagado, su importe ya no es el
      // que se pagó, así que el movimiento con el que se cuadró no lo prueba.
      pagado: false,
      fechaPagoReal: undefined,
      movimientoTesoreriaId: undefined,
      esProrrateado: undefined,
      esSoloIntereses: undefined,
      diasDevengo: undefined,
    });

    devengoPrevio = p.fechaCargo;
  }

  const periodos = [...intactos, laDelAdelanto, ...rehechos];

  let nuevo: PlanPagos = {
    ...plan,
    periodos,
    resumen: {
      ...plan.resumen,
      totalIntereses: Math.round(periodos.reduce((s, p) => s + p.interes, 0) * 100) / 100,
      totalCuotas: periodos.length,
      fechaFinalizacion: periodos[periodos.length - 1]?.fechaCargo ?? plan.resumen.fechaFinalizacion,
    },
  };

  // Los tramos que vengan DESPUÉS se vuelven a aplicar · si no, adelantar
  // capital en un mixto borraría su cambio de tipo. Es lo que hacía el motor
  // propio: la Unicaja se quedaba al 2,600 % hasta 2043.
  for (const t of tramos) {
    if (t.desde && t.desde > desde) {
      nuevo = recalcularDesde(nuevo, { desde: t.desde, tinAnual: t.tin, base });
    }
  }

  return nuevo;
}

/**
 * El cuadro después de cancelar del todo.
 *
 * Es el mismo adelanto, por todo lo que queda vivo: no hay nada que rehacer
 * después, y los intereses corridos van EN la línea de cierre en vez de a cero.
 */
export function cancelarAnticipado(
  prestamo: Prestamo,
  plan: PlanPagos | null,
  cierre: { fecha: string; capital: number; interesesCorridos?: number }
): PlanPagos | null {
  return amortizarAnticipado(prestamo, plan, {
    desde: cierre.fecha,
    importe: cierre.capital,
    modo: 'REDUCIR_PLAZO',
    interesesCorridos: cierre.interesesCorridos,
    cortePor: 'CARGO',
  });
}

/**
 * Los intereses corridos desde el último recibo hasta un día · §6 bis · quater.
 *
 * Los cobra el banco al cancelar, y se calculaban DOS veces —una en
 * `loanSettlementService` y otra en `propertySaleService`— con la misma cuenta
 * equivocada las dos: `vivo × tipo × días ÷ 365` fijo, con un tipo de
 * `calculateBaseRate`. O sea sin la base del préstamo —un ACT/360 cobra un
 * 1,39 % más—, sin bonificaciones y sin el tramo que rija ese día.
 *
 * Aquí es una sola, con las piezas de siempre.
 */
export function interesesCorridos(
  prestamo: Prestamo,
  plan: PlanPagos | null,
  hasta: string,
  vivo: number
): number {
  if (!(vivo > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return 0;

  // Desde el último recibo que ya devengó · si no hay cuadro, desde lo que el
  // préstamo sepa decir de sí mismo.
  const ultimo = (plan?.periodos ?? [])
    .filter((p) => p.fechaCargo && p.fechaCargo <= hasta)
    .sort((a, b) => a.fechaCargo.localeCompare(b.fechaCargo))
    .at(-1);
  const desde =
    ultimo?.fechaCargo ||
    prestamo.fechaUltimaCuotaPagada ||
    prestamo.fechaPrimerCargo ||
    prestamo.fechaFirma;
  if (!desde || desde >= hasta) return 0;

  const base = baseDiasSueltosDe(prestamo);
  const tin = tinDelTramo(prestamo, tramoVigente(prestamo, hasta));
  return interesPorDias(aCentimos(vivo), tin, diasSegunBase(desde, hasta, base), base) / 100;
}
