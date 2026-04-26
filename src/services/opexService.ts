// src/services/opexService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub enriquecido para preservar API surface.
// Ya migrado a compromisosRecurrentes en TAREA 2.

import { initDB, OpexRule, OpexCategory, OpexFrequency } from './db';
import { CompromisoRecurrente } from '../types/compromisosRecurrentes';

// Re-export types from db.ts for backward compatibility
export type { OpexRule, OpexCategory, OpexFrequency, OpexEstacionalidad, ExpenseBusinessType, AsymmetricPayment } from './db';

/**
 * Generates base OPEX rules (at €0) for a property.
 * NOTE: In V62, this is a no-op stub. Real implementation would write to compromisosRecurrentes.
 */
export async function generateBaseOpexForProperty(
  _propertyId: number,
  _accountId?: number
): Promise<void> {
  console.warn('[opexService] Store eliminado en V62 · usar compromisosRecurrentes');
}

/**
 * Returns all OPEX rules for a given property.
 * V62 stub: returns empty array.
 */
export async function getOpexRulesForProperty(_propertyId: number): Promise<OpexRule[]> {
  return [];
}

/**
 * Saves an OPEX rule (V62 stub: no-op).
 */
export async function saveOpexRule(_rule: Partial<OpexRule>): Promise<OpexRule | null> {
  console.warn('[opexService] Store eliminado en V62 · usar compromisosRecurrentes');
  return null;
}

/**
 * Deletes an OPEX rule by ID (V62 stub: no-op).
 */
export async function deleteOpexRule(_id: number): Promise<void> {
  console.warn('[opexService] Store eliminado en V62 · operación no-op');
}

/**
 * Maps a CompromisoRecurrente back to OpexRule format (for backward compatibility).
 * V62 stub: returns null.
 */
export function mapCompromisoToOpexRule(_compromiso: CompromisoRecurrente): OpexRule | null {
  return null;
}

/**
 * Returns all active CompromisoRecurrente records for a given inmueble.
 * V62: delegates to compromisosRecurrentes store.
 */
export async function getCompromisosForInmueble(propertyId: number): Promise<CompromisoRecurrente[]> {
  try {
    const db = await initDB();
    const compromisos = await db.getAllFromIndex('compromisosRecurrentes', 'inmuebleId', propertyId);
    return compromisos.filter((c) => c.ambito === 'inmueble');
  } catch (error) {
    console.error('[opexService] Error getting compromisos:', error);
    return [];
  }
}

/**
 * Injects contract-specific OPEX rules based on contract type.
 * V62 stub: no-op.
 */
export async function injectContractOpex(
  _propertyId: number,
  _contractType: string,
  _accountId?: number
): Promise<void> {
  console.warn('[opexService] Store eliminado en V62 · usar compromisosRecurrentes');
}

