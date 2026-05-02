// T27.3 · utility pura · calcula cuánto saldo "disponible libre" queda en una
// cuenta · descontando lo que YA está asignado a otros fondos activos.
//
// El shape `cuentasAsignadas` del repo tiene 3 modos union (`completo` ·
// `parcial fijo` · `parcial porcentaje`). Esta utility normaliza los 3 a un
// `importeAsignadoEfectivo: number` antes de sumar · ver
// `importeEfectivoDeAsignacion` abajo.

import type { CuentaAsignada, FondoAhorro } from '../../../../types/miPlan';

export interface ComputeDisponibleArgs {
  cuentaId: number;
  saldoCuenta: number;
  fondos: FondoAhorro[];
  /** Si presente · este fondo se EXCLUYE del cálculo de "asignado a otros". */
  excluirFondoId?: string;
}

export interface ComputeDisponibleResult {
  saldo: number;
  asignadoAOtros: number;
  asignadoAOtrosDetalle: Array<{
    fondoId: string;
    fondoNombre: string;
    importe: number;
  }>;
  disponible: number;
}

/**
 * Convierte una `CuentaAsignada` (3 modos) a un importe absoluto en €.
 * - `completo` → todo el saldo de la cuenta
 * - `parcial fijo` → `importeAsignado` literal
 * - `parcial porcentaje` → `(porcentajeAsignado / 100) * saldoCuenta`
 */
export function importeEfectivoDeAsignacion(
  asig: CuentaAsignada,
  saldoCuenta: number,
): number {
  if (asig.modo === 'completo') return saldoCuenta;
  if (asig.modo === 'parcial' && asig.modoImporte === 'fijo') {
    return asig.importeAsignado;
  }
  if (asig.modo === 'parcial' && asig.modoImporte === 'porcentaje') {
    return (asig.porcentajeAsignado / 100) * saldoCuenta;
  }
  return 0;
}

export function computeDisponibleEnCuenta(
  args: ComputeDisponibleArgs,
): ComputeDisponibleResult {
  const fondosRelevantes = args.fondos.filter(
    (f) =>
      f.id !== args.excluirFondoId &&
      f.activo &&
      f.cuentasAsignadas.some((cv) => cv.cuentaId === args.cuentaId),
  );

  let asignadoAOtros = 0;
  const detalle: ComputeDisponibleResult['asignadoAOtrosDetalle'] = [];
  for (const f of fondosRelevantes) {
    const asig = f.cuentasAsignadas.find((c) => c.cuentaId === args.cuentaId);
    if (!asig) continue;
    const importe = importeEfectivoDeAsignacion(asig, args.saldoCuenta);
    asignadoAOtros += importe;
    detalle.push({ fondoId: f.id, fondoNombre: f.nombre, importe });
  }

  return {
    saldo: args.saldoCuenta,
    asignadoAOtros,
    asignadoAOtrosDetalle: detalle,
    disponible: Math.max(0, args.saldoCuenta - asignadoAOtros),
  };
}
