import { initDB } from './db';
import { PersonalExpense, PersonalExpenseFrequency } from '../types/personal';

class PersonalExpensesService {
  async getExpenses(personalDataId: number): Promise<PersonalExpense[]> {
    try {
      const db = await initDB();
      const tx = db.transaction('personalExpenses', 'readonly');
      const index = tx.store.index('personalDataId');
      const expenses = await index.getAll(personalDataId);
      return expenses || [];
    } catch (error) {
      console.error('Error getting personal expenses:', error);
      return [];
    }
  }

  async saveExpense(expense: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<PersonalExpense> {
    const db = await initDB();
    const now = new Date().toISOString();
    const newExpense: PersonalExpense = { ...expense, createdAt: now, updatedAt: now };
    const id = await db.add('personalExpenses', newExpense as PersonalExpense);
    return { ...newExpense, id: id as number };
  }

  async updateExpense(id: number, data: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<PersonalExpense> {
    const db = await initDB();
    const existing = await db.get('personalExpenses', id);
    if (!existing) throw new Error('PersonalExpense not found');
    const updated: PersonalExpense = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
    await db.put('personalExpenses', updated);
    return updated;
  }

  async deleteExpense(id: number): Promise<void> {
    const db = await initDB();
    await db.delete('personalExpenses', id);
  }

  calcularImporteMensual(expense: PersonalExpense): number {
    if (!expense.activo) return 0;
    const factors: Record<PersonalExpenseFrequency, number> = {
      semanal: 52 / 12,
      mensual: 1,
      bimestral: 1 / 2,
      trimestral: 1 / 3,
      semestral: 1 / 6,
      anual: 1 / 12,
    };
    return expense.importe * (factors[expense.frecuencia] ?? 0);
  }

  async calcularTotalMensual(personalDataId: number): Promise<number> {
    const expenses = await this.getExpenses(personalDataId);
    return expenses.reduce((sum, e) => sum + this.calcularImporteMensual(e), 0);
  }
}

export const personalExpensesService = new PersonalExpensesService();
