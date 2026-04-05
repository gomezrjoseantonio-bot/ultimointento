import type { OpexCategory, OpexFrequency } from '../services/db';

export type PropertyExpenseFrequency = OpexFrequency | 'unico';

export type PropertyExpenseSource =
  | 'opex_rule'
  | 'gasto'
  | 'expense_h5'
  | 'legacy_expense';

export type PropertyExpenseClass = 'opex' | 'mejora';

export interface PropertyExpense {
  id: string;
  propertyId: number;
  category: OpexCategory | string;
  concept: string;
  amount: number;
  frequency: PropertyExpenseFrequency;
  accountId?: number;
  comments?: string;
  startDate?: string;
  endDate?: string;
  casillaAEAT?: string; // Override manual de la casilla AEAT
  source: PropertyExpenseSource;
  expenseClass: PropertyExpenseClass;
  isLegacy: boolean;
  isActive: boolean;
}

export interface PropertyExpenseDiagnostics {
  hasConfiguredExpenses: boolean;
  usingLegacyFallback: boolean;
  warning?: string;
}
