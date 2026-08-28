// ============================================================================
// El almacén de previsiones de un compromiso · qué se retira y qué se emite
// ============================================================================
//
// Regenerar es siempre lo mismo en dos tiempos: retirar lo vivo y emitir lo
// nuevo. Las dos mitades tienen que conocer la MISMA regla de idempotencia —lo
// intocable ni se borra ni se reemite— y por eso viven juntas y aparte del
// servicio, que ya carga con el motor de fechas, los recibos de tarjeta y el
// ciclo de vida del gasto.
// ============================================================================

import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import { toISODateLocal } from '../../utils/recurrenceDateUtils';
import {
  claveOrigenPrevision,
  esPrevisionDeCompromiso,
  esPrevisionIntocable,
} from './previsionesIdempotencia';
import { loConservaElCiclo, periodosDelCiclo } from './vencidosDelCiclo';

const STORE_TREASURY = 'treasuryEvents';

/**
 * Borra las previsiones VIVAS (status='predicted', sin conciliar y sin
 * descartar) del compromiso indicado. Las confirmadas/ejecutadas (realidad
 * bancaria) y las descartadas (decisión del usuario) se respetan.
 *
 * `cicloQueConserva` (B9) · con el compromiso delante se salvan además los
 * VENCIDOS que su ciclo sigue contemplando. Sin él se borra todo lo vivo, que
 * es lo que quieren los caminos donde el gasto deja de proyectar entero
 * —eliminar, pasar a preparado, dar de baja—: allí no queda ciclo que aplicar.
 *
 * Hace falta porque el motor solo emite del mes en curso hacia delante: lo que
 * este borrado se lleve de meses anteriores no lo repone nadie. Ver
 * `vencidosDelCiclo.ts` para la regla.
 */
export async function borrarEventosFuturosCompromiso(
  compromisoId: number,
  cicloQueConserva?: CompromisoRecurrente,
): Promise<void> {
  const hoy = new Date();
  // El mismo borde desde el que reproyecta `generarEventosDesdeCompromiso`: de
  // ahí en adelante el ciclo reemite, y conservar sería lo contrario de
  // regenerar.
  const corte = toISODateLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const periodos = cicloQueConserva
    ? periodosDelCiclo(cicloQueConserva, '1900-01-01', corte)
    : new Set<string>();

  const db = await initDB();
  const tx = db.transaction(STORE_TREASURY, 'readwrite');
  const store = tx.objectStore(STORE_TREASURY);
  const idx = store.index('sourceId');
  let cursor = await idx.openCursor(IDBKeyRange.only(compromisoId));
  while (cursor) {
    const ev = cursor.value as TreasuryEvent;
    if (
      esPrevisionDeCompromiso(ev) &&
      !esPrevisionIntocable(ev) &&
      !loConservaElCiclo(ev, periodos, corte)
    ) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Persiste un lote de previsiones del compromiso saltándose las claves de
 * origen ya ocupadas. Se llama SIEMPRE después de
 * `borrarEventosFuturosCompromiso`: lo que ha sobrevivido al borrado es, por
 * definición, intocable, así que su periodo no se vuelve a emitir. Dedupe
 * también dentro del propio lote.
 */
export async function persistirPrevisionesCompromiso(
  compromisoId: number,
  eventos: Array<Omit<TreasuryEvent, 'id'>>,
): Promise<number> {
  if (eventos.length === 0) return 0;
  const db = await initDB();
  const tx = db.transaction(STORE_TREASURY, 'readwrite');
  const store = tx.objectStore(STORE_TREASURY);

  const supervivientes = (await store.index('sourceId').getAll(compromisoId)) as TreasuryEvent[];
  const ocupadas = new Set(
    supervivientes.filter(esPrevisionDeCompromiso).map(claveOrigenPrevision),
  );

  let creados = 0;
  for (const ev of eventos) {
    const clave = claveOrigenPrevision(ev);
    if (ocupadas.has(clave)) continue;
    ocupadas.add(clave);
    await store.add(ev as TreasuryEvent);
    creados += 1;
  }
  await tx.done;
  return creados;
}
