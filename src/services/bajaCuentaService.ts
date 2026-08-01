// ============================================================================
// Tesorería V6 · §4.8 · baja de cuenta
// ============================================================================
//
// "Baja: BLOQUEADA si la cuenta tiene movimientos pendientes (mensaje
// explícito). Si procede, con Deshacer."
//
// Por qué se bloquea y no se avisa y ya: un previsto vive colgado de su cuenta.
// Dar de baja la cuenta con previstos abiertos deja esas previsiones apuntando
// a una cuenta que ya no está — no desaparecen del motor, siguen proyectando
// cierre, y el usuario no tiene dónde verlas ni resolverlas. Es mejor obligar a
// cerrarlas antes que dejar cifras huérfanas moviéndose solas.
//
// La baja es SUAVE (`deactivate`), así que Deshacer es `reactivate`. No se
// borra nada: el histórico de movimientos de una cuenta cerrada sigue siendo
// parte de la contabilidad del usuario.
// ============================================================================

import { initDB } from './db';
import type { TreasuryEvent } from './db';
import { esPendiente } from './tesoreriaV6Metrics';
import { cuentasService } from './cuentasService';

export interface MotivoBloqueo {
  /** Cuántos previstos siguen abiertos en esta cuenta. */
  pendientes: number;
  /** Los primeros, para poder nombrarlos en el mensaje en vez de solo contar. */
  ejemplos: Array<{ fecha: string; concepto: string; importe: number }>;
}

/** `null` = se puede dar de baja. */
export async function motivoParaNoDarDeBaja(accountId: number): Promise<MotivoBloqueo | null> {
  const db = await initDB();
  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];

  const abiertos = eventos
    .filter((e) => e.accountId === accountId)
    .filter((e) => esPendiente(e));

  if (abiertos.length === 0) return null;

  const porFecha = abiertos
    .slice()
    .sort((a, b) => (a.predictedDate ?? '').localeCompare(b.predictedDate ?? ''));

  return {
    pendientes: abiertos.length,
    ejemplos: porFecha.slice(0, 3).map((e) => ({
      fecha: (e.predictedDate ?? '').slice(0, 10),
      concepto: e.description,
      importe: e.type === 'income' ? Math.abs(e.amount) : -Math.abs(e.amount),
    })),
  };
}

/** El texto que ve el usuario · explícito, con las cifras, no un "no se puede". */
export function mensajeDeBloqueo(motivo: MotivoBloqueo): string {
  const n = motivo.pendientes;
  return n === 1
    ? 'Esta cuenta tiene 1 movimiento pendiente. Confírmalo o descártalo antes de darla de baja.'
    : `Esta cuenta tiene ${n} movimientos pendientes. Confírmalos o descártalos antes de darla de baja.`;
}

export class CuentaConPendientesError extends Error {
  constructor(readonly motivo: MotivoBloqueo) {
    super(mensajeDeBloqueo(motivo));
    this.name = 'CuentaConPendientesError';
  }
}

/**
 * Da de baja la cuenta si procede.
 *
 * Vuelve a comprobar los pendientes aquí, aunque la UI ya lo haya hecho para
 * pintar el botón: entre que se abre la ficha y se pulsa Dar de baja puede
 * haber pasado cualquier cosa, y el bloqueo tiene que ser real, no decorativo.
 */
export async function darDeBajaCuenta(accountId: number): Promise<void> {
  const motivo = await motivoParaNoDarDeBaja(accountId);
  if (motivo) throw new CuentaConPendientesError(motivo);
  await cuentasService.deactivate(accountId);
}

/** Deshacer · la baja es suave, así que basta con reactivar. */
export async function deshacerBajaCuenta(accountId: number): Promise<void> {
  await cuentasService.reactivate(accountId);
}
