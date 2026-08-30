// ============================================================================
// Aplicar una sugerencia · el camino que nace de lo que ATLAS propone
// ============================================================================
//
// Sale de `bankStatementOrchestrator`, que estaba en el techo de tamaño del
// trinquete, y es una separación real: el orquestador lee un fichero y produce
// un resultado; esto ESCRIBE a partir de una propuesta aceptada, que es otro
// trabajo con otras reglas.
//
// ── Una advertencia que hay que dejar dicha ─────────────────────────────────
//
// Esto no se ejecuta hoy. `payloadDeConfirmacion` devuelve `approvedSuggestions`
// vacío a propósito (`extractoSesion.ts` ~:351-355) y la pantalla de conciliar
// no lo llena: cuando el usuario acepta una propuesta, lo hace por la ficha, que
// pasa por `crearDesdeFicha` y sí crea la fila fiscal. Este camino NO la crea,
// así que engancharlo tal cual dejaría gastos de inmueble fuera de la
// declaración. Se conserva porque `confirmDecisions` sigue aceptando el canal y
// romperlo no arregla nada; se documenta para que nadie lo cablee sin mirarlo.

import { initDB } from './db';
import type { Movement, TreasuryEvent } from './db';
import type { MovementSuggestion, SuggestionAction } from './movementSuggestionService';
import { buildLearnKey, createOrUpdateRule } from './movementLearningService';

/**
 * Lo que se aprende al resolver una línea · categoría, ámbito y piso.
 *
 * Viaja junto a `feedLearningRule` porque son la misma idea: qué queda sabido
 * cuando una línea del banco se cierra, venga de una previsión o de una
 * propuesta aceptada.
 */
export interface DerivedCategory {
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
}

export async function applySuggestion(movement: Movement, suggestion: MovementSuggestion, now: string): Promise<void> {
  const db = await initDB();

  switch (suggestion.action.kind) {
    case 'create_treasury_event':
    case 'assign_to_contract':
    case 'mark_personal_expense': {
      const event = buildTreasuryEventFromAction(movement, suggestion.action, now);
      const eventId = (await db.add('treasuryEvents', event)) as number;
      await db.put('treasuryEvents', { ...event, id: eventId, executedMovementId: movement.id });
      await db.put('movements', {
        ...movement,
        unifiedStatus: 'conciliado',
        statusConciliacion: 'match_manual',
        updatedAt: now,
      });
      await feedLearningRule(movement, deriveCategoryFromAction(suggestion.action));
      return;
    }
    case 'ignore':
      await db.put('movements', {
        ...movement,
        unifiedStatus: 'no_planificado',
        statusConciliacion: 'sin_match',
        updatedAt: now,
      });
      return;
  }
}

export function buildTreasuryEventFromAction(
  movement: Movement,
  action: SuggestionAction,
  now: string
): TreasuryEvent {
  const base = {
    amount: Math.abs(movement.amount),
    predictedDate: movement.date,
    description: movement.description,
    accountId: movement.accountId,
    status: 'executed' as const,
    actualDate: movement.date,
    // Magnitud · misma convención que el punteo manual y que `approvedMatches`.
    actualAmount: Math.abs(movement.amount),
    executedMovementId: movement.id,
    executedAt: now,
    generadoPor: 'user' as const,
    createdAt: now,
    updatedAt: now,
  };

  switch (action.kind) {
    case 'create_treasury_event':
      return {
        ...base,
        type: action.type,
        sourceType: action.sourceType,
        sourceId: typeof action.sourceId === 'number' ? action.sourceId : undefined,
        ambito: action.ambito,
        inmuebleId: action.inmuebleId,
        categoryKey: action.categoryKey,
      };
    case 'assign_to_contract':
      return {
        ...base,
        type: movement.amount >= 0 ? 'income' : 'expense',
        sourceType: 'contract',
        sourceId: action.contractId,
        // De QUÉ contrato es este cobro. `sourceId` es el enlace legacy y
        // `contratoId` el principal (el que mira `esRentaDeContrato`): sin los
        // dos el evento quedaba huérfano —ningún contrato lo reconocía como su
        // renta— y encima era invisible para el dedupe de previsiones, así que
        // el mes acababa con el cobro real y la previsión duplicada.
        contratoId: action.contractId,
        ambito: 'INMUEBLE',
      };
    case 'mark_personal_expense':
      return {
        ...base,
        type: movement.amount >= 0 ? 'income' : 'expense',
        sourceType: 'personal_expense',
        ambito: 'PERSONAL',
        categoryKey: action.categoryKey,
      };
    case 'ignore':
      // Defensive: applySuggestion handles `ignore` directly without calling
      // this builder. Throw so a future caller doesn't silently misuse it.
      throw new Error('buildTreasuryEventFromAction: ignore action has no event representation');
  }
}

/**
 * Lo que se aprende al resolver una línea · categoría, ámbito y piso.
 *
 * Viaja junto a `feedLearningRule` porque son la misma idea: qué queda sabido
 * cuando una línea del banco se cierra, venga de una previsión o de una
 * propuesta aceptada.
 */
export interface DerivedCategory {
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
}

export function deriveCategoryFromEvent(event: TreasuryEvent): DerivedCategory | null {
  const categoria = event.categoryKey ?? event.categoryLabel;
  if (!categoria) return null;
  return {
    categoria,
    ambito: event.ambito ?? 'PERSONAL',
    inmuebleId: event.inmuebleId != null ? String(event.inmuebleId) : undefined,
  };
}

export function deriveCategoryFromAction(action: SuggestionAction): DerivedCategory | null {
  switch (action.kind) {
    case 'create_treasury_event':
      if (!action.categoryKey) return null;
      return {
        categoria: action.categoryKey,
        ambito: action.ambito,
        inmuebleId: action.inmuebleId != null ? String(action.inmuebleId) : undefined,
      };
    case 'mark_personal_expense':
      return { categoria: action.categoryKey, ambito: 'PERSONAL' };
    case 'assign_to_contract':
      return null; // contract-bound learning is too instance-specific to generalise
    case 'ignore':
      return null;
  }
}

export async function feedLearningRule(
  movement: Movement,
  derived: DerivedCategory | null,
  contraparteConfirmada?: string
): Promise<void> {
  if (!derived) return;
  try {
    const learnKey = buildLearnKey(movement);
    // T16-fix-functional · pasar el movimiento permite a createOrUpdateRule
    // rellenar counterpartyPattern/descriptionPattern/amountSign y propagar
    // movimientoId al history[] (B2 + B8 del audit T16).
    await createOrUpdateRule({
      learnKey,
      categoria: derived.categoria,
      ambito: derived.ambito,
      inmuebleId: derived.inmuebleId,
      movement,
      contraparteConfirmada,
    });
  } catch (err) {
    // Learning is opportunistic — do not block confirmation if it fails.
    console.warn('[orchestrator] feedLearningRule failed', err);
  }
}
