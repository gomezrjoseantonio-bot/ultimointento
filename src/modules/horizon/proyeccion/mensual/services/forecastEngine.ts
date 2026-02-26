// src/modules/horizon/proyeccion/mensual/services/forecastEngine.ts
// ATLAS HORIZON: Pure frequency-aware calculation engine for automatic projections

import { OpexRule } from '../../../../../services/db';
import { GastoRecurrente, PersonalExpense } from '../../../../../types/personal';

export interface OpexDetalleItem {
  propertyId: number;
  propertyAlias: string;
  concepto: string;
  importe: number;
}

/**
 * Determines whether an OpexRule applies in a given calendar month (1–12).
 * Handles all supported frequencies including periodical ones that depend on mesInicio.
 */
export function opexRuleAppliesToMonth(rule: OpexRule, month1to12: number): boolean {
  if (!rule.activo) return false;

  switch (rule.frecuencia) {
    case 'mensual':
      return true;

    case 'bimestral': {
      const start = rule.mesInicio ?? 1;
      if (month1to12 < start) return false;
      return (month1to12 - start) % 2 === 0;
    }

    case 'trimestral': {
      const start = rule.mesInicio ?? 1;
      if (month1to12 < start) return false;
      return (month1to12 - start) % 3 === 0;
    }

    case 'semestral': {
      const start = rule.mesInicio ?? 1;
      if (month1to12 < start) return false;
      return (month1to12 - start) % 6 === 0;
    }

    case 'anual': {
      const targetMonth = rule.mesInicio ?? rule.mesesCobro?.[0] ?? 1;
      return month1to12 === targetMonth;
    }

    case 'meses_especificos':
      return (rule.mesesCobro ?? []).includes(month1to12);

    case 'semanal':
      // Weekly expenses occur every month (amount is per-week; multiplied below)
      return true;

    default:
      return false;
  }
}

/**
 * Returns the effective amount of an OpexRule for a given calendar month.
 * Returns 0 if the rule does not apply in that month.
 * Respects asymmetricPayments overrides and weekly multiplier.
 */
export function getOpexAmountForMonth(rule: OpexRule, month1to12: number): number {
  if (!opexRuleAppliesToMonth(rule, month1to12)) return 0;

  // Asymmetric payment override takes precedence
  if (rule.asymmetricPayments?.length) {
    const ap = rule.asymmetricPayments.find(p => p.mes === month1to12);
    if (ap !== undefined) return ap.importe;
  }

  if (rule.frecuencia === 'semanal') {
    // 52 weeks / 12 months ≈ 4.33 payments per month
    return rule.importeEstimado * (52 / 12);
  }

  return rule.importeEstimado;
}

/**
 * Calculates the total OPEX amount across all provided rules for a given month.
 */
export function calculateOpexForMonth(rules: OpexRule[], month1to12: number): number {
  return rules.reduce((sum, rule) => sum + getOpexAmountForMonth(rule, month1to12), 0);
}

/**
 * Returns a per-property/concept breakdown of OPEX for a given month.
 * Only items with importe > 0 are included.
 */
export function calculateOpexBreakdownForMonth(
  rules: OpexRule[],
  month1to12: number,
  propertyAliasMap: Map<number, string>,
): OpexDetalleItem[] {
  const items: OpexDetalleItem[] = [];
  for (const rule of rules) {
    const importe = getOpexAmountForMonth(rule, month1to12);
    if (importe > 0) {
      items.push({
        propertyId: rule.propertyId,
        propertyAlias: propertyAliasMap.get(rule.propertyId) ?? `Inmueble #${rule.propertyId}`,
        concepto: rule.concepto,
        importe,
      });
    }
  }
  return items;
}

/**
 * Determines whether a GastoRecurrente applies in a given calendar month (1–12).
 * The cycle start is derived from fechaInicio.
 */
export function gastoRecurrenteAppliesToMonth(
  gasto: GastoRecurrente,
  month1to12: number,
): boolean {
  if (!gasto.activo) return false;

  // Derive cycle-start month from fechaInicio (defaults to January)
  const startMonth = gasto.fechaInicio
    ? new Date(gasto.fechaInicio).getMonth() + 1
    : 1;

  switch (gasto.frecuencia) {
    case 'mensual':
      return true;

    case 'bimestral':
      if (month1to12 < startMonth) return false;
      return (month1to12 - startMonth) % 2 === 0;

    case 'trimestral':
      if (month1to12 < startMonth) return false;
      return (month1to12 - startMonth) % 3 === 0;

    case 'semestral':
      if (month1to12 < startMonth) return false;
      return (month1to12 - startMonth) % 6 === 0;

    case 'anual':
      return month1to12 === startMonth;

    case 'meses_especificos':
      return (gasto.mesesCobro ?? []).includes(month1to12);

    default:
      return false;
  }
}

/**
 * Calculates the total personal recurring expenses for a given calendar month.
 */
export function calculateGastosPersonalesForMonth(
  gastos: GastoRecurrente[],
  month1to12: number,
): number {
  return gastos.reduce((sum, gasto) => {
    if (!gastoRecurrenteAppliesToMonth(gasto, month1to12)) return sum;
    return sum + gasto.importe;
  }, 0);
}

/**
 * Determines whether a PersonalExpense (OPEX-style) applies in a given calendar month (1–12).
 * Handles all supported frequencies: semanal, mensual, bimestral, trimestral,
 * semestral, anual, and meses_especificos.
 */
export function personalExpenseAppliesToMonth(
  expense: PersonalExpense,
  month1to12: number,
): boolean {
  if (!expense.activo) return false;

  switch (expense.frecuencia) {
    case 'semanal':
    case 'mensual':
      return true;

    case 'bimestral': {
      const start = expense.mesInicio ?? 1;
      if (month1to12 < start) return false;
      return (month1to12 - start) % 2 === 0;
    }

    case 'trimestral': {
      const start = expense.mesInicio ?? 1;
      if (month1to12 < start) return false;
      return (month1to12 - start) % 3 === 0;
    }

    case 'semestral': {
      const start = expense.mesInicio ?? 1;
      if (month1to12 < start) return false;
      return (month1to12 - start) % 6 === 0;
    }

    case 'anual': {
      const targetMonth = expense.mesInicio ?? 1;
      return month1to12 === targetMonth;
    }

    case 'meses_especificos':
      return (expense.mesesCobro ?? []).includes(month1to12);

    default:
      return false;
  }
}

/**
 * Returns the effective amount of a PersonalExpense for a given calendar month.
 * Returns 0 if the expense does not apply in that month.
 * Respects asymmetricPayments overrides and weekly multiplier.
 */
export function getPersonalExpenseAmountForMonth(
  expense: PersonalExpense,
  month1to12: number,
): number {
  if (!personalExpenseAppliesToMonth(expense, month1to12)) return 0;

  // Asymmetric payment override takes precedence
  if (expense.asymmetricPayments?.length) {
    const ap = expense.asymmetricPayments.find(p => p.mes === month1to12);
    if (ap !== undefined) return ap.importe;
  }

  if (expense.frecuencia === 'semanal') {
    // 52 weeks / 12 months ≈ 4.33 payments per month
    return expense.importe * (52 / 12);
  }

  return expense.importe;
}

/**
 * Calculates the total amount across all PersonalExpenses for a given calendar month.
 */
export function calculatePersonalExpensesForMonth(
  expenses: PersonalExpense[],
  month1to12: number,
): number {
  return expenses.reduce(
    (sum, expense) => sum + getPersonalExpenseAmountForMonth(expense, month1to12),
    0,
  );
}
