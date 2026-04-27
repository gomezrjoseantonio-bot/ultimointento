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
import { initDB, Movement, TreasuryEvent } from './db';

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

interface ScoredCandidate {
  movementId: number;
  treasuryEventId: number;
  score: number;
  reasons: string[];
  daysDiff: number;
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

  const eventsByAccount = await loadCandidateEvents(db, movements);
  const allCandidates = collectCandidates(movements, eventsByAccount, opts);
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
    result.set(
      accountId,
      events.filter(e => e.status === 'predicted' && e.id != null)
    );
  }

  return result;
}

function collectCandidates(
  movements: Movement[],
  eventsByAccount: Map<number, TreasuryEvent[]>,
  opts: Required<MatchOptions>
): ScoredCandidate[] {
  const candidates: ScoredCandidate[] = [];
  for (const movement of movements) {
    const events = eventsByAccount.get(movement.accountId) ?? [];
    for (const event of events) {
      const daysDiff = Math.abs(daysBetween(movement.date, event.predictedDate));
      if (!Number.isFinite(daysDiff) || daysDiff > opts.fechaWindowDays) continue;
      const scored = scorePair(movement, event, daysDiff, opts);
      if (scored.score <= 0) continue;
      candidates.push({
        movementId: movement.id!,
        treasuryEventId: event.id!,
        score: scored.score,
        reasons: scored.reasons,
        daysDiff,
      });
    }
  }
  return candidates;
}

function scorePair(
  movement: Movement,
  event: TreasuryEvent,
  daysDiff: number,
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

  // Description / counterparty proximity.
  const description = (movement.description ?? '').toLowerCase();
  const provider = (event.providerName ?? event.counterparty ?? '').toLowerCase().trim();
  if (provider.length >= 3 && description.includes(provider)) {
    score += 25;
    reasons.push('descripcion_proveedor');
  }

  return { score, reasons };
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
    const list = candidatesByMovement.get(movement.id) ?? [];
    if (list.length === 0) {
      sinMatch.push(movement.id);
      continue;
    }
    if (list.length === 1) {
      matches.push(toMatchScore(list[0]));
      continue;
    }
    list.sort((a, b) => b.score - a.score || a.daysDiff - b.daysDiff);
    multiMatches.push({
      movementId: movement.id,
      candidates: list.map(toMatchScore),
    });
  }

  return { matches, multiMatches, sinMatch };
}

function toMatchScore(candidate: ScoredCandidate): MatchScore {
  return {
    movementId: candidate.movementId,
    treasuryEventId: candidate.treasuryEventId,
    score: candidate.score,
    reasons: candidate.reasons,
  };
}
