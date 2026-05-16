/**
 * TAREA 13 v4 · Acción 1 (D6) · migración one-shot para reescribir
 * `casillaAEAT='RSUMAD'` (clave interna del XML que usaba el bloque viejo
 * `declaracionDistributorService.persistirPlanPensiones`) a las casillas
 * oficiales del modelo IRPF en registros de `aportacionesPlan` con
 * `origen='xml_aeat'`.
 *
 * Mapping ·
 *   - `importeTitular > 0 && importeEmpresa === 0` → `casillaAEAT = '0426'`
 *     (aportaciones del partícipe / trabajador) · update in-place.
 *   - `importeEmpresa > 0 && importeTitular === 0` → `casillaAEAT = '0427'`
 *     (contribuciones del promotor / empresa) · update in-place.
 *   - Ambos > 0 (registros legacy escritos con el bloque viejo en un mismo
 *     evento) → **split** · el registro original se queda con la mitad
 *     titular (`casillaAEAT='0426'`, `importeEmpresa=0`) y se crea un
 *     registro nuevo con la mitad empresa (`casillaAEAT='0427'`,
 *     `importeTitular=0`, UUID nuevo). Esto deja el shape canónico que el
 *     servicio `aeatPlanesPensionesImportService` espera (un row por rol),
 *     garantizando que `aportacionExisteIdempotente` matchea correctamente
 *     en reimportaciones futuras y no duplica importes.
 *
 * NO toca registros con `casillaAEAT !== 'RSUMAD'` · respeta `'0426'`/`'0427'`
 * ya escritos por el servicio nuevo y cualquier override manual del usuario.
 *
 * Idempotente · el flag `migration_casillaAEAT_oficial_v1` en `keyval` se
 * escribe SOLO si todos los `put`/`add` por registro tienen éxito · si alguno
 * falla, el flag NO se escribe y el próximo arranque reintenta. Lectura
 * del flag, swaps y escritura del flag se ejecutan en una sola transacción
 * `readwrite` sobre `keyval` + `aportacionesPlan` para serializar runs
 * concurrentes (varias pestañas / instancias).
 *
 * NO bumpea `DB_VERSION`. NO toca parser, adapter ni los importes.
 */

import { initDB } from '../db';
import type { AportacionPlan } from '../../types/planesPensiones';

export const CASILLA_AEAT_OFICIAL_FLAG_KEY =
  'migration_casillaAEAT_oficial_v1';

const genUUID = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export interface FixCasillaAEATOficialReport {
  /** True si el flag estaba presente al iniciar · skip silencioso. */
  skipped: boolean;
  /** Número de registros actualizados in-place (un solo importe presente). */
  updated: number;
  /**
   * Número de registros legacy combinados que se han dividido en 2.
   * Cuenta el evento de split, no los registros resultantes (cada split
   * produce 1 update del original + 1 add del nuevo).
   */
  split: number;
  /**
   * Errores no fatales por registro o en la transacción. Si > 0, el flag NO
   * se escribe · el próximo arranque reintentará.
   */
  errors: string[];
}

export async function fixCasillaAEATOficial(): Promise<FixCasillaAEATOficialReport> {
  const report: FixCasillaAEATOficialReport = {
    skipped: false,
    updated: 0,
    split: 0,
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

      try {
        if (titular > 0 && empresa === 0) {
          // Solo titular · update in-place.
          await aportStore.put({
            ...ap,
            casillaAEAT: '0426',
            fechaActualizacion: ahora,
          });
          report.updated++;
          logs.push(
            `[ATLAS] FIX-casillaAEAT ${ap.id} ejercicio ${ap.ejercicioFiscal} · `
              + `RSUMAD → 0426 (titular ${titular})`,
          );
        } else if (empresa > 0 && titular === 0) {
          // Solo empresa · update in-place.
          await aportStore.put({
            ...ap,
            casillaAEAT: '0427',
            fechaActualizacion: ahora,
          });
          report.updated++;
          logs.push(
            `[ATLAS] FIX-casillaAEAT ${ap.id} ejercicio ${ap.ejercicioFiscal} · `
              + `RSUMAD → 0427 (empresa ${empresa})`,
          );
        } else if (titular > 0 && empresa > 0) {
          // Registro combinado legacy · split en 2 · preserva el original
          // para mantener `id` estable de cara a `ingresoIdNomina`/`movementId`
          // y deja la mitad empresa en un registro nuevo con UUID nuevo.
          await aportStore.put({
            ...ap,
            importeEmpresa: 0,
            casillaAEAT: '0426',
            fechaActualizacion: ahora,
          });
          const nuevoEmpresa: AportacionPlan = {
            ...ap,
            id: genUUID(),
            importeTitular: 0,
            importeEmpresa: empresa,
            casillaAEAT: '0427',
            // ingresoIdNomina/movementId del original aplican al cobro del
            // partícipe · se preservan en el row 0426 (original) y NO en el
            // 0427 (empresa) que no tiene cobro asociado.
            ingresoIdNomina: undefined,
            movementId: undefined,
            fechaCreacion: ahora,
            fechaActualizacion: ahora,
          };
          await aportStore.add(nuevoEmpresa);
          report.split++;
          logs.push(
            `[ATLAS] FIX-casillaAEAT ${ap.id} ejercicio ${ap.ejercicioFiscal} · split RSUMAD → `
              + `0426 (titular ${titular}, id original) + 0427 (empresa ${empresa}, id ${nuevoEmpresa.id})`,
          );
        }
        // Si titular === 0 && empresa === 0 → skip silencioso (no mapeable).
      } catch (error) {
        report.errors.push(
          `aportacionesPlan ${ap.id}: ${error instanceof Error ? error.message : String(error)}`,
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
