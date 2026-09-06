// ============================================================================
// E2.4.2 · Paso 2 · APRENDIZAJE INTRA-LOTE · lo que se enseña en la línea 3
//                   resuelve la 50 y la 200 AHORA, no en el siguiente fichero
// ============================================================================
//
// Hasta E2.4.2 la regla que nacía de clasificar una línea (`feedLearningRule`)
// solo se miraba al importar el SIGUIENTE fichero. Aprender «Víctor = personal»
// en la línea 3 dejaba las otras cuarenta de Víctor en «te necesitan», y el
// usuario las clasificaba una a una con la misma ficha.
//
// Aquí se busca, en el MISMO lote, qué líneas comparten la clave de aprendizaje
// (`buildLearnKey` · v2 con identificador, v1 sin él) con la recién
// clasificada. Son las que la regla resolvería sola al reimportar; se resuelven
// ya, con los mismos valores de la ficha (cada una con SU importe y SU fecha ·
// `valoresPorLinea`), y quedan marcadas como resueltas por el motor
// (`comoSeResolvio: 'motor'` en la línea · reclasificables desde Tesorería).
//
// Decisión de Jose (6 sep 2026): se aplica de verdad, no como propuesta a
// re-confirmar doscientas veces; visible con su origen y reversible.
//
// Puro. La cola (otros lotes a medias) se resuelve sola: al retomarlos,
// `reabrirLote` vuelve a analizar y la regla recién aprendida ya está en
// `movementLearningRules`.
// ============================================================================

import type { Movement } from '../db';
import { buildLearnKey } from '../movementLearningService';

/** Lo mínimo de una línea de la sesión para calcular su clave. */
export interface LineaConClave {
  lineaId: number;
  textoBanco: string;
  importe: number;
  referencia?: string;
  contraparte?: string;
}

/** La clave de aprendizaje de una línea · la misma que llevará su regla. */
export function claveDeLinea(l: LineaConClave): string {
  const m = {
    description: l.textoBanco,
    amount: l.importe,
    counterparty: l.contraparte,
    reference: l.referencia,
  } as Movement;
  return buildLearnKey(m);
}

/**
 * Las líneas del lote que aprenderían de esta · misma clave, mismo signo, aún
 * sin decidir (`sinDecidir` las filtra: en «te necesitan» y sin gesto del
 * usuario). La propia línea no se incluye.
 */
export function hermanasDeAprendizaje(
  clasificada: LineaConClave,
  lote: readonly LineaConClave[],
  sinDecidir: (lineaId: number) => boolean,
): LineaConClave[] {
  const clave = claveDeLinea(clasificada);
  return lote.filter(
    (l) =>
      l.lineaId !== clasificada.lineaId &&
      Math.sign(l.importe) === Math.sign(clasificada.importe) &&
      sinDecidir(l.lineaId) &&
      claveDeLinea(l) === clave,
  );
}
