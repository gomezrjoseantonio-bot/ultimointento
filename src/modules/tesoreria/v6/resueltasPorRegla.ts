// ============================================================================
// E2.2 · Lo que una regla aprendida resuelve sola · visto desde la sesión
// ============================================================================
//
// El sugeridor ya dice, por línea, qué regla la reconoce y si esa regla se ha
// ganado la confianza (`metadata.resuelveSola` · el umbral vive en
// `reglaResuelveSola`, no aquí). Este módulo traduce eso a lo que la pantalla
// y el Guardar necesitan:
//
//   · qué líneas van al montón «resueltas» sin que el usuario las toque;
//   · cuáles de ellas viajan al Guardar como `resueltasPorRegla` · SOLO las que
//     el usuario no ha decidido de otra manera ni ha desmentido, y que no
//     reconoció ya un libro (una igualdad exacta pesa más que una regla);
//   · qué reglas hay que penalizar · las de las líneas sobre las que el usuario
//     pulsó «No es esto».
//
// Puro. Sin base, sin React.
// ============================================================================

import type { SugerenciaPorLinea } from '../../../services/lineaComoMovimiento';
import { bucketDeLinea } from './conciliarBuckets';
import { veredictoEfectivo, type DecisionesSesion, type LineaExtracto } from './extractoSesion';

/**
 * lineaId → id de la regla que la resuelve sola · vacío si ninguna.
 *
 * Solo la vía de reglas aprendidas cuenta: un recurrente o una heurística
 * proponen, no resuelven (§13 · la confianza se gana con el uso).
 */
export function autoPorReglaDe(
  sugerencias: Map<number, SugerenciaPorLinea[]> | undefined
): Map<number, number> {
  const out = new Map<number, number>();
  if (!sugerencias) return out;
  for (const [lineaId, lista] of sugerencias) {
    for (const s of lista) {
      const meta = s.metadata as { ruleId?: unknown; resuelveSola?: unknown } | undefined;
      if (s.via !== 'learning_rule' || meta?.resuelveSola !== true) continue;
      if (typeof meta.ruleId !== 'number') continue;
      out.set(lineaId, meta.ruleId);
      break;
    }
  }
  return out;
}

/**
 * Lo que viaja al Guardar como `resueltasPorRegla`.
 *
 * Una línea entra si su bucket es «resueltas» POR la regla: sigue en
 * `resolver` para el usuario (no la asignó, creó, traspasó ni ignoró), no la
 * desmintió, y no la reconoció un libro (esa va por `approvedDeterministic`).
 */
export function lineasResueltasPorRegla(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion,
  autoPorRegla: ReadonlyMap<number, number>,
  reconocidas?: ReadonlySet<number>
): Array<{ lineaId: number; ruleId: number }> {
  const auto = new Set(autoPorRegla.keys());
  const out: Array<{ lineaId: number; ruleId: number }> = [];
  for (const l of lineas) {
    const ruleId = autoPorRegla.get(l.lineaId);
    if (ruleId == null) continue;
    if (reconocidas?.has(l.lineaId)) continue;
    if (veredictoEfectivo(l, decisiones) !== 'resolver') continue;
    if (bucketDeLinea(l, decisiones, undefined, reconocidas, auto) !== 'resueltas') continue;
    out.push({ lineaId: l.lineaId, ruleId });
  }
  return out;
}

/**
 * Las reglas que el usuario desmintió · «No es esto» sobre una línea que una
 * regla resolvía sola. Sin repetir: dos líneas de la misma regla son una
 * corrección, no dos.
 */
export function reglasCorregidas(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion,
  autoPorRegla: ReadonlyMap<number, number>
): number[] {
  const out = new Set<number>();
  for (const l of lineas) {
    const ruleId = autoPorRegla.get(l.lineaId);
    if (ruleId != null && decisiones.desemparejados.has(l.lineaId)) out.add(ruleId);
  }
  return [...out];
}
