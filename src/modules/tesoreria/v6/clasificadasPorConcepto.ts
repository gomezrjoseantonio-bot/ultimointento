// ============================================================================
// E2.4.2-fix2 · Lo que el MOTOR clasificó · visto desde la sesión
// ============================================================================
//
// El orquestador clasifica cada línea al importar y lo guarda en la fila
// (`lineasExtracto.clasificacion`). Hasta ahora nadie lo leía: ni los montones
// ni Guardar. Este módulo es el espejo de `resueltasPorRegla` para esa señal:
//
//   · qué líneas van al montón «resueltas» porque tienen sus 4 ejes puestos
//     (`estaClasificada` · D1);
//   · cuáles de ellas viajan al Guardar como `resueltasPorConcepto` · SOLO las
//     que el usuario no ha decidido de otra manera ni ha desmentido, y que no
//     cerró ya un libro o una regla (esas van por su propio camino).
//
// Puro. Sin base, sin React.
// ============================================================================

import { estaClasificada } from '../../../services/clasificacion/clasificada';
import { bucketDeLinea } from './conciliarBuckets';
import { veredictoEfectivo, type DecisionesSesion, type LineaExtracto } from './extractoSesion';

/** lineaId de cada línea que el motor dejó con sus ejes puestos. */
export function clasificadasDe(lineas: readonly LineaExtracto[]): Set<number> {
  const out = new Set<number>();
  for (const l of lineas) if (estaClasificada(l.clasificacion)) out.add(l.lineaId);
  return out;
}

/**
 * Lo que viaja al Guardar como `resueltasPorConcepto`.
 *
 * Una línea entra si su bucket es «resueltas» POR la clasificación: sigue en
 * `resolver` para el usuario, no la desmintió («No es esto»), y no la resolvió
 * antes un libro (`reconocidas`) ni una regla (`autoResueltas`).
 */
export function lineasResueltasPorConcepto(
  lineas: readonly LineaExtracto[],
  decisiones: DecisionesSesion,
  clasificadas: ReadonlySet<number>,
  reconocidas?: ReadonlySet<number>,
  autoResueltas?: ReadonlySet<number>,
): number[] {
  const out: number[] = [];
  for (const l of lineas) {
    if (!clasificadas.has(l.lineaId)) continue;
    if (reconocidas?.has(l.lineaId) || autoResueltas?.has(l.lineaId)) continue;
    if (veredictoEfectivo(l, decisiones) !== 'resolver') continue;
    if (bucketDeLinea(l, decisiones, undefined, reconocidas, autoResueltas, clasificadas) !== 'resueltas') continue;
    out.push(l.lineaId);
  }
  return out;
}
