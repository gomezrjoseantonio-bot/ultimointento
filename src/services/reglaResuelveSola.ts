// ============================================================================
// E2.2 · Cuándo una regla aprendida deja de PROPONER y RESUELVE sola
// ============================================================================
//
// Una regla nace de un gesto del usuario y, al principio, solo propone: la
// tarjeta dice «parece la comunidad del piso 4» y él confirma. Cada
// confirmación sin corrección es una aplicación más (`appliedCount`). Cuando
// llega a N, ATLAS deja de preguntar por ese concepto y lo resuelve solo al
// Guardar —nace el movimiento con su fila fiscal, igual que si lo hubiera
// clasificado él—, pero SIEMPRE reclasificable (§13): auto no encierra.
//
// Corregir una regla la devuelve a proponer: «No es esto» sobre una línea que
// la regla resolvió (`penalizarRegla`) o clasificarla de otra manera
// (`createOrUpdateRule` detecta el cambio de opinión) ponen `appliedCount` a
// cero o a uno y suman una corrección. La confianza se gana con el uso y se
// pierde con el error; no es un interruptor.
//
// N vive AQUÍ y solo aquí. Es prudente de arranque (decisión Jose · opción B) y
// se baja cuando se vea que acierta. Nada más en el código conoce el número.
// ============================================================================

import type { MovementLearningRule } from './db';
import { resolveCasillaAEAT } from './treasuryConfirmationService';

/** Aplicaciones sin corrección a partir de las cuales la regla resuelve sola. */
export const APLICACIONES_PARA_RESOLVER_SOLA = 3;

type ReglaMinima = Pick<
  MovementLearningRule,
  'appliedCount' | 'ambito' | 'categoria' | 'resolucion' | 'cuentaDestinoId'
>;

/** ¿Se ha ganado la confianza? · `appliedCount` ya descuenta las correcciones. */
export function tieneConfianza(rule: Pick<MovementLearningRule, 'appliedCount'>): boolean {
  return (rule.appliedCount ?? 0) >= APLICACIONES_PARA_RESOLVER_SOLA;
}

/**
 * ¿Puede esta regla resolver una línea sin preguntar?
 *
 * Confianza ganada Y una resolución que se pueda ejecutar sin pedir nada:
 *   · un traspaso necesita saber a qué cuenta;
 *   · un gasto de INMUEBLE necesita casilla · sin ella la ficha se queda abierta
 *     pidiéndola (`falta_casilla`), y en automático no hay a quién pedírsela,
 *     así que se sigue proponiendo en vez de resolver a medias.
 */
export function puedeResolverSola(rule: ReglaMinima): boolean {
  if (!tieneConfianza(rule)) return false;
  if (rule.resolucion === 'traspaso') return rule.cuentaDestinoId != null;
  if (rule.ambito === 'INMUEBLE') return !!resolveCasillaAEAT(rule.categoria);
  return !!rule.categoria;
}
