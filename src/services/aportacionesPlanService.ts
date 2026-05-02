// src/services/aportacionesPlanService.ts
// TAREA 13: Servicio CRUD para el store aportacionesPlan

import { initDB } from './db';
import type { AportacionPlan } from '../types/planesPensiones';

const genUUID = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const aportacionesPlanService = {
  async crearAportacion(
    data: Omit<AportacionPlan, 'id' | 'fechaCreacion' | 'fechaActualizacion'>,
  ): Promise<AportacionPlan> {
    const db = await initDB();
    const ahora = new Date().toISOString();
    const aportacion: AportacionPlan = {
      ...data,
      id: genUUID(),
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    };
    await db.add('aportacionesPlan', aportacion);
    return aportacion;
  },

  async getAportacionesPorPlan(planId: string): Promise<AportacionPlan[]> {
    const db = await initDB();
    const all = (await db.getAll('aportacionesPlan')) as AportacionPlan[];
    return all.filter((a) => a.planId === planId).sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  async getAportacionesPorAño(planId: string, ejercicio: number): Promise<AportacionPlan[]> {
    const db = await initDB();
    const all = (await db.getAll('aportacionesPlan')) as AportacionPlan[];
    return all
      .filter((a) => a.planId === planId && a.ejercicioFiscal === ejercicio)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  async getTotalesPorAño(
    planId: string,
    ejercicio: number,
  ): Promise<{ titular: number; empresa: number; conyuge: number; total: number }> {
    const aportaciones = await this.getAportacionesPorAño(planId, ejercicio);
    const titular = aportaciones.reduce((s, a) => s + (a.importeTitular ?? 0), 0);
    const empresa = aportaciones.reduce((s, a) => s + (a.importeEmpresa ?? 0), 0);
    const conyuge = aportaciones.reduce((s, a) => s + (a.importeConyuge ?? 0), 0);
    return { titular, empresa, conyuge, total: titular + empresa + conyuge };
  },

  async getMapaAportacionesAcumuladas(): Promise<Map<string, number>> {
    const db = await initDB();
    const all = (await db.getAll('aportacionesPlan')) as AportacionPlan[];
    const mapa = new Map<string, number>();
    for (const a of all) {
      const importe =
        (a.importeTitular ?? 0) +
        (a.importeEmpresa ?? 0) +
        (a.importeConyuge ?? 0);
      mapa.set(a.planId, (mapa.get(a.planId) ?? 0) + importe);
    }
    return mapa;
  },

  async mensualizarAnual(aportacionId: string): Promise<AportacionPlan[]> {
    const db = await initDB();
    const aportacion = (await db.get('aportacionesPlan', aportacionId)) as AportacionPlan | undefined;
    if (!aportacion) throw new Error(`Aportación ${aportacionId} no encontrada`);
    if (aportacion.granularidad !== 'anual') {
      throw new Error('Solo se pueden mensualizar aportaciones anuales');
    }
    const año = aportacion.ejercicioFiscal;
    const meses = 12;
    const importeTitularMes = aportacion.importeTitular / meses;
    const importeEmpresaMes = aportacion.importeEmpresa / meses;
    const importeConyugeMes = (aportacion.importeConyuge ?? 0) / meses;

    await db.delete('aportacionesPlan', aportacionId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const ahora = new Date().toISOString();
    const nuevas: AportacionPlan[] = [];
    for (let mes = 1; mes <= meses; mes++) {
      const mesStr = String(mes).padStart(2, '0');
      const nueva = await this.crearAportacion({
        planId: aportacion.planId,
        fecha: `${año}-${mesStr}-01`,
        ejercicioFiscal: año,
        importeTitular: importeTitularMes,
        importeEmpresa: importeEmpresaMes,
        importeConyuge: importeConyugeMes > 0 ? importeConyugeMes : undefined,
        origen: aportacion.origen,
        granularidad: 'mensual',
        mesesCubiertos: 1,
        notas: aportacion.notas,
        casillaAEAT: aportacion.casillaAEAT,
        ingresoIdNomina: aportacion.ingresoIdNomina,
        movementId: aportacion.movementId,
      });
      nuevas.push(nueva);
    }
    return nuevas;
  },

  async eliminarAportacion(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('aportacionesPlan', id);
  },
};
