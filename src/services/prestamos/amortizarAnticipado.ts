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
import { baseDe, interesDelPeriodo } from './baseDeCalculo';
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
}

const aCentimos = (euros: number): number => Math.round(euros * 100);

/** El primer periodo que DEVENGA a partir de un día · el corte de §6 ter·ter. */
const empieza = (p: PeriodoPago): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(p.devengoDesde ?? '') ? p.devengoDesde : p.fechaCargo;

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

  const corte = plan.periodos.findIndex((p) => empieza(p) >= desde);
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
    devengoDesde: anterior?.fechaCargo ?? plan.periodos[0].devengoDesde,
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
  });
}
