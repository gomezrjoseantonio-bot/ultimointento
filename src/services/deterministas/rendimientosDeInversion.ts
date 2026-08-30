// Rendimiento de una inversión · el pago que ya está apuntado.
//
// `rendimiento.pagos_generados[]` lleva `fecha_pago`, `importe_neto`,
// `importe_bruto` y `retencion_fiscal`. Lo que llega a la cuenta es el NETO; el
// bruto y la retención viajan con el reconocimiento para persistirlos por
// detrás (§3.3) y no se enseñan al conciliar.
//
// ── Un aviso de tipos ───────────────────────────────────────────────────────
//
// `pagos_generados` NO está en `PosicionInversion`, que es el tipo que declara
// `db.ts` para el store `inversiones`. Vive en `InversionRendimientoPeriodico`
// (`types/inversiones-extended.ts:57`), una ampliación que solo aplica a
// cuenta_remunerada · prestamo_p2p · deposito_plazo. En la base conviven las dos
// formas, así que aquí se lee con un tipo local estrecho en vez de ensanchar el
// canónico: ensancharlo prometería a todo lector que el campo está, y no está.
//
// Las posiciones sin `pagos_generados` NO se fuerzan (§1.3): sin fechas ni
// importes apuntados no hay nada determinista que casar, y caen en «te
// necesitan», que es la verdad.

import type { Movement } from '../db';
import type { OrigenDeterminista } from './tipos';
import { mismoDia, mismoImporte } from './igualdad';

/** Lo mínimo que hace falta leer · no ensancha el tipo canónico del store. */
interface PosicionConPagos {
  id?: number | string;
  nombre?: string;
  rendimiento?: {
    pagos_generados?: Array<{
      id: number;
      fecha_pago: string;
      importe_bruto: number;
      retencion_fiscal: number;
      importe_neto: number;
      estado?: string;
      movimiento_id?: number;
    }>;
  };
}

export function rendimientosQueCuadran(
  movimientos: Movement[],
  posiciones: PosicionConPagos[],
): OrigenDeterminista[] {
  const out: OrigenDeterminista[] = [];

  for (const m of movimientos) {
    if (m.id == null) continue;
    // Un rendimiento ENTRA en la cuenta.
    if (m.amount <= 0) continue;

    const candidatos: OrigenDeterminista[] = [];

    for (const pos of posiciones) {
      for (const pago of pos.rendimiento?.pagos_generados ?? []) {
        // Ya tiene su movimiento · casarlo otra vez lo contaría dos veces.
        if (pago.movimiento_id != null) continue;
        if (!mismoDia(pago.fecha_pago, m.date)) continue;
        if (!mismoImporte(pago.importe_neto, m.amount)) continue;

        candidatos.push({
          movementId: m.id,
          fuente: 'inversion',
          origenId: String(pos.id ?? ''),
          piezaId: String(pago.id),
          titulo: `Rendimiento · ${pos.nombre?.trim() || 'inversión'}`,
          como: 'fecha_importe',
          desglose: {
            tipo: 'rendimiento',
            bruto: pago.importe_bruto,
            retencion: pago.retencion_fiscal,
            neto: pago.importe_neto,
          },
        });
      }
    }

    if (candidatos.length === 1) out.push(candidatos[0]);
  }

  return out;
}
