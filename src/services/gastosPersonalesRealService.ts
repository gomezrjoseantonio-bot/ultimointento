// src/services/gastosPersonalesRealService.ts
// ATLAS — GastosPersonalesReal service
// Manages confirmed/real personal expenses written by Tesorería after punteo.
// This is the mirror of gastosInmueble (Inmuebles module).
//
// RESTRICTION: Only Tesorería writes here. The UI never writes directly.

import { initDB } from './db';
import { GastoPersonalReal, DesviacionResumen, PersonalExpenseCategory } from '../types/personal';

class GastosPersonalesRealService {

  /**
   * Register a confirmed real expense. Called by Tesorería upon confirming
   * a gasto_personal event.
   */
  async registrarGastoReal(data: {
    personalDataId: number;
    patronId?: number;
    concepto: string;
    categoria: PersonalExpenseCategory;
    importeReal: number;
    importeEstimado?: number;
    fechaReal: string;
    cuentaCargoId?: number;
    tesoreriaEventoId: string;
    ejercicio: number;
    mes: number;
  }): Promise<GastoPersonalReal> {
    const db = await initDB();
    const now = new Date().toISOString();

    const desviacion = data.importeEstimado != null
      ? data.importeReal - data.importeEstimado
      : undefined;

    const gasto: GastoPersonalReal = {
      personalDataId: data.personalDataId,
      patronId: data.patronId,
      concepto: data.concepto,
      categoria: data.categoria,
      importeReal: data.importeReal,
      fechaReal: data.fechaReal,
      cuentaCargoId: data.cuentaCargoId,
      importeEstimado: data.importeEstimado,
      desviacion,
      tesoreriaEventoId: data.tesoreriaEventoId,
      ejercicio: data.ejercicio,
      mes: data.mes,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.add('gastosPersonalesReal', gasto);
    return { ...gasto, id: id as number };
  }

  /**
   * Get all confirmed real expenses for a given fiscal year (and optionally month).
   */
  async getGastosRealesPorPeriodo(
    personalDataId: number,
    ejercicio: number,
    mes?: number,
  ): Promise<GastoPersonalReal[]> {
    try {
      const db = await initDB();
      const tx = db.transaction('gastosPersonalesReal', 'readonly');
      const index = tx.store.index('personalDataId');
      const all = await index.getAll(personalDataId);

      return (all || []).filter(g =>
        g.ejercicio === ejercicio && (mes == null || g.mes === mes)
      );
    } catch (error) {
      console.error('Error getting gastos personales reales:', error);
      return [];
    }
  }

  /**
   * Compute deviation summary per pattern for a fiscal year.
   * Groups real expenses by patronId and compares against estimated totals.
   */
  async getDesviaciones(
    personalDataId: number,
    ejercicio: number,
  ): Promise<DesviacionResumen[]> {
    const reales = await this.getGastosRealesPorPeriodo(personalDataId, ejercicio);

    const byPatron = new Map<number, {
      concepto: string;
      categoria: PersonalExpenseCategory;
      estimado: number;
      real: number;
      meses: Set<number>;
    }>();

    for (const g of reales) {
      if (g.patronId == null) continue;
      const entry = byPatron.get(g.patronId) ?? {
        concepto: g.concepto,
        categoria: g.categoria,
        estimado: 0,
        real: 0,
        meses: new Set<number>(),
      };
      entry.real += g.importeReal;
      entry.estimado += g.importeEstimado ?? 0;
      entry.meses.add(g.mes);
      byPatron.set(g.patronId, entry);
    }

    return Array.from(byPatron.entries()).map(([patronId, entry]) => ({
      patronId,
      concepto: entry.concepto,
      categoria: entry.categoria,
      estimadoTotal: entry.estimado,
      realTotal: entry.real,
      desviacion: entry.real - entry.estimado,
      meses: Array.from(entry.meses).sort((a, b) => a - b),
    }));
  }
}

export const gastosPersonalesRealService = new GastosPersonalesRealService();
