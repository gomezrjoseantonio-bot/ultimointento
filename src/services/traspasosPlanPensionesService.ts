// src/services/traspasosPlanPensionesService.ts
// TAREA 13: Servicio para el store traspasosPlanPensiones (V65).

import { initDB } from './db';
import type {
  TraspasoPlanPensiones,
  PlanPensiones,
} from '../types/planesPensiones';
import type { ValoracionHistorica } from '../types/valoraciones';

/**
 * Devuelve el valor del plan en el momento del traspaso aplicando el fallback
 * para registros legacy V65 que solo guardaron `importeTraspasado`.
 *
 * Reglas:
 *   · Si `valorTraspaso` está definido → ese.
 *   · Si no, `esTotal=true` → `importeTraspasado` (en total coinciden).
 *   · Si no, `esTotal=false` → null (parcial sin valor del plan ⇒ no
 *     calculable). El consumidor debe tratar null como "rentabilidad por
 *     bloque no disponible" sin inventar valores.
 */
export function valorTraspasoNormalizado(
  t: Pick<TraspasoPlanPensiones, 'valorTraspaso' | 'importeTraspasado' | 'esTotal'>,
): number | null {
  if (t.valorTraspaso != null) return t.valorTraspaso;
  if (t.esTotal) return t.importeTraspasado;
  return null;
}

export const traspasosPlanPensionesService = {
  /**
   * Registra un traspaso de plan de pensiones.
   *
   * Side-effects (alineados con §5.8 de TAREA-13-spec):
   *   1. Crea el registro en `traspasosPlanPensiones`.
   *   2. SOLO si `esTotal=true` · actualiza el plan origen
   *      (`planesPensiones.planId`) con `gestoraActual = gestoraDestino`,
   *      `isinActual = isinDestino`, `valorActual = valorTraspaso`,
   *      `fechaUltimaValoracion = fechaEjecucion`, y la nueva
   *      política/tipo administrativo si han cambiado.
   *   3. SOLO si `esTotal=true` · crea entrada en `valoraciones_historicas`
   *      con `tipo_activo='plan_pensiones'`,
   *      `fecha_valoracion = fechaEjecucion truncada a YYYY-MM` (formato del
   *      índice compuesto `tipo-activo-fecha`), `valor=valorTraspaso`. Esto
   *      es lo que `rentabilidadPlanService` usa para cerrar el bloque
   *      anterior y abrir el siguiente.
   *
   * Para `esTotal=false` (traspaso parcial · el partícipe mantiene saldo en
   * la gestora origen) NO se mutan ni el plan origen ni se escribe valoración.
   * Solo queda el registro del evento en `traspasosPlanPensiones`. El usuario
   * debe ajustar manualmente el valor restante del plan origen y, si procede,
   * crear el plan destino antes de calcular rentabilidad por bloque.
   */
  async registrarTraspaso(
    data: Omit<TraspasoPlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'>,
  ): Promise<TraspasoPlanPensiones> {
    const db = await initDB();
    const ahora = new Date().toISOString();

    // Sanity: si esTotal pero no llega importeTraspasado, lo igualamos a
    // valorTraspaso. Si esParcial, importeTraspasado debe venir explícito.
    const importeFinal =
      data.importeTraspasado ?? (data.esTotal ? data.valorTraspaso ?? 0 : 0);

    const traspaso: Omit<TraspasoPlanPensiones, 'id'> = {
      ...data,
      importeTraspasado: importeFinal,
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    };
    const id = await db.add('traspasosPlanPensiones', traspaso);

    // Side-effects 2 y 3 · SOLO si traspaso total. Para parciales, el plan
    // origen sigue existiendo en la gestora original; sobreescribir
    // gestoraActual/isinActual/valorActual sería incorrecto.
    if (data.esTotal) {
      const plan = (await db.get('planesPensiones', data.planId)) as
        | PlanPensiones
        | undefined;
      const valorReferencia = data.valorTraspaso ?? data.importeTraspasado ?? 0;

      if (plan) {
        const planActualizado: PlanPensiones = {
          ...plan,
          gestoraActual: data.gestoraDestino,
          isinActual: data.isinDestino ?? plan.isinActual,
          valorActual: valorReferencia,
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

        // Side-effect 3 · valoración histórica con valorTraspaso a fechaMes.
        // Idempotente: si ya existe valoración del mes, sobreescribe.
        if (valorReferencia > 0) {
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
            valor: valorReferencia,
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
      }
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

  /**
   * Devuelve todos los traspasos que afectan a algún plan del personalData
   * indicado. Útil para el historial agregado de PlanesManager (TAREA 13 v4
   * · Commit 1 (C9)).
   */
  async getTraspasosPorPersonalData(
    personalDataId: number,
  ): Promise<TraspasoPlanPensiones[]> {
    const db = await initDB();
    const planes = (await db.getAll('planesPensiones')) as PlanPensiones[];
    const planIds = new Set(
      planes.filter((p) => p.personalDataId === personalDataId).map((p) => p.id),
    );
    if (planIds.size === 0) return [];
    const all = (await db.getAll('traspasosPlanPensiones')) as TraspasoPlanPensiones[];
    return all
      .filter((t) => planIds.has(t.planId) || (t.planIdDestino && planIds.has(t.planIdDestino)))
      .sort((a, b) => b.fechaEjecucion.localeCompare(a.fechaEjecucion));
  },

  async eliminarTraspaso(id: number): Promise<void> {
    const db = await initDB();
    await db.delete('traspasosPlanPensiones', id);
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
