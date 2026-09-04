// ============================================================================
// E1.3 · reabrir un lote a medias
// ============================================================================
//
// Lo mismo que devuelve `processFile`, pero sin leer ningún fichero ni insertar
// nada: los movimientos ya están (E1.1 los creó al importar) y el emparejamiento,
// las sugerencias y el reconocimiento son lecturas puras que se vuelven a
// calcular sobre ellos. Vive aparte del orquestador para que aquel no pase de
// 800 líneas (trinquete de salud).
//
// Las decisiones del usuario NO van aquí: viven en las filas de
// `lineasExtracto` y las carga el drawer (`decisionesPersistidas`).
// ============================================================================

import { initDB, ImportBatch, Movement } from './db';
import type { OrchestratorResult } from './bankStatementOrchestrator';
import { matchBatch, MatchOptions } from './movementMatchingService';
import { suggestForUnmatched } from './movementSuggestionService';
import { reconocerDeterministas, nadaReconocido, type LoQueSeReconoce } from './deterministas/matcheoDeterminista';

/**
 * E1.3 · reabrir un lote a medias · lo mismo que devuelve `processFile`, pero
 * sin leer ningún fichero ni insertar nada: los movimientos ya están (E1.1
 * los creó al importar) y el emparejamiento, las sugerencias y el
 * reconocimiento son lecturas puras que se vuelven a calcular sobre ellos.
 *
 * Las decisiones del usuario NO van aquí: viven en las filas de
 * `lineasExtracto` y las carga el drawer (`decisionesPersistidas`).
 */
export async function reabrirLote(
  importBatchId: string,
  options: { matchOptions?: MatchOptions } = {}
): Promise<OrchestratorResult> {
  const db = await initDB();
  const batch = (await db.get('importBatches', importBatchId)) as ImportBatch | undefined;
  if (!batch) throw new Error(`El lote ${importBatchId} ya no existe.`);
  if (batch.consolidadoAt) throw new Error(`El lote ${importBatchId} ya se guardó · no hay nada que retomar.`);

  const movimientos = (await movimientosDelLote(db, importBatchId)).filter((m) => m.id != null);
  const ids = movimientos.map((m) => m.id as number);
  const matchResult = await matchBatch(ids, options.matchOptions);
  const suggestions = await suggestForUnmatched(matchResult.sinMatch);
  const reconocido = await (async (): Promise<LoQueSeReconoce> => {
    try {
      const sinCasar = movimientos.filter((m) => matchResult.sinMatch.includes(m.id as number));
      return await reconocerDeterministas(sinCasar);
    } catch (err) {
      console.warn('[orchestrator] no se pudo reconocer contra los libros del usuario', err);
      return nadaReconocido();
    }
  })();

  return {
    importBatchId,
    movementsParsed: batch.totalRows,
    movementsInserted: batch.importedRows,
    duplicatesSkipped: batch.duplicatedRows,
    matchResult,
    suggestions,
    reconocido,
    bankProfileUsed: batch.origenBanco,
    warnings: [
      `Sesión retomada · el extracto se importó el ${batch.timestampImport.slice(0, 10)} (${batch.filename}).`,
    ],
  };
}

/** Movimientos de un lote · por índice `importBatch` si el handle lo ofrece. */
async function movimientosDelLote(
  db: Awaited<ReturnType<typeof initDB>>,
  importBatchId: string
): Promise<Movement[]> {
  const porIndice = (db as { getAllFromIndex?: unknown }).getAllFromIndex;
  if (typeof porIndice === 'function') {
    return ((await db.getAllFromIndex('movements', 'importBatch', importBatchId)) ?? []) as Movement[];
  }
  const todos = ((await db.getAll('movements')) ?? []) as Movement[];
  return todos.filter((m) => m.importBatch === importBatchId);
}
