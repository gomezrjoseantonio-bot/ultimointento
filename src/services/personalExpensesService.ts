import { initDB } from './db';
import { PersonalData, PersonalExpense, PersonalExpenseFrequency } from '../types/personal';

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

  async loadTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();

    const base: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'>[] = [
      { personalDataId, concepto: 'Supermercado', categoria: 'alimentacion', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Tarifa Móvil', categoria: 'otros', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Ocio/Suscripciones', categoria: 'ocio', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Fibra/Internet', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
    ];

    // Housing conditions
    if (profile?.housingType === 'rent') {
      base.push(
        { personalDataId, concepto: 'Alquiler', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Seguro Inquilino', categoria: 'seguros', importe: 0, frecuencia: 'anual', activo: true },
      );
    }

    // Vehicle conditions
    if (profile?.hasVehicle === true) {
      base.push(
        { personalDataId, concepto: 'Gasolina', categoria: 'transporte', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Seguro Coche', categoria: 'seguros', importe: 0, frecuencia: 'anual', activo: true },
      );
    } else if (profile?.hasVehicle === false) {
      base.push(
        { personalDataId, concepto: 'Transporte Público', categoria: 'transporte', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }

    // Children conditions
    if (profile?.hasChildren) {
      base.push(
        { personalDataId, concepto: 'Colegio / Guardería', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Actividades Extraescolares', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }

    const db = await initDB();
    for (const item of base) {
      const expense: PersonalExpense = { ...item, createdAt: now, updatedAt: now };
      await db.add('personalExpenses', expense);
    }
  }
}

export const personalExpensesService = new PersonalExpensesService();
