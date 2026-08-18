// ============================================================================
// Limpiar los duplicados de previstos punteados ya creados
// ============================================================================
//
// El bug de duplicados (arreglado en el import) dejó pares en la base de datos:
// un previsto PUNTEADO (Confirmado, `source:'manual'` con `reference:
// treasury_event:<id>`) y la línea del extracto (`source:'import'`) del MISMO
// cargo, sin conciliar. La subida del mismo fichero está bloqueada por hash, así
// que esos pares no se colapsan solos.
//
// Esta limpieza los reconcilia a posteriori, con el MISMO colapso que el import
// (`aplicarReconciliacionConfirmado`). Es CONSERVADORA: solo toca confirmados que
// son un previsto punteado (`treasury_event:`), que es donde mordió el bug —no
// un movimiento anotado a mano suelto que casualmente coincida en importe—. Y es
// idempotente: una vez colapsado, el superviviente es `source:'import'` y ya no
// vuelve a casar.
// ============================================================================

import { initDB } from './db';
import type { Movement } from './db';
import { emparejarConfirmados } from './conciliacionConfirmados';
import { aplicarReconciliacionConfirmado, eventIdDeReferencia } from './reconciliarConfirmado';

/** Un confirmado que nació de puntear un previsto (`confirmTreasuryEvent`). */
function esPrevistoPunteado(m: Movement): boolean {
  return m.source === 'manual' && eventIdDeReferencia(m.reference) != null;
}

/**
 * Pares `líneaImport → confirmado punteado` del MISMO cargo, por cuenta, importe
 * con signo y fecha cercana. Puro sobre la lista de movimientos.
 */
export function detectarDuplicadosPunteados(movements: Movement[]): Map<number, number> {
  const lineasImport = (movements ?? []).filter((m) => m.id != null && m.source === 'import');
  const punteados = (movements ?? []).filter(esPrevistoPunteado);
  return emparejarConfirmados(lineasImport, punteados);
}

/** Cuántos duplicados hay ahora mismo · para avisar antes de limpiar. */
export function contarDuplicadosPunteados(movements: Movement[]): number {
  return detectarDuplicadosPunteados(movements).size;
}

/**
 * Reconcilia todos los duplicados punteados de la base de datos y devuelve
 * cuántos colapsó.
 */
export async function reconciliarDuplicadosExistentes(): Promise<number> {
  const db = await initDB();
  const movements = (await db.getAll('movements')) as Movement[];
  const pares = detectarDuplicadosPunteados(movements);
  const porId = new Map<number, Movement>();
  for (const m of movements) if (m.id != null) porId.set(m.id, m);

  const now = new Date().toISOString();
  let n = 0;
  for (const [importId, confirmadoId] of pares) {
    const importMov = porId.get(importId);
    if (!importMov) continue;
    await aplicarReconciliacionConfirmado(db, importMov, confirmadoId, now);
    n += 1;
  }
  return n;
}
