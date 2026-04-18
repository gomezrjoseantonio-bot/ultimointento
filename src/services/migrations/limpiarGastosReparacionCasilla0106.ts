// Migración one-shot: elimina registros de gastosInmueble con casillaAEAT='0106'
// y origen='xml_aeat' escritos antes del fix BUG-1. Usaban C_GRCEA (bruto antes
// del tope) en lugar de C_INTGRCEA (aplicado tras el tope), sobrededuciendo el
// gasto de reparación cuando había arrastre. Al reimportar el XML se reescriben
// correctamente con el importe aplicado real.

import { initDB } from '../db';

const MIGRATION_KEY = 'migration_limpiar_gastos_reparacion_0106_v1';

export async function limpiarGastosReparacionCasillasErroneas(): Promise<{ eliminados: number }> {
  const db = await initDB();
  const todos = await db.getAll('gastosInmueble');
  let eliminados = 0;
  for (const g of todos) {
    if (
      g.origen === 'xml_aeat' &&
      g.casillaAEAT === '0106' &&
      typeof g.concepto === 'string' &&
      g.concepto.startsWith('Declaración AEAT') &&
      g.id != null
    ) {
      await db.delete('gastosInmueble', g.id);
      eliminados++;
    }
  }
  if (eliminados > 0) {
    console.log(`[gastosInmueble] Limpieza reparaciones 0106: ${eliminados} eliminados`);
  }
  return { eliminados };
}

export async function runMigrationIfNeeded(): Promise<void> {
  if (localStorage.getItem(MIGRATION_KEY)) return;
  try {
    await limpiarGastosReparacionCasillasErroneas();
    localStorage.setItem(MIGRATION_KEY, 'done');
  } catch (e) {
    console.error('[Migración] limpiarGastosReparacionCasillasErroneas falló:', e);
  }
}
