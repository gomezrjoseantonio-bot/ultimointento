// ============================================================================
// ViviendaHabitualService · LEGACY (Fase 4 · entidad retirada)
// ============================================================================
//
// La ficha «Mi vivienda» se retiró del producto. El modelo unificado es:
//   · Recibos del hogar (alquiler · IBI · comunidad · seguro · suministros)
//     → Personal → Gastos (compromisosRecurrentes · flag esViviendaHabitual
//     en el alquiler para la deducción autonómica).
//   · Hipoteca → Financiación (prestamos · la cuota la genera Préstamos).
//   · Rol fiscal del propietario → Inmueble con usoTipo 'vivienda_habitual'
//     (excluye imputación art. 85 · habilita deducción DT 18ª pre-2013).
//
// Este servicio queda como lector/limpiador del store legacy `viviendaHabitual`
// (no se borra el store · los datos del usuario se conservan dormidos):
//   · `obtenerViviendaActiva` → compat fiscal: fiscalContextService sigue
//     leyendo la referencia catastral de fichas antiguas como red de seguridad
//     para la exclusión de imputación (filtrarViviendaHabitualDePropiedades).
//   · `borrarEventosFuturosVivienda` → el bootstrap de Tesorería limpia los
//     eventos previstos que la ficha hubiera generado en su día, para que no
//     dupliquen a los compromisos.
// ============================================================================

import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import type { ViviendaHabitual } from '../../types/viviendaHabitual';

const STORE_VIVIENDA = 'viviendaHabitual';
const STORE_TREASURY = 'treasuryEvents';

/** Ficha activa del titular (lector legacy · compat fiscal por ref. catastral). */
export async function obtenerViviendaActiva(
  personalDataId: number,
): Promise<ViviendaHabitual | undefined> {
  const db = await initDB();
  const all = await db.getAll(STORE_VIVIENDA);
  return all.find((v) => v.personalDataId === personalDataId && v.activa);
}

/**
 * Borra los eventos PREVISTOS que la ficha generó en su día (confirmados y
 * ejecutados se respetan). El generador ya no existe · esto es solo limpieza.
 */
export async function borrarEventosFuturosVivienda(viviendaId: number): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_TREASURY, 'readwrite');
  const store = tx.objectStore(STORE_TREASURY);
  const idx = store.index('sourceId');
  let cursor = await idx.openCursor(IDBKeyRange.only(viviendaId));
  while (cursor) {
    const ev = cursor.value as TreasuryEvent;
    const esViviendaDerivado =
      (ev.sourceType === 'gasto_recurrente' ||
        ev.sourceType === 'contrato' ||
        ev.sourceType === 'hipoteca') &&
      (ev.categoryKey === 'vivienda.alquiler' ||
        ev.categoryKey === 'vivienda.hipoteca' ||
        ev.categoryKey === 'vivienda.comunidad' ||
        ev.categoryKey === 'vivienda.ibi' ||
        ev.categoryKey === 'vivienda.seguros');
    if (esViviendaDerivado && ev.status === 'predicted') {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}
