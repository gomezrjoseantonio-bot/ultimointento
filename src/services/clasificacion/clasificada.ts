// ============================================================================
// E2.4.2-fix2 · ¿Está clasificada esta línea? · «resuelto = tiene sus 4 ejes»
// ============================================================================
//
// El motor rellena los ejes que sabe y deja el resto por defecto. Esto decide
// cuándo lo que sabe BASTA para dar la línea por resuelta sin gesto del
// usuario (Jose · 11 sep 2026 · D1):
//
//   · una familia puesta por CONCEPTO, IDENTIFICADOR o regla APRENDIDA;
//   · o un movimiento interno que no venga del defecto (un traspaso propio,
//     el ahorro, la fianza).
//
// Un ingreso «por el signo» sin familia NO está clasificado: es lo que hay
// que preguntar. Y una familia por RECURRENCIA tampoco cuenta aquí: un
// recurrente que casa por texto propone, no resuelve (§13).
// ============================================================================

import { labelClasificacion, LABEL_NATURALEZA } from '../catalogo/catalogoUnico';
import type { ClasificacionLinea, OrigenEje } from './tipos';

const RESUELVE: ReadonlySet<OrigenEje> = new Set<OrigenEje>(['concepto', 'identificador', 'aprendida']);

export function estaClasificada(c: ClasificacionLinea | undefined | null): boolean {
  if (!c) return false;
  if (c.naturaleza === 'movimiento_interno') return c.origen.naturaleza !== 'defecto';
  return c.familia !== undefined && c.origen.familia !== undefined && RESUELVE.has(c.origen.familia);
}

/**
 * Lo que se lee de una clasificación · «Gasto · Gestión · Gestoría»,
 * «Traspaso · A ahorro». Sin familia, solo la naturaleza.
 */
export function etiquetaDeClasificacion(c: ClasificacionLinea): string {
  const nat = LABEL_NATURALEZA[c.naturaleza];
  if (!c.familia) return nat;
  const fam = labelClasificacion(c.familia, c.subtipo);
  return c.naturaleza === 'movimiento_interno' ? fam : `${nat} · ${fam}`;
}

/**
 * El aviso de una línea que se queda SIN clasificar a propósito · el último
 * motivo que no sea el del defecto (el IVA: «movimiento con Hacienda…»).
 * `null` si no hay nada que decir más allá de «no sé».
 */
export function avisoDeClasificacion(c: ClasificacionLinea | undefined | null): string | null {
  if (!c || estaClasificada(c)) return null;
  const propios = c.motivos.filter((m) => !m.startsWith('sin señal'));
  return propios.length > 0 ? propios[propios.length - 1] : null;
}
