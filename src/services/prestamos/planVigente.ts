// ============================================================================
// ¿Sigue valiendo el cuadro que hay guardado? · VOCABULARIO §6 bis
// ============================================================================
//
// Un cuadro persistido puede haber dejado de cuadrar: el préstamo se editó, el
// motor cambió, o viene de una versión que colocaba mal los días de cargo.
// Comprobarlo se hace de la única forma que de verdad lo demuestra — generando
// el que TOCARÍA y comparándolo fila a fila.
//
// Y ahí está lo caro: la comprobación cuesta lo mismo que lo que evita. Por eso
// existe `planYaValidado`: mientras el préstamo no se toque —`updatedAt` es su
// testigo— el cuadro que se validó hace un momento sigue valiendo por la misma
// razón que valía entonces. Sin ese sello, la caché en memoria no ahorraba
// nada: cada acierto pagaba una generación completa, y Financiación pedía el
// cuadro dos veces por préstamo cada vez que se abría.
//
// Vive fuera del servicio porque `prestamosService` se pasó de las 800 líneas
// al añadirle el sello, y porque esto es una pregunta cerrada sobre dos datos:
// no toca la base, no guarda nada y no sabe de pantallas.
// ============================================================================

import type { PlanPagos, Prestamo } from '../../types/prestamos';
import { prestamosCalculationService } from '../prestamosCalculationService';

/** Qué cuadro se validó para qué versión de qué préstamo. */
const validados = new Map<string, { updatedAt?: string; plan: PlanPagos }>();

/**
 * Si este cuadro exacto ya se validó para esta versión exacta del préstamo.
 *
 * Se compara el plan por IDENTIDAD, no por contenido: si alguien guardó otro
 * cuadro, es otro objeto y el sello no vale — que es lo que hay que hacer.
 */
export function planYaValidado(prestamo: Prestamo, plan: PlanPagos): boolean {
  const sello = validados.get(prestamo.id);
  return sello?.plan === plan && sello.updatedAt === prestamo.updatedAt;
}

export function anotarValidado(prestamo: Prestamo, plan: PlanPagos): void {
  validados.set(prestamo.id, { updatedAt: prestamo.updatedAt, plan });
}

/** Se olvida lo validado · al cambiar el préstamo hay que volver a mirar. */
export function olvidarValidado(prestamoId: string): void {
  validados.delete(prestamoId);
}

export function needsPlanRegeneration(prestamo: Prestamo, plan: PlanPagos): boolean {
  if (!plan.periodos || plan.periodos.length === 0) return true;

  const customPlanSource = plan.metadata?.source;
  const isCancelledLoan = prestamo.activo === false || prestamo.estado === 'cancelado';
  const lastPeriod = plan.periodos[plan.periodos.length - 1];

  if (isCancelledLoan) {
    const finalPrincipalCentimos = Math.round((lastPeriod?.principalFinal || 0) * 100);
    if (prestamo.fechaCancelacion && plan.resumen.fechaFinalizacion === prestamo.fechaCancelacion && finalPrincipalCentimos === 0) {
      return false;
    }
  }

  if (customPlanSource === 'loan_settlement') {
    const amortizadoCentimos = plan.periodos.reduce(
      (sum, p) => sum + Math.round(p.amortizacion * 100),
      0,
    );
    const principalInicialCentimos = Math.round(prestamo.principalInicial * 100);
    const finalPrincipalCentimos = Math.round((lastPeriod?.principalFinal || 0) * 100);
    return amortizadoCentimos !== principalInicialCentimos || finalPrincipalCentimos !== 0;
  }

  // Aquí había una escotilla para los planes marcados `wizard_v2_generated`:
  // los escribía el motor del wizard, con su línea 0 de carencia técnica, y
  // la comparación de abajo —hecha contra el motor legacy, que no la
  // produce— los daba por inválidos en cada lectura. Con un solo motor la
  // comparación ya es contra el mismo cuadro que los generó, y la excepción
  // sobra: mantenerla dejaría fuera del control de coherencia justo a los
  // préstamos dados de alta por la puerta principal.

  if (hasIrregularMonthlyCadence(plan)) return true;

  // Date sequence must match current generation rules exactly.
  // This catches legacy persisted plans that kept monthly cadence but drifted
  // from the configured billing day after short months (e.g. day 31 loans).
  const expectedPlan = prestamosCalculationService.generatePaymentSchedule(prestamo);
  if (expectedPlan.periodos.length !== plan.periodos.length) {
    return true;
  }
  for (let i = 0; i < plan.periodos.length; i++) {
    const expected = expectedPlan.periodos[i];
    const current = plan.periodos[i];

    if (expected.fechaCargo !== current.fechaCargo) {
      return true;
    }

    // Keep canonical financial fields synced with current generation rules.
    // This forces legacy plans (e.g. old first-installment logic) to be refreshed
    // so Calendario de pagos and Cuadro de amortización stay aligned.
    const sameCuota = Math.round(expected.cuota * 100) === Math.round(current.cuota * 100);
    const sameInteres = Math.round(expected.interes * 100) === Math.round(current.interes * 100);
    const sameAmortizacion = Math.round(expected.amortizacion * 100) === Math.round(current.amortizacion * 100);
    const samePrincipalFinal = Math.round(expected.principalFinal * 100) === Math.round(current.principalFinal * 100);

    if (!sameCuota || !sameInteres || !sameAmortizacion || !samePrincipalFinal) {
      return true;
    }

    if ((expected.esProrrateado ?? false) !== (current.esProrrateado ?? false)) {
      return true;
    }

    if ((expected.esSoloIntereses ?? false) !== (current.esSoloIntereses ?? false)) {
      return true;
    }
  }

  // First installment must match explicit first charge date (date-only compare)
  if (prestamo.fechaPrimerCargo) {
    const expectedFirst = prestamo.fechaPrimerCargo.slice(0, 10);
    const currentFirst = plan.periodos[0]?.fechaCargo?.slice(0, 10);
    if (expectedFirst && currentFirst && expectedFirst !== currentFirst) {
      return true;
    }
  }

  // Principal amortized must match initial principal to the cent
  const amortizadoCentimos = plan.periodos.reduce(
    (sum, p) => sum + Math.round(p.amortizacion * 100),
    0,
  );
  const principalInicialCentimos = Math.round(prestamo.principalInicial * 100);
  if (amortizadoCentimos !== principalInicialCentimos) {
    return true;
  }

  const finalPrincipalCentimos = Math.round((plan.periodos[plan.periodos.length - 1]?.principalFinal || 0) * 100);
  if (finalPrincipalCentimos !== 0) {
    return true;
  }

  return false;
}

function getMonthDistance(fromMonth: string, toMonth: string): number {
  const [fromY, fromM] = fromMonth.split('-').map(Number);
  const [toY, toM] = toMonth.split('-').map(Number);
  return (toY - fromY) * 12 + (toM - fromM);
}

function hasIrregularMonthlyCadence(plan: PlanPagos): boolean {
  if (!plan.periodos || plan.periodos.length < 2) return false;

  for (let i = 1; i < plan.periodos.length; i++) {
    const prevMonth = plan.periodos[i - 1].fechaCargo.substring(0, 7);
    const currentMonth = plan.periodos[i].fechaCargo.substring(0, 7);
    if (getMonthDistance(prevMonth, currentMonth) !== 1) {
      return true;
    }
  }

  return false;
}
