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
    if (expense.frecuencia === 'meses_especificos') {
      if (expense.asymmetricPayments && expense.asymmetricPayments.length > 0) {
        const annual = expense.asymmetricPayments.reduce((sum, p) => sum + p.importe, 0);
        return annual / 12;
      }
      const months = expense.mesesCobro?.length ?? 0;
      return months > 0 ? (expense.importe * months) / 12 : 0;
    }
    const factors: Record<Exclude<PersonalExpenseFrequency, 'meses_especificos'>, number> = {
      semanal: 52 / 12,
      mensual: 1,
      bimestral: 1 / 2,
      trimestral: 1 / 3,
      semestral: 1 / 6,
      anual: 1 / 12,
    };
    return expense.importe * (factors[expense.frecuencia as Exclude<PersonalExpenseFrequency, 'meses_especificos'>] ?? 0);
  }

  async calcularTotalMensual(personalDataId: number): Promise<number> {
    const expenses = await this.getExpenses(personalDataId);
    return expenses.reduce((sum, e) => sum + this.calcularImporteMensual(e), 0);
  }

  async loadTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();

    const items: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    // Base expenses (always injected)
    items.push(
      { personalDataId, concepto: 'Supermercado', categoria: 'alimentacion', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Tarifa Móvil', categoria: 'otros', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Fibra / Internet', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Plataformas (Netflix/Spotify)', categoria: 'ocio', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Peluquería / Cuidado Personal', categoria: 'salud', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Farmacia / Salud básica', categoria: 'salud', importe: 0, frecuencia: 'mensual', activo: true },
    );

    // Housing-specific expenses
    const housingType = profile?.housingType;
    if (housingType === 'rent') {
      items.push(
        { personalDataId, concepto: 'Alquiler', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Seguro Inquilino', categoria: 'seguros', importe: 0, frecuencia: 'anual', activo: true },
        { personalDataId, concepto: 'Luz', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Agua', categoria: 'vivienda', importe: 0, frecuencia: 'bimestral', activo: true },
        { personalDataId, concepto: 'Gas / Climatización', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
      );
    } else if (housingType === 'ownership_with_mortgage' || housingType === 'ownership_without_mortgage') {
      items.push(
        { personalDataId, concepto: 'Luz', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Agua', categoria: 'vivienda', importe: 0, frecuencia: 'bimestral', activo: true },
        { personalDataId, concepto: 'Gas / Climatización', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }
    // living_with_parents: no housing/utility expenses

    // Vehicle-specific expenses
    if (profile?.hasVehicle === true) {
      items.push(
        { personalDataId, concepto: 'Gasolina / Carga Eléctrica', categoria: 'transporte', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Seguro Vehículo', categoria: 'seguros', importe: 0, frecuencia: 'anual', activo: true },
        { personalDataId, concepto: 'Mantenimiento / Taller', categoria: 'transporte', importe: 0, frecuencia: 'anual', activo: true },
      );
    } else {
      items.push(
        { personalDataId, concepto: 'Abono Transporte Público', categoria: 'transporte', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }

    // Children-specific expenses
    if (profile?.hasChildren) {
      items.push(
        { personalDataId, concepto: 'Colegio / Guardería', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Actividades Extraescolares', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Ropa y Calzado Infantil', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }

    const db = await initDB();
    for (const item of items) {
      const expense: PersonalExpense = { ...item, createdAt: now, updatedAt: now };
      await db.add('personalExpenses', expense);
    }
  }

  async mergeTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();

    const items: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    // Base expenses (always included in ideal set)
    items.push(
      { personalDataId, concepto: 'Supermercado', categoria: 'alimentacion', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Tarifa Móvil', categoria: 'otros', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Fibra / Internet', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Plataformas (Netflix/Spotify)', categoria: 'ocio', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Peluquería / Cuidado Personal', categoria: 'salud', importe: 0, frecuencia: 'mensual', activo: true },
      { personalDataId, concepto: 'Farmacia / Salud básica', categoria: 'salud', importe: 0, frecuencia: 'mensual', activo: true },
    );

    const housingType = profile?.housingType;
    if (housingType === 'rent') {
      items.push(
        { personalDataId, concepto: 'Alquiler', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Seguro Inquilino', categoria: 'seguros', importe: 0, frecuencia: 'anual', activo: true },
        { personalDataId, concepto: 'Luz', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Agua', categoria: 'vivienda', importe: 0, frecuencia: 'bimestral', activo: true },
        { personalDataId, concepto: 'Gas / Climatización', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
      );
    } else if (housingType === 'ownership_with_mortgage' || housingType === 'ownership_without_mortgage') {
      items.push(
        { personalDataId, concepto: 'Luz', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Agua', categoria: 'vivienda', importe: 0, frecuencia: 'bimestral', activo: true },
        { personalDataId, concepto: 'Gas / Climatización', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }

    if (profile?.hasVehicle === true) {
      items.push(
        { personalDataId, concepto: 'Gasolina / Carga Eléctrica', categoria: 'transporte', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Seguro Vehículo', categoria: 'seguros', importe: 0, frecuencia: 'anual', activo: true },
        { personalDataId, concepto: 'Mantenimiento / Taller', categoria: 'transporte', importe: 0, frecuencia: 'anual', activo: true },
      );
    } else {
      items.push(
        { personalDataId, concepto: 'Abono Transporte Público', categoria: 'transporte', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }

    if (profile?.hasChildren) {
      items.push(
        { personalDataId, concepto: 'Colegio / Guardería', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Actividades Extraescolares', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Ropa y Calzado Infantil', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }

    const existing = await this.getExpenses(personalDataId);
    const existingConcepts = new Set(existing.map((e) => e.concepto));

    const db = await initDB();
    for (const item of items) {
      if (!existingConcepts.has(item.concepto)) {
        const expense: PersonalExpense = { ...item, createdAt: now, updatedAt: now };
        await db.add('personalExpenses', expense);
      }
    }
  }
}

export const personalExpensesService = new PersonalExpensesService();
