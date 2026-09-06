// E2.4.2 · la huella de que una línea la cerró el MOTOR (aprendizaje intra-lote)
// y no una persona: `comoSeResolvio: 'motor'` en la línea y
// `statusConciliacion: 'match_automatico'` en su movimiento. Es la misma marca
// que deja `resolverPorRegla` (E2.2) · quien audite distingue lo automático, y
// el movimiento sigue reclasificable desde Tesorería (reversible).

import { initDB, type Movement } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';

export async function marcarResueltaPorElMotor(lineaId: number, ahora = new Date().toISOString()): Promise<void> {
  const db = await initDB();
  const linea = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
  if (!linea) return;
  await db.put('lineasExtracto', { ...linea, comoSeResolvio: 'motor', updatedAt: ahora });
  for (const movementId of linea.movementIds ?? []) {
    const m = (await db.get('movements', movementId)) as Movement | undefined;
    if (m) await db.put('movements', { ...m, statusConciliacion: 'match_automatico', updatedAt: ahora });
  }
}
