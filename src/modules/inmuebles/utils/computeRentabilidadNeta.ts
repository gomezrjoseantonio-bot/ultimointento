import type { Property } from '../../../services/db';

interface Args {
  properties: Property[];
  /** Map de inmuebleId → renta mensual real (suma rentaMensual contratos activos) */
  rentaMensualPorInmueble: Map<number, number>;
  /** Map de inmuebleId → OPEX anual (suma gastosInmueble del año en curso) */
  opexAnualPorInmueble: Map<number, number>;
  /** Map de inmuebleId → cuota anual préstamo (suma 12 cuotas próximas de préstamos vivos vinculados) */
  cuotaAnualPrestamoPorInmueble: Map<number, number>;
}

export interface RentabilidadNetaResult {
  /** Rentabilidad neta cartera · % · undefined si no se puede calcular (sin valor inversión) */
  rentabilidadNetaPct: number | undefined;
  /** Renta anual bruta cartera */
  rentaAnualBruta: number;
  /** OPEX anual cartera */
  opexAnual: number;
  /** Cuota anual préstamos cartera */
  cuotaAnualPrestamo: number;
  /** Cashflow anual neto · renta − opex − cuota préstamo */
  cashflowAnualNeto: number;
  /** Valor total invertido (precio adquisición agregado · sin gastos) */
  valorInversion: number;
}

/**
 * T29 · Rentabilidad neta cartera.
 *
 * Fórmula · cashflow anual neto / valor inversión × 100.
 * Cashflow neto = renta anual bruta − OPEX anual − cuota anual préstamo.
 *
 * Devuelve undefined en `rentabilidadNetaPct` cuando no hay valor de inversión
 * (cartera vacía o sin datos de adquisición · UI muestra "—").
 */
export function computeRentabilidadNeta(args: Args): RentabilidadNetaResult {
  let rentaAnualBruta = 0;
  let opexAnual = 0;
  let cuotaAnualPrestamo = 0;
  let valorInversion = 0;

  for (const p of args.properties) {
    if (p.id == null) continue;
    const renta = args.rentaMensualPorInmueble.get(p.id) ?? 0;
    rentaAnualBruta += renta * 12;
    opexAnual += args.opexAnualPorInmueble.get(p.id) ?? 0;
    cuotaAnualPrestamo += args.cuotaAnualPrestamoPorInmueble.get(p.id) ?? 0;
    valorInversion += p.acquisitionCosts?.price ?? 0;
  }

  const cashflowAnualNeto = rentaAnualBruta - opexAnual - cuotaAnualPrestamo;

  const rentabilidadNetaPct = valorInversion > 0
    ? Math.round((cashflowAnualNeto / valorInversion) * 100 * 100) / 100
    : undefined;

  return {
    rentabilidadNetaPct,
    rentaAnualBruta,
    opexAnual,
    cuotaAnualPrestamo,
    cashflowAnualNeto,
    valorInversion,
  };
}
