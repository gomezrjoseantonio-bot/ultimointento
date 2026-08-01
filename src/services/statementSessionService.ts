// ============================================================================
// Tesorería V6 · §4.7 · la sesión de importación como BORRADOR
// ============================================================================
//
// El problema que resuelve, en una frase: `processFile` inserta los movimientos
// al procesar el fichero, pero §4.7 dice que "lo no resuelto no se mezcla con
// la lista de la cuenta: espera en el extracto".
//
// Las dos cosas no pueden ser verdad a la vez sin un filtro. Los movimientos
// recién insertados nacen con `source: 'import'`, y en el modelo de punteo eso
// es `conciliado` (`punteoModel.estadoDeMovimiento`). Sin este filtro, soltar
// un fichero en la dropzone haría aparecer TODAS sus líneas en el drawer de
// cuenta, ya conciliadas, antes de que el usuario mire ninguna — y moviendo el
// saldo. Justo lo contrario de lo que pide la sección.
//
// La alternativa era reescribir `processFile` para no insertar hasta el final.
// Se descartó: es cirugía mayor sobre un servicio en producción con otro
// consumidor vivo, y el emparejamiento (`matchBatch`) trabaja sobre ids ya
// insertados. Marcar la sesión es aditivo y se comprueba en un solo sitio.
//
// Regla: un `ImportBatch` sin `consolidadoAt` es un BORRADOR, y sus movimientos
// no existen para nadie fuera del drawer que los está resolviendo.
// ============================================================================

import { initDB } from './db';
import type { ImportBatch } from './db/types-fiscal';
import type { Movement } from './db';

/**
 * Ids de los batches que aún no han pasado por `Guardar`.
 *
 * Se devuelve el conjunto entero y no un predicado por movimiento porque quien
 * llama tiene una lista larga y una sola pasada por `importBatches` cuesta
 * mucho menos que una consulta por fila.
 */
export async function batchesEnBorrador(): Promise<Set<string>> {
  const db = await initDB();
  const batches = ((await db.getAll('importBatches')) ?? []) as ImportBatch[];
  const borradores = new Set<string>();
  for (const b of batches) {
    if (!b.consolidadoAt && b.id) borradores.add(b.id);
  }
  return borradores;
}

/**
 * Quita los movimientos que todavía esperan en un extracto sin guardar.
 *
 * Los movimientos sin `importBatch` (alta a mano, punteo, inbox) pasan siempre:
 * no vienen de ninguna sesión de importación y no hay nada que esperar.
 */
export function sinBorradores<T extends Pick<Movement, 'importBatch'>>(
  movimientos: T[],
  borradores: Set<string>
): T[] {
  if (borradores.size === 0) return movimientos;
  return movimientos.filter((m) => !m.importBatch || !borradores.has(m.importBatch));
}

/**
 * Una línea que se quedó sin resolver al guardar.
 *
 * `movementId` es el registro que `processFile` insertó y que hay que borrar
 * para cumplir D4; el resto es lo que permite volver a enseñarla sin el fichero.
 */
export interface LineaPendiente {
  movementId?: number;
  hashLinea: string;
  fecha: string;
  importe: number;
  concepto: string;
}

/**
 * Marca la sesión como guardada · a partir de aquí sus movimientos cuentan.
 *
 * Se llama DESPUÉS de `confirmDecisions`, no antes: si la consolidación falla a
 * medias, más vale que la sesión siga siendo un borrador (invisible) que dejar
 * movimientos a medio resolver moviendo saldos.
 *
 * Idempotente: consolidar dos veces conserva la marca original, porque la fecha
 * que importa es la de la primera vez que el usuario dijo que sí.
 */
export async function consolidarSesion(
  importBatchId: string,
  pendientes: LineaPendiente[] = []
): Promise<void> {
  const db = await initDB();
  const batch = (await db.get('importBatches', importBatchId)) as ImportBatch | undefined;
  if (!batch) throw new Error(`Sesión de importación ${importBatchId} no encontrada`);
  if (batch.consolidadoAt) return;

  // D4 · lo que quedó sin resolver NO SE MATERIALIZA. `processFile` ya había
  // insertado un `Movement` por línea, así que "no materializarse" obliga a
  // borrarlos: en cuanto el batch deje de ser borrador, cualquiera que siguiera
  // en el store aparecería en la lista de la cuenta como conciliado y movería
  // el saldo, que es justo lo que §4.7 prohíbe.
  //
  // La línea no se pierde: su identidad queda en el batch, que es lo que
  // significa "sigue pendiente en la sesión de importación".
  for (const p of pendientes) {
    if (p.movementId == null) continue;
    try {
      await db.delete('movements', p.movementId);
    } catch (err) {
      console.warn('[statementSession] no se pudo desmaterializar la línea pendiente', err);
    }
  }

  await db.put('importBatches', {
    ...batch,
    consolidadoAt: new Date().toISOString(),
    ...(pendientes.length > 0
      ? {
          lineasPendientes: pendientes.map(({ hashLinea, fecha, importe, concepto }) => ({
            hashLinea,
            fecha,
            importe,
            concepto,
          })),
        }
      : {}),
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
