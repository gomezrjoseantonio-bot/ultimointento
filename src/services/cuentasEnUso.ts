// ============================================================================
// Tesorería V6 · §4.8 · qué cuentas siguen en uso
// ============================================================================
//
// Dar de baja una cuenta es SUAVE: `cuentasService.deactivate` la deja en su
// sitio con `status: 'INACTIVE'` para que Deshacer sea inmediato y el histórico
// no se toque. Lo que no puede pasar es que siga saliendo en pantalla.
//
// Y salía: la tira de cuentas, los KPIs del hero y el móvil filtraban cada uno
// por su cuenta y los tres comprobaban solo `status !== 'DELETED'`. Una cuenta
// dada de baja no es una cuenta borrada, así que pasaba los tres filtros: la
// baja se guardaba de verdad, el aviso decía la verdad, y la pantalla seguía
// enseñándola como si nada.
//
// El criterio vive aquí y no repetido en cada pantalla justamente por eso: era
// el mismo tres veces y las tres estaban mal igual.
//
// No hace falta una segunda lista para resolver nombres de cuentas dadas de
// baja: `motivoParaNoDarDeBaja` impide la baja mientras queden pendientes, así
// que una cuenta de baja no puede aparecer en ninguna bandeja de trabajo.
// ============================================================================

import type { Account } from './db';

/** ¿Está esta cuenta fuera de juego —de baja o borrada—? */
export function estaDeBaja(cuenta: Account): boolean {
  if (cuenta.status === 'DELETED' || cuenta.status === 'INACTIVE') return true;
  if (cuenta.deleted_at) return true;
  // Campos heredados · `deactivate` los mantiene en sintonía con `status`, pero
  // hay cuentas antiguas que solo tienen estos.
  if (cuenta.activa === false) return true;
  return false;
}

/** Las que siguen en uso · las únicas que se pintan y suman. */
export function cuentasEnUso(cuentas: Account[]): Account[] {
  return cuentas.filter((c) => !estaDeBaja(c));
}
