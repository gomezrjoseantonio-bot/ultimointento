// Guardar lo reconocido · lo único de este camino que ESCRIBE.
//
// Se llama desde `confirmDecisions`, dentro del mismo Guardar que el resto de
// decisiones. Hace dos cosas y ninguna más:
//
//   1 · Deja el movimiento CONCILIADO, con la clasificación que trae su origen
//       (el piso del préstamo, la categoría). El texto del banco no se toca:
//       `hashMovement` dedupica por él, y reescribirlo haría que un reimport
//       solapado no reconociera la línea y duplicara el cargo.
//
//   2 · Anota el desglose fiscal EN EL ORIGEN, no en el movimiento: el interés y
//       la amortización son del cuadro del préstamo, y el bruto y la retención
//       del pago de la inversión. Ahí es donde los busca la declaración.
//
// §3.3 · nada de esto se enseña al conciliar. El usuario cuadra su tesorería.

import type { IDBPDatabase } from 'idb';
import type { Movement } from '../db';
import type { OrigenDeterminista } from './tipos';

/** Lo que hace falta de la base · para poder probar esto sin abrir IndexedDB. */
export interface BaseParaCierre {
  get(store: string, key: unknown): Promise<unknown>;
  put(store: string, valor: unknown): Promise<unknown>;
}

/**
 * El movimiento, cerrado contra su origen.
 *
 * `statusConciliacion: 'match_automatico'` y no `'match_manual'`: esto lo cerró
 * ATLAS por una igualdad exacta, no el usuario a mano. Quien audite después
 * tiene que poder distinguirlo.
 */
export function movimientoCerrado(m: Movement, o: OrigenDeterminista, ahora: string): Movement {
  return {
    ...m,
    ...(o.inmuebleId != null ? { inmuebleId: String(o.inmuebleId), ambito: 'INMUEBLE' as const } : {}),
    ...(o.categoryKey != null ? { categoryKey: o.categoryKey } : {}),
    // El nombre legible convive con el churro del banco, no lo sustituye.
    descripcionPrevision: o.titulo,
    unifiedStatus: 'conciliado',
    statusConciliacion: 'match_automatico',
    updatedAt: ahora,
  };
}

/** Marca el periodo del cuadro como pagado por este movimiento. */
async function anotarEnPrestamo(db: BaseParaCierre, o: OrigenDeterminista, m: Movement): Promise<void> {
  const desglose = o.desglose;
  if (desglose?.tipo !== 'prestamo') return;
  const pr = (await db.get('prestamos', o.origenId)) as
    | { planPagos?: { periodos?: Array<Record<string, unknown>> } }
    | undefined;
  const periodos = pr?.planPagos?.periodos;
  if (!periodos) return;
  const periodo = periodos.find((p) => p.periodo === desglose.periodo);
  if (!periodo) return;
  // El desglose ya estaba calculado en el cuadro; lo que faltaba era decir que
  // ESTA cuota ya se pagó, y con qué movimiento. Sin la huella, un reimport
  // volvería a casarla y la contaría dos veces (`esGirableporElBanco`).
  periodo.pagado = true;
  periodo.fechaPagoReal = m.date;
  periodo.movimientoTesoreriaId = String(m.id);
  await db.put('prestamos', pr);
}

/** Marca el pago de rendimiento como cobrado por este movimiento. */
async function anotarEnInversion(db: BaseParaCierre, o: OrigenDeterminista, m: Movement): Promise<void> {
  if (o.desglose?.tipo !== 'rendimiento') return;
  const pos = (await db.get('inversiones', Number(o.origenId) || o.origenId)) as
    | { rendimiento?: { pagos_generados?: Array<Record<string, unknown>> } }
    | undefined;
  const pagos = pos?.rendimiento?.pagos_generados;
  if (!pagos) return;
  const pago = pagos.find((p) => String(p.id) === o.piezaId);
  if (!pago) return;
  pago.estado = 'pagado';
  pago.movimiento_id = m.id;
  await db.put('inversiones', pos);
}

/**
 * Aplica un reconocimiento. Devuelve `true` si el movimiento quedó cerrado.
 *
 * Si anotar en el origen falla, el movimiento se cierra igual: la conciliación
 * de tesorería es lo que el usuario acaba de pedir, y perder la huella fiscal es
 * molesto, pero dejarle la línea sin conciliar tras haber pulsado Guardar es
 * peor y además incumple el cuadre de FASE 1.
 */
export async function aplicarReconocimiento(
  db: BaseParaCierre,
  o: OrigenDeterminista,
  ahora: string,
): Promise<boolean> {
  const m = (await db.get('movements', o.movementId)) as Movement | undefined;
  if (!m) return false;

  await db.put('movements', movimientoCerrado(m, o, ahora));

  try {
    if (o.fuente === 'prestamo') await anotarEnPrestamo(db, o, m);
    if (o.fuente === 'inversion') await anotarEnInversion(db, o, m);
  } catch (err) {
    console.warn('[deterministas] no se pudo anotar el desglose en el origen', err);
  }
  return true;
}

/** El adaptador desde la base real · `IDBPDatabase` cumple el contrato. */
export function baseDe(db: IDBPDatabase<never>): BaseParaCierre {
  return db as unknown as BaseParaCierre;
}
