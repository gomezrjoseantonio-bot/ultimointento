// src/services/planesPensionesService.ts
// TAREA 13: Servicio CRUD para el store planesPensiones

import { initDB } from './db';
import type {
  PlanPensiones,
  TipoAdministrativo,
  EstadoPlan,
} from '../types/planesPensiones';
import { valoracionesService } from './valoracionesService';
import {
  lookupTerCatalogoFromNames,
  type TerCatalogoEntry,
} from '../data/terCatalogoPP';

/**
 * T-VALORACIONES PR7a''''' · hidrata `valorActual` de cada plan con la
 * última valoración del servicio nuevo (`valoracionesActivos`) si está
 * disponible. Si no hay entrada en el mapa o falla la lectura · mantiene
 * el `valorActual` legacy intacto. Una sola lectura del mapa por
 * llamada · O(N) hidratación en memoria.
 *
 * Mismo patrón usado en `inversionesService.hydrateValorActual` ·
 * "upstream hydration" · todos los componentes UI downstream que leen
 * `plan.valorActual` reciben el valor correcto sin modificarlos.
 */
async function hydrateValorActualPlanes(planes: PlanPensiones[]): Promise<PlanPensiones[]> {
  if (planes.length === 0) return planes;
  let mapa: Map<string, { valor: number; fecha_valoracion: string }>;
  try {
    mapa = await valoracionesService.getMapValoracionesMasRecientes('plan_pensiones');
  } catch {
    return planes;
  }
  return planes.map((p) => {
    if (p.id == null) return p;
    const match = mapa.get(String(p.id));
    if (!match) return p;
    return { ...p, valorActual: match.valor };
  });
}

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

/**
 * T-FICHA-PP-PULIDO v1 · Bug #1.
 *
 * Resuelve el TER de un plan según prioridad:
 *   1. Override manual del usuario (`plan.terOverride`)
 *   2. Match en catálogo curado (`TER_CATALOGO_PP`) por nombres normalizados
 *      de gestora y plan
 *   3. null · sin dato · la UI muestra CTA "consulta a tu gestora"
 *
 * `ter` se devuelve siempre en formato porcentual (1.5 = 1,50%) para que
 * el catálogo y el override usen las mismas unidades visibles al usuario.
 * El consumidor que necesite decimal (ej. cálculos) divide entre 100.
 */
export function resolveTerPlan(
  plan: Pick<PlanPensiones, 'terOverride' | 'gestoraActual' | 'nombre'> | null | undefined,
): {
  ter: number | null;
  fuente: 'manual' | 'catalogo' | 'desconocido';
  catalogoEntry?: TerCatalogoEntry;
} {
  if (!plan) return { ter: null, fuente: 'desconocido' };

  if (typeof plan.terOverride === 'number' && plan.terOverride >= 0) {
    return { ter: plan.terOverride, fuente: 'manual' };
  }

  const entry = lookupTerCatalogoFromNames(plan.gestoraActual, plan.nombre);
  if (entry) {
    return { ter: entry.ter, fuente: 'catalogo', catalogoEntry: entry };
  }

  return { ter: null, fuente: 'desconocido' };
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
    if (!result) return undefined;
    // T-VALORACIONES PR7a''''' · upstream hydration · valorActual del
    // servicio gana sobre el legacy si hay valoración disponible.
    const [hydrated] = await hydrateValorActualPlanes([result as PlanPensiones]);
    return hydrated;
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
    return await hydrateValorActualPlanes(planes);
  },

  async getPlanesPorTipo(tipo: TipoAdministrativo): Promise<PlanPensiones[]> {
    const db = await initDB();
    const planes = (await db.getAll('planesPensiones')) as PlanPensiones[];
    return await hydrateValorActualPlanes(planes.filter((p) => p.tipoAdministrativo === tipo));
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
    // Cascade de valoraciones ELIMINADA (bloque 2.4): leía el store `valoraciones_historicas`,
    // renombrado a `valoracionesActivos` en V74 y físicamente inexistente en v79. `db.getAll`
    // sobre un store inexistente lanza NotFoundError, así que esta cascada abortaba
    // `eliminarPlan` antes del `delete('planesPensiones')` — el plan no llegaba a borrarse.
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
