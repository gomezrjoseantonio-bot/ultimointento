// Migración one-shot: elimina registros tipo:'reparacion' en mejorasInmueble
// que fueron escritos erróneamente por escribirMejoras() al importar XML AEAT.
// Las reparaciones son gastos deducibles (casilla 0106) y deben vivir solo
// en gastosInmueble. mejorasInmueble es exclusivamente para CAPEX (tipo mejora/ampliacion).

import { initDB } from '../db';

const MIGRATION_KEY = 'migration_fix_reparaciones_duplicadas_v1';

export async function fixReparacionesDuplicadas(): Promise<number> {
  const db = await initDB();
  const todas = await db.getAll('mejorasInmueble');
  const reparaciones = todas.filter((m: any) => m.tipo === 'reparacion');
  for (const r of reparaciones) {
    if (r.id != null) await db.delete('mejorasInmueble', r.id);
  }
  return reparaciones.length;
}

export async function runMigrationIfNeeded(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY)) return;
  try {
    const deleted = await fixReparacionesDuplicadas();
    if (deleted > 0) {
      console.info(`[Migración] fixReparacionesDuplicadas: ${deleted} registros eliminados de mejorasInmueble`);
    }
    localStorage.setItem(MIGRATION_KEY, 'done');
  } catch (e) {
    console.error('[Migración] fixReparacionesDuplicadas falló:', e);
  }
}
