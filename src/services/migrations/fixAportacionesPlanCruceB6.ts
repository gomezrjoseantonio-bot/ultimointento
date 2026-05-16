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
 * Idempotente · escribe el flag `migration_b6_aportacionesPlan_v1` en
 * `keyval` cuando termina y hace skip silencioso en arranques posteriores.
 *
 * NO bumpea `DB_VERSION` (sigue en su valor actual). Solo toca registros
 * con `origen='xml_aeat'`.
 */

import { initDB } from '../db';
import type { AportacionPlan } from '../../types/planesPensiones';

export const B6_MIGRATION_FLAG_KEY = 'migration_b6_aportacionesPlan_v1';

export interface FixAportacionesPlanCruceB6Report {
  /** True si el flag estaba presente · skip silencioso. */
  skipped: boolean;
  /** Número de registros invertidos. */
  swapped: number;
  /** Errores no fatales por registro o al escribir el flag. */
  errors: string[];
}

export async function fixAportacionesPlanCruceB6(): Promise<FixAportacionesPlanCruceB6Report> {
  const report: FixAportacionesPlanCruceB6Report = {
    skipped: false,
    swapped: 0,
    errors: [],
  };

  const db = await initDB();

  const flag = await db.get('keyval', B6_MIGRATION_FLAG_KEY);
  if (flag === 'completed') {
    report.skipped = true;
    return report;
  }

  let aportaciones: AportacionPlan[];
  try {
    aportaciones = (await db.getAll('aportacionesPlan')) as AportacionPlan[];
  } catch (error) {
    report.errors.push(
      `getAll aportacionesPlan: ${error instanceof Error ? error.message : String(error)}`,
    );
    return report;
  }

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
        fechaActualizacion: new Date().toISOString(),
      };
      await db.put('aportacionesPlan', swapped);
      report.swapped++;
      // eslint-disable-next-line no-console
      console.log(
        `[ATLAS] FIX-B6 aportacionesPlan ${ap.id} ejercicio ${ap.ejercicioFiscal} · `
          + `titular ${titularAntes} → ${empresaAntes} · empresa ${empresaAntes} → ${titularAntes}`,
      );
    } catch (error) {
      report.errors.push(
        `put aportacionesPlan ${ap.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  try {
    await db.put('keyval', 'completed', B6_MIGRATION_FLAG_KEY);
  } catch (error) {
    report.errors.push(
      `put flag: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return report;
}
