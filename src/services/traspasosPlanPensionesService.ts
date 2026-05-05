// src/services/traspasosPlanPensionesService.ts
// TAREA 13: Servicio para el store traspasosPlanPensiones (V65).

import { initDB } from './db';
import type {
  TraspasoPlanPensiones,
  PlanPensiones,
} from '../types/planesPensiones';
import type { ValoracionHistorica } from '../types/valoraciones';

export const traspasosPlanPensionesService = {
  /**
   * Registra un traspaso de plan de pensiones.
   *
   * Side-effects (alineados con §5.8 de TAREA-13-spec):
   *   1. Crea el registro en `traspasosPlanPensiones`.
   *   2. Actualiza el plan origen (`planesPensiones.planId`) con
   *      `gestoraActual = gestoraDestino`, `isinActual = isinDestino`,
   *      `valorActual = valorTraspaso`, `fechaUltimaValoracion = fechaEjecucion`,
   *      y la nueva política/tipo administrativo si han cambiado.
   *   3. Crea entrada en `valoraciones_historicas` con
   *      `tipo_activo='plan_pensiones'`, `fecha_valoracion=fechaEjecucion`,
   *      `valor=valorTraspaso` (clave para que `rentabilidadPlanService`
   *      cierre el bloque anterior y abra el siguiente).
   */
  async registrarTraspaso(
    data: Omit<TraspasoPlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'>,
  ): Promise<TraspasoPlanPensiones> {
    const db = await initDB();
    const ahora = new Date().toISOString();

    // Sanity: si esTotal pero no llega importeTraspasado, lo igualamos a
    // valorTraspaso. Si esParcial, importeTraspasado debe venir explícito.
    const importeFinal = data.importeTraspasado ?? (data.esTotal ? data.valorTraspaso : 0);

    const traspaso: Omit<TraspasoPlanPensiones, 'id'> = {
      ...data,
      importeTraspasado: importeFinal,
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    };
    const id = await db.add('traspasosPlanPensiones', traspaso);

    // Side-effect 2 · actualizar el plan origen (la identidad del plan se
    // mantiene; solo cambia la gestora actual).
    const plan = (await db.get('planesPensiones', data.planId)) as
      | PlanPensiones
      | undefined;
    if (plan) {
      const planActualizado: PlanPensiones = {
        ...plan,
        gestoraActual: data.gestoraDestino,
        isinActual: data.isinDestino ?? plan.isinActual,
        valorActual: data.valorTraspaso,
        fechaUltimaValoracion: data.fechaEjecucion,
        ...(data.nuevoTipoAdministrativo
          ? { tipoAdministrativo: data.nuevoTipoAdministrativo }
          : {}),
        ...(data.nuevaPoliticaInversion
          ? { politicaInversion: data.nuevaPoliticaInversion }
          : {}),
        fechaActualizacion: ahora,
      };
      await db.put('planesPensiones', planActualizado);
    }

    // Side-effect 3 · entrada en valoraciones_historicas con valorTraspaso a
    // fechaEjecucion. Idempotente: si ya existe una valoración en ese mes
    // para el plan, la sobreescribe (último valor gana).
    if (plan) {
      const fechaMes = data.fechaEjecucion.slice(0, 7); // YYYY-MM
      const tx = db.transaction('valoraciones_historicas', 'readwrite');
      const existing = (await tx.store
        .index('tipo-activo-fecha')
        .getAll(['plan_pensiones', plan.id as any, fechaMes])) as ValoracionHistorica[];
      const prev = existing[0];
      const record: ValoracionHistorica = {
        tipo_activo: 'plan_pensiones',
        activo_id: plan.id as any,
        activo_nombre: plan.nombre,
        fecha_valoracion: fechaMes,
        valor: data.valorTraspaso,
        origen: 'manual',
        notas: `Valor en traspaso ${data.gestoraOrigen} → ${data.gestoraDestino}`,
        created_at: prev?.created_at ?? ahora,
        updated_at: ahora,
      };
      if (prev?.id !== undefined) {
        await tx.store.put({ ...record, id: prev.id });
      } else {
        await tx.store.add(record);
      }
      await tx.done;
    }

    return { ...traspaso, id: id as number };
  },

  async getTraspasosPorPlan(planId: string): Promise<TraspasoPlanPensiones[]> {
    const db = await initDB();
    const all = (await db.getAll('traspasosPlanPensiones')) as TraspasoPlanPensiones[];
    return all
      .filter((t) => t.planId === planId || t.planIdDestino === planId)
      .sort((a, b) => a.fechaEjecucion.localeCompare(b.fechaEjecucion));
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
