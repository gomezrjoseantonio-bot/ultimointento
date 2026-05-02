// src/services/planesPensionesService.ts
// TAREA 13: Servicio CRUD para el store planesPensiones

import { initDB } from './db';
import type {
  PlanPensiones,
  TipoAdministrativo,
  EstadoPlan,
} from '../types/planesPensiones';

const genUUID = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Fórmula canónica para el total aportado de un plan de pensiones.
 *
 * `total_aportado = Σ aportacionesPlan` (titular + empresa + cónyuge).
 *
 * `plan.importeInicial` es el VALOR inicial del plan (valoración de partida,
 * etiquetado en el formulario como "Valor inicial"), NO una aportación. Si
 * el usuario tuvo una aportación inicial debe registrarla como
 * `AportacionPlan`; aquí no se incluye.
 */
export function calcularTotalAportadoPlan(sumaAportaciones: number): number {
  const suma = Number(sumaAportaciones);
  if (!Number.isFinite(suma) || suma < 0) return 0;
  return suma;
}

export interface FiltrosPlanes {
  personalDataId?: number;
  titular?: 'yo' | 'pareja';
  tipoAdministrativo?: TipoAdministrativo;
  estado?: EstadoPlan;
}

export const planesPensionesService = {
  async createPlan(
    data: Omit<PlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'>,
  ): Promise<PlanPensiones> {
    const db = await initDB();
    const ahora = new Date().toISOString();
    const plan: PlanPensiones = {
      ...data,
      id: genUUID(),
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    };
    await db.add('planesPensiones', plan);
    return plan;
  },

  async updatePlan(
    id: string,
    updates: Partial<Omit<PlanPensiones, 'id' | 'fechaCreacion'>>,
  ): Promise<PlanPensiones> {
    const db = await initDB();
    const existing = await db.get('planesPensiones', id);
    if (!existing) throw new Error(`Plan ${id} no encontrado`);
    const updated: PlanPensiones = {
      ...(existing as PlanPensiones),
      ...updates,
      id,
      fechaActualizacion: new Date().toISOString(),
    };
    await db.put('planesPensiones', updated);
    return updated;
  },

  async getPlan(id: string): Promise<PlanPensiones | undefined> {
    const db = await initDB();
    const result = await db.get('planesPensiones', id);
    return result as PlanPensiones | undefined;
  },

  async getAllPlanes(filtros?: FiltrosPlanes): Promise<PlanPensiones[]> {
    const db = await initDB();
    let planes = (await db.getAll('planesPensiones')) as PlanPensiones[];
    if (filtros?.personalDataId != null) {
      planes = planes.filter((p) => p.personalDataId === filtros.personalDataId);
    }
    if (filtros?.titular) {
      planes = planes.filter((p) => p.titular === filtros.titular);
    }
    if (filtros?.tipoAdministrativo) {
      planes = planes.filter((p) => p.tipoAdministrativo === filtros.tipoAdministrativo);
    }
    if (filtros?.estado) {
      planes = planes.filter((p) => p.estado === filtros.estado);
    }
    return planes;
  },

  async getPlanesPorTipo(tipo: TipoAdministrativo): Promise<PlanPensiones[]> {
    const db = await initDB();
    const planes = (await db.getAll('planesPensiones')) as PlanPensiones[];
    return planes.filter((p) => p.tipoAdministrativo === tipo);
  },

  async eliminarPlan(id: string): Promise<void> {
    const db = await initDB();
    // Cascade: borrar aportaciones
    const aportaciones = (await db.getAll('aportacionesPlan')) as Array<{ id: string; planId: string }>;
    for (const ap of aportaciones) {
      if (ap.planId === id) {
        await db.delete('aportacionesPlan', ap.id);
      }
    }
    // Cascade: borrar traspasos
    const traspasos = (await db.getAll('traspasosPlanPensiones')) as Array<{ id: number; planId: string }>;
    for (const t of traspasos) {
      if (t.planId === id) {
        await db.delete('traspasosPlanPensiones', t.id);
      }
    }
    // Cascade: borrar valoraciones (tipo_activo='plan_pensiones', activo_id=UUID)
    const valoraciones = (await db.getAll('valoraciones_historicas' as any)) as Array<{ id: number; tipo_activo: string; activo_id: unknown }>;
    for (const v of valoraciones) {
      if (v.tipo_activo === 'plan_pensiones' && String(v.activo_id) === id) {
        await db.delete('valoraciones_historicas' as any, v.id as any);
      }
    }
    await db.delete('planesPensiones', id);
  },

  async getValorActualConsolidado(id: string): Promise<number> {
    const plan = await this.getPlan(id);
    return plan?.valorActual ?? 0;
  },

  async getAportacionesAcumuladasTotal(id: string): Promise<{ titular: number; empresa: number; total: number }> {
    const db = await initDB();
    const aportaciones = (await db.getAll('aportacionesPlan')) as Array<{
      planId: string;
      importeTitular: number;
      importeEmpresa: number;
    }>;
    const del_plan = aportaciones.filter((a) => a.planId === id);
    const titular = del_plan.reduce((s, a) => s + (a.importeTitular ?? 0), 0);
    const empresa = del_plan.reduce((s, a) => s + (a.importeEmpresa ?? 0), 0);
    return { titular, empresa, total: titular + empresa };
  },

  async cambiarTipoAdministrativo(id: string, nuevoTipo: TipoAdministrativo): Promise<PlanPensiones> {
    return this.updatePlan(id, { tipoAdministrativo: nuevoTipo });
  },

  // T23.6.1 · alias público para lectura sin filtros (galería unificada)
  async getAll(): Promise<PlanPensiones[]> {
    return this.getAllPlanes();
  },
};
