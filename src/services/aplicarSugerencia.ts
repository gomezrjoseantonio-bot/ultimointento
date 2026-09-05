// ============================================================================
// Lo que ATLAS aprende cuando una línea se cierra
// ============================================================================
//
// Queda lo que de verdad corre: la categoría que hereda un movimiento de la
// previsión con la que cuadró, y la regla que se escribe a partir de ahí.
//
// Lo que había alrededor —`applySuggestion` y su cadena— se ha borrado en la
// 2.0.2. Era un camino inalcanzable: `payloadDeConfirmacion` devolvía
// `approvedSuggestions` vacío por diseño y ningún otro sitio llenaba ese canal,
// así que el bucle que lo aplicaba no se ejecutaba nunca. Y era peor que
// inofensivo: NO creaba la fila fiscal, así que engancharlo habría dejado gastos
// de inmueble fuera de la declaración. Cuando el usuario acepta una propuesta lo
// hace por la ficha, que pasa por `crearDesdeFicha` y sí la crea.
// ============================================================================

import type { Movement, TreasuryEvent } from './db';
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

export function deriveCategoryFromEvent(event: TreasuryEvent): DerivedCategory | null {
  const categoria = event.categoryKey ?? event.categoryLabel;
  if (!categoria) return null;
  return {
    categoria,
    ambito: event.ambito ?? 'PERSONAL',
    inmuebleId: event.inmuebleId != null ? String(event.inmuebleId) : undefined,
  };
}

/**
 * E2.2 · lo mismo, leído del MOVIMIENTO ya clasificado · vale para lo que
 * cierra el reconocedor determinista y para lo que clasifica la ficha. Sin
 * categoría no hay nada que aprender (`null`).
 */
export function deriveCategoryFromMovement(m: Movement): DerivedCategory | null {
  const categoria = m.categoryKey;
  if (!categoria) return null;
  const inmuebleId = m.inmuebleId != null && m.inmuebleId !== '' ? String(m.inmuebleId) : undefined;
  return {
    categoria,
    ambito: m.ambito ?? (inmuebleId ? 'INMUEBLE' : 'PERSONAL'),
    inmuebleId,
  };
}

/** E2.2 · la regla no clasifica: convierte la línea en traspaso a esta cuenta. */
export interface ResolucionTraspaso {
  tipo: 'traspaso';
  cuentaDestinoId: number;
}

export async function feedLearningRule(
  movement: Movement,
  derived: DerivedCategory | null,
  contraparteConfirmada?: string,
  resolucion?: ResolucionTraspaso
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
      ...(resolucion ? { resolucion: 'traspaso' as const, cuentaDestinoId: resolucion.cuentaDestinoId } : {}),
    });
  } catch (err) {
    // Learning is opportunistic — do not block confirmation if it fails.
    console.warn('[orchestrator] feedLearningRule failed', err);
  }
}
