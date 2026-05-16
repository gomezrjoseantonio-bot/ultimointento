/**
 * TAREA CC FIX · migración one-shot para reparar el cruce
 * `importeTitular` ↔ `importeEmpresa` en registros de `aportacionesPlan`
 * escritos por `declaracionDistributorService.persistirPlanPensiones`
 * (paso 12b) antes del fix del parser `irpfXmlParserService.extraerPlanPensiones`.
 *
 * Contexto · el parser AEAT leía `IEIP` (casilla 0008 = contribución empresa)
 * y lo etiquetaba como aportación del titular, derivando empresa como
 * `total − titular`. Eso invertía los dos campos al persistir en
 * `aportacionesPlan` con `origen='xml_aeat'`. F2 enmascaraba el cruce
 * con una derivación inversa en su adapter (FIX-B6) · ahora corregimos
 * el parser en origen y volteamos los registros ya escritos una sola vez.
 *
 * Idempotente · el flag `migration_b6_aportacionesPlan_v1` en `keyval`
 * se escribe SOLO si todos los `put` por registro tienen éxito · si algún
 * registro falla, NO se marca como completada para que el próximo arranque
 * vuelva a intentarlo. Lectura del flag, swaps y escritura del flag se
 * ejecutan en una sola transacción `readwrite` sobre `keyval` +
 * `aportacionesPlan` para serializar runs concurrentes (varias pestañas /
 * instancias) y evitar que un 2.º run lea el flag ausente entre el swap
 * del 1.º y la escritura del flag (lo que volvería a invertir los datos).
 *
 * NO bumpea `DB_VERSION` (sigue en su valor actual). Solo toca registros
 * con `origen='xml_aeat'`.
 */

import { initDB } from '../db';
import type { AportacionPlan } from '../../types/planesPensiones';

export const B6_MIGRATION_FLAG_KEY = 'migration_b6_aportacionesPlan_v1';

export interface FixAportacionesPlanCruceB6Report {
  /** True si el flag estaba presente al iniciar · skip silencioso. */
  skipped: boolean;
  /** Número de registros invertidos. */
  swapped: number;
  /**
   * Errores no fatales por registro o en la transacción. Si > 0, el flag NO
   * se escribe · el próximo arranque reintentará.
   */
  errors: string[];
}

export async function fixAportacionesPlanCruceB6(): Promise<FixAportacionesPlanCruceB6Report> {
  const report: FixAportacionesPlanCruceB6Report = {
    skipped: false,
    swapped: 0,
    errors: [],
  };

  const db = await initDB();

  // Una sola transacción readwrite sobre los 2 stores · serializa runs
  // concurrentes (otra pestaña) y garantiza que la lectura del flag y los
  // swaps son atómicos respecto a la escritura final del flag.
  const tx = db.transaction(['keyval', 'aportacionesPlan'], 'readwrite');
  const keyvalStore = tx.objectStore('keyval');
  const aportStore = tx.objectStore('aportacionesPlan');

  try {
    const flag = await keyvalStore.get(B6_MIGRATION_FLAG_KEY);
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
      const titularAntes = ap.importeTitular ?? 0;
      const empresaAntes = ap.importeEmpresa ?? 0;
      if (titularAntes === 0 && empresaAntes === 0) continue;

      try {
        const swapped: AportacionPlan = {
          ...ap,
          importeTitular: empresaAntes,
          importeEmpresa: titularAntes,
          fechaActualizacion: ahora,
        };
        await aportStore.put(swapped);
        report.swapped++;
        logs.push(
          `[ATLAS] FIX-B6 aportacionesPlan ${ap.id} ejercicio ${ap.ejercicioFiscal} · `
            + `titular ${titularAntes} → ${empresaAntes} · empresa ${empresaAntes} → ${titularAntes}`,
        );
      } catch (error) {
        report.errors.push(
          `put aportacionesPlan ${ap.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Solo marcamos completada si TODOS los swaps fueron OK · si algún
    // registro falló, el flag NO se escribe y la próxima corrida reintenta.
    if (report.errors.length === 0) {
      await keyvalStore.put('completed', B6_MIGRATION_FLAG_KEY);
    }

    await tx.done;

    // Logs fuera de la transacción para no retrasar el commit.
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
