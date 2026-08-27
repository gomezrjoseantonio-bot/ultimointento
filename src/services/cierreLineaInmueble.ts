// ============================================================================
// Cerrar la línea fiscal cuando su previsión se cumple
// ============================================================================
//
// Un gasto de inmueble vive en dos sitios a la vez: la previsión de tesorería
// (`treasuryEvents`) y la línea que declara (`gastosInmueble`). Cuando el pago
// ocurre de verdad hay que cerrar los dos, y hasta ahora solo uno de los dos
// caminos lo hacía:
//
//   · puntear a mano  (`confirmTreasuryEvent`) → cerraba la línea
//   · subir el extracto (`bankStatementOrchestrator`) → NO la cerraba
//
// Los dos dejaban bien el evento y el movimiento, así que en tesorería no se
// notaba. Se notó en la declaración: desde que `yaOcurrio` (#1809) decide qué
// deduce mirando `estado`, `estadoTesoreria` y `movimientoId` de la línea,
// conciliar con el fichero del banco —el gesto normal— dejaba el gasto en
// `previsto` y fuera de las casillas.
//
// El cierre vive aquí, en un módulo hoja, para que los dos caminos escriban lo
// MISMO. Escrito dos veces volvería a divergir, que es exactamente cómo nació
// esto.
// ============================================================================

import type { GastoInmueble, TreasuryEvent } from './db';

/** Lo mínimo de la base que hace falta · así se puede probar sin IndexedDB. */
export interface DbParaCierre {
  getAllFromIndex(store: string, index: string, clave: unknown): Promise<unknown[]>;
  getAll(store: string): Promise<unknown[]>;
  put(store: string, valor: unknown): Promise<unknown>;
}

/**
 * La clave con la que el generador de recurrentes nombra la línea del mes.
 *
 * Hace falta porque las líneas de gasto se enlazan al evento de DOS maneras
 * distintas según quién las creó:
 *
 *   · las que nacen de puntear llevan `treasuryEventId`
 *     (`treasuryConfirmationService:421`),
 *   · las que nacen del gasto recurrente NO lo llevan: se identifican por
 *     `origen: 'recurrente'` + este `origenId` (`operacionFiscalService:275`).
 *
 * Buscar solo por `treasuryEventId` no encontraría nunca las segundas, que son
 * justo las del caso que este módulo viene a arreglar.
 */
export function origenIdRecurrenteDeEvento(evento: TreasuryEvent): string | null {
  if (evento.sourceType !== 'gasto_recurrente') return null;
  const { sourceId, año, mes } = evento as TreasuryEvent & { año?: number; mes?: number };
  if (sourceId == null || año == null || mes == null) return null;
  return `recurrente-${sourceId}-${año}-${mes}`;
}

/**
 * Lo que se escribe al cerrar · los mismos campos que pone el punteo manual
 * (`treasuryConfirmationService:412-421`).
 *
 * Los tres primeros son los que lee `yaOcurrio`. El cuarto deja la línea atada
 * al evento, que es lo que permite encontrarla después —al desconciliar, por
 * ejemplo— sin volver a derivar la clave.
 */
export function camposDeCierre(
  movementId: number,
  eventId: number,
): Pick<GastoInmueble, 'estado' | 'estadoTesoreria' | 'movimientoId' | 'treasuryEventId'> {
  return {
    estado: 'confirmado',
    estadoTesoreria: 'confirmed',
    movimientoId: String(movementId),
    treasuryEventId: eventId,
  };
}

/**
 * ¿Se le puede cerrar a esta línea?
 *
 * A todas menos a las de un ejercicio ya declarado: eso es verdad consumida y
 * pasarlo a `confirmado` degradaría el dato que se presentó. Además el resumen
 * fiscal de un año declarado sale del snapshot AEAT congelado
 * (`fiscalSummaryService:128-130`), no de estas líneas, así que cerrarlas no
 * arreglaría nada y sí borraría una marca.
 */
export function aceptaCierre(linea: GastoInmueble | null | undefined): boolean {
  if (!linea) return false;
  return linea.estado !== 'declarado';
}

/**
 * Cierra la línea de gasto de inmueble que corresponde a este evento, si la hay.
 *
 * **Solo cierra lo que ya existe · nunca crea.** El punteo manual sí crea la
 * línea cuando falta, porque el usuario está declarando un gasto que no estaba;
 * aquí crearla duplicaría el gasto del recurrente —una `previsto` con su
 * `origenId` y otra `confirmado` al lado—, que es peor que el fallo que
 * arregla.
 *
 * Devuelve si cerró algo.
 */
export async function cerrarLineaDeGastoDelEvento(
  db: DbParaCierre,
  evento: TreasuryEvent,
  movementId: number,
): Promise<boolean> {
  if (evento.id == null) return false;
  // Un gasto personal no tiene línea de inmueble que cerrar. Se comprueba
  // antes de buscar y no después: el `origenId` de un recurrente se construye
  // igual en los dos ámbitos, y sin esta guarda un evento personal podría
  // llegar a mirar —y en el peor caso pisar— la línea de un inmueble.
  if (evento.ambito !== 'INMUEBLE') return false;

  let linea: GastoInmueble | undefined;

  // 1 · La que ya está atada al evento (nació de un punteo anterior).
  //
  // `gastosInmueble` NO tiene índice por `treasuryEventId` (`upgrade-a.ts:124-130`),
  // así que el camino real es el escaneo. Se intenta el índice igualmente por si
  // alguna base lo tuviera, con el mismo patrón que `findLineByTreasuryEventId`
  // en `treasuryConfirmationService:214`.
  //
  // El escaneo se paga una vez por movimiento cuadrado y no se deja para el
  // final a propósito: el enlace explícito manda sobre el derivado, y buscar
  // antes por `origenId` podría cerrar otra línea cuando conviven las dos.
  try {
    const porEvento = (await db.getAllFromIndex(
      'gastosInmueble',
      'treasuryEventId',
      evento.id,
    )) as GastoInmueble[];
    linea = porEvento?.[0];
  } catch {
    try {
      const todas = (await db.getAll('gastosInmueble')) as GastoInmueble[];
      linea = todas?.find((l) => l?.treasuryEventId === evento.id);
    } catch {
      // sin base que leer · se intenta la otra vía
    }
  }

  // 2 · La del gasto recurrente, que no lleva el enlace.
  if (!linea) {
    const origenId = origenIdRecurrenteDeEvento(evento);
    if (origenId == null) return false;
    try {
      const porOrigen = (await db.getAllFromIndex('gastosInmueble', 'origen-origenId', [
        'recurrente',
        origenId,
      ])) as GastoInmueble[];
      linea = porOrigen?.[0];
    } catch {
      return false;
    }
  }

  if (!aceptaCierre(linea)) return false;

  await db.put('gastosInmueble', {
    ...linea,
    ...camposDeCierre(movementId, evento.id),
    updatedAt: new Date().toISOString(),
  });
  return true;
}
