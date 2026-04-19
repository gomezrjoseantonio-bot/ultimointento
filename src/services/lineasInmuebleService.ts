// src/services/lineasInmuebleService.ts
//
// PR5.5 · Choke point para editar/eliminar líneas de inmueble
// (`gastosInmueble`, `mejorasInmueble`, `mueblesInmueble`) propagando los
// cambios al `TreasuryEvent` y al `Movement` vinculados cuando existan.
//
// Los servicios por tipo (gastosInmuebleService / mejorasInmuebleService /
// mueblesInmuebleService) delegan sus métodos `update/delete` aquí para que
// la cadena bidireccional inmueble ↔ tesorería no se rompa.
//
// Reglas de propagación:
//   - Sólo se tocan los campos relevantes del event/movement (importe,
//     fecha, descripción, contraparte, notas y los 4 campos de
//     documentación de PR5).
//   - Si la línea es legacy y no tiene `treasuryEventId`/`movimientoId`, se
//     actualiza/borra sólo la línea (no hay cadena).
//   - `deleteLineaInmueble` hace cascada: borra el movement y el event
//     asociados. Esto incluye el caso habitual en el que el event se creó
//     desde /conciliacion y el user decide eliminarlo desde el tab del
//     inmueble.

import { initDB } from './db';
import type { Movement, TreasuryEvent } from './db';

export type LineaStoreName =
  | 'gastosInmueble'
  | 'mejorasInmueble'
  | 'mueblesInmueble';

// Campos que sí se propagan. Cualquier otro update (origen, casillaAEAT…)
// queda confinado a la línea. Esto evita que un cambio de categoria fiscal
// contamine el movement.
const PROPAGATABLE_FIELDS = [
  'importe',
  'fecha',
  'fechaAlta',
  'concepto',
  'descripcion',
  'proveedorNombre',
  'proveedorNIF',
  'notas',
  'facturaId',
  'facturaNoAplica',
  'justificanteId',
  'justificanteNoAplica',
] as const;

function pickPropagatable(updates: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PROPAGATABLE_FIELDS) {
    if (k in updates) out[k] = (updates as any)[k];
  }
  return out;
}

function buildDescription(linea: any, storeName: LineaStoreName): string | undefined {
  const concepto = linea.concepto ?? linea.descripcion;
  if (!concepto) return undefined;
  const prefix =
    storeName === 'gastosInmueble'
      ? 'Gasto'
      : storeName === 'mejorasInmueble'
      ? 'Mejora'
      : 'Mobiliario';
  return `${prefix} · ${concepto}`;
}

/**
 * Actualiza una línea de inmueble y propaga los cambios al `TreasuryEvent`
 * y al `Movement` asociados (si existen).
 *
 * Devuelve la línea actualizada para que el UI pueda refrescar sin re-lookup.
 */
export async function updateLineaInmueble(
  storeName: LineaStoreName,
  lineaId: number,
  updates: Partial<Record<string, unknown>>,
): Promise<any | null> {
  const db = await initDB();
  const existing = (await db.get(storeName, lineaId)) as any;
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated = { ...existing, ...updates, updatedAt: now };

  const tx = db.transaction([storeName, 'treasuryEvents', 'movements'], 'readwrite');

  // 1. Actualizar la línea
  await (tx.objectStore(storeName) as any).put(updated);

  const propagate = pickPropagatable(updates);
  const hasPropagatable = Object.keys(propagate).length > 0;

  // 2. Propagar al treasuryEvent
  if (hasPropagatable && existing.treasuryEventId) {
    const eventsStore = tx.objectStore('treasuryEvents') as any;
    const event = (await eventsStore.get(existing.treasuryEventId)) as
      | TreasuryEvent
      | undefined;
    if (event) {
      const eventPatch: Partial<TreasuryEvent> = {};
      if ('importe' in propagate) eventPatch.amount = Math.abs(Number(propagate.importe) || 0);
      const newDate =
        'fecha' in propagate ? propagate.fecha : 'fechaAlta' in propagate ? propagate.fechaAlta : undefined;
      if (typeof newDate === 'string') eventPatch.predictedDate = newDate;
      const newDesc = buildDescription(updated, storeName);
      if (newDesc) eventPatch.description = newDesc;
      if ('proveedorNombre' in propagate || 'proveedorNIF' in propagate) {
        eventPatch.counterparty =
          (propagate.proveedorNombre as string | undefined) ??
          (propagate.proveedorNIF as string | undefined) ??
          event.counterparty;
      }
      if ('notas' in propagate) eventPatch.notes = (propagate.notas as string) || undefined;
      if ('facturaId' in propagate) eventPatch.facturaId = propagate.facturaId as number | undefined;
      if ('facturaNoAplica' in propagate)
        eventPatch.facturaNoAplica = propagate.facturaNoAplica as boolean | undefined;
      if ('justificanteId' in propagate)
        eventPatch.justificanteId = propagate.justificanteId as number | undefined;
      if ('justificanteNoAplica' in propagate)
        eventPatch.justificanteNoAplica = propagate.justificanteNoAplica as boolean | undefined;

      await eventsStore.put({ ...event, ...eventPatch, updatedAt: now });
    }
  }

  // 3. Propagar al movement
  if (hasPropagatable && existing.movimientoId) {
    const movementsStore = tx.objectStore('movements') as any;
    const movementId =
      typeof existing.movimientoId === 'string'
        ? Number(existing.movimientoId)
        : existing.movimientoId;
    const movement = (await movementsStore.get(movementId)) as Movement | undefined;
    if (movement) {
      const movementPatch: Partial<Movement> = {};
      if ('importe' in propagate) {
        const abs = Math.abs(Number(propagate.importe) || 0);
        movementPatch.amount = movement.amount < 0 ? -abs : abs;
      }
      const newDate =
        'fecha' in propagate ? propagate.fecha : 'fechaAlta' in propagate ? propagate.fechaAlta : undefined;
      if (typeof newDate === 'string') {
        movementPatch.date = newDate;
        movementPatch.valueDate = newDate;
      }
      const newDesc = buildDescription(updated, storeName);
      if (newDesc) movementPatch.description = newDesc;
      if ('proveedorNombre' in propagate || 'proveedorNIF' in propagate) {
        movementPatch.counterparty =
          (propagate.proveedorNombre as string | undefined) ??
          (propagate.proveedorNIF as string | undefined) ??
          movement.counterparty;
      }
      if ('facturaId' in propagate) movementPatch.facturaId = propagate.facturaId as number | undefined;
      if ('facturaNoAplica' in propagate)
        movementPatch.facturaNoAplica = propagate.facturaNoAplica as boolean | undefined;
      if ('justificanteId' in propagate)
        movementPatch.justificanteId = propagate.justificanteId as number | undefined;
      if ('justificanteNoAplica' in propagate)
        movementPatch.justificanteNoAplica = propagate.justificanteNoAplica as boolean | undefined;

      await movementsStore.put({ ...movement, ...movementPatch, updatedAt: now });
    }
  }

  await tx.done;

  return updated;
}

/**
 * Elimina una línea de inmueble en cascada con su `TreasuryEvent` y
 * `Movement` asociados. Si la línea es legacy y no tiene vínculos, sólo
 * borra la línea.
 */
export async function deleteLineaInmueble(
  storeName: LineaStoreName,
  lineaId: number,
): Promise<void> {
  const db = await initDB();
  const existing = (await db.get(storeName, lineaId)) as any;
  if (!existing) return;

  const tx = db.transaction([storeName, 'treasuryEvents', 'movements'], 'readwrite');

  await (tx.objectStore(storeName) as any).delete(lineaId);

  if (existing.movimientoId) {
    const movementId =
      typeof existing.movimientoId === 'string'
        ? Number(existing.movimientoId)
        : existing.movimientoId;
    if (Number.isFinite(movementId)) {
      await (tx.objectStore('movements') as any).delete(movementId);
    }
  }

  if (existing.treasuryEventId) {
    await (tx.objectStore('treasuryEvents') as any).delete(existing.treasuryEventId);
  }

  await tx.done;
}
