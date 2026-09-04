// ============================================================================
// E1.5 · MATERIALIZAR una línea · el único sitio donde NACE un movimiento
// ============================================================================
//
// Tras el corte, importar guarda la línea (`lineasExtracto`) y NO crea el
// movimiento. El `Movement` nace SOLO al resolver la línea —cuadrarla con un
// previsto, reconocerla contra un libro, clasificarla desde la ficha, hacerla
// traspaso—, y todos esos caminos pasan por aquí. Cinco puntos de creación,
// una sola implementación (E1.5-preflight §2).
//
// Lo que garantiza, y por qué:
//   · el movimiento se crea SIN id (`movementNuevoDesdeLinea`) y el store lo
//     asigna · mina M1: usar `linea.id` como id pisaría un movimiento ajeno;
//   · la línea queda ENLAZADA en el mismo paso (`movementIds`, `estado:
//     'resuelta'`, `comoSeResolvio`) · mina M3: una línea con movimiento y
//     `movementIds` vacío contaría dos veces en el saldo;
//   · es IDEMPOTENTE · si la línea ya tiene su movimiento (reintento de un
//     Guardar que falló a medias, ficha y luego traspaso sobre la misma línea)
//     se devuelve el que hay y no nace otro;
//   · el movimiento hereda `importBatch` de la línea · mina M10: «salir sin
//     guardar» tiene que poder borrarlo con el lote.
//
// D2 · `movementIds` guarda SOLO los movimientos de la cuenta de la línea. La
// pata de entrada de un traspaso vive en la otra cuenta y la cuenta esa otra
// cuenta: aquí solo se enlaza el que nace de ESTA línea (§16.4 · Σ importes de
// `movementIds` = `importe`).
// ============================================================================

import type { Movement } from './db';
import type { ComoSeResolvioLinea, LineaExtractoPersistida } from './db/types-lineasExtracto';
import { movementNuevoDesdeLinea } from './lineaComoMovimiento';

/** Lo mínimo de la base · el handle real y los mocks lo cumplen. */
export interface BaseParaMaterializar {
  get(store: string, key: unknown): Promise<unknown>;
  put(store: string, valor: unknown): Promise<unknown>;
  add(store: string, valor: unknown): Promise<unknown>;
}

export class LineaNoEncontradaError extends Error {
  constructor(lineaId: number) {
    super(`E1.5 · la línea ${lineaId} no existe en lineasExtracto`);
    this.name = 'LineaNoEncontradaError';
  }
}

export interface Materializada {
  movement: Movement;
  /** `true` si el movimiento acaba de nacer · `false` si la línea ya lo tenía. */
  nuevo: boolean;
}

/**
 * El movimiento de una línea · el que ya tiene, o uno nuevo si aún no lo
 * tenía. Escribe la línea enlazada en el mismo paso.
 */
export async function materializarLinea(
  db: BaseParaMaterializar,
  lineaId: number,
  ahora: string,
  como: ComoSeResolvioLinea
): Promise<Materializada> {
  const linea = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
  if (!linea) throw new LineaNoEncontradaError(lineaId);

  // Ya tiene movimiento · se devuelve el que hay (idempotencia).
  for (const id of linea.movementIds ?? []) {
    const existente = (await db.get('movements', id)) as Movement | undefined;
    if (existente) return { movement: existente, nuevo: false };
  }

  const sinId = movementNuevoDesdeLinea(linea);
  const id = Number(await db.add('movements', { ...sinId, createdAt: ahora, updatedAt: ahora }));
  const movement: Movement = { ...sinId, id, createdAt: ahora, updatedAt: ahora };
  await enlazarLinea(db, linea, [id], ahora, como);
  return { movement, nuevo: true };
}

/**
 * Enlaza una línea a movimientos que YA existen · D1: cuando la línea es la
 * que confirma un Confirmado que el usuario ya tenía, no nace nada: la línea
 * apunta a ese movimiento y deja de sumar por sí misma.
 */
export async function enlazarLineaAMovimiento(
  db: BaseParaMaterializar,
  lineaId: number,
  movementIds: number[],
  ahora: string,
  como: ComoSeResolvioLinea
): Promise<void> {
  const linea = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
  if (!linea) throw new LineaNoEncontradaError(lineaId);
  await enlazarLinea(db, linea, movementIds, ahora, como);
}

async function enlazarLinea(
  db: BaseParaMaterializar,
  linea: LineaExtractoPersistida,
  movementIds: number[],
  ahora: string,
  como: ComoSeResolvioLinea
): Promise<void> {
  await db.put('lineasExtracto', {
    ...linea,
    movementIds: [...movementIds],
    estado: 'resuelta',
    comoSeResolvio: como,
    updatedAt: ahora,
  } as LineaExtractoPersistida);
}
