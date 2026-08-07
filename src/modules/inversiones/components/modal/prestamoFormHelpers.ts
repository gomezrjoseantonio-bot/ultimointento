// Lógica pura del formulario de préstamo (`AltaPrestamoModal`): validación de
// las condiciones y reajuste de las aportaciones cuando se edita el capital.
// Vive aparte para que el modal se quede con el formulario y el estado.

import type { Aportacion, PosicionInversion } from '../../../../types/inversiones';

export interface CondicionesPrestamo {
  capital: number;
  tin: number;
  duracionMeses: number;
  cuentaCargo: string;
  fechaFirma: string;
  fechaPrimerCobro: string;
}

/**
 * Primer motivo por el que el préstamo no se puede guardar, listo para el
 * toast. `null` si las condiciones son válidas.
 */
export function validarCondiciones(c: CondicionesPrestamo): string | null {
  if (!Number.isFinite(c.capital) || c.capital <= 0) {
    return 'El capital debe ser mayor que 0';
  }
  if (!Number.isFinite(c.tin) || c.tin <= 0) {
    return 'El TIN debe ser mayor que 0';
  }
  if (!Number.isFinite(c.duracionMeses) || c.duracionMeses <= 0) {
    return 'La duración debe ser mayor que 0 meses';
  }
  if (!c.cuentaCargo) {
    return 'Selecciona la cuenta de cargo del capital';
  }
  if (!c.fechaPrimerCobro) {
    return 'Indica desde cuándo se reciben los intereses';
  }
  if (c.fechaPrimerCobro < c.fechaFirma) {
    return 'El primer cobro de intereses no puede ser anterior a la firma';
  }
  return null;
}

/**
 * Al editar el capital de un préstamo vivo no se reescribe el histórico: se
 * ajusta la aportación inicial por la diferencia, de modo que lo ya amortizado
 * se conserva. Devuelve `null` si el capital no cambia (no hay nada que tocar).
 */
export function ajustarCapitalEditado(
  posicion: PosicionInversion,
  nuevoCapital: number,
  fechaFirma: string,
  cuentaCargoId: number,
): Partial<PosicionInversion> | null {
  const capitalPrevio = Number(posicion.total_aportado ?? posicion.valor_actual ?? 0);
  const delta = nuevoCapital - capitalPrevio;
  if (delta === 0) return null;

  const aportaciones: Aportacion[] = [...(posicion.aportaciones ?? [])].sort((a, b) =>
    String(a.fecha).localeCompare(String(b.fecha)),
  );
  const idxInicial = aportaciones.findIndex((a) => a.tipo === 'aportacion');
  if (idxInicial >= 0) {
    aportaciones[idxInicial] = {
      ...aportaciones[idxInicial],
      importe: Number(aportaciones[idxInicial].importe ?? 0) + delta,
      fecha: `${fechaFirma}T12:00:00.000Z`,
      cuenta_cargo_id: cuentaCargoId,
    };
  }
  const totalAportado = aportaciones.reduce((sum, a) => {
    if (a.tipo === 'reembolso') return sum - Number(a.importe ?? 0);
    if (a.tipo === 'aportacion') return sum + Number(a.importe ?? 0);
    return sum;
  }, 0);

  return {
    aportaciones,
    total_aportado: totalAportado,
    valor_actual: Math.max(0, Number(posicion.valor_actual ?? 0) + delta),
    fecha_valoracion: posicion.fecha_valoracion,
  };
}
