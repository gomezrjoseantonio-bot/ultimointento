/**
 * TAREA 13 v4 · Acción 1 (D6) · migración one-shot para reescribir
 * `casillaAEAT='RSUMAD'` (clave interna del XML que usaba el bloque viejo
 * `declaracionDistributorService.persistirPlanPensiones`) a las casillas
 * oficiales del modelo IRPF en registros de `aportacionesPlan` con
 * `origen='xml_aeat'`.
 *
 * Mapping ·
 *   - `importeTitular > 0 && importeEmpresa === 0` → `casillaAEAT = '0426'`
 *     (aportaciones del partícipe / trabajador).
 *   - `importeEmpresa > 0 && importeTitular === 0` → `casillaAEAT = '0427'`
 *     (contribuciones del promotor / empresa).
 *   - Ambos > 0 (registros legacy escritos con el bloque viejo en un mismo
 *     evento) → `casillaAEAT = '0426/0427'` (representa ambas casillas).
 *
 * NO toca registros con `casillaAEAT !== 'RSUMAD'` · respeta `'0426'`/`'0427'`
 * ya escritos por el servicio nuevo y cualquier override manual del usuario.
 *
 * Idempotente · el flag `migration_casillaAEAT_oficial_v1` en `keyval` se
 * escribe SOLO si todos los `put` por registro tienen éxito · si alguno
 * falla, el flag NO se escribe y el próximo arranque reintenta. Lectura
 * del flag, swaps y escritura del flag se ejecutan en una sola transacción
 * `readwrite` sobre `keyval` + `aportacionesPlan` para serializar runs
 * concurrentes (varias pestañas / instancias).
 *
 * NO bumpea `DB_VERSION`. NO toca parser, adapter ni el shape de los
 * registros más allá de `casillaAEAT` + `fechaActualizacion`.
 */

import { initDB } from '../db';
import type { AportacionPlan } from '../../types/planesPensiones';

export const CASILLA_AEAT_OFICIAL_FLAG_KEY =
  'migration_casillaAEAT_oficial_v1';

export interface FixCasillaAEATOficialReport {
  /** True si el flag estaba presente al iniciar · skip silencioso. */
  skipped: boolean;
  /** Número de registros actualizados. */
  updated: number;
  /**
   * Errores no fatales por registro o en la transacción. Si > 0, el flag NO
   * se escribe · el próximo arranque reintentará.
   */
  errors: string[];
}

function mapearCasilla(titular: number, empresa: number): string | null {
  if (titular > 0 && empresa === 0) return '0426';
  if (empresa > 0 && titular === 0) return '0427';
  if (titular > 0 && empresa > 0) return '0426/0427';
  return null;
}

export async function fixCasillaAEATOficial(): Promise<FixCasillaAEATOficialReport> {
  const report: FixCasillaAEATOficialReport = {
    skipped: false,
    updated: 0,
    errors: [],
  };

  const db = await initDB();

  // Una sola transacción readwrite sobre los 2 stores · serializa runs
  // concurrentes (otra pestaña) y garantiza que la lectura del flag y los
  // updates son atómicos respecto a la escritura final del flag.
  const tx = db.transaction(['keyval', 'aportacionesPlan'], 'readwrite');
  const keyvalStore = tx.objectStore('keyval');
  const aportStore = tx.objectStore('aportacionesPlan');

  try {
    const flag = await keyvalStore.get(CASILLA_AEAT_OFICIAL_FLAG_KEY);
    if (flag === 'completed') {
      report.skipped = true;
      await tx.done;
      return report;
    }

    const aportaciones = (await aportStore.getAll()) as AportacionPlan[];
    const ahora = new Date().toISOString();
    const logs: string[] = [];

    for (const ap of aportaciones) {
      if (ap.origen !== 'xml_aeat') continue;
      if (ap.casillaAEAT !== 'RSUMAD') continue;

      const titular = ap.importeTitular ?? 0;
      const empresa = ap.importeEmpresa ?? 0;
      const nuevaCasilla = mapearCasilla(titular, empresa);
      if (!nuevaCasilla) continue; // ambos = 0 · no mapeable, skip

      try {
        const updated: AportacionPlan = {
          ...ap,
          casillaAEAT: nuevaCasilla,
          fechaActualizacion: ahora,
        };
        await aportStore.put(updated);
        report.updated++;
        logs.push(
          `[ATLAS] FIX-casillaAEAT ${ap.id} ejercicio ${ap.ejercicioFiscal} · `
            + `RSUMAD → ${nuevaCasilla} (titular ${titular} · empresa ${empresa})`,
        );
      } catch (error) {
        report.errors.push(
          `put aportacionesPlan ${ap.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Solo marcamos completada si TODOS los updates fueron OK.
    if (report.errors.length === 0) {
      await keyvalStore.put('completed', CASILLA_AEAT_OFICIAL_FLAG_KEY);
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
