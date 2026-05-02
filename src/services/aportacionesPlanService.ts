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

  /**
   * Suma `importeTitular + importeEmpresa + importeConyuge` de una lista de aportaciones.
   */
  sumaAportaciones(aportaciones: AportacionPlan[]): number {
    return aportaciones.reduce(
      (s, a) =>
        s +
        (Number(a.importeTitular) || 0) +
        (Number(a.importeEmpresa) || 0) +
        (Number(a.importeConyuge) || 0),
      0,
    );
  },

  /**
   * Total aportado a un plan (suma de todas sus aportaciones registradas).
   * Usa el índice `planId` para evitar escanear toda la tabla.
   */
  async getTotalAportadoPorPlan(planId: string): Promise<number> {
    const db = await initDB();
    const aportaciones = (await db.getAllFromIndex(
      'aportacionesPlan',
      'planId',
      planId,
    )) as AportacionPlan[];
    return this.sumaAportaciones(aportaciones);
  },

  /**
   * Devuelve un mapa `planId → suma de aportaciones`.
   *
   * Si se pasa `planIds`, consulta por índice (una query por plan en paralelo)
   * y solo incluye los planes solicitados, evitando un escaneo completo de
   * `aportacionesPlan`. Sin argumentos, hace fallback a un `getAll`.
   */
  async getMapaAportacionesAcumuladas(
    planIds?: string[],
  ): Promise<Map<string, number>> {
    const db = await initDB();
    const mapa = new Map<string, number>();

    if (planIds && planIds.length > 0) {
      await Promise.all(
        planIds.map(async (planId) => {
          const aportaciones = (await db.getAllFromIndex(
            'aportacionesPlan',
            'planId',
            planId,
          )) as AportacionPlan[];
          const total = this.sumaAportaciones(aportaciones);
          if (total !== 0) mapa.set(planId, total);
        }),
      );
      return mapa;
    }

    const all = (await db.getAll('aportacionesPlan')) as AportacionPlan[];
    for (const a of all) {
      const importe =
        (Number(a.importeTitular) || 0) +
        (Number(a.importeEmpresa) || 0) +
        (Number(a.importeConyuge) || 0);
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
