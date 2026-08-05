// ============================================================================
// Confirmar o rectificar una revisión · VOCABULARIO §6 ter · ter
// ============================================================================
//
// ATLAS no ve la carta del banco. Puede decir qué demuestran tus movimientos,
// pero no si te dejaron la bonificación: los bancos perdonan, aplican criterios
// propios y a veces te dan una que no esperabas. Por eso una revisión que ya
// pasó **no cambia nada sola** — queda esperando a que digas qué pasó.
//
// Y va en los DOS SENTIDOS (decisión de Jose · 4 ago 2026). Empezar a cumplir
// una que no tenías baja la cuota igual que perderla la sube, y las dos cosas
// se confirman aquí.
//
// Al confirmar se propaga hasta donde se nota:
//
//   · Los estados de las bonificaciones pasan a ser lo que el banco decidió.
//   · El cuadro se recalcula DESDE la revisión, conservando lo pagado
//     (`recalcularDesde`) — nunca desde el origen, que reescribiría intereses
//     ya cobrados.
//   · Las previsiones de tesorería salen del cuadro, así que se corrigen solas.
// ============================================================================

import type { Prestamo } from '../../types/prestamos';
import { prestamosService } from '../prestamosService';
import { tinConBonificaciones } from '../bonificaciones/tinEfectivo';
import { tinBase } from '../../modules/financiacion/helpers';
import { recalcularDesde } from './cuadroPorTramos';

/** Qué decidió el banco con cada bonificación. */
export type LoQueDecidioElBanco = Record<string, 'CUMPLIDA' | 'PERDIDA'>;

export interface RevisionConfirmada {
  /** La revisión que se está dando por vista · `YYYY-MM-DD` o `YYYY-MM`. */
  fecha: string;
  /** Desde qué día rige el tipo nuevo · `YYYY-MM-DD`. */
  aplicaDesde: string;
  /** Lo que el banco decidió, bonificación a bonificación. */
  decision: LoQueDecidioElBanco;
}

export interface ResultadoDeConfirmar {
  /** El tipo que se pagaba antes de esta revisión. */
  tinAntes: number;
  /** El que se paga desde ella. */
  tinDespues: number;
  /** Si el cuadro se ha rehecho · no lo hace si el tipo no cambia. */
  cuadroRehecho: boolean;
}

/**
 * Aplica lo que el banco decidió en una revisión.
 *
 * Devuelve `null` si el préstamo no existe. No inventa nada: las
 * bonificaciones que no aparezcan en `decision` se quedan como estaban, porque
 * no decir nada de una no es decir que se perdió.
 */
export async function confirmarRevision(
  prestamoId: string,
  revision: RevisionConfirmada
): Promise<ResultadoDeConfirmar | null> {
  const prestamo = await prestamosService.getPrestamoById(prestamoId);
  if (!prestamo) return null;

  const base = tinBase(prestamo);
  const tinAntes = tinConBonificaciones(base, prestamo.bonificaciones, prestamo);

  const bonificaciones = (prestamo.bonificaciones ?? []).map((b) => {
    const decidido = revision.decision[b.id];
    return decidido ? { ...b, estado: decidido } : b;
  });

  const tinDespues = tinConBonificaciones(base, bonificaciones, prestamo);

  // El cuadro se lee ANTES de guardar, y el guardado va con `conservarPlan`.
  //
  // `updatePrestamo` regenera el plan cuando cambia lo que rebajan las
  // bonificaciones, pero lo regenera DESDE EL ORIGEN, que es justo lo que aquí
  // no vale. Dejarle hacerlo y pisarlo después dejaba el cuadro incorrecto
  // guardado entre las dos escrituras — y ahí se quedaba para siempre si la app
  // se cerraba en medio.
  const planAntes = await prestamosService.getPaymentPlan(prestamoId);

  const actualizado: Partial<Prestamo> = {
    bonificaciones,
    ultimaRevisionBonificacionesConfirmada: revision.fecha,
  };

  // Si el tipo no se mueve no hay cuadro que rehacer · perder una bonificación
  // con el tope ya alcanzado por otras no cambia lo que pagas.
  const cambiaElTipo = Math.abs(tinDespues - tinAntes) > 0.000001;
  const rehacer = cambiaElTipo && planAntes != null;

  await prestamosService.updatePrestamo(prestamoId, actualizado, { conservarPlan: rehacer });

  if (rehacer) {
    const planNuevo = recalcularDesde(planAntes!, {
      desde: revision.aplicaDesde,
      tinAnual: tinDespues,
    });
    await prestamosService.savePaymentPlan(prestamoId, planNuevo);
  }

  return { tinAntes, tinDespues, cuadroRehecho: rehacer };
}
