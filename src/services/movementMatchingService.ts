// TAREA 17 sub-task 17.2 · Movement matching service.
//
// Given a batch of bank movement IDs (just imported), proposes pairings against
// previously forecasted treasuryEvents that are still unmatched. The service
// is pure analysis: it never mutates `movements` or `treasuryEvents`. The
// orchestrator (sub-tarea 17.5) applies the user-approved matches.
//
// The actual codebase models the unmatched-event state as `status === 'predicted'`
// (see src/services/db.ts TreasuryEvent type + treasuryConfirmationService),
// even though spec §1.3 refers to it as 'pending'. We use the canonical value.
import { esConciliable } from './descarteDePrevision';
import { initDB, Movement, TreasuryEvent } from './db';
import { pareceBizum, contraparteDeBizum } from './bizum';
import { claveDeNombre, nivelDeCoincidencia } from './coincidenciaNombre';
import { cargarAliasContraparte, nombreDeContraparte } from './movementLearningService';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';
import { matchResultPorLinea, movimientosDesdeLineas, type MatchResultPorLinea } from './lineaComoMovimiento';

/**
 * Los alias que el usuario ya enseñó · clave del nombre que manda el banco →
 * claves de las personas a las que lo ha confirmado.
 */
type AliasContraparte = Map<string, Set<string>>;

export type MatchScore = {
  movementId: number;
  treasuryEventId: number;
  score: number;
  reasons: string[];
};

export type MatchResult = {
  matches: MatchScore[];
  multiMatches: { movementId: number; candidates: MatchScore[] }[];
  sinMatch: number[];
};

export interface MatchOptions {
  fechaWindowDays?: number;
  amountTolerancePercent?: number;
  scoreThreshold?: number;
}

const DEFAULT_OPTIONS: Required<MatchOptions> = {
  fechaWindowDays: 5,
  amountTolerancePercent: 1,
  scoreThreshold: 70,
};

// Cuánto tiene que sacar el primer candidato al segundo para cuadrar SOLO (en
// vez de pedir elegir). Es un bonus de nombre completo (descripcion_proveedor o
// alias_aprendido = 25): quien lleva el nombre gana; un parecido flojo, no.
const MARGEN_GANADOR_CLARO = 20;

interface ScoredCandidate {
  movementId: number;
  treasuryEventId: number;
  score: number;
  reasons: string[];
  daysDiff: number;
  /** Clave de SERIE del previsto · colapsa las instancias mensuales de un recurrente. */
  serieKey: string;
}

/**
 * Ventana ancha para el IMPORTE EXACTO. Un recibo mensual se carga el día que el
 * banco quiere, que puede caer semanas lejos del día previsto; con ±5 no se veía
 * su previsión y no cuadraba nada. Con importe clavado, mirar todo el mes es
 * seguro —y la serie se colapsa a su instancia más cercana antes de decidir—.
 */
const VENTANA_IMPORTE_EXACTO_DIAS = 35;

/** Clave de serie de un previsto · igual criterio que el picker de asignación. */
function serieDeEvento(e: TreasuryEvent): string {
  const quien = (e.providerName ?? e.counterparty ?? e.description ?? '').trim().toLowerCase();
  const cuanto = Math.round(Math.abs(e.actualAmount ?? e.amount) * 100);
  const donde = e.inmuebleId ?? '';
  const que = e.categoryKey ?? e.sourceType ?? '';
  return `${quien}|${cuanto}|${donde}|${que}`;
}

export async function matchBatch(
  movementIds: number[],
  options?: MatchOptions
): Promise<MatchResult> {
  const opts: Required<MatchOptions> = { ...DEFAULT_OPTIONS, ...options };

  if (movementIds.length === 0) {
    return { matches: [], multiMatches: [], sinMatch: [] };
  }

  const db = await initDB();

  const movements: Movement[] = [];
  for (const id of movementIds) {
    const mov = (await db.get('movements', id)) as Movement | undefined;
    if (mov && mov.id != null) movements.push(mov);
  }
  if (movements.length === 0) {
    return { matches: [], multiMatches: [], sinMatch: [] };
  }

  return emparejarEnMemoria(db, movements, opts);
}

/**
 * E1.4b · la misma entrada, por LÍNEA del extracto.
 *
 * Cada línea se convierte en el `Movement` que `insertMovements` habría
 * creado (`movementDesdeLinea`, en memoria, sin escribir) y se empareja con la
 * MISMA lógica que `matchBatch`: solo cambia de dónde viene el input. El
 * resultado habla en `lineaId`. Las líneas descartadas no entran, igual que hoy
 * no tienen movimiento. E1.5 · es la puerta que usa el orquestador.
 */
export async function matchLineas(
  lineas: LineaExtractoPersistida[],
  options?: MatchOptions
): Promise<MatchResultPorLinea> {
  const opts: Required<MatchOptions> = { ...DEFAULT_OPTIONS, ...options };
  const movements = movimientosDesdeLineas(lineas);
  if (movements.length === 0) {
    return { matches: [], multiMatches: [], sinMatch: [] };
  }
  const db = await initDB();
  return matchResultPorLinea(await emparejarEnMemoria(db, movements, opts));
}

/**
 * El emparejamiento propiamente dicho, sobre movimientos YA en memoria · lo
 * comparten la entrada por id (`matchBatch`) y la entrada por línea
 * (`matchLineas`). Lee previstos y alias; no escribe.
 */
async function emparejarEnMemoria(
  db: Awaited<ReturnType<typeof initDB>>,
  movements: Movement[],
  opts: Required<MatchOptions>
): Promise<MatchResult> {
  const eventsByAccount = await loadCandidateEvents(db, movements);
  const alias = await cargarAliasContraparte();
  const allCandidates = collectCandidates(movements, eventsByAccount, alias, opts);
  const winnersByEvent = resolveEventConflicts(allCandidates);
  return classify(movements, winnersByEvent, opts);
}

async function loadCandidateEvents(
  db: Awaited<ReturnType<typeof initDB>>,
  movements: Movement[]
): Promise<Map<number, TreasuryEvent[]>> {
  const accountIds = Array.from(new Set(movements.map(m => m.accountId)));
  const result = new Map<number, TreasuryEvent[]>();

  for (const accountId of accountIds) {
    let events: TreasuryEvent[];
    try {
      events = (await db.getAllFromIndex(
        'treasuryEvents',
        'accountId',
        accountId
      )) as TreasuryEvent[];
    } catch {
      // Fallback when the index is unavailable (e.g. mocked DB in tests)
      const all = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];
      events = all.filter(e => e.accountId === accountId);
    }
    // Un DESCARTADO no entra: el usuario ya dijo que no iba a ocurrir, y
    // casarlo por detrás lo dejaba `executed` con la marca puesta — invisible
    // en pantalla con el saldo movido. Ver `descarteDePrevision`.
    result.set(
      accountId,
      events.filter(e => esConciliable(e) && e.id != null)
    );
  }

  return result;
}

function collectCandidates(
  movements: Movement[],
  eventsByAccount: Map<number, TreasuryEvent[]>,
  alias: AliasContraparte,
  opts: Required<MatchOptions>
): ScoredCandidate[] {
  const candidates: ScoredCandidate[] = [];
  for (const movement of movements) {
    const events = eventsByAccount.get(movement.accountId) ?? [];
    for (const event of events) {
      const daysDiff = Math.abs(daysBetween(movement.date, event.predictedDate));
      if (!Number.isFinite(daysDiff)) continue;
      // Importe clavado ⇒ se mira todo el mes; el resto sigue con ±5 días.
      const importeExacto =
        signMatchesType(movement.amount, event.type) &&
        Math.abs(Math.abs(movement.amount) - Math.abs(event.amount)) < 0.005;
      const ventana = importeExacto ? VENTANA_IMPORTE_EXACTO_DIAS : opts.fechaWindowDays;
      if (daysDiff > ventana) continue;
      const scored = scorePair(movement, event, daysDiff, alias, opts);
      if (scored.score <= 0) continue;
      candidates.push({
        movementId: movement.id!,
        treasuryEventId: event.id!,
        score: scored.score,
        reasons: scored.reasons,
        daysDiff,
        serieKey: serieDeEvento(event),
      });
    }
  }
  return candidates;
}

function scorePair(
  movement: Movement,
  event: TreasuryEvent,
  daysDiff: number,
  alias: AliasContraparte,
  opts: Required<MatchOptions>
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Date proximity (mutually exclusive bands, max one applies).
  if (daysDiff === 0) {
    score += 30;
    reasons.push('fecha_exacta');
  } else if (daysDiff === 1) {
    score += 20;
    reasons.push('fecha_dia_adyacente');
  } else if (daysDiff <= 3) {
    score += 10;
    reasons.push('fecha_proxima');
  }

  // Amount accuracy (mutually exclusive: exact > tolerance).
  const movAbs = Math.abs(movement.amount);
  const evtAbs = Math.abs(event.amount);
  const diffAbs = Math.abs(movAbs - evtAbs);
  const sameSign = signMatchesType(movement.amount, event.type);

  if (sameSign && diffAbs < 0.005) {
    score += 30;
    reasons.push('importe_exacto');
  } else if (sameSign && evtAbs > 0 && diffAbs / evtAbs <= opts.amountTolerancePercent / 100) {
    score += 20;
    reasons.push('importe_dentro_tolerancia');
  }

  // accountId is guaranteed to match (movement was filtered by account before
  // we got here), but per spec we still credit it explicitly.
  if (movement.accountId === event.accountId) {
    score += 15;
    reasons.push('cuenta_match');
  }

  // Importe EXACTO en la misma cuenta ⇒ cuadre de confianza, aunque el día no
  // coincida — pero SOLO en GASTOS. Un recibo domiciliado (luz, gas, cuota) se
  // carga uno o dos días después de la fecha prevista y con el importe clavado:
  // exigir que además pegue el proveedor dejaba fuera lo más normal, y ese era
  // el origen del "0 de 27". En INGRESOS no vale: quién paga es lo que
  // distingue una renta de un ingreso cualquiera del mismo importe, así que ahí
  // manda la contraparte (Bizum/alias), no el importe a secas.
  const esGasto = event.type === 'expense' || event.type === 'financing';
  if (esGasto && sameSign && diffAbs < 0.005 && movement.accountId === event.accountId) {
    score += 25;
    reasons.push('importe_exacto_misma_cuenta');
  }

  // Ingreso de ALQUILER · importe EXACTO en la misma cuenta, fecha dentro de la
  // ventana (±5 días) y el concepto del banco dice "alquiler/renta/..." ⇒ cuadre,
  // aunque el pagador venga con otro texto que el del contrato. La renta llega
  // por transferencia uno o dos días después y con el nombre del banco distinto;
  // exigir además que pegue la contraparte la dejaba en "resolver". La palabra
  // "alquiler" es lo que la distingue de un Bizum del mismo importe de otra
  // persona (que NO debe colgarse de la renta): sin ella, no hay empujón. La
  // contraparte SIGUE sumando (desempata dos rentas iguales), y si hay dos
  // previstos del mismo importe la ambigüedad va a multiMatch, no a un cuadre a
  // ciegas. Se acota a ±5 días para que un ingreso suelto lejano no la consuma.
  const esIngreso = event.type === 'income';
  const textoIngreso = `${movement.description ?? ''} ${movement.counterparty ?? ''}`.toLowerCase();
  const pareceAlquiler = /alquiler|arrendamiento|mensualidad|inquilin|\brenta\b/.test(textoIngreso);
  if (
    esIngreso &&
    pareceAlquiler &&
    sameSign &&
    diffAbs < 0.005 &&
    movement.accountId === event.accountId &&
    daysDiff <= opts.fechaWindowDays
  ) {
    score += 25;
    reasons.push('importe_exacto_alquiler_misma_cuenta');
  }

  // Un recibo recurrente —domiciliación de luz/gas/cuota o el recibo de una
  // tarjeta— se carga en SU cuenta con el día a menudo desplazado uno o dos
  // respecto a lo previsto, y con el importe VARIABLE mes a mes (el gas de un
  // mes no es el de otro: previsto 30 €, real 13,38 €). Sin este empujón, un
  // recibo variable cuyo día no clava se quedaba en 60 (fecha_adyacente 20 +
  // cuenta 15 + proveedor 25) —por debajo del umbral—, su previsión no se
  // consumía, y seguía descontando el PREVISTO del saldo mientras el cargo real
  // ya había salido. El +10 cierra ese hueco. Nunca casa por sí solo: sin
  // proveedor ni importe reconocibles no llega al umbral (cuenta 15 + fecha 30 +
  // 10 = 55), así que no inventa emparejamientos.
  const esReciboRecurrente =
    event.sourceType === 'gasto_recurrente' || event.sourceType === 'tarjeta_recibo';
  if (esReciboRecurrente && esGasto && sameSign && movement.accountId === event.accountId) {
    score += 10;
    reasons.push('recibo_recurrente_misma_cuenta');
  }

  // Description / counterparty proximity.
  const description = (movement.description ?? '').toLowerCase();
  const provider = (event.providerName ?? event.counterparty ?? '').toLowerCase().trim();
  if (provider.length >= 3 && description.includes(provider)) {
    score += 25;
    reasons.push('descripcion_proveedor');
  } else {
    score += puntosDeContraparte(movement, event, alias, reasons);
  }

  return { score, reasons };
}

/**
 * Quién paga · primero lo que el usuario ya enseñó, después lo que se deduce.
 *
 * El alias va delante a propósito: una confirmación suya es un dato, y el
 * parecido de dos nombres es una conjetura. Si alguna vez confirmó que este
 * texto del banco era esta persona, eso manda sobre cualquier heurística —y
 * cubre los casos que ninguna heurística alcanza, como "MPARWEZ".
 */
function puntosDeContraparte(
  movement: Movement,
  event: TreasuryEvent,
  alias: AliasContraparte,
  reasons: string[]
): number {
  const nombreBanco = nombreDeContraparte(movement);
  const quienCobra = claveDeNombre(event.counterparty ?? event.providerName ?? '');
  // Sin nombre a los dos lados no hay nada que preguntar · una clave vacía
  // preguntada contra el Set casaría con cualquier previsión anónima.
  if (nombreBanco && quienCobra) {
    const aprendidas = alias.get(claveDeNombre(nombreBanco));
    if (aprendidas?.has(quienCobra)) {
      reasons.push('alias_aprendido');
      return 25;
    }
  }
  return puntosDeBizum(movement, event, reasons);
}

/**
 * Un Bizum casi nunca trae el nombre completo del contrato: el banco manda
 * "BIZUM DE ADNAN PARWEZ" y en la ficha pone "Adnan Parwez Khan". El
 * `includes` de arriba no lo ve, así que la línea se quedaba por debajo del
 * umbral y ni siquiera se PROPONÍA como candidata a la renta del inquilino.
 *
 * Aquí se compara por palabras. Y se puntúa distinto según lo que se sepa:
 * compartir nombre y apellido señala a una persona; compartir sólo el nombre de
 * pila señala a varias, y entonces salen las dos como candidatas y decide el
 * usuario. Nada de esto concilia por su cuenta.
 *
 * Se limita a los Bizum a propósito: para el resto de líneas manda la regla de
 * proveedor de siempre, que aquí no se toca.
 */
function puntosDeBizum(movement: Movement, event: TreasuryEvent, reasons: string[]): number {
  const textoBanco = `${movement.counterparty ?? ''} ${movement.description ?? ''}`.trim();
  const esBizum = movement.paymentMethod === 'Bizum' || pareceBizum(textoBanco);
  if (!esBizum) return 0;

  const quienCobra = event.counterparty ?? event.providerName ?? '';
  // El nombre limpio si el texto lo dice; si no, el texto entero — de ahí ya se
  // quedan sólo las palabras que valen para comparar.
  const quienPaga = contraparteDeBizum(textoBanco) ?? textoBanco;

  const nivel = nivelDeCoincidencia(quienPaga, quienCobra);
  if (nivel === 'fuerte') {
    reasons.push('bizum_contraparte');
    return 25;
  }
  if (nivel === 'parcial') {
    reasons.push('bizum_contraparte_parcial');
    return 10;
  }
  return 0;
}

function signMatchesType(movementAmount: number, type: TreasuryEvent['type']): boolean {
  if (type === 'income') return movementAmount > 0;
  if (type === 'expense') return movementAmount < 0;
  // financing covers both directions (loan disbursement vs cuota); accept either.
  return true;
}

function daysBetween(a: string, b: string): number {
  const dateA = parseISO(a);
  const dateB = parseISO(b);
  if (dateA == null || dateB == null) return Number.POSITIVE_INFINITY;
  const MS_PER_DAY = 86_400_000;
  return Math.round((dateA - dateB) / MS_PER_DAY);
}

function parseISO(input: string): number | null {
  if (!input) return null;
  // Accept YYYY-MM-DD or full ISO. Anchor to UTC midnight to avoid TZ drift.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (ymd) {
    const ts = Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return Number.isNaN(ts) ? null : ts;
  }
  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? null : parsed;
}

// Per spec invariant 1: a single treasuryEvent must not appear in two movements'
// candidate lists. For each event, the strongest candidate wins; the loser drops
// the event from its options (and may end up in `sinMatch` as a result).
function resolveEventConflicts(
  candidates: ScoredCandidate[]
): Map<number, ScoredCandidate> {
  const winnersByEvent = new Map<number, ScoredCandidate>();
  for (const candidate of candidates) {
    const existing = winnersByEvent.get(candidate.treasuryEventId);
    if (!existing || beats(candidate, existing)) {
      winnersByEvent.set(candidate.treasuryEventId, candidate);
    }
  }
  return winnersByEvent;
}

function beats(a: ScoredCandidate, b: ScoredCandidate): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.daysDiff !== b.daysDiff) return a.daysDiff < b.daysDiff;
  return a.movementId < b.movementId;
}

function classify(
  movements: Movement[],
  winnersByEvent: Map<number, ScoredCandidate>,
  opts: Required<MatchOptions>
): MatchResult {
  const candidatesByMovement = new Map<number, ScoredCandidate[]>();
  for (const candidate of winnersByEvent.values()) {
    if (candidate.score < opts.scoreThreshold) continue;
    const list = candidatesByMovement.get(candidate.movementId) ?? [];
    list.push(candidate);
    candidatesByMovement.set(candidate.movementId, list);
  }

  const matches: MatchScore[] = [];
  const multiMatches: { movementId: number; candidates: MatchScore[] }[] = [];
  const sinMatch: number[] = [];

  for (const movement of movements) {
    if (movement.id == null) continue;
    const listaCruda = candidatesByMovement.get(movement.id) ?? [];
    // Colapsar la SERIE: 14 mensualidades del mismo recurrente son UN candidato,
    // el más cercano. Sin esto, ampliar la ventana convertía cada recibo en un
    // multiMatch de doce opciones idénticas y no cuadraba nada solo.
    const list = dedupePorSerie(listaCruda);
    if (list.length === 0) {
      sinMatch.push(movement.id);
      continue;
    }
    if (list.length === 1) {
      matches.push(toMatchScore(list[0]));
      continue;
    }
    list.sort((a, b) => b.score - a.score || a.daysDiff - b.daysDiff);
    // GANADOR CLARO · con seis habitaciones del mismo importe, la línea del banco
    // trae el nombre del inquilino y solo UNA previsión casa ese nombre (+25). Si
    // el primero saca al segundo por un margen de nombre, cuadra con él en vez de
    // pedir elegir entre seis idénticas; si van pegados (mismo importe y nadie
    // desempata), sí se ofrece elegir. Sin esto, el empujón del alquiler subía las
    // seis por encima del umbral y convertía un cuadre limpio en un multiMatch.
    if (list[0].score - list[1].score >= MARGEN_GANADOR_CLARO) {
      matches.push(toMatchScore(list[0]));
      continue;
    }
    multiMatches.push({
      movementId: movement.id,
      candidates: list.map(toMatchScore),
    });
  }

  return { matches, multiMatches, sinMatch };
}

/**
 * Una entrada por SERIE · la instancia más cercana (mejor puntuada, y a igualdad
 * la de menos días). Así un recurrente con doce mensualidades en la ventana no
 * se lee como doce candidatos distintos.
 */
function dedupePorSerie(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const mejorPorSerie = new Map<string, ScoredCandidate>();
  for (const c of candidates) {
    const previa = mejorPorSerie.get(c.serieKey);
    if (!previa || c.score > previa.score || (c.score === previa.score && c.daysDiff < previa.daysDiff)) {
      mejorPorSerie.set(c.serieKey, c);
    }
  }
  return [...mejorPorSerie.values()];
}

function toMatchScore(candidate: ScoredCandidate): MatchScore {
  return {
    movementId: candidate.movementId,
    treasuryEventId: candidate.treasuryEventId,
    score: candidate.score,
    reasons: candidate.reasons,
  };
}
