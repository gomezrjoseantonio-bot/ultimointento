// src/services/traspasosPlanPensionesService.ts
// TAREA 13: Servicio para el store traspasosPlanPensiones

import { initDB } from './db';
import type { TraspasoPlanPensiones, PlanPensiones } from '../types/planesPensiones';

export const traspasosPlanPensionesService = {
  async registrarTraspaso(
    data: Omit<TraspasoPlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'>,
  ): Promise<TraspasoPlanPensiones> {
    const db = await initDB();
    const ahora = new Date().toISOString();
    const traspaso: Omit<TraspasoPlanPensiones, 'id'> = {
      ...data,
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    };
    const id = await db.add('traspasosPlanPensiones', traspaso);
    return { ...traspaso, id: id as number };
  },

  async getTraspasosPorPlan(planId: string): Promise<TraspasoPlanPensiones[]> {
    const db = await initDB();
    const all = (await db.getAll('traspasosPlanPensiones')) as TraspasoPlanPensiones[];
    return all
      .filter((t) => t.planId === planId || t.planIdDestino === planId)
      .sort((a, b) => b.fechaEjecucion.localeCompare(a.fechaEjecucion));
  },

  async getTrayectoriaCompleta(planId: string): Promise<{
    plan: PlanPensiones | undefined;
    traspasos: TraspasoPlanPensiones[];
  }> {
    const db = await initDB();
    const plan = (await db.get('planesPensiones', planId)) as PlanPensiones | undefined;
    const traspasos = await this.getTraspasosPorPlan(planId);
    return { plan, traspasos };
  },
};
