// Migración one-shot: elimina gastosInmueble importados desde XML AEAT que
// fueron escritos con casillas incorrectas por una versión anterior del
// distribuidor (comunidad en 0109, servicios en 0112, seguros en 0114,
// IBI en 0115 — mezclado con amortización). Tras limpiar, el usuario debe
// re-importar sus declaraciones para que se reescriban con las casillas
// correctas (0114, 0108, 0109, 0110 respectivamente).

import { limpiarGastosDeclaracionConCasillasErroneas } from '../declaracionDistributorService';

const MIGRATION_KEY = 'migration_fix_gastos_declaracion_casillas_v1';

export async function runMigrationIfNeeded(): Promise<{ eliminados: number; ejecutada: boolean }> {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATION_KEY)) {
    return { eliminados: 0, ejecutada: false };
  }
  try {
    const { eliminados } = await limpiarGastosDeclaracionConCasillasErroneas();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MIGRATION_KEY, 'done');
    }
    return { eliminados, ejecutada: true };
  } catch (e) {
    console.error('[Migración] fixGastosDeclaracionCasillas falló:', e);
    return { eliminados: 0, ejecutada: false };
  }
}
