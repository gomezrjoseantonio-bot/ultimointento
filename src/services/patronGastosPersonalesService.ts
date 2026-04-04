// src/services/patronGastosPersonalesService.ts
// ATLAS — PatronGastosPersonales service (renamed from personalExpensesService)
// Manages spending patterns. Does NOT hold confirmed/real data.
// Real confirmed expenses are managed by gastosPersonalesRealService.

import { initDB } from './db';
import { PersonalData, PatronGastoPersonal, PersonalExpense, PersonalExpenseFrequency } from '../types/personal';

class PatronGastosPersonalesService {
  async getPatrones(personalDataId: number): Promise<PatronGastoPersonal[]> {
    try {
      const db = await initDB();
      const tx = db.transaction('patronGastosPersonales', 'readonly');
      const index = tx.store.index('personalDataId');
      const patrones = await index.getAll(personalDataId);
      return patrones || [];
    } catch (error) {
      console.error('Error getting patron gastos personales:', error);
      return [];
    }
  }

  async savePatron(patron: Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatronGastoPersonal> {
    const db = await initDB();
    const now = new Date().toISOString();
    const newPatron: PatronGastoPersonal = { ...patron, origen: patron.origen ?? 'manual', createdAt: now, updatedAt: now };
    const id = await db.add('patronGastosPersonales', newPatron as PatronGastoPersonal);
    return { ...newPatron, id: id as number };
  }

  async updatePatron(id: number, data: Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatronGastoPersonal> {
    const db = await initDB();
    const existing = await db.get('patronGastosPersonales', id);
    if (!existing) throw new Error('PatronGastoPersonal not found');
    const updated: PatronGastoPersonal = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
    await db.put('patronGastosPersonales', updated);
    return updated;
  }

  async deletePatron(id: number): Promise<void> {
    const db = await initDB();
    await db.delete('patronGastosPersonales', id);
  }

  calcularImporteMensual(patron: PatronGastoPersonal | PersonalExpense): number {
    if (!patron.activo) return 0;
    if (patron.frecuencia === 'meses_especificos') {
      if (patron.asymmetricPayments && patron.asymmetricPayments.length > 0) {
        const annual = patron.asymmetricPayments.reduce((sum, p) => sum + p.importe, 0);
        return annual / 12;
      }
      const months = patron.mesesCobro?.length ?? 0;
      return months > 0 ? (patron.importe * months) / 12 : 0;
    }
    const factors: Record<Exclude<PersonalExpenseFrequency, 'meses_especificos'>, number> = {
      semanal: 52 / 12,
      mensual: 1,
      bimestral: 1 / 2,
      trimestral: 1 / 3,
      semestral: 1 / 6,
      anual: 1 / 12,
    };
    return patron.importe * (factors[patron.frecuencia as Exclude<PersonalExpenseFrequency, 'meses_especificos'>] ?? 0);
  }

  async calcularTotalMensual(personalDataId: number): Promise<number> {
    const patrones = await this.getPatrones(personalDataId);
    return patrones
      .filter(p => p.activo && p.importe > 0)
      .reduce((sum, p) => sum + this.calcularImporteMensual(p), 0);
  }

  /**
   * Suggests spending patterns based on user profile.
   */
  getSugeridosPorPerfil(personalDataId: number, profile?: PersonalData | null): Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt'>[] {
    return this.buildIdealPatronItems(personalDataId, profile);
  }

  private buildIdealPatronItems(personalDataId: number, profile?: PersonalData | null, includeBase = true): Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt'>[] {
    const items: Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    if (includeBase) {
      items.push(
        { personalDataId, concepto: 'Supermercado', categoria: 'alimentacion', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Tarifa Móvil', categoria: 'otros', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Fibra / Internet', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Plataformas (Netflix/Spotify)', categoria: 'ocio', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Peluquería / Cuidado Personal', categoria: 'salud', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Farmacia / Salud básica', categoria: 'salud', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
      );
    }

    const housingType = profile?.housingType;
    if (housingType === 'rent') {
      items.push(
        { personalDataId, concepto: 'Alquiler', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Seguro Inquilino', categoria: 'seguros', importe: 0, frecuencia: 'anual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Luz', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Agua', categoria: 'vivienda', importe: 0, frecuencia: 'bimestral', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Gas / Climatización', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
      );
    } else if (housingType === 'ownership_with_mortgage' || housingType === 'ownership_without_mortgage') {
      items.push(
        { personalDataId, concepto: 'Luz', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Agua', categoria: 'vivienda', importe: 0, frecuencia: 'bimestral', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Gas / Climatización', categoria: 'vivienda', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
      );
    }

    if (profile?.hasVehicle === true) {
      items.push(
        { personalDataId, concepto: 'Gasolina / Carga Eléctrica', categoria: 'transporte', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Seguro Vehículo', categoria: 'seguros', importe: 0, frecuencia: 'anual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Mantenimiento / Taller', categoria: 'transporte', importe: 0, frecuencia: 'anual', activo: true, origen: 'perfil' },
      );
    } else {
      items.push(
        { personalDataId, concepto: 'Abono Transporte Público', categoria: 'transporte', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
      );
    }

    if (profile?.hasChildren) {
      items.push(
        { personalDataId, concepto: 'Colegio / Guardería', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Actividades Extraescolares', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
        { personalDataId, concepto: 'Ropa y Calzado Infantil', categoria: 'educacion', importe: 0, frecuencia: 'mensual', activo: true, origen: 'perfil' },
      );
    }

    return items;
  }

  async loadTemplatePatrones(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();
    const items = this.buildIdealPatronItems(personalDataId, profile);
    items.sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));

    const db = await initDB();
    for (const item of items) {
      const patron: PatronGastoPersonal = { ...item, createdAt: now, updatedAt: now };
      await db.add('patronGastosPersonales', patron);
    }
  }

  async smartMergeTemplatePatrones(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();
    const idealItems = this.buildIdealPatronItems(personalDataId, profile);
    const existing = await this.getPatrones(personalDataId);
    const existingConcepts = new Set(existing.map(e => e.concepto.toLowerCase()));

    const newItems = idealItems.filter(item => !existingConcepts.has(item.concepto.toLowerCase()));
    if (newItems.length === 0) return;

    const db = await initDB();
    for (const item of newItems) {
      const patron: PatronGastoPersonal = { ...item, createdAt: now, updatedAt: now };
      await db.add('patronGastosPersonales', patron);
    }
  }

  async smartSyncTemplatePatrones(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.getPatrones(personalDataId);

    const includeBase = existing.length === 0;
    const idealItems = this.buildIdealPatronItems(personalDataId, profile, includeBase);

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

    const db = await initDB();
    for (const patron of existing) {
      if (patron.id && conceptsToDelete.has(patron.concepto.toLowerCase())) {
        await db.delete('patronGastosPersonales', patron.id);
      }
    }

    const remainingAfterDelete = existing.filter(
      e => !(e.id && conceptsToDelete.has(e.concepto.toLowerCase()))
    );
    const remainingConcepts = new Set(remainingAfterDelete.map(e => e.concepto.toLowerCase()));
    const newItems = idealItems.filter(item => !remainingConcepts.has(item.concepto.toLowerCase()));
    for (const item of newItems) {
      const patron: PatronGastoPersonal = { ...item, createdAt: now, updatedAt: now };
      await db.add('patronGastosPersonales', patron);
    }
  }

  // ── Legacy compatibility: delegate to old store if new store is empty ──────
  // This allows a smooth transition during the migration period.
  // The old personalExpensesService methods are preserved but route through here.

  /** @deprecated Use getPatrones */
  async getExpenses(personalDataId: number): Promise<PatronGastoPersonal[]> {
    return this.getPatrones(personalDataId);
  }

  /** @deprecated Use savePatron */
  async saveExpense(expense: Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatronGastoPersonal> {
    return this.savePatron({ ...expense, origen: expense.origen ?? 'manual' });
  }

  /** @deprecated Use updatePatron */
  async updateExpense(id: number, data: Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt'>): Promise<PatronGastoPersonal> {
    return this.updatePatron(id, { ...data, origen: data.origen ?? 'manual' });
  }

  /** @deprecated Use deletePatron */
  async deleteExpense(id: number): Promise<void> {
    return this.deletePatron(id);
  }

  /** @deprecated Use smartMergeTemplatePatrones */
  async smartMergeTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    return this.smartMergeTemplatePatrones(personalDataId, profile);
  }

  /** @deprecated Use smartSyncTemplatePatrones */
  async smartSyncTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    return this.smartSyncTemplatePatrones(personalDataId, profile);
  }

  /** @deprecated Use loadTemplatePatrones */
  async loadTemplateExpenses(personalDataId: number, profile?: PersonalData | null): Promise<void> {
    return this.loadTemplatePatrones(personalDataId, profile);
  }
}

export const patronGastosPersonalesService = new PatronGastosPersonalesService();

// Backward-compatible alias
export const personalExpensesService = patronGastosPersonalesService;
