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
    return expenses
      .filter(e => e.activo && e.importe > 0)
      .reduce((sum, e) => sum + this.calcularImporteMensual(e), 0);
  }

  private buildIdealExpenseItems(personalDataId: number, profile?: PersonalData | null, includeBase = true): Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'>[] {
    const items: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    // Base expenses – only injected when the caller explicitly requests them (i.e. on first load)
    if (includeBase) {
      items.push(
        { personalDataId, concepto: 'Supermercado', categoria: 'alimentacion', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Tarifa Móvil', categoria: 'otros', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Fibra / Internet', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Plataformas (Netflix/Spotify)', categoria: 'ocio', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Peluquería / Cuidado Personal', categoria: 'salud', importe: 0, frecuencia: 'mensual', activo: true },
        { personalDataId, concepto: 'Farmacia / Salud básica', categoria: 'salud', importe: 0, frecuencia: 'mensual', activo: true },
      );
    }

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

    return items;
  }

  async loadTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();
    const items = this.buildIdealExpenseItems(personalDataId, profile);
    items.sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));

    const db = await initDB();
    for (const item of items) {
      const expense: PersonalExpense = { ...item, createdAt: now, updatedAt: now };
      await db.add('personalExpenses', expense);
    }
  }

  async smartMergeTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();
    const idealItems = this.buildIdealExpenseItems(personalDataId, profile);
    const existing = await this.getExpenses(personalDataId);
    const existingConcepts = new Set(existing.map(e => e.concepto.toLowerCase()));

    const newItems = idealItems.filter(item => !existingConcepts.has(item.concepto.toLowerCase()));
    if (newItems.length === 0) return;

    const db = await initDB();
    for (const item of newItems) {
      const expense: PersonalExpense = { ...item, createdAt: now, updatedAt: now };
      await db.add('personalExpenses', expense);
    }
  }

  async smartSyncTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.getExpenses(personalDataId);

    // Base expenses are only injected when the list is completely empty.
    // This covers both first-time setup and the case where the user has deleted all expenses.
    // Once the user has any expenses we never inject base expenses again – they may have been renamed.
    const includeBase = existing.length === 0;
    const idealItems = this.buildIdealExpenseItems(personalDataId, profile, includeBase);

    // Determine concepts to delete based on current profile settings
    const conceptsToDelete = new Set<string>();

    const housingType = profile?.housingType;
    if (housingType === 'ownership_with_mortgage' || housingType === 'ownership_without_mortgage') {
      conceptsToDelete.add('alquiler');
      conceptsToDelete.add('seguro inquilino');
    } else if (housingType === 'living_with_parents') {
      conceptsToDelete.add('alquiler');
      conceptsToDelete.add('seguro inquilino');
      conceptsToDelete.add('luz');
      conceptsToDelete.add('agua');
      conceptsToDelete.add('gas / climatización');
    }

    if (profile?.hasVehicle === true) {
      conceptsToDelete.add('abono transporte público');
    } else {
      conceptsToDelete.add('gasolina / carga eléctrica');
      conceptsToDelete.add('seguro vehículo');
      conceptsToDelete.add('seguro coche');
      conceptsToDelete.add('mantenimiento / taller');
    }

    if (!profile?.hasChildren) {
      conceptsToDelete.add('colegio / guardería');
      conceptsToDelete.add('actividades extraescolares');
      conceptsToDelete.add('ropa y calzado infantil');
    }

    // Delete expenses whose concept matches the deletion list
    const db = await initDB();
    for (const expense of existing) {
      if (expense.id && conceptsToDelete.has(expense.concepto.toLowerCase())) {
        await db.delete('personalExpenses', expense.id);
      }
    }

    // Add missing items
    const remainingAfterDelete = existing.filter(
      e => !(e.id && conceptsToDelete.has(e.concepto.toLowerCase()))
    );
    const remainingConcepts = new Set(remainingAfterDelete.map(e => e.concepto.toLowerCase()));
    const newItems = idealItems.filter(item => !remainingConcepts.has(item.concepto.toLowerCase()));
    for (const item of newItems) {
      const expense: PersonalExpense = { ...item, createdAt: now, updatedAt: now };
      await db.add('personalExpenses', expense);
    }
  }
}

export const personalExpensesService = new PersonalExpensesService();
