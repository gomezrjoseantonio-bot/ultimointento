/**
 * retaTramos.ts · Tabla de tramos RETA (cuota de autónomos) · ejercicio 2024.
 *
 * ⚠️ VERIFICAR CIFRAS OFICIALES · Wizard import XML V2 · paso 7 (§ 7.8).
 * Esta tabla NO existía en el código · se crea best-effort con la tabla 2024 de
 * rendimientos netos → cuota mínima mensual (15 tramos · tabla reducida + general).
 * Las cifras deben contrastarse contra la tabla oficial vigente antes de
 * considerarse fuente fiscal. Jose autorizó el best-effort con este flag.
 *
 * Uso · `sugerirTramoReta(totalRetaAnual)`: el XML AEAT trae el total RETA del
 * año en la casilla E1G6 (gastosSS). Dividido entre 12 da la cuota mensual
 * media efectivamente pagada; se sugiere el tramo cuya cuota mensual sea la más
 * cercana POR DEBAJO de ese valor.
 */

export interface TramoReta {
  /** Límite inferior de rendimiento neto mensual del tramo (informativo). */
  rendimientoMin: number;
  /** Límite superior de rendimiento neto mensual del tramo (Infinity en el último). */
  rendimientoMax: number;
  /** Cuota mínima mensual del tramo (€/mes). */
  cuotaMensual: number;
  /** Etiqueta de rango para la UI. */
  etiqueta: string;
}

/** Tabla 2024 · 15 tramos · cifras best-effort pendientes de verificación. */
export const TRAMOS_RETA_2024: TramoReta[] = [
  { rendimientoMin: 0, rendimientoMax: 670, cuotaMensual: 230, etiqueta: '≤ 670 €/mes' },
  { rendimientoMin: 670, rendimientoMax: 900, cuotaMensual: 260, etiqueta: '670 – 900' },
  { rendimientoMin: 900, rendimientoMax: 1166.7, cuotaMensual: 278, etiqueta: '900 – 1.167' },
  { rendimientoMin: 1166.7, rendimientoMax: 1300, cuotaMensual: 291, etiqueta: '1.167 – 1.300' },
  { rendimientoMin: 1300, rendimientoMax: 1500, cuotaMensual: 294, etiqueta: '1.300 – 1.500' },
  { rendimientoMin: 1500, rendimientoMax: 1700, cuotaMensual: 294, etiqueta: '1.500 – 1.700' },
  { rendimientoMin: 1700, rendimientoMax: 1850, cuotaMensual: 310, etiqueta: '1.700 – 1.850' },
  { rendimientoMin: 1850, rendimientoMax: 2030, cuotaMensual: 315, etiqueta: '1.850 – 2.030' },
  { rendimientoMin: 2030, rendimientoMax: 2330, cuotaMensual: 320, etiqueta: '2.030 – 2.330' },
  { rendimientoMin: 2330, rendimientoMax: 2760, cuotaMensual: 330, etiqueta: '2.330 – 2.760' },
  { rendimientoMin: 2760, rendimientoMax: 3190, cuotaMensual: 350, etiqueta: '2.760 – 3.190' },
  { rendimientoMin: 3190, rendimientoMax: 3620, cuotaMensual: 370, etiqueta: '3.190 – 3.620' },
  { rendimientoMin: 3620, rendimientoMax: 4050, cuotaMensual: 390, etiqueta: '3.620 – 4.050' },
  { rendimientoMin: 4050, rendimientoMax: 6000, cuotaMensual: 420, etiqueta: '4.050 – 6.000' },
  { rendimientoMin: 6000, rendimientoMax: Infinity, cuotaMensual: 530, etiqueta: '> 6.000' },
];

export interface SugerenciaReta {
  indice: number;
  tramo: TramoReta;
  /** Cuota mensual media efectivamente pagada según el XML (E1G6 / 12). */
  cuotaMensualPagada: number;
}

/**
 * Sugiere el tramo a partir del total RETA anual (casilla E1G6).
 * Devuelve el tramo cuya cuota mensual es la más cercana POR DEBAJO de E1G6/12.
 * Si el pagado es menor que la cuota del primer tramo, sugiere el primero.
 */
export function sugerirTramoReta(
  totalRetaAnual: number,
  tabla: TramoReta[] = TRAMOS_RETA_2024,
): SugerenciaReta | null {
  if (!Number.isFinite(totalRetaAnual) || totalRetaAnual <= 0) return null;
  const cuotaMensualPagada = totalRetaAnual / 12;

  let indice = 0;
  for (let i = 0; i < tabla.length; i++) {
    if (tabla[i].cuotaMensual <= cuotaMensualPagada) indice = i;
    else break;
  }
  return { indice, tramo: tabla[indice], cuotaMensualPagada };
}
