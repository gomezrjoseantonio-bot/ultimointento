// ============================================================================
// E1.3 · reabrir un lote a medias
// ============================================================================
//
// Lo mismo que devuelve `processFile`, pero sin leer ningún fichero ni guardar
// nada: las líneas ya están (E1.1) y el emparejamiento, las sugerencias y el
// reconocimiento son lecturas puras que se vuelven a calcular sobre ellas. Vive aparte del orquestador para que aquel no pase de
// 800 líneas (trinquete de salud).
//
// Las decisiones del usuario NO van aquí: viven en las filas de
// `lineasExtracto` y las carga el drawer (`decisionesPersistidas`).
// ============================================================================

import { initDB, ImportBatch } from './db';
import { analizarLineas, type OrchestratorResult } from './bankStatementOrchestrator';
import type { MatchOptions } from './movementMatchingService';
import { lineasDelLote } from './lineasExtractoService';

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

  // E1.5 · la sesión se rehace desde las LÍNEAS del lote · no hay movimientos
  // que releer (y los que el usuario ya creó en ella no se tocan).
  const propuesta = await analizarLineas(await lineasDelLote(db, importBatchId), options.matchOptions);

  return {
    importBatchId,
    movementsParsed: batch.totalRows,
    lineasImportadas: batch.importedRows,
    duplicatesSkipped: batch.duplicatedRows,
    ...propuesta,
    bankProfileUsed: batch.origenBanco,
    warnings: [
      `Sesión retomada · el extracto se importó el ${batch.timestampImport.slice(0, 10)} (${batch.filename}).`,
    ],
  };
}
