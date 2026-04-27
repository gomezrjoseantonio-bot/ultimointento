// TAREA 17 sub-task 17.3 · Movement suggestion service.
//
// For each movement that capa 2 (movementMatchingService) couldn't pair with a
// previously forecasted treasuryEvent, this service proposes one or more
// suggested actions for the user to confirm in the UI.
//
// Three vías are evaluated **in order**, with a short-circuit: as soon as a
// vía produces a suggestion with confidence ≥ 60, the remaining vías are not
// evaluated. The exception is vía B with appliedCount=0 (confidence 50): it is
// emitted but does NOT short-circuit, so vía C also runs.
//
// Vía A — `compromisosRecurrentes`. Active commitments matched by ámbito +
// account + importe ± tolerance. Confidence 70-90 depending on match strength.
// Today the store is empty (T9 will populate it), so vía A returns [] in
// practice and the engine falls through to vía B. The shell is in place for
// when T9 lands.
//
// Vía B — `movementLearningRules`. Compute learnKey via
// movementLearningService.buildLearnKey, look up by exact key. If a rule
// exists with appliedCount > 0, propose with confidence 70-85 (log10 bonus).
// If appliedCount == 0, propose at confidence 50 — informative but not
// actionable yet, and vía C still runs.
//
// Vía C — heuristics over description tokens. Detects suministros, hipoteca/
// cuota préstamo, IBI/tasas, comunidad, BIZUM/transferencias, AMAZON purchases.
// Falls back to `ignore` at confidence 30 if nothing matches.
//
// Pure analysis: never mutates DB. The orchestrator (sub-task 17.5) applies
// approved suggestions and is the only writer.
import {
  initDB,
  Movement,
  MovementLearningRule,
  TreasuryEvent,
} from './db';
import { buildLearnKey } from './movementLearningService';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';

export type SuggestionVia = 'compromiso_recurrente' | 'learning_rule' | 'heuristica';

export type SuggestionAction =
  | {
      kind: 'create_treasury_event';
      type: TreasuryEvent['type'];
      ambito: 'PERSONAL' | 'INMUEBLE';
      inmuebleId?: number;
      categoryKey?: string;
      sourceType: TreasuryEvent['sourceType'];
      sourceId?: number | string;
    }
  | { kind: 'assign_to_contract'; contractId?: number }
  | { kind: 'mark_personal_expense'; categoryKey: string }
  | { kind: 'ignore' };

export interface MovementSuggestion {
  movementId: number;
  via: SuggestionVia;
  confidence: number;            // 0-100
  description: string;            // human-readable for UI
  action: SuggestionAction;
  metadata?: Record<string, unknown>;
}

const SHORT_CIRCUIT_CONFIDENCE = 60;
const COMPROMISO_AMOUNT_TOLERANCE_PERCENT = 5;

export async function suggestForUnmatched(
  movementIds: number[]
): Promise<Map<number, MovementSuggestion[]>> {
  const result = new Map<number, MovementSuggestion[]>();
  if (movementIds.length === 0) return result;

  const db = await initDB();

  const movements: Movement[] = [];
  for (const id of movementIds) {
    const mov = (await db.get('movements', id)) as Movement | undefined;
    if (mov && mov.id != null) movements.push(mov);
  }
  if (movements.length === 0) return result;

  const compromisos = await loadActiveCompromisos(db);
  const learningRulesByKey = await loadLearningRulesIndex(db, movements);

  for (const movement of movements) {
    const suggestions: MovementSuggestion[] = [];

    const viaA = suggestFromCompromiso(movement, compromisos);
    if (viaA) suggestions.push(viaA);
    if (viaA && viaA.confidence >= SHORT_CIRCUIT_CONFIDENCE) {
      result.set(movement.id!, suggestions);
      continue;
    }

    const viaB = suggestFromLearningRule(movement, learningRulesByKey);
    if (viaB) suggestions.push(viaB);
    if (viaB && viaB.confidence >= SHORT_CIRCUIT_CONFIDENCE) {
      result.set(movement.id!, suggestions);
      continue;
    }

    const viaC = suggestFromHeuristics(movement);
    if (viaC) suggestions.push(viaC);

    result.set(movement.id!, suggestions);
  }

  return result;
}

// ─── Vía A · compromisos recurrentes ─────────────────────────────────────────

async function loadActiveCompromisos(
  db: Awaited<ReturnType<typeof initDB>>
): Promise<CompromisoRecurrente[]> {
  let all: CompromisoRecurrente[] = [];
  try {
    all = ((await db.getAll('compromisosRecurrentes')) ?? []) as CompromisoRecurrente[];
  } catch {
    return [];
  }
  return all.filter(c => c.estado === 'activo');
}

function suggestFromCompromiso(
  movement: Movement,
  compromisos: CompromisoRecurrente[]
): MovementSuggestion | null {
  if (compromisos.length === 0) return null;

  type Candidate = { compromiso: CompromisoRecurrente; confidence: number };
  let best: Candidate | null = null;

  for (const compromiso of compromisos) {
    if (compromiso.cuentaCargo !== movement.accountId) continue;

    const expected = expectedImporte(compromiso);
    if (expected == null) continue;
    const movAbs = Math.abs(movement.amount);
    if (Math.abs(movAbs - expected) / Math.max(expected, 0.01) > COMPROMISO_AMOUNT_TOLERANCE_PERCENT / 100) continue;

    // Confidence: 70 base, +10 if importe céntimo exacto, +10 if proveedor token
    // appears in the movement description.
    let confidence = 70;
    if (Math.abs(movAbs - expected) < 0.005) confidence += 10;
    const description = (movement.description ?? '').toLowerCase();
    const proveedor = (compromiso.proveedor?.nombre ?? '').toLowerCase().trim();
    if (proveedor.length >= 3 && description.includes(proveedor)) confidence += 10;

    if (!best || confidence > best.confidence) {
      best = { compromiso, confidence };
    }
  }

  if (!best) return null;

  const ambito = best.compromiso.ambito === 'inmueble' ? 'INMUEBLE' : 'PERSONAL';
  return {
    movementId: movement.id!,
    via: 'compromiso_recurrente',
    confidence: best.confidence,
    description: `Coincide con compromiso "${best.compromiso.alias}" (${best.compromiso.proveedor?.nombre ?? 'proveedor sin nombre'})`,
    action: {
      kind: 'create_treasury_event',
      type: movement.amount >= 0 ? 'income' : 'expense',
      ambito,
      inmuebleId: best.compromiso.inmuebleId,
      categoryKey: best.compromiso.categoria,
      sourceType: 'gasto_recurrente',
      sourceId: best.compromiso.id,
    },
    metadata: { compromisoId: best.compromiso.id },
  };
}

function expectedImporte(compromiso: CompromisoRecurrente): number | null {
  const imp = compromiso.importe;
  switch (imp.modo) {
    case 'fijo':
      return imp.importe;
    case 'variable':
      return imp.importeMedio;
    case 'diferenciadoPorMes':
      // Use mean of the 12 months as a rough match anchor.
      if (!imp.importesPorMes || imp.importesPorMes.length === 0) return null;
      return imp.importesPorMes.reduce((s, v) => s + v, 0) / imp.importesPorMes.length;
    case 'porPago': {
      const values = Object.values(imp.importesPorPago ?? {});
      if (values.length === 0) return null;
      return values.reduce((s, v) => s + v, 0) / values.length;
    }
    default:
      return null;
  }
}

// ─── Vía B · learning rules ─────────────────────────────────────────────────

async function loadLearningRulesIndex(
  db: Awaited<ReturnType<typeof initDB>>,
  movements: Movement[]
): Promise<Map<string, MovementLearningRule>> {
  const index = new Map<string, MovementLearningRule>();
  const seenKeys = new Set<string>();
  for (const movement of movements) {
    seenKeys.add(buildLearnKey(movement));
  }

  for (const key of seenKeys) {
    let rules: MovementLearningRule[];
    try {
      rules = (await db.getAllFromIndex(
        'movementLearningRules',
        'learnKey',
        key
      )) as MovementLearningRule[];
    } catch {
      const all = ((await db.getAll('movementLearningRules')) ?? []) as MovementLearningRule[];
      rules = all.filter(r => r.learnKey === key);
    }
    if (rules.length > 0) {
      // Pick the rule with highest appliedCount; tiebreak by most recent update.
      rules.sort(
        (a, b) =>
          (b.appliedCount ?? 0) - (a.appliedCount ?? 0) ||
          (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
      );
      index.set(key, rules[0]);
    }
  }
  return index;
}

function suggestFromLearningRule(
  movement: Movement,
  rulesByKey: Map<string, MovementLearningRule>
): MovementSuggestion | null {
  const learnKey = buildLearnKey(movement);
  const rule = rulesByKey.get(learnKey);
  if (!rule) return null;

  const applied = rule.appliedCount ?? 0;
  let confidence: number;
  if (applied === 0) {
    confidence = 50;
  } else {
    const bonus = Math.min(15, Math.round(Math.log10(applied + 1) * 5));
    confidence = 70 + bonus;
  }

  const action: SuggestionAction =
    rule.ambito === 'PERSONAL'
      ? { kind: 'mark_personal_expense', categoryKey: rule.categoria }
      : {
          kind: 'create_treasury_event',
          type: rule.amountSign === 'positive' ? 'income' : 'expense',
          ambito: 'INMUEBLE',
          inmuebleId: rule.inmuebleId ? Number(rule.inmuebleId) : undefined,
          categoryKey: rule.categoria,
          sourceType: 'gasto',
        };

  return {
    movementId: movement.id!,
    via: 'learning_rule',
    confidence,
    description:
      applied > 0
        ? `Regla aprendida (${applied} aplicaciones previas) → ${rule.categoria}`
        : `Regla aprendida sin aplicaciones previas → ${rule.categoria}`,
    action,
    metadata: { learnKey, ruleId: rule.id, appliedCount: applied },
  };
}

// ─── Vía C · heuristics ─────────────────────────────────────────────────────

interface HeuristicRule {
  match: (description: string, amount: number) => boolean;
  build: (movement: Movement) => Omit<MovementSuggestion, 'movementId' | 'via'>;
}

const HEURISTIC_RULES: HeuristicRule[] = [
  // Suministros (always evaluated before generic prestamo / bizum so
  // "RECIBO IBERDROLA CLIENTES SAU" doesn't fall into the BIZUM bucket).
  {
    match: d =>
      /(IBERDROLA|ENDESA|NATURGY|REPSOL|CEPSA|TOTAL\s+ENERGIES|VODAFONE|MOVISTAR|ORANGE|YOIGO|MASMOVIL|JAZZTEL)/i.test(
        d
      ),
    build: () => ({
      confidence: 60,
      description: 'Posible suministro · proponer crear evento de tesorería en INMUEBLE (puedes cambiarlo a PERSONAL)',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'inmueble.suministros',
        sourceType: 'gasto',
      },
    }),
  },
  // Hipoteca / préstamo
  {
    match: d => /(CUOTA\s+PRESTAMO|HIPOTECA|RECIBO\s+BANCO)/i.test(d),
    build: () => ({
      confidence: 65,
      description: 'Posible cuota de préstamo / hipoteca · proponer asignar a préstamo activo de la cuenta',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'vivienda.hipoteca',
        sourceType: 'prestamo',
      },
    }),
  },
  // IBI / tasas / impuestos inmueble
  {
    match: d => /(\bIBI\b|TASA\s+BASURA|AYUNTAMIENTO|CONTRIBUCION\s+URBANA)/i.test(d),
    build: () => ({
      confidence: 60,
      description: 'Posible impuesto del inmueble (IBI, tasa de basura, etc.)',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'inmueble.ibi',
        sourceType: 'gasto',
      },
    }),
  },
  // Comunidad
  {
    match: d => /(COMUNIDAD|ADMIN\s+FINCAS|FINCAS)/i.test(d),
    build: () => ({
      confidence: 60,
      description: 'Posible cuota de comunidad de propietarios',
      action: {
        kind: 'create_treasury_event',
        type: 'expense',
        ambito: 'INMUEBLE',
        categoryKey: 'inmueble.comunidad',
        sourceType: 'gasto',
      },
    }),
  },
  // BIZUM / transferencia recibida con NIF
  {
    match: (d, _amount) => /(BIZUM|TRANSFERENCIA\s+RECIBIDA)/i.test(d),
    build: () => ({
      confidence: 50,
      description: 'Bizum o transferencia recibida · proponer asignar a un contrato de alquiler activo',
      action: { kind: 'assign_to_contract' },
    }),
  },
  // Compras Amazon / AliExpress (only when amount is negative ⇒ gasto personal)
  {
    match: (d, amount) =>
      amount < 0 && /(AMAZON|ALIEXPRESS|ALI\s+EXPRESS)/i.test(d),
    build: () => ({
      confidence: 50,
      description: 'Compra online (Amazon / AliExpress) · proponer marcar como gasto personal',
      action: {
        kind: 'mark_personal_expense',
        categoryKey: 'tecnologia',
      },
    }),
  },
];

function suggestFromHeuristics(movement: Movement): MovementSuggestion {
  const description = (movement.description ?? '').trim();

  for (const rule of HEURISTIC_RULES) {
    if (rule.match(description, movement.amount)) {
      const partial = rule.build(movement);
      return {
        movementId: movement.id!,
        via: 'heuristica',
        ...partial,
      };
    }
  }

  // Fallback: nothing matched, suggest ignoring.
  return {
    movementId: movement.id!,
    via: 'heuristica',
    confidence: 30,
    description: 'Sin patrón reconocible · puedes ignorarlo o clasificarlo manualmente',
    action: { kind: 'ignore' },
  };
}
