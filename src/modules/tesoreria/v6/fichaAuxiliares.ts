// ============================================================================
// Piezas sueltas de la ficha de movimiento
// ============================================================================
//
// Salen de `FichaMovimiento` porque no son la ficha: son dos utilidades que
// solo necesitaban un sitio, y la ficha ya es el fichero más largo de la
// pantalla.
// ============================================================================

import type { Account } from '../../../services/db';

export function etiquetaCuenta(c: Account): string {
  const nombre = c.alias || c.name || c.banco?.name || 'Cuenta';
  const mask = c.ultimosCuatro || c.iban?.slice(-4);
  return mask ? `${nombre} ···· ${mask}` : nombre;
}

/** Acepta coma o punto decimal · devuelve `null` si no es un importe válido. */
export function parseImporte(raw: string): number | null {
  const sinAdornos = raw.replace(/[€\s]/g, '');
  if (!sinAdornos) return null;
  // Con coma, el punto es separador de miles ("1.234,50"). Sin coma, un punto
  // es decimal ("74.09"): quitarlo siempre convertiría 74.09 en 7409.
  const normalizado = sinAdornos.includes(',')
    ? sinAdornos.replace(/\./g, '').replace(',', '.')
    : sinAdornos;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}
