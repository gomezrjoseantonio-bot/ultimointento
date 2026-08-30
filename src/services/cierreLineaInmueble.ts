// ============================================================================
// Cerrar la línea fiscal cuando su previsión se cumple
// ============================================================================
//
// Un gasto de inmueble vive en dos sitios a la vez: la previsión de tesorería
// (`treasuryEvents`) y la línea que declara (`gastosInmueble`). Cuando el pago
// ocurre de verdad hay que cerrar los dos, y esto ha fallado ya DOS veces, por
// el mismo motivo las dos: cada camino se lo montaba por su cuenta.
//
// #1810 · subir el extracto NO cerraba la línea (puntear a mano sí). Los dos
// dejaban bien el evento y el movimiento, así que en tesorería no se notaba; se
// notó en la declaración, porque `yaOcurrio` (#1809) decide qué deduce mirando
// `estado`, `estadoTesoreria` y `movimientoId` de la línea. Se arregló trayendo
// el cierre del extracto aquí.
//
// Y quedó a medias: el punteo manual siguió con SU búsqueda, solo por
// `treasuryEventId`. Una línea de gasto recurrente nace sin ese enlace
// (`origen`+`origenId`, `operacionFiscalService:344`), así que al puntearla no
// la encontraba y creaba una segunda — el mismo recibo deducido dos veces. Lo
// fija `punteoManualCierraLinea.test.ts`.
//
// De ahí que aquí vivan las DOS piezas y no solo los campos:
//
//   · `buscarLineaDelEvento` · CUÁL es la línea (por enlace o por origen)
//   · `camposDeCierre`       · QUÉ se le escribe
//
// Los tres caminos —extracto, punteo y alta a mano— entran por aquí. Tener dos
// versiones de cualquiera de las dos piezas es exactamente cómo nació esto, las
// dos veces.
//
// Y cerrar no basta: hay que escribir el dato REAL. La jerarquía es
//
//   conciliado (banco) > confirmado (punteo) > previsto (estimación)
//
// así que al conciliar, el importe y la fecha del extracto sobrescriben lo que
// la línea trajera. Cerrarla conservando la estimación —lo que se hacía hasta
// ahora— deducía 82,00 € cuando el banco había cargado 87,40 €.
// ============================================================================

import type { GastoInmueble, Movement, TreasuryEvent } from './db';

/**
 * Lo que hace falta saber del movimiento real · un `Movement` entero pide de
 * más y ata el módulo a un tipo que no necesita.
 *
 * `date` es la fecha de CARGO (la que fija el ejercicio, criterio caja) y
 * `valueDate` la fecha valor, que se guarda aparte para no perderla.
 *
 * `accountId` se relaja a opcional respecto de `Movement`: el punteo manual
 * puede estar confirmando una previsión cuya cuenta aún no se resolvió, y ahí
 * no se escribe cuenta en vez de inventarse una.
 */
export type MovimientoReal = Pick<Movement, 'id' | 'amount' | 'date' | 'valueDate'> & {
  accountId?: number;
};

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
 * Lo mínimo de un object store para BUSCAR la línea. Con esta forma sirven los
 * dos sitios desde donde se busca: el `objectStore` de una transacción abierta
 * (punteo manual) y un adaptador sobre `DbParaCierre` (extracto).
 */
export interface StoreParaBuscar {
  index(nombre: string): { getAll(clave: unknown): Promise<unknown[]> };
  getAll(): Promise<unknown[]>;
}

/** Adapta una `DbParaCierre` a la forma de store que espera la búsqueda. */
export const storeDesdeDb = (db: DbParaCierre, store: string): StoreParaBuscar => ({
  index: (nombre: string) => ({
    getAll: (clave: unknown) => db.getAllFromIndex(store, nombre, clave),
  }),
  getAll: () => db.getAll(store),
});

/**
 * Encuentra la línea que le toca a un evento · **el único sitio donde se busca**.
 *
 * Existe porque tener dos búsquedas fue el bug: el extracto miraba por las dos
 * vías y el punteo manual solo por `treasuryEventId`, así que al puntear un
 * recurrente no encontraba su línea del mes —que aún no tiene ese enlace— y
 * creaba una segunda. El mismo recibo deducido dos veces en la declaración,
 * que es justo lo que `altaMovimientoService:423-428` evita en su camino.
 *
 * Las dos vías, en este orden y no en el otro:
 *   1. `treasuryEventId` · el enlace explícito de una línea ya punteada.
 *   2. `origen:'recurrente'` + `origenId` · la que escribió el generador de
 *      recurrentes (`operacionFiscalService:344`), que NO lleva el enlace.
 *
 * El explícito manda sobre el derivado: buscar antes por `origenId` podría
 * cerrar otra línea cuando conviven las dos.
 *
 * Devuelve `undefined` si no hay ninguna — quien llame decide si eso significa
 * "no hay nada que cerrar" (extracto) o "hay que crearla" (punteo manual).
 */
export async function buscarLineaDelEvento<
  T extends { treasuryEventId?: number; origen?: string; origenId?: string },
>(store: StoreParaBuscar, evento: TreasuryEvent): Promise<T | undefined> {
  if (evento.id == null) return undefined;

  // 1 · Por el enlace explícito. El índice `treasuryEventId` no existe en
  // `gastosInmueble` (`upgrade-a.ts:124-130`), así que el camino real es el
  // escaneo; se intenta el índice igualmente por si alguna base lo tuviera.
  let linea: T | undefined;
  try {
    const porEvento = (await store.index('treasuryEventId').getAll(evento.id)) as T[];
    linea = porEvento?.[0];
  } catch {
    try {
      const todas = (await store.getAll()) as T[];
      linea = todas?.find((l) => l?.treasuryEventId === evento.id);
    } catch {
      // sin base que leer · se intenta la otra vía
    }
  }
  if (linea) return linea;

  // 2 · Por el origen del recurrente. `origenIdRecurrenteDeEvento` devuelve
  // null salvo para `gasto_recurrente`, así que mejoras y mobiliario —que no
  // tienen `origen`/`origenId`— salen por aquí sin tocar nada.
  const origenId = origenIdRecurrenteDeEvento(evento);
  if (origenId == null) return undefined;
  try {
    const porOrigen = (await store
      .index('origen-origenId')
      .getAll(['recurrente', origenId])) as T[];
    return porOrigen?.[0];
  } catch {
    return undefined;
  }
}

/** Campos que escribe el cierre · los mismos por los tres caminos. */
export type CamposDeCierre = Pick<
  GastoInmueble,
  | 'estado'
  | 'estadoTesoreria'
  | 'movimientoId'
  | 'treasuryEventId'
  | 'importe'
  | 'fecha'
  | 'fechaValor'
  | 'ejercicio'
  | 'cuentaBancaria'
>;

/**
 * Lo que se escribe al cerrar · los mismos campos que pone el punteo manual,
 * que consume esta función para que no puedan volver a divergir.
 *
 * Dos bloques:
 *   · el CIERRE (`estado`, `estadoTesoreria`, `movimientoId`) es lo que lee
 *     `yaOcurrio` para decidir que el gasto se deduce, y `treasuryEventId` lo
 *     que permite encontrar la línea después —al desconciliar, por ejemplo—
 *     sin volver a derivar la clave;
 *   · el DATO REAL (`importe`, `fecha`, `ejercicio`, `fechaValor`,
 *     `cuentaBancaria`) es lo que de verdad pasó, y manda sobre lo previsto.
 *
 * `importe` va en MAGNITUD: el signo vive en el movimiento (negativo si es un
 * cargo) y la línea de gasto siempre declara positivo, como el resto de
 * escritores. El `ejercicio` sale de la fecha de CARGO y nunca de la fecha
 * valor: es el criterio de caja, y un cargo del 3 de enero es gasto del año
 * nuevo aunque se previera para el 28 de diciembre.
 *
 * `eventId` es opcional porque una línea puede colapsarse contra un movimiento
 * que no nació de ninguna previsión (un alta a mano): ahí no hay evento al que
 * atarla y no se inventa uno.
 */
export function camposDeCierre(
  movimiento: MovimientoReal,
  eventId?: number | null,
): CamposDeCierre {
  const fecha = String(movimiento.date).slice(0, 10);
  return {
    estado: 'confirmado',
    estadoTesoreria: 'confirmed',
    movimientoId: movimiento.id != null ? String(movimiento.id) : undefined,
    ...(eventId != null ? { treasuryEventId: eventId } : {}),
    importe: Math.abs(movimiento.amount),
    fecha,
    ejercicio: Number(fecha.slice(0, 4)),
    ...(movimiento.valueDate
      ? { fechaValor: String(movimiento.valueDate).slice(0, 10) }
      : {}),
    ...(movimiento.accountId != null
      ? { cuentaBancaria: String(movimiento.accountId) }
      : {}),
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
 * Cierra la línea de gasto de inmueble que corresponde a este evento, si la hay,
 * y le escribe el importe y la fecha REALES del movimiento.
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
  movimiento: MovimientoReal,
): Promise<boolean> {
  if (evento.id == null) return false;
  // Un gasto personal no tiene línea de inmueble que cerrar. Se comprueba
  // antes de buscar y no después: el `origenId` de un recurrente se construye
  // igual en los dos ámbitos, y sin esta guarda un evento personal podría
  // llegar a mirar —y en el peor caso pisar— la línea de un inmueble.
  if (evento.ambito !== 'INMUEBLE') return false;

  const linea = await buscarLineaDelEvento<GastoInmueble>(storeDesdeDb(db, 'gastosInmueble'), evento);
  if (!linea) return false;

  if (!aceptaCierre(linea)) return false;

  await db.put('gastosInmueble', {
    ...linea,
    ...camposDeCierre(movimiento, evento.id),
    updatedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Repunta al movimiento nuevo las líneas que apuntaban a uno que va a
 * desaparecer, escribiéndoles de paso el dato real. Devuelve cuántas movió.
 *
 * Es el caso del colapso (`reconciliarConfirmado`): la línea del extracto y un
 * Confirmado ya punteado son la MISMA operación, sobrevive la del extracto y el
 * confirmado se borra. La línea de gasto le apuntaba por `movimientoId`, así
 * que sin esto se quedaba señalando un id que ya no existe —y encima con el
 * importe previsto, cuando el banco acababa de decir el real.
 *
 * Se busca por `movimientoId` y no por el evento a propósito: un Confirmado
 * puede no venir de ninguna previsión (un alta a mano), y su línea hay que
 * repuntarla igual.
 */
export async function repuntarLineasAlMovimiento(
  db: DbParaCierre,
  movimientoAnteriorId: number,
  movimiento: MovimientoReal,
): Promise<number> {
  let todas: GastoInmueble[];
  try {
    todas = (await db.getAll('gastosInmueble')) as GastoInmueble[];
  } catch {
    return 0;
  }

  const ahora = new Date().toISOString();
  let movidas = 0;

  for (const linea of todas ?? []) {
    // `movimientoId` es `string` en el tipo, pero hay líneas viejas que lo
    // guardaron como número. Comparar solo por cadena las dejaría huérfanas,
    // que es justo el fallo que esto viene a arreglar.
    if (linea?.movimientoId == null) continue;
    if (Number(linea.movimientoId) !== movimientoAnteriorId) continue;
    // Misma guarda que el cierre: un ejercicio ya declarado es verdad
    // consumida y no se reescribe, ni siquiera para repuntarlo.
    if (!aceptaCierre(linea)) continue;
    await db.put('gastosInmueble', {
      ...linea,
      ...camposDeCierre(movimiento, linea.treasuryEventId),
      updatedAt: ahora,
    });
    movidas += 1;
  }

  return movidas;
}
