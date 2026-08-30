// ============================================================================
// «La próxima vez, sola» · lo que ATLAS ya ha aprendido de esta cuenta
// ============================================================================
//
// El panel dorado del mockup. Su trabajo no es informar, es cerrar el trato:
// el usuario acaba de contestar seis preguntas y esto le dice qué se lleva a
// cambio — que el mes que viene esas seis no se las vuelven a hacer.
//
// Se lee de `movementLearningRules`, que es donde `createOrUpdateRule` escribe
// cuando el usuario clasifica. NO se inventa nada: si el store está vacío, el
// panel dice que todavía no reconoce nada, y eso es la verdad de una cuenta
// recién creada.
//
// Sin jerga (§3.5): aquí no se dice «regla». Se dice «cosas que ya reconozco».
// ============================================================================

import type { MovementLearningRule } from '../../../../services/db/types-movimientos';
import { etiquetaDeCategoria } from './propuestaDeLinea';

export interface CosaReconocida {
  id: number | undefined;
  /** «Emilio Carrera» · de quién o de qué. */
  quien: string;
  /** «renta de FA32» · en qué se convierte. */
  enQue: string;
  /** Aprendida en esta sesión · se enseña con sello nuevo. */
  reciente: boolean;
}

export interface LoQueYaReconoce {
  /** Las que se acaban de aprender · van arriba y con sello. */
  nuevas: CosaReconocida[];
  /** Cuántas sabía de antes · se resume en una línea, no se listan. */
  deAntes: number;
  /** El total, para la frase de la cabecera. */
  total: number;
}

/**
 * El nombre legible de una regla.
 *
 * `aliasContraparte` es lo que el banco escribe («BIZUM DE ADNAN PARWEZ») y
 * `contraparteCanonica` cómo se llama de verdad. Se prefiere el canónico: el
 * usuario reconoce a su inquilino, no la forma en que su banco lo abrevia.
 */
export function quienDeLaRegla(r: MovementLearningRule): string {
  return (r.contraparteCanonica || r.aliasContraparte || r.counterpartyPattern || '').trim() || 'sin nombre';
}

/** En qué se convierte · la categoría en cristiano, con el piso si lo hay. */
export function enQueDeLaRegla(r: MovementLearningRule, aliasInmueble?: string): string {
  const que = etiquetaDeCategoria(r.categoria) ?? r.categoria;
  if (r.ambito === 'PERSONAL') return `${que} · tuyo`;
  return aliasInmueble ? `${que} de ${aliasInmueble}` : que;
}

/**
 * Reparte las reglas entre las de esta sesión y las de antes.
 *
 * «Reciente» se decide por `updatedAt` contra el momento en que se abrió el
 * extracto, no por un contador: lo que el usuario acaba de enseñar es lo que se
 * ha tocado mientras esta pantalla estaba abierta.
 */
export function loQueYaReconoce(
  reglas: MovementLearningRule[],
  desde: string,
  aliasPorInmueble?: Map<string, string>,
): LoQueYaReconoce {
  const nuevas: CosaReconocida[] = [];
  let deAntes = 0;

  for (const r of reglas) {
    const reciente = Boolean(r.updatedAt && r.updatedAt >= desde);
    if (!reciente) {
      deAntes += 1;
      continue;
    }
    nuevas.push({
      id: r.id,
      quien: quienDeLaRegla(r),
      enQue: enQueDeLaRegla(r, r.inmuebleId ? aliasPorInmueble?.get(r.inmuebleId) : undefined),
      reciente: true,
    });
  }

  return { nuevas, deAntes, total: reglas.length };
}
