// ============================================================================
// El cuadro cuando el tipo cambia a mitad de vida · VOCABULARIO §6 ter · ter
// ============================================================================
//
// El banco no rehace tu cuadro desde el origen cuando revisa. Lo dice su propia
// carta:
//
//   «La cuota que abonará será de 252,62 € mensuales calculada sobre el capital
//    pendiente de amortizar de 47.394,19 € a fecha 31 de 03 de 2026.»
//
// O sea: **lo pagado se queda como está** y la cuota nueva sale del capital que
// queda vivo ese día, al tipo nuevo, en los meses que falten. Es lo único
// honesto: los intereses de las cuotas ya cobradas ocurrieron a otro tipo, y
// recalcularlos cambiaría un hecho. Además el capital vivo de hoy es
// consecuencia de haber amortizado al tipo viejo — partir de otro daría una
// cuota que no es la que te van a cobrar.
//
// Regenerar el cuadro entero al tipo nuevo, que es lo que se hacía, falla en
// las dos cosas a la vez.
//
// Puro: no lee la base ni el reloj, y la fórmula de la cuota es LA MISMA que
// usa el generador — importada, no copiada. Dos fórmulas para lo mismo acaban
// dando dos cuotas distintas.
// ============================================================================

import type { PlanPagos, PeriodoPago } from '../../types/prestamos';
import { cuotaFrancesa } from './cuadro';

export interface RevisionDeTipo {
  /**
   * Desde cuándo rige el tipo nuevo · ISO `YYYY-MM-DD`.
   *
   * Las cuotas con fecha de cargo ANTERIOR no se tocan. La de ese mismo día sí:
   * es la primera que el banco cobra ya revisada.
   */
  desde: string;
  /** El TIN anual nuevo · en porcentaje (3.63 = 3,63 %). */
  tinAnual: number;
}

const aCentimos = (euros: number): number => Math.round(euros * 100);

/**
 * El mismo cuadro, con el tipo nuevo a partir de `desde`.
 *
 * Devuelve el plan TAL CUAL cuando no hay nada que recalcular —una revisión
 * posterior a la última cuota, un plan vacío, un tipo que no es un número—.
 * Inventar un cuadro es peor que dejar el que había: de él sale la cuota que se
 * enseña y la previsión de tesorería de todos los meses que quedan.
 */
export function recalcularDesde(plan: PlanPagos, revision: RevisionDeTipo): PlanPagos {
  const { desde, tinAnual } = revision;

  if (!plan?.periodos?.length) return plan;
  if (typeof tinAnual !== 'number' || !Number.isFinite(tinAnual) || tinAnual < 0) return plan;
  // La fecha se valida con forma, no con longitud: el corte se decide comparando
  // CADENAS (`fechaCargo >= desde`), y un «2025/09/28» ordena distinto que un
  // «2025-09-28». Con diez caracteres cualquiera de los dos pasaría el filtro y
  // el tramo rehecho empezaría donde no toca.
  if (typeof desde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return plan;

  const corte = plan.periodos.findIndex((p) => p.fechaCargo >= desde);
  if (corte === -1) return plan;

  const intactos = plan.periodos.slice(0, corte);
  const porRehacer = plan.periodos.slice(corte);

  // El capital del que parte el tramo nuevo · lo que queda vivo ese día.
  //
  // Del último periodo intacto, no del principal inicial: entre medias se ha
  // amortizado, y esa amortización ocurrió de verdad.
  const anterior = intactos[intactos.length - 1];
  let vivoCentimos = anterior
    ? aCentimos(anterior.principalFinal)
    : aCentimos(porRehacer[0].principalFinal + porRehacer[0].amortizacion);

  // La cuota nueva · francesa sobre lo que queda, al tipo nuevo, en los meses
  // que faltan. Es literalmente la cuenta de la carta.
  const cuotaCentimos = aCentimos(cuotaFrancesa(vivoCentimos / 100, tinAnual, porRehacer.length));

  const rehechos: PeriodoPago[] = porRehacer.map((p, i) => {
    const esUltimo = i === porRehacer.length - 1;

    // Interés del mes sobre lo que queda vivo · misma cuenta que el generador.
    // La prorrata y los meses de solo intereses no se replican aquí a
    // propósito: son irregularidades del ARRANQUE del préstamo, y una revisión
    // a mitad de vida no las tiene.
    const interesCentimos = Math.round(((vivoCentimos / 100) * (tinAnual / 100)) / 12 * 100);

    let amortizacionCentimos: number;
    let cuotaDelPeriodo: number;

    if (esUltimo) {
      // La última cuota cierra el préstamo · se lleva lo que quede, para que el
      // cuadro no termine debiendo cuatro céntimos.
      amortizacionCentimos = vivoCentimos;
      cuotaDelPeriodo = amortizacionCentimos + interesCentimos;
    } else {
      cuotaDelPeriodo = cuotaCentimos;
      amortizacionCentimos = cuotaCentimos - interesCentimos;
      // Con un tipo alto y un plazo corto el interés puede comerse la cuota. No
      // se amortiza en negativo: se paga interés y el capital se queda quieto.
      if (amortizacionCentimos < 0) {
        amortizacionCentimos = 0;
        cuotaDelPeriodo = interesCentimos;
      }
    }

    vivoCentimos = Math.max(0, vivoCentimos - amortizacionCentimos);

    return {
      ...p,
      cuota: cuotaDelPeriodo / 100,
      interes: interesCentimos / 100,
      amortizacion: amortizacionCentimos / 100,
      principalFinal: vivoCentimos / 100,
      // Lo que se recalcula es lo que está POR VENIR · si algo de esto constaba
      // pagado, deja de constarlo: su importe ya no es el que se pagó, así que
      // el movimiento con el que se cuadró tampoco lo prueba. Dejar el enlace
      // sería lo mismo que dejar un `executedMovementId` al vacío: se lee como
      // «esto ya está», y no lo está.
      pagado: false,
      fechaPagoReal: undefined,
      movimientoTesoreriaId: undefined,
      // Las marcas del ARRANQUE se sueltan porque este cálculo no las aplica:
      // un periodo que siguiera diciendo «prorrateado» con una cuota entera
      // afirmaría de sí mismo algo que sus cifras desmienten. Solo puede pasar
      // si la revisión cae sobre los primeros meses del préstamo.
      esProrrateado: undefined,
      esSoloIntereses: undefined,
      diasDevengo: undefined,
    };
  });

  const periodos = [...intactos, ...rehechos];

  return {
    ...plan,
    periodos,
    resumen: {
      ...plan.resumen,
      totalIntereses: Math.round(periodos.reduce((s, p) => s + p.interes, 0) * 100) / 100,
      totalCuotas: periodos.length,
      fechaFinalizacion: periodos[periodos.length - 1]?.fechaCargo ?? plan.resumen.fechaFinalizacion,
    },
  };
}
