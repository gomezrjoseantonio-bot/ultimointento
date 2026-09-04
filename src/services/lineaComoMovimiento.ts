// ============================================================================
// E1.4b · la línea del extracto, vista como un movimiento EN MEMORIA
// ============================================================================
//
// El matcheo (`matchBatch`, `suggestForUnmatched`, `reconocerDeterministas`,
// la conciliación con confirmados) habla en `Movement`. Hasta E1.4b solo podía
// alimentarse con movimientos ya INSERTADOS, releídos por id. Aquí se le da la
// otra puerta: a partir de una fila de `lineasExtracto` (E1.1) se construye el
// mismo `Movement` que `insertMovements` habría creado, con los mismos campos,
// pero sin escribir nada. El matcheo no distingue uno de otro.
//
// El `id` del movimiento en memoria ES el `lineaId`. Así todo lo que el matcheo
// devuelve «por movementId» se lee directamente como «por lineaId», que es lo
// que la sesión (E1.2) y E1.5 consumen. La traducción a movimientos reales,
// cuando haga falta, sale de `linea.movementIds` (plural · §16.4: una línea
// puede haber engendrado varios).
//
// Precedente: el extracto de tarjeta (`conciliarExtractoTarjeta.ts`), que se
// LEE y EMPAREJA sin escribir.
//
// Lo que NO hace: activar la puerta. El orquestador sigue insertando y
// emparejando por movimiento (E1.1). Cruzar la puerta es E1.5.
// ============================================================================

import type { Movement } from './db';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';
import { contraparteDeBizum, pareceBizum } from './bizum';
import type { MatchResult, MatchScore } from './movementMatchingService';
import type { MovementSuggestion } from './movementSuggestionService';
import type { LoQueSeReconoce } from './deterministas/matcheoDeterminista';
import type { AtribucionDeterminista, OrigenDeterminista } from './deterministas/tipos';

/**
 * ¿Entra esta línea al matcheo?
 *
 * Igual que hoy: una fila descartada (`duplicada`, `sin_fecha`, `sin_importe`)
 * no tiene movimiento y por tanto nunca llega al matcheo; y sin `id` no hay
 * por dónde referirla. Es el mismo conjunto que hoy tiene `movementIds` no
 * vacío.
 */
export function entraAlMatcheo(linea: LineaExtractoPersistida): boolean {
  return linea.id != null && !linea.descarte;
}

/**
 * El `Movement` que `insertMovements` habría creado para esta línea · en
 * memoria, sin tocar la base. Mismos campos, mismos valores por defecto.
 *
 * `id` = `linea.id` (ver cabecera). Pura.
 */
export function movementDesdeLinea(linea: LineaExtractoPersistida): Movement {
  const description = linea.conceptoLiteral;
  const amount = linea.importe;
  return {
    id: linea.id,
    accountId: linea.accountId,
    date: linea.fechaOperacion,
    valueDate: linea.fechaValor || linea.fechaOperacion,
    amount,
    description,
    // Lo que venga en la columna del fichero manda; si no, se lee del texto
    // (los Bizum lo traen dentro). Es lo mismo que hace `insertMovements`.
    counterparty: linea.contraparte ?? contraparteDeBizum(description),
    ...(pareceBizum(description) ? { paymentMethod: 'Bizum' as const } : {}),
    reference: linea.referencia,
    balance: linea.saldo,
    currency: linea.divisa,
    unifiedStatus: 'no_planificado',
    source: 'import',
    type: amount >= 0 ? 'Ingreso' : 'Gasto',
    origin: 'CSV',
    movementState: 'Confirmado',
    state: 'pending',
    status: 'pendiente',
    category: { tipo: amount >= 0 ? 'Ingresos' : 'Gastos' },
    tags: [],
    isAutoTagged: false,
    ambito: 'PERSONAL',
    statusConciliacion: 'sin_match',
    importBatch: linea.importBatchId,
    createdAt: linea.createdAt,
    updatedAt: linea.updatedAt,
  };
}

/** Las líneas que entran, como movimientos en memoria · en el mismo orden. */
export function movimientosDesdeLineas(lineas: LineaExtractoPersistida[]): Movement[] {
  return lineas.filter(entraAlMatcheo).map(movementDesdeLinea);
}

// ─── Lo que devuelve el matcheo, dicho por lineaId ───────────────────────────
//
// Son las mismas formas que devuelven los servicios, con `movementId`
// renombrado a `lineaId`. No se interpreta nada: es un cambio de nombre para
// que quien lo consuma no tenga que saber que el id en memoria era el de la
// línea.

export interface CuadrePorLinea {
  lineaId: number;
  treasuryEventId: number;
  score: number;
  reasons: string[];
}

export interface MatchResultPorLinea {
  matches: CuadrePorLinea[];
  multiMatches: { lineaId: number; candidates: CuadrePorLinea[] }[];
  sinMatch: number[];
}

export type SugerenciaPorLinea = Omit<MovementSuggestion, 'movementId'> & { lineaId: number };

export type OrigenPorLinea = Omit<OrigenDeterminista, 'movementId'> & { lineaId: number };
export type AtribucionPorLinea = Omit<AtribucionDeterminista, 'movementId'> & { lineaId: number };

export interface LoQueSeReconocePorLinea {
  origenes: Map<number, OrigenPorLinea>;
  atribuciones: Map<number, AtribucionPorLinea>;
}

function cuadrePorLinea(m: MatchScore): CuadrePorLinea {
  const { movementId, ...resto } = m;
  return { lineaId: movementId, ...resto };
}

export function matchResultPorLinea(r: MatchResult): MatchResultPorLinea {
  return {
    matches: r.matches.map(cuadrePorLinea),
    multiMatches: r.multiMatches.map((mm) => ({
      lineaId: mm.movementId,
      candidates: mm.candidates.map(cuadrePorLinea),
    })),
    sinMatch: [...r.sinMatch],
  };
}

export function sugerenciasPorLinea(
  r: Map<number, MovementSuggestion[]>
): Map<number, SugerenciaPorLinea[]> {
  const out = new Map<number, SugerenciaPorLinea[]>();
  for (const [lineaId, sugerencias] of r) {
    out.set(
      lineaId,
      sugerencias.map(({ movementId, ...resto }) => ({ lineaId: movementId, ...resto }))
    );
  }
  return out;
}

export function reconocidoPorLinea(r: LoQueSeReconoce): LoQueSeReconocePorLinea {
  const origenes = new Map<number, OrigenPorLinea>();
  for (const [lineaId, { movementId, ...resto }] of r.origenes) {
    origenes.set(lineaId, { lineaId: movementId, ...resto });
  }
  const atribuciones = new Map<number, AtribucionPorLinea>();
  for (const [lineaId, { movementId, ...resto }] of r.atribuciones) {
    atribuciones.set(lineaId, { lineaId: movementId, ...resto });
  }
  return { origenes, atribuciones };
}

// ─── La traducción a movimientos, cuando haga falta ─────────────────────────

/**
 * `lineaId → movementIds` · los movimientos que HOY nacieron de cada línea.
 *
 * Plural a propósito (§16.4 · pago múltiple): una línea puede haber engendrado
 * varios movimientos, y quien traduzca un resultado por línea a movimientos
 * tiene que repartirlo entre todos. Vacío para una línea sin movimiento (lo
 * normal en E1.5).
 */
export function movementIdsPorLinea(lineas: LineaExtractoPersistida[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const l of lineas) {
    if (l.id == null) continue;
    out.set(l.id, [...l.movementIds]);
  }
  return out;
}

/**
 * Un origen reconocido por línea, dicho para UN movimiento concreto · es lo
 * que `confirmDecisions.approvedDeterministic` sigue esperando.
 */
export function origenParaMovimiento(origen: OrigenPorLinea, movementId: number): OrigenDeterminista {
  const { lineaId, ...resto } = origen;
  void lineaId;
  return { movementId, ...resto };
}
