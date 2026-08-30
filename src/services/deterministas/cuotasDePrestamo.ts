// Cuotas de préstamo · el cuadro de amortización que el usuario ya tiene.
//
// `planPagos.periodos[]` lleva `fechaCargo`, `cuota`, `interes` y `amortizacion`
// por periodo: la fecha y el importe con los que el banco va a girar. Casar una
// línea del extracto contra eso es una igualdad, no una estimación.
//
// Dos líneas del cuadro que NO son un recibo del banco y no pueden casar:
//   · `esAdelantoDeCapital` · una entrega de capital que apuntó el propio
//     usuario al amortizar. No la gira el banco.
//   · un periodo ya `pagado` con `movimientoTesoreriaId` · ya tiene su
//     movimiento; volver a casarlo contra otra línea contaría la cuota dos veces.

import type { Prestamo } from '../../types/prestamos';
import type { PeriodoPago } from '../../types/planPagos';
import type { Movement } from '../db';
import type { OrigenDeterminista } from './tipos';
import { mismoDia, mismoImporte } from './igualdad';

/** ¿Este periodo del cuadro puede corresponder a una línea del banco? */
export function esGirableporElBanco(p: PeriodoPago): boolean {
  if (p.esAdelantoDeCapital) return false;
  if (p.pagado && p.movimientoTesoreriaId) return false;
  return true;
}

/**
 * Cómo se llama esta cuota en pantalla.
 *
 * «Cuota 7/240 · Unicaja». Nunca el id del préstamo ni el nombre del campo: el
 * usuario reconoce su préstamo por el banco y por el número de cuota.
 */
export function tituloDeCuota(prestamo: Prestamo, p: PeriodoPago, total: number): string {
  const nombre = prestamo.nombre?.trim() || prestamo.banco?.trim() || 'préstamo';
  return `Cuota ${p.periodo}/${total} · ${nombre}`;
}

/**
 * Reconoce las líneas que son una cuota de algún préstamo.
 *
 * Se recorre movimiento a movimiento y se para en la PRIMERA cuota que cuadra:
 * dos préstamos con la misma cuota el mismo día es un empate que no se puede
 * resolver por importe y fecha, y elegir uno a ciegas es peor que no elegir.
 * Ese caso se deja sin reconocer y cae en «te necesitan», que es donde el
 * usuario lo resuelve de un vistazo.
 */
export function cuotasQueCuadran(
  movimientos: Movement[],
  prestamos: Prestamo[],
): OrigenDeterminista[] {
  const out: OrigenDeterminista[] = [];

  for (const m of movimientos) {
    if (m.id == null) continue;
    // Una cuota SALE de la cuenta. Un abono nunca es una cuota.
    if (m.amount >= 0) continue;

    const candidatos: OrigenDeterminista[] = [];

    for (const pr of prestamos) {
      const periodos = pr.planPagos?.periodos;
      if (!periodos?.length) continue;

      for (const p of periodos) {
        if (!esGirableporElBanco(p)) continue;
        if (!mismoDia(p.fechaCargo, m.date)) continue;
        if (!mismoImporte(p.cuota, m.amount)) continue;

        candidatos.push({
          movementId: m.id,
          fuente: 'prestamo',
          origenId: String(pr.id ?? ''),
          piezaId: String(p.periodo),
          titulo: tituloDeCuota(pr, p, periodos.length),
          como: 'fecha_importe',
          desglose: {
            tipo: 'prestamo',
            periodo: p.periodo,
            interes: p.interes,
            amortizacion: p.amortizacion,
          },
          ...(pr.inmuebleId != null ? { inmuebleId: Number(pr.inmuebleId) } : {}),
        });
      }
    }

    // Empate = no se elige. Ver el comentario de arriba.
    if (candidatos.length === 1) out.push(candidatos[0]);
  }

  return out;
}
