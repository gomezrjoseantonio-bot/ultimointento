// Venta de un inmueble · el cobro y la cancelación de la hipoteca.
//
// `PropertySale` guarda `saleDate`, `netProceeds` y `loanSettlement.total`: las
// dos patas de dinero que el banco va a enseñar el día de la firma. Son cifras
// que el usuario introdujo en el wizard de venta, no estimaciones.
//
// Solo las ventas `confirmed`. Un borrador es una simulación —el usuario está
// probando qué le quedaría— y conciliar contra una simulación sería dar por
// hecho algo que no ha pasado.

import type { PropertySale } from '../db/types';
import type { Movement } from '../db';
import type { OrigenDeterminista } from './tipos';
import { mismoDia, mismoImporte } from './igualdad';

/** Las dos patas de dinero de una venta, con su signo esperado. */
function patasDeLaVenta(v: PropertySale): Array<{
  pieza: string;
  importe: number;
  entra: boolean;
  titulo: string;
}> {
  const patas = [];
  if (v.netProceeds > 0) {
    patas.push({
      pieza: 'cobro',
      importe: v.netProceeds,
      entra: true,
      titulo: 'Cobro de la venta',
    });
  }
  if (v.loanSettlement?.total > 0) {
    patas.push({
      pieza: 'cancelacion',
      importe: v.loanSettlement.total,
      entra: false,
      titulo: 'Cancelación de la hipoteca al vender',
    });
  }
  return patas;
}

/**
 * Reconoce las líneas que son el dinero de una venta.
 *
 * Como en las cuotas, un empate no se resuelve: dos ventas por el mismo importe
 * el mismo día se dejan sin reconocer.
 */
export function ventasQueCuadran(
  movimientos: Movement[],
  ventas: PropertySale[],
): OrigenDeterminista[] {
  const out: OrigenDeterminista[] = [];

  for (const m of movimientos) {
    if (m.id == null) continue;
    const candidatos: OrigenDeterminista[] = [];

    for (const v of ventas) {
      if (v.status !== 'confirmed') continue;
      if (!mismoDia(v.saleDate, m.date)) continue;

      for (const pata of patasDeLaVenta(v)) {
        // El signo importa: el cobro entra y la cancelación sale. Sin esto, una
        // venta cuyo cobro y cancelación coincidieran en importe casaría la
        // pata equivocada.
        if (pata.entra !== (m.amount > 0)) continue;
        if (!mismoImporte(pata.importe, m.amount)) continue;

        candidatos.push({
          movementId: m.id,
          fuente: 'venta',
          origenId: String(v.id ?? ''),
          piezaId: pata.pieza,
          titulo: pata.titulo,
          como: 'fecha_importe',
          inmuebleId: v.propertyId,
        });
      }
    }

    if (candidatos.length === 1) out.push(candidatos[0]);
  }

  return out;
}
