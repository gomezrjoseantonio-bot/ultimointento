// CANDADO A · cierra la Fase 0 de la conversión a DBSchema (TAREA-CC-DBSCHEMA-F0).
//
// Hoy `AtlasHorizonDB extends DBSchema`, así que `db.get('__no_existe__', 1)` es un
// error de compilación (nombre de store inválido). El `@ts-expect-error` lo consume
// y `tsc --noEmit` pasa. ANTES de la Fase 0 (StoreNames=string) esa línea NO era
// error, el `@ts-expect-error` quedaba sin consumir y `tsc` fallaba.
//
// El propio `tsc --noEmit` es el semáforo: si algún día la interfaz deja de extender
// DBSchema (regresión), esta directiva vuelve a quedar sin usar y el build rompe.
import { initDB } from '../db';

export async function candadoNombres() {
  const db = await initDB();
  // @ts-expect-error — debe fallar en compilación cuando AtlasHorizonDB extienda DBSchema
  await db.get('__no_existe__', 1);
}
