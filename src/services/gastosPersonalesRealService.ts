// src/services/gastosPersonalesRealService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub enriquecido para preservar API surface.
// Futuro: usar movements + treasuryEvents.

import { GastoPersonalReal, PersonalExpenseCategory, DesviacionResumen } from '../types/personal';

class GastosPersonalesRealService {
  /**
   * Register a confirmed real expense. Called by Tesorería upon confirming
   * a gasto_personal event.
   */
  async registrarGastoReal(_data: {
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
    console.warn('[gastosPersonalesRealService] Store eliminado en V62 · operación no-op');
    const now = new Date().toISOString();
    const desviacion = _data.importeEstimado != null
      ? _data.importeReal - _data.importeEstimado
      : undefined;
    return {
      id: 0,
      personalDataId: _data.personalDataId,
      patronId: _data.patronId,
      concepto: _data.concepto,
      categoria: _data.categoria,
      importeReal: _data.importeReal,
      fechaReal: _data.fechaReal,
      cuentaCargoId: _data.cuentaCargoId,
      importeEstimado: _data.importeEstimado,
      desviacion,
      tesoreriaEventoId: _data.tesoreriaEventoId,
      ejercicio: _data.ejercicio,
      mes: _data.mes,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get all confirmed real expenses for a given fiscal year (and optionally month).
   */
  async getGastosRealesPorPeriodo(
    _personalDataId: number,
    _ejercicio: number,
    _mes?: number,
  ): Promise<GastoPersonalReal[]> {
    return [];
  }

  /**
   * Compute deviation summary per pattern for a fiscal year.
   */
  async getDesviaciones(
    _personalDataId: number,
    _ejercicio: number,
  ): Promise<DesviacionResumen[]> {
    return [];
  }

  // Legacy method names for backward compatibility
  async getAll(): Promise<GastoPersonalReal[]> {
    return [];
  }

  async getAllForPersonalData(_personalDataId: number): Promise<GastoPersonalReal[]> {
    return [];
  }

  async getByEjercicio(_personalDataId: number, _ejercicio: number): Promise<GastoPersonalReal[]> {
    return [];
  }

  async save(_gasto: Partial<GastoPersonalReal>): Promise<GastoPersonalReal | null> {
    console.warn('[gastosPersonalesRealService] Store eliminado en V62 · operación no-op');
    return null;
  }

  async delete(_id: number): Promise<void> {
    console.warn('[gastosPersonalesRealService] Store eliminado en V62 · operación no-op');
  }
}

export const gastosPersonalesRealService = new GastosPersonalesRealService();

