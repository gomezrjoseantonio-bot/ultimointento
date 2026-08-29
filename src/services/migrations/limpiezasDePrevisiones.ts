// ============================================================================
// Las limpiezas de previsiones inventadas · una puerta para las dos
// ============================================================================
//
// Dos migraciones hermanas que retiran previsiones que nunca debieron existir:
//
//   · las que C1 (#1819) fabricó hacia atrás, para meses anteriores al mes en
//     que nacieron;
//   · las anteriores a la APERTURA de su cuenta, que el motor emitía por
//     proyectar siempre desde el día 1 del mes sin mirar desde cuándo existe la
//     cuenta.
//
// Cada una tiene su propia frontera y su propio módulo, que es donde se explica
// qué borra y qué respeta. Aquí solo viven el flag, el recibo y el aislamiento
// del fallo, que son idénticos en las dos y no merecen escribirse dos veces.
//
// Un fallo de una limpieza NO puede tumbar la apertura de la base: se traga, se
// avisa por consola y se sigue. Y borrar no se deshace, así que cada una deja
// su recibo en `keyval` — mismo criterio que la V88 de tarjetas.
// ============================================================================

import type { IDBPDatabase } from 'idb';
import { limpiarPrevisionesRetroactivas } from './limpiarPrevisionesRetroactivas';
import { limpiarPrevistosAntesDeLaApertura } from './limpiarPrevistosAntesDeLaApertura';

/** Lo que toda limpieza devuelve · cuántas se llevó, para saber si hubo recibo. */
type ConRecuento = { fecha: string } & ({ borradas: number } | { borrados: number });

const cuantas = (r: ConRecuento): number =>
  'borradas' in r ? r.borradas : r.borrados;

/**
 * Corre una limpieza una sola vez en la vida de esta base.
 *
 * El flag es una optimización, no la única defensa: las dos limpiezas son
 * idempotentes por sí mismas, así que correrlas de más no rompe nada.
 */
async function unaVez<T extends ConRecuento>(
  db: IDBPDatabase<any>,
  flag: string,
  claveDelRecibo: string,
  etiqueta: string,
  limpieza: (db: IDBPDatabase<any>) => Promise<T>,
): Promise<void> {
  try {
    if ((await db.get('keyval', flag)) === 'completed') return;
    const recibo = await limpieza(db);
    if (cuantas(recibo) > 0) {
      console.log(`[DB ${etiqueta}] ${cuantas(recibo)} previsión(es) retirada(s)`, recibo);
      await db.put('keyval', recibo, claveDelRecibo);
    }
    await db.put('keyval', 'completed', flag);
  } catch (err) {
    console.warn(`[DB ${etiqueta}] limpieza falló:`, err);
  }
}

/** Las dos limpiezas, en orden y cada una con su flag. */
export async function ejecutarLimpiezasDePrevisiones(db: IDBPDatabase<any>): Promise<void> {
  await unaVez(
    db,
    'migration_limpieza_previsiones_retroactivas_v1',
    'recibo_limpieza_previsiones_retroactivas',
    'limpieza C1',
    limpiarPrevisionesRetroactivas,
  );
  await unaVez(
    db,
    'migration_limpieza_previstos_antes_apertura_v1',
    'recibo_limpieza_previstos_antes_apertura',
    'limpieza apertura',
    limpiarPrevistosAntesDeLaApertura,
  );
}
