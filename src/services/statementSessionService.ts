// ============================================================================
// Tesorería V6 · §4.7 · la sesión de importación · guardada o a medias
// ============================================================================
//
// Un `ImportBatch` sin `consolidadoAt` es una sesión A MEDIAS: se ofrece
// retomar (E1.3 · `lotesAMedias`, `reabrirLote`). Con `consolidadoAt` ya pasó
// por Guardar.
//
// E1.5 · lo que había aquí de «borrador» (`batchesEnBorrador`, `sinBorradores`)
// se retiró con el corte: existía para esconder los movimientos que el import
// insertaba antes de que el usuario mirara nada, y tras el corte importar no
// inserta ninguno. Dejarlo habría escondido justo los movimientos que el
// usuario YA resolvió en una sesión sin guardar. Y «desmaterializar» las
// líneas pendientes al consolidar se retiró en FASE 1 (una línea del banco es
// dinero que se movió); ya no hay nada que borrar.
// ============================================================================

import { initDB } from './db';
import type { ImportBatch } from './db/types-fiscal';

/**
 * Marca la sesión como guardada · deja de ofrecerse como «a medias».
 *
 * Se llama DESPUÉS de `confirmDecisions`, no antes: si algo falla a medias,
 * más vale que la sesión siga a medias (retomable) que darla por cerrada.
 *
 * Idempotente: consolidar dos veces conserva la marca original, porque la fecha
 * que importa es la de la primera vez que el usuario dijo que sí.
 */
export async function consolidarSesion(importBatchId: string): Promise<void> {
  const db = await initDB();
  const batch = (await db.get('importBatches', importBatchId)) as ImportBatch | undefined;
  if (!batch) throw new Error(`Sesión de importación ${importBatchId} no encontrada`);
  if (batch.consolidadoAt) return;

  await db.put('importBatches', {
    ...batch,
    consolidadoAt: new Date().toISOString(),
  });
}

/** ¿Esta sesión ya se guardó? Para no ofrecer resolver algo ya cerrado. */
export async function estaConsolidada(importBatchId: string): Promise<boolean> {
  const db = await initDB();
  const batch = (await db.get('importBatches', importBatchId)) as ImportBatch | undefined;
  return Boolean(batch?.consolidadoAt);
}

/**
 * §4.7 · "el fichero se archiva en el Archivo, vinculado a cuenta y periodo".
 *
 * El periodo se deduce de las fechas de las líneas y no del nombre del fichero,
 * que miente a menudo ("extracto.csv", "descarga (3).xlsx").
 *
 * No revienta la consolidación si falla: el extracto ya está conciliado y los
 * saldos son correctos: perder la copia archivada es molesto, deshacer un
 * guardado bueno lo es mucho más. Devuelve el id del documento, o `null`.
 */
export async function archivarExtracto(
  file: File,
  cuenta: { id?: number; alias?: string; ultimosCuatro?: string },
  fechas: string[]
): Promise<number | null> {
  try {
    const { saveDocumentWithBlob } = await import('./db/documents');
    const ordenadas = fechas.filter(Boolean).slice().sort();
    const desde = ordenadas[0];
    const hasta = ordenadas[ordenadas.length - 1];
    const periodo = desde && hasta ? (desde === hasta ? desde : `${desde} a ${hasta}`) : undefined;

    return await saveDocumentWithBlob({
      filename: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified,
      uploadDate: new Date().toISOString(),
      content: file,
      metadata: {
        tipo: 'bancario',
        title: `Extracto · ${cuenta.alias ?? 'cuenta'}${periodo ? ` · ${periodo}` : ''}`,
        entityType: 'personal',
        ...(cuenta.id != null ? { entityId: cuenta.id } : {}),
        tags: [
          'extracto',
          ...(cuenta.ultimosCuatro ? [`****${cuenta.ultimosCuatro}`] : []),
          ...(periodo ? [periodo] : []),
        ],
      },
    });
  } catch (err) {
    console.error('[statementSession] no se pudo archivar el extracto', err);
    return null;
  }
}
