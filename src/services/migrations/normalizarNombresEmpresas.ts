/**
 * T-INVERSIONES-V5 §7.7 · Normalizar nombres de empresas pagadoras de planes
 * de pensiones a partir del CIF · matchea contra tabla canónica y reescribe
 * `empresaPagadora.nombre` cuando el CIF está mapeado.
 *
 * Contexto · los imports XML AEAT escriben el nombre tal como aparece en la
 * declaración (mayúsculas, sin acentos, abreviaturas legales). El usuario
 * ve "ORANGE ESPAGNE SA" en lugar de "Orange España S.A.U.". Esta migración
 * normaliza el campo `nombre` para que la UI muestre el nombre comercial
 * canónico sin tocar el CIF.
 *
 * NO toca planes cuyo CIF no esté en la tabla canónica · respeta el
 * input manual del usuario. NO crea/borra planes · sólo reescribe el
 * sub-objeto `empresaPagadora.nombre`.
 *
 * Idempotente · flag `migration_normalizarNombresEmpresas_v1` en `keyval`.
 * Una sola transacción `readwrite` sobre `keyval` + `planesPensiones`.
 *
 * NO bumpea `DB_VERSION` · sólo backfill de datos existentes.
 *
 * Para añadir nuevas entradas, ampliar `NOMBRES_NORMALIZADOS` y bumpear el
 * sufijo del flag (`_v2`) para que la migración vuelva a correr · de lo
 * contrario los planes ya importados con el nombre legacy no se tocarán.
 */

import { initDB } from '../db';
import type { PlanPensiones } from '../../types/planesPensiones';

export const NORMALIZAR_NOMBRES_EMPRESAS_FLAG_KEY =
  'migration_normalizarNombresEmpresas_v1';

/**
 * Tabla canónica CIF → nombre comercial. Ampliar a medida que aparezcan
 * nuevos casos en las declaraciones. Claves en uppercase para match
 * insensible a mayúsculas/minúsculas.
 */
export const NOMBRES_NORMALIZADOS: Record<string, string> = {
  A82009812: 'Orange España S.A.U.',
};

export interface NormalizarNombresEmpresasReport {
  skipped: boolean;
  updated: number;
  errors: string[];
}

export async function normalizarNombresEmpresas(): Promise<NormalizarNombresEmpresasReport> {
  const report: NormalizarNombresEmpresasReport = {
    skipped: false,
    updated: 0,
    errors: [],
  };

  const db = await initDB();
  const tx = db.transaction(['keyval', 'planesPensiones'], 'readwrite');
  const keyvalStore = tx.objectStore('keyval');
  const planesStore = tx.objectStore('planesPensiones');

  try {
    const flag = await keyvalStore.get(NORMALIZAR_NOMBRES_EMPRESAS_FLAG_KEY);
    if (flag === 'completed') {
      report.skipped = true;
      await tx.done;
      return report;
    }

    const planes = (await planesStore.getAll()) as PlanPensiones[];
    const ahora = new Date().toISOString();
    const logs: string[] = [];

    for (const plan of planes) {
      const cif = plan.empresaPagadora?.cif?.trim().toUpperCase();
      if (!cif) continue;

      const nombreCanonico = NOMBRES_NORMALIZADOS[cif];
      if (!nombreCanonico) continue;

      const nombreActual = plan.empresaPagadora?.nombre ?? '';
      if (nombreActual === nombreCanonico) continue;

      try {
        await planesStore.put({
          ...plan,
          empresaPagadora: {
            ...plan.empresaPagadora!,
            cif,
            nombre: nombreCanonico,
          },
          fechaActualizacion: ahora,
        });
        report.updated++;
        logs.push(
          `[ATLAS] NORMALIZAR-nombre planesPensiones ${plan.id} · ${cif} · "${nombreActual}" → "${nombreCanonico}"`,
        );
      } catch (error) {
        report.errors.push(
          `planesPensiones ${plan.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (report.errors.length === 0) {
      await keyvalStore.put('completed', NORMALIZAR_NOMBRES_EMPRESAS_FLAG_KEY);
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
