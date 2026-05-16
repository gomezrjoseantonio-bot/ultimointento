/**
 * Pulido T13 v4 final · issue 2 · migración data-fix retroactiva para corregir
 * `fechaContratacion` de planes creados vía XML AEAT.
 *
 * Contexto · `aeatPlanesPensionesImportService.asegurarPlanStub` setea
 * `fechaContratacion = '${ejercicio}-01-01'` en el primer ejercicio importado.
 * Si el usuario importó la declaración 2024 antes que las anteriores, el plan
 * quedó con `fechaContratacion='2024-01-01'` pero las aportaciones se han ido
 * añadiendo desde 2020. La ficha muestra "Plan abierto 2024 · Primera
 * aportación 2020", trayectoria incoherente.
 *
 * Esta migración recorre `planesPensiones` con `origen='xml_aeat'` y, para
 * cada plan, calcula `min(aportacionesPlan.fecha) WHERE planId === plan.id`.
 * Si la fecha mínima es anterior a `fechaContratacion`, retrocede a esa fecha
 * mínima (no a `'${año}-01-01'` arbitrario · usamos la fecha real de la
 * primera aportación, que es lo más fiel al "abrir el plan").
 *
 * NO toca planes con `origen='manual'` ni `origen='migrado_v60'` · respeta la
 * fecha que el usuario haya introducido manualmente.
 *
 * Idempotente · flag `migration_fechaContratacion_retro_v1` en `keyval` · si
 * algún `put` falla, el flag NO se escribe y el próximo arranque reintenta.
 * Una sola transacción `readwrite` sobre `keyval` + `planesPensiones` +
 * `aportacionesPlan`.
 *
 * NO bumpea `DB_VERSION`. NO toca aportaciones, importes ni el parser.
 */

import { initDB } from '../db';
import type { PlanPensiones, AportacionPlan } from '../../types/planesPensiones';

export const FECHA_CONTRATACION_RETRO_FLAG_KEY =
  'migration_fechaContratacion_retro_v1';

export interface FixFechaContratacionRetroactivaReport {
  /** True si el flag estaba presente al iniciar · skip silencioso. */
  skipped: boolean;
  /** Número de planes a los que se retrocedió la fecha. */
  updated: number;
  /** Número de planes XML AEAT inspeccionados (incluye los que no necesitaron cambio). */
  inspected: number;
  /** Errores no fatales por plan o en la transacción. */
  errors: string[];
}

export async function fixFechaContratacionRetroactiva(): Promise<FixFechaContratacionRetroactivaReport> {
  const report: FixFechaContratacionRetroactivaReport = {
    skipped: false,
    updated: 0,
    inspected: 0,
    errors: [],
  };

  const db = await initDB();
  const tx = db.transaction(
    ['keyval', 'planesPensiones', 'aportacionesPlan'],
    'readwrite',
  );
  const keyvalStore = tx.objectStore('keyval');
  const planesStore = tx.objectStore('planesPensiones');
  const aportStore = tx.objectStore('aportacionesPlan');

  try {
    const flag = await keyvalStore.get(FECHA_CONTRATACION_RETRO_FLAG_KEY);
    if (flag === 'completed') {
      report.skipped = true;
      await tx.done;
      return report;
    }

    const planes = (await planesStore.getAll()) as PlanPensiones[];
    const aportaciones = (await aportStore.getAll()) as AportacionPlan[];
    const ahora = new Date().toISOString();
    const logs: string[] = [];

    // Indexar aportaciones por planId para min(fecha) en O(N).
    const fechaMinPorPlan = new Map<string, string>();
    for (const a of aportaciones) {
      if (!a.fecha) continue;
      const prev = fechaMinPorPlan.get(a.planId);
      if (!prev || a.fecha < prev) {
        fechaMinPorPlan.set(a.planId, a.fecha);
      }
    }

    for (const plan of planes) {
      if (plan.origen !== 'xml_aeat') continue;
      report.inspected++;
      const fechaMin = fechaMinPorPlan.get(plan.id);
      if (!fechaMin) continue;
      if (fechaMin >= plan.fechaContratacion) continue;

      try {
        await planesStore.put({
          ...plan,
          fechaContratacion: fechaMin,
          fechaActualizacion: ahora,
        });
        report.updated++;
        logs.push(
          `[ATLAS] FIX-fechaContratacion-retro ${plan.id} (${plan.nombre}) · `
            + `${plan.fechaContratacion} → ${fechaMin}`,
        );
      } catch (error) {
        report.errors.push(
          `planesPensiones ${plan.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (report.errors.length === 0) {
      await keyvalStore.put('completed', FECHA_CONTRATACION_RETRO_FLAG_KEY);
    }

    await tx.done;

    for (const line of logs) {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* ignore */
    }
    report.errors.push(
      `transaction: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return report;
}
