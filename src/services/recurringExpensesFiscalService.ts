import { getAllExpensesForProperty } from './propertyExpenses';
import { OPEX_CATEGORY_TO_AEAT_BOX } from './aeatClassificationService';

/**
 * Calcula los gastos recurrentes OPEX de un inmueble que son fiscalmente
 * deducibles para un ejercicio concreto, agrupados por casilla AEAT.
 *
 * Solo incluye gastos activos cuyo período de vigencia cubra el ejercicio.
 * Calcula el importe anual según la frecuencia (mensual × 12, trimestral × 4,
 * etc.) con prorrateo de meses efectivos cuando el gasto empieza o acaba a
 * mitad del año.
 *
 * @param propertyId  ID del inmueble.
 * @param ejercicio   Año fiscal (ej.: 2024).
 * @returns Mapa casilla AEAT → importe anual  { '0109': 420, '0114': 393, … }
 */
export async function getGastosRecurrentesFiscales(
  propertyId: number,
  ejercicio: number
): Promise<Record<string, number>> {
  const exerciseStart = new Date(ejercicio, 0, 1);   // 1 Jan
  const exerciseEnd   = new Date(ejercicio, 11, 31); // 31 Dec

  const allExpenses = await getAllExpensesForProperty(propertyId);

  const result: Record<string, number> = {};

  for (const expense of allExpenses) {
    // Only active OPEX recurring expenses (non-legacy sources or opex_rule)
    if (!expense.isActive) continue;
    if (expense.expenseClass !== 'opex') continue;
    // Legacy one-off items (gastos, expense_h5, legacy_expense) are already
    // covered by document-based classification; skip them here.
    if (expense.source !== 'opex_rule') continue;

    // Vigencia check
    const start = expense.startDate ? new Date(expense.startDate) : null;
    const end   = expense.endDate   ? new Date(expense.endDate)   : null;

    if (start && start > exerciseEnd) continue;  // starts after the exercise year
    if (end   && end   < exerciseStart) continue; // ended before the exercise year

    // Determine the AEAT box: manual override > automatic mapping
    let box: string | undefined = expense.casillaAEAT;
    if (!box) {
      box = OPEX_CATEGORY_TO_AEAT_BOX[expense.category as keyof typeof OPEX_CATEGORY_TO_AEAT_BOX];
    }
    if (!box) continue; // category has no AEAT mapping (e.g. 'otro')

    // Calculate effective annual amount, prorating partial years
    const annualAmount = calculateEffectiveAnnualAmount(expense.amount, expense.frequency, ejercicio, start, end);
    if (annualAmount <= 0) continue;

    result[box] = (result[box] ?? 0) + annualAmount;
  }

  return result;
}

/**
 * Calcula el importe anual efectivo de un gasto recurrente para el ejercicio,
 * prorrateando los meses efectivos cuando el gasto empieza o acaba a mitad de año.
 */
function calculateEffectiveAnnualAmount(
  amountPerCycle: number,
  frequency: string,
  ejercicio: number,
  start: Date | null,
  end: Date | null
): number {
  // Full annual multipliers by frequency
  const multiplierByFrequency: Record<string, number> = {
    'semanal':   52,
    'mensual':   12,
    'bimestral':  6,
    'trimestral': 4,
    'semestral':  2,
    'anual':      1,
    'unico':      1,
  };

  if (frequency === 'meses_especificos') {
    // Already normalized to annual by propertyExpenses service
    return applyMonthProration(amountPerCycle, ejercicio, start, end, true);
  }

  const multiplier = multiplierByFrequency[frequency];
  if (multiplier === undefined) return 0;

  if (frequency === 'anual' || frequency === 'unico') {
    return amountPerCycle;
  }

  // For sub-annual frequencies, prorate by effective months
  const effectiveMonths = getEffectiveMonths(ejercicio, start, end);
  if (effectiveMonths === 12) {
    return amountPerCycle * multiplier;
  }

  // Monthly equivalent × effective months
  const monthlyEquivalent = amountPerCycle * (multiplier / 12);
  return monthlyEquivalent * effectiveMonths;
}

function applyMonthProration(
  fullAnnual: number,
  ejercicio: number,
  start: Date | null,
  end: Date | null,
  _alreadyAnnual: boolean
): number {
  const effectiveMonths = getEffectiveMonths(ejercicio, start, end);
  return effectiveMonths === 12 ? fullAnnual : (fullAnnual / 12) * effectiveMonths;
}

/**
 * Returns the number of calendar months (1–12) in the exercise year that the
 * expense is active, based on its optional start and end dates.
 */
function getEffectiveMonths(
  ejercicio: number,
  start: Date | null,
  end: Date | null
): number {
  const firstMonth = (start && start.getFullYear() === ejercicio)
    ? start.getMonth() + 1  // 1-based month when expense starts mid-year
    : 1;                     // started before or has no start → from January

  const lastMonth = (end && end.getFullYear() === ejercicio)
    ? end.getMonth() + 1    // 1-based month when expense ends mid-year
    : 12;                    // ends after or has no end → through December

  return Math.max(0, lastMonth - firstMonth + 1);
}
