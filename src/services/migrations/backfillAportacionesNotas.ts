/**
 * Pulido T13 v4 final · issue 5 · backfill de `notas` en aportaciones legacy.
 *
 * Contexto · las migraciones B6 y casillaAEAT oficial reescribieron el campo
 * `casillaAEAT` pero no añadieron `notas` a registros legacy. Resultado · la
 * tabla "Aportaciones · histórico" muestra notas descriptivas en las
 * aportaciones 2020-2022 (que pasaron por el adapter nuevo) y "—" en las
 * 2023-2024 (escritas por el bloque viejo y reescritas solo en casilla).
 *
 * Esta migración recorre `aportacionesPlan` con `origen='xml_aeat'` y `notas`
 * vacío o null y genera la nota a partir del shape:
 *
 *   - `casillaAEAT === '0426'`     → "Importado de declaración IRPF {año} (casilla 0426 · partícipe)"
 *   - `casillaAEAT === '0427'`     → "Importado de declaración IRPF {año} (casilla 0427 · empresa)"
 *   - `casillaAEAT === '0426/0427'`→ "Importado de declaración IRPF {año} (casillas 0426+0427)"
 *   - cualquier otro / vacío       → "Importado de declaración IRPF {año} (XML AEAT)"
 *
 * NO toca registros con notas ya presentes · respeta override manual y
 * cualquier nota legítima escrita por flows nuevos.
 *
 * Idempotente · flag `migration_aportacionesPlan_notas_backfill_v1` en
 * `keyval` · una sola transacción `readwrite` sobre `keyval` +
 * `aportacionesPlan`.
 *
 * NO bumpea `DB_VERSION`. NO toca importes, casillas ni el parser.
 */

import { initDB } from '../db';
import type { AportacionPlan } from '../../types/planesPensiones';

export const APORTACIONES_NOTAS_BACKFILL_FLAG_KEY =
  'migration_aportacionesPlan_notas_backfill_v1';

export interface BackfillAportacionesNotasReport {
  skipped: boolean;
  updated: number;
  errors: string[];
}

function generarNota(ap: AportacionPlan): string {
  const año = ap.ejercicioFiscal;
  const casilla = ap.casillaAEAT;
  if (casilla === '0426') {
    return `Importado de declaración IRPF ${año} (casilla 0426 · partícipe)`;
  }
  if (casilla === '0427') {
    return `Importado de declaración IRPF ${año} (casilla 0427 · empresa)`;
  }
  if (casilla === '0426/0427') {
    return `Importado de declaración IRPF ${año} (casillas 0426+0427)`;
  }
  return `Importado de declaración IRPF ${año} (XML AEAT)`;
}

export async function backfillAportacionesNotas(): Promise<BackfillAportacionesNotasReport> {
  const report: BackfillAportacionesNotasReport = {
    skipped: false,
    updated: 0,
    errors: [],
  };

  const db = await initDB();
  const tx = db.transaction(['keyval', 'aportacionesPlan'], 'readwrite');
  const keyvalStore = tx.objectStore('keyval');
  const aportStore = tx.objectStore('aportacionesPlan');

  try {
    const flag = await keyvalStore.get(APORTACIONES_NOTAS_BACKFILL_FLAG_KEY);
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
      if (ap.notas && ap.notas.trim().length > 0) continue;

      const nota = generarNota(ap);
      try {
        await aportStore.put({
          ...ap,
          notas: nota,
          fechaActualizacion: ahora,
        });
        report.updated++;
        logs.push(
          `[ATLAS] BACKFILL-notas aportacionesPlan ${ap.id} ejercicio ${ap.ejercicioFiscal} · "${nota}"`,
        );
      } catch (error) {
        report.errors.push(
          `aportacionesPlan ${ap.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (report.errors.length === 0) {
      await keyvalStore.put('completed', APORTACIONES_NOTAS_BACKFILL_FLAG_KEY);
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
