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
import type { FamiliaId } from './catalogo/catalogoUnico';
import { buildLearnKey, createOrUpdateRule } from './movementLearningService';
import { initDB } from './db';
import { esCif, identificadoresDeMovimiento } from './identificadoresDelConcepto';
import { aprenderEnCatalogo, type BaseParaCatalogo } from './catalogoNacional/catalogoNacional';

/**
 * Lo que se aprende al resolver una línea · categoría, ámbito y piso.
 *
 * Viaja junto a `feedLearningRule` porque son la misma idea: qué queda sabido
 * cuando una línea del banco se cierra, venga de una previsión o de una
 * propuesta aceptada.
 */
export interface DerivedCategory {
  familia: FamiliaId;
  subtipo?: string;
  ambito: 'personal' | 'inmueble';
  inmuebleId?: string;
}

export function deriveCategoryFromEvent(event: TreasuryEvent): DerivedCategory | null {
  const familia = event.familia;
  if (!familia) return null;
  return {
    familia,
    subtipo: event.subtipo,
    ambito: event.ambito ?? 'personal',
    inmuebleId: event.inmuebleId != null ? String(event.inmuebleId) : undefined,
  };
}

/**
 * E2.2 · lo mismo, leído del MOVIMIENTO ya clasificado · vale para lo que
 * cierra el reconocedor determinista y para lo que clasifica la ficha. Sin
 * categoría no hay nada que aprender (`null`).
 */
export function deriveCategoryFromMovement(m: Movement): DerivedCategory | null {
  const familia = m.familia;
  if (!familia) return null;
  const inmuebleId = m.inmuebleId != null && m.inmuebleId !== '' ? String(m.inmuebleId) : undefined;
  return {
    familia,
    subtipo: m.subtipo,
    ambito: m.ambito ?? (inmuebleId ? 'inmueble' : 'personal'),
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
    // Sin clave no se aprende NADA. De un concepto del que no queda con qué
    // agrupar no se puede sacar una regla: la que naciera se aplicaría a
    // cualquier otro apunte igual de anónimo. Mejor volver a preguntar.
    if (!learnKey) return;
    // T16-fix-functional · pasar el movimiento permite a createOrUpdateRule
    // rellenar counterpartyPattern/descriptionPattern/amountSign y propagar
    // movimientoId al history[] (B2 + B8 del audit T16).
    await createOrUpdateRule({
      learnKey,
      familia: derived.familia,
      subtipo: derived.subtipo,
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
  // E3.1 · §7.3 · lo que el usuario acaba de enseñar sobre un proveedor sube
  // TAMBIÉN al catálogo nacional. Es lo que hace que «nadie tenga que añadir
  // WIZINK a una lista»: lo enseña el primer cliente y lo heredan los demás.
  await aprenderProveedorDelMovimiento(movement, derived);
}

/**
 * E3.1 · §7.3 · lo que se sabe de quien cobra CRECE con cada confirmación.
 *
 * Se guarda en `proveedores` (E3.1b · un solo sitio), y con UN límite que no es
 * negociable: solo se marca `origen: 'nacional'` —o sea, compartible— lo
 * anclado en un CIF de EMPRESA. El DNI del fontanero de un cliente se queda en
 * su navegador y no entra en ninguna tabla que vean los demás. Un nombre sin
 * CIF tampoco sube: «Pepe» no identifica a nadie fuera de casa de quien lo
 * escribió.
 *
 * Nunca lanza: aprender es oportunista y una confirmación no se rompe por esto.
 */
async function aprenderProveedorDelMovimiento(
  movement: Movement,
  derived: DerivedCategory | null,
): Promise<void> {
  if (!derived?.familia) return;
  try {
    const ids = identificadoresDeMovimiento(movement);
    const cif = ids.find((id) => id.tipo === 'nif' && esCif(id.valor));
    if (!cif) return;
    const nombre = ids.find((id) => id.tipo === 'acreedor')?.texto?.trim();
    const db = await initDB();
    await aprenderEnCatalogo(
      db as unknown as BaseParaCatalogo,
      {
        nif: cif.valor,
        ...(nombre ? { nombre, alias: [nombre] } : {}),
        familia: derived.familia,
        ...(derived.subtipo ? { subtipo: derived.subtipo } : {}),
        ...(derived.ambito ? { ambito: derived.ambito } : {}),
        // Anclado a un CIF de EMPRESA · esto sí es compartible.
        origen: 'nacional',
      },
      (mensaje, err) => console.warn(`[catalogo] ${mensaje}`, err),
    );
  } catch (err) {
    console.warn('[catalogo] no se pudo aprender el proveedor de este movimiento', err);
  }
}
