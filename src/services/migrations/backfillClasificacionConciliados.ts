// ============================================================================
// P7 · Pasada retroactiva · rellenar la clasificación de los apuntes conciliados
// ============================================================================
//
// La herencia de clasificación (el apunte del banco toma la familia/concepto de
// la previsión con la que cuadra) se cableó DESPUÉS de que muchos apuntes ya
// estuvieran conciliados. Esos quedaron "mudos": sin `categoryKey` ni
// `conceptoId`, así que la fila no enseña de qué son, aunque su previsión SÍ lo
// supiera. Esta migración los rellena desde su previsión.
//
// ── Qué toca y qué no ──────────────────────────────────────────────────────
//
// SOLO los apuntes MUDOS (sin `categoryKey` ni `conceptoId`) que tienen una
// previsión detrás con clasificación. Un apunte ya clasificado NO se toca —no se
// pisa lo que el usuario puso—; uno sin previsión (un cargo suelto que nadie
// clasificó) tampoco —no se inventa nada—.
//
// El enlace con la previsión, por dos vías (la que haya):
//   1. `reference: treasury_event:<id>` · lo pone `confirmTreasuryEvent` al
//      materializar un previsto punteado.
//   2. La previsión apunta al apunte con `executedMovementId`/`movementId`.
//
// Idempotente: la segunda pasada no encuentra nada mudo que rellenar. El flag
// solo evita releer la tabla en cada arranque.
// ============================================================================

import { initDB } from '../db';
import type { Movement, TreasuryEvent } from '../db';
import { eventIdDeReferencia } from '../reconciliarConfirmado';

const MIGRATION_KEY = 'migration_backfill_clasificacion_conciliados_v1';

export interface ResultadoBackfillClasificacion {
  revisados: number;
  rellenados: number;
}

/** Un apunte está MUDO si no lleva ni categoría ni concepto fino. */
export function estaMudo(m: Pick<Movement, 'categoryKey' | 'conceptoId'>): boolean {
  return !m.categoryKey && !m.conceptoId;
}

/**
 * El parche de clasificación que un apunte mudo hereda de su previsión · solo
 * los campos que el apunte NO tiene y la previsión SÍ. Vacío si no hay nada que
 * heredar (la previsión tampoco clasifica, o el apunte ya está clasificado).
 */
export function parcheDeClasificacion(m: Movement, ev: TreasuryEvent): Partial<Movement> {
  if (!estaMudo(m)) return {};
  const parche: Partial<Movement> = {};
  if (ev.categoryKey && !m.categoryKey) parche.categoryKey = ev.categoryKey;
  if (ev.subtypeKey && !m.subtypeKey) parche.subtypeKey = ev.subtypeKey;
  if (ev.conceptoId && !m.conceptoId) parche.conceptoId = ev.conceptoId;
  // Ámbito e inmueble ayudan a la vista por inmueble · se rellenan solo si el
  // apunte no los tiene (el `PERSONAL` de un mudo es el valor por defecto, no una
  // elección), y solo cuando de verdad heredamos una clasificación.
  if (parche.categoryKey || parche.conceptoId) {
    if (ev.ambito && (!m.ambito || m.ambito === 'PERSONAL')) parche.ambito = ev.ambito;
    if (ev.inmuebleId != null && m.inmuebleId == null) parche.inmuebleId = String(ev.inmuebleId);
  }
  return parche;
}

export async function backfillClasificacionConciliados(): Promise<ResultadoBackfillClasificacion> {
  const db = await initDB();
  const movimientos = ((await db.getAll('movements')) ?? []) as Movement[];
  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];

  const eventoPorId = new Map<number, TreasuryEvent>();
  const eventoPorMovimiento = new Map<number, TreasuryEvent>();
  for (const e of eventos) {
    if (e.id != null) eventoPorId.set(e.id, e);
    if (e.executedMovementId != null) eventoPorMovimiento.set(e.executedMovementId, e);
    if (e.movementId != null) eventoPorMovimiento.set(e.movementId, e);
  }

  const parches = new Map<number, Partial<Movement>>();
  for (const m of movimientos) {
    if (m.id == null || !estaMudo(m)) continue;
    const evId = eventIdDeReferencia(m.reference);
    const ev = (evId != null ? eventoPorId.get(evId) : undefined) ?? eventoPorMovimiento.get(m.id);
    if (!ev) continue;
    const parche = parcheDeClasificacion(m, ev);
    if (Object.keys(parche).length > 0) parches.set(m.id, parche);
  }

  if (parches.size > 0) {
    const ahora = new Date().toISOString();
    const tx = db.transaction('movements', 'readwrite');
    const store = tx.objectStore('movements');
    for (const m of movimientos) {
      const parche = m.id != null ? parches.get(m.id) : undefined;
      if (!parche) continue;
      await store.put({ ...m, ...parche, updatedAt: ahora });
    }
    await tx.done;
  }

  return { revisados: movimientos.length, rellenados: parches.size };
}

// ─── Arranque ───────────────────────────────────────────────────────────────

function leerFlag(clave: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirFlag(clave: string, valor: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(clave, valor);
  } catch {
    // Sin flag volverá a correr · es idempotente, no pasa nada.
  }
}

export async function runMigrationIfNeeded(): Promise<void> {
  if (leerFlag(MIGRATION_KEY)) return;
  try {
    const r = await backfillClasificacionConciliados();
    if (r.rellenados > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[Migración] backfillClasificacionConciliados: ${r.rellenados} de ${r.revisados} apunte(s) rellenado(s) desde su previsión`,
      );
    }
    escribirFlag(MIGRATION_KEY, 'done');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[Migración] backfillClasificacionConciliados falló:', e);
  }
}
