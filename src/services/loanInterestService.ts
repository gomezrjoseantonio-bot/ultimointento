// Loan Interest Service
// Calculates mortgage/loan interest paid in a fiscal year for a given property.
// Used by fiscalSummaryService to auto-populate box0105 from linked loans.

import { prestamosService } from './prestamosService';
import { prestamosCalculationService } from './prestamosCalculationService';

/**
 * Returns the total mortgage/loan interest paid for a property in a given fiscal year.
 *
 * Strategy:
 * 1. Find all active loans linked to the property (via inmuebleId).
 * 2. For each loan, retrieve or generate the amortisation schedule.
 * 3. Sum the `interes` of every period whose `fechaCargo` falls within the year.
 *
 * @param propertyId  Numeric property identifier (matched against Prestamo.inmuebleId as string)
 * @param ejercicio   Fiscal year (e.g. 2024)
 * @returns Total interest paid in the year, rounded to 2 decimal places
 */
export async function getInteresesHipotecaByPropertyAndYear(
  propertyId: number,
  ejercicio: number
): Promise<number> {
  const inmuebleIdStr = propertyId.toString();
  const prestamos = await prestamosService.getPrestamosByProperty(inmuebleIdStr);

  if (!prestamos || prestamos.length === 0) {
    return 0;
  }

  let totalIntereses = 0;

  for (const prestamo of prestamos) {
    if (!prestamo.activo) continue;

    // Get (or generate) the payment schedule for this loan
    let plan = await prestamosService.getPaymentPlan(prestamo.id);
    if (!plan) {
      // Fallback: generate on-the-fly without persisting
      plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
    }

    // Sum interest of periods whose charge date falls in the requested year
    for (const periodo of plan.periodos) {
      const year = new Date(periodo.fechaCargo).getFullYear();
      if (year === ejercicio) {
        totalIntereses += periodo.interes;
      }
    }
  }

  return Math.round(totalIntereses * 100) / 100;
}
