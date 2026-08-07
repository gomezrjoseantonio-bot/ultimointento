// ============================================================================
// Lo que un compromiso recurrente va a costar · la proyección, en un sitio
// ============================================================================
//
// Un compromiso no se prorratea en su modelo —el IBI son 500 € en junio y 500 €
// en noviembre, no 83 € al mes—, así que «cuánto cuesta al año» hay que
// calcularlo expandiendo su patrón sobre el año y sumando lo que caiga.
//
// Vive aquí porque lo preguntan dos sitios que no se conocen: el colchón del
// panel, que quiere la vista prorrateada, y la verificación de bonificaciones,
// que quiere saber si la prima de un seguro llega al mínimo que pide el banco.
// Escrito dos veces, un día uno de los dos contaría los pagos puntuales y el
// otro no, y las dos pantallas dirían cifras distintas del mismo recibo.
// ============================================================================

import { expandirPatron, calcularImporte } from '../personal/patronCalendario';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

/**
 * Un compromiso que de verdad se va a cobrar y se repite.
 *
 * Los `puntual` quedan fuera: son un pago único, y meterlos en un coste anual
 * recurrente diría que el año que viene vuelve a pasar.
 */
export const esActivoRecurrente = (c: CompromisoRecurrente): boolean =>
  c.estado === 'activo' && c.patron?.tipo !== 'puntual';

/**
 * Lo que este compromiso suma en un año natural.
 *
 * Cero si su patrón no se puede expandir · un calendario roto no se convierte
 * en una cifra inventada.
 */
export const costeAnualDe = (c: CompromisoRecurrente, anio: number): number => {
  try {
    const fechas = expandirPatron(c.patron, `${anio}-01-01`, `${anio}-12-31`);
    return fechas.reduce((s, f) => s + calcularImporte(c.importe, f), 0);
  } catch {
    return 0;
  }
};
