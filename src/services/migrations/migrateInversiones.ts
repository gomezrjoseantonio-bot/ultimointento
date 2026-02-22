// src/services/migrations/migrateInversiones.ts
// ATLAS HORIZON: Migration script for existing investment positions to new extended model

import { initDB } from '../db';
import { PosicionInversion } from '../../types/inversiones';

/**
 * Migrate existing investment positions to the new extended model.
 * All existing positions are converted to InversionValoracionSimple.
 * Safe to run multiple times (idempotent).
 */
export async function migrateInversionesToNewModel(): Promise<{ migrated: number; skipped: number }> {
  const db = await initDB();
  const oldPosiciones: PosicionInversion[] = await db.getAll('inversiones');

  let migrated = 0;
  let skipped = 0;

  for (const posicion of oldPosiciones) {
    const posAny = posicion as any;
    
    // Skip if already migrated (has rentabilidad_euros defined)
    if (posAny.rentabilidad_euros !== undefined) {
      skipped++;
      continue;
    }

    // Handle legacy 'deposito' type -> keep as-is (backward compat)
    const migrated_posicion: any = {
      ...posicion,
      rentabilidad_euros: posicion.valor_actual - posicion.total_aportado,
      rentabilidad_porcentaje: posicion.total_aportado > 0
        ? ((posicion.valor_actual - posicion.total_aportado) / posicion.total_aportado) * 100
        : 0,
    };

    await db.put('inversiones', migrated_posicion);
    migrated++;
  }

  return { migrated, skipped };
}
