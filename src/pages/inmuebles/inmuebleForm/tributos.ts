// Ficha de inmueble · TRIBUTOS de la compra (puro · sin efectos ni stores).
//
// Regla (decisión Jose · ronda 2): los impuestos de compra se AUTO-calculan y
// son editables (override manual):
//   · USADA      → ITP sobre el VALOR DE REFERENCIA × tipo de la CCAA.
//   · OBRA NUEVA → IVA sobre el PRECIO (10% vivienda / 21% resto) + AJD sobre el
//     precio (1.5% · editable).
// El tipo de ITP por CCAA lo resuelve `getITPRateForCCAA` (string · fallback 8%),
// no reinventamos la tabla aquí.

import { getITPRateForCCAA } from '../../../utils/locationUtils';
import { AJD_RATE } from '../../../utils/inmuebleUtils';
import type { TipoActivo } from '../../../types/tipoActivo';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** IVA de obra nueva · 10% si es vivienda (piso), 21% en el resto (local, plaza…). */
export function ivaRateFor(tipoActivo: TipoActivo): number {
  return tipoActivo === 'piso' ? 10 : 21;
}

/** Tipo de ITP (%) de la CCAA · string, case-insensitive, fallback 8%. */
export function itpRateFor(ccaa: string): number {
  return getITPRateForCCAA(ccaa);
}

export interface TributosInput {
  tipoActivo: TipoActivo;
  ccaa: string;
  precioCompra: number;
  valorReferencia: number;
}

export interface TributosAuto {
  itp: number;
  itpRate: number;
  iva: number;
  ivaRate: number;
  ajd: number;
  ajdRate: number;
}

/**
 * Importes AUTO de los tres tributos. La UI muestra ITP (usada) o IVA+AJD
 * (nueva) según el estado, pero se calculan todos por igual (baratos y puros).
 */
export function calcularTributosAuto(input: TributosInput): TributosAuto {
  const itpRate = itpRateFor(input.ccaa);
  const ivaRate = ivaRateFor(input.tipoActivo);
  return {
    itp: round2((input.valorReferencia * itpRate) / 100),
    itpRate,
    iva: round2((input.precioCompra * ivaRate) / 100),
    ivaRate,
    ajd: round2((input.precioCompra * AJD_RATE) / 100),
    ajdRate: AJD_RATE,
  };
}
