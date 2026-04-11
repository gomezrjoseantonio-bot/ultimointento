/**
 * Servicio de imputación de intereses — Financiación v2
 *
 * Reglas fiscales:
 * - Solo destinos ADQUISICION o REFORMA vinculados a un inmueble generan
 *   intereses deducibles (casilla 0105 IRPF).
 * - La garantía NO determina la deducibilidad.
 * - El reparto es proporcional al importe destinado respecto al principalInicial.
 * - Fallback legacy: si el préstamo no tiene destinos usa inmuebleId /
 *   afectacionesInmueble (comportamiento idéntico a getAllocationFactor).
 */

import type { Prestamo } from '../types/prestamos';

// Tipos de destino que generan intereses deducibles en alquiler
const TIPOS_DEDUCIBLES = new Set<string>(['ADQUISICION', 'REFORMA']);

/**
 * Calcula el factor de imputación de un préstamo a un inmueble concreto.
 *
 * Devuelve un número en [0, 1]:
 * - 1.0  → todo el préstamo va a ese inmueble
 * - 0.5  → la mitad del préstamo va a ese inmueble
 * - 0.0  → el préstamo no tiene relación con ese inmueble
 *
 * Compatibilidad legacy:
 * - Si el préstamo no tiene `destinos` → usa afectacionesInmueble o inmuebleId.
 */
export function getImputacionFactor(
  prestamo: Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble' | 'destinos' | 'principalInicial'>,
  inmuebleId: string
): number {
  // ─── Modelo v2: usar destinos ───
  if (prestamo.destinos && prestamo.destinos.length > 0) {
    const principal = prestamo.principalInicial;
    if (!principal || principal <= 0) return 0;

    const importeDestinado = prestamo.destinos
      .filter((d) => d.inmuebleId === inmuebleId)
      .reduce((sum, d) => sum + (d.importe ?? 0), 0);

    return Math.min(1, importeDestinado / principal);
  }

  // ─── Legacy: afectacionesInmueble ───
  if (prestamo.afectacionesInmueble && prestamo.afectacionesInmueble.length > 0) {
    const afectacion = prestamo.afectacionesInmueble.find((a) => a.inmuebleId === inmuebleId);
    return afectacion ? afectacion.porcentaje / 100 : 0;
  }

  // ─── Legacy: inmuebleId único ───
  return prestamo.inmuebleId === inmuebleId ? 1 : 0;
}

/**
 * Calcula los intereses deducibles correspondientes a un inmueble en un año.
 *
 * Solo los destinos de tipo ADQUISICION o REFORMA vinculados al inmueble
 * contribuyen a la deducibilidad.
 *
 * Fallback legacy: si el préstamo no tiene destinos usa inmuebleId / afectaciones
 * y asume que el préstamo es de tipo ADQUISICION (comportamiento anterior).
 */
export function interesesDeduciblesInmueble(
  prestamo: Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble' | 'destinos' | 'principalInicial'>,
  inmuebleId: string,
  interesesTotalAño: number
): number {
  if (interesesTotalAño <= 0) return 0;

  // ─── Modelo v2: usar solo destinos deducibles ───
  if (prestamo.destinos && prestamo.destinos.length > 0) {
    const principal = prestamo.principalInicial;
    if (!principal || principal <= 0) return 0;

    const importeDeducible = prestamo.destinos
      .filter((d) => d.inmuebleId === inmuebleId && TIPOS_DEDUCIBLES.has(d.tipo))
      .reduce((sum, d) => sum + (d.importe ?? 0), 0);

    const factor = Math.min(1, importeDeducible / principal);
    return Math.round(interesesTotalAño * factor * 100) / 100;
  }

  // ─── Legacy fallback: toda la imputación es deducible ───
  const factor = getImputacionFactor(prestamo, inmuebleId);
  return Math.round(interesesTotalAño * factor * 100) / 100;
}
