// T27.1 · tipos internos del wizard "Crear Nuevo Objetivo"
// Ver docs/atlas-wizard-objetivo-v1.html · 5 pasos · 4 tipos
//
// IMPORTANTE: el shape persistido (`Objetivo` en src/types/miPlan.ts) es la
// fuente de verdad. Estos tipos son SOLO el draft del wizard mientras el
// usuario rellena los pasos. Al confirmar se mapea a `Objetivo` real.

import type { ObjetivoTipo } from '../../../types/miPlan';

export type StepKey = 1 | 2 | 3 | 4 | 5;

// Unidad de medida para tipo='acumular' · €/€ o meses de tesorería.
export type AcumularUnidad = 'eur' | 'meses';

// Sub-tipo de meta para tipo='comprar' · número de inmuebles o valor total €.
export type ComprarMetric = 'unidades' | 'valor';

// Categorías predefinidas para tipo='reducir'.
// "contratos vacíos" queda fuera de T27.1 (no es €/mes · futura T27.1.1).
export type ReducirCategoria =
  | 'gastos_personales'
  | 'suministros'
  | 'suscripciones'
  | 'otro';

export interface ObjetivoDraft {
  tipo?: ObjetivoTipo;

  // Comunes
  nombre: string;
  descripcion: string;       // mapeado a Objetivo.descripcion (campo opcional)
  fechaCierre: string;       // ISO YYYY-MM-DD · día 1 del mes elegido

  // tipo === 'acumular'
  acumularUnidad: AcumularUnidad;
  acumularValorMeta: string;     // input string para soportar parcial · se valida a number
  acumularValorActual: string;   // si fondoId · se autorrellena en runtime

  // tipo === 'amortizar'
  prestamoId: string;            // FK · obligatorio

  // tipo === 'comprar'
  comprarMetric: ComprarMetric;
  comprarValorMeta: string;      // unidades o €

  // tipo === 'reducir'
  reducirCategoria: ReducirCategoria;
  reducirCategoriaLibre: string; // si reducirCategoria='otro'
  reducirMetaMensual: string;    // €/mes

  // Vínculos · solo para acumular y comprar (fondo es OBLIGATORIO en repo)
  fondoId: string;

  // Capacidad de ahorro mensual (input manual T27.1 · auto-cálculo en T8)
  capacidadAhorroMensual: string;
}

export const draftInicial = (): ObjetivoDraft => ({
  tipo: undefined,
  nombre: '',
  descripcion: '',
  fechaCierre: '',
  acumularUnidad: 'eur',
  acumularValorMeta: '',
  acumularValorActual: '',
  prestamoId: '',
  comprarMetric: 'unidades',
  comprarValorMeta: '',
  reducirCategoria: 'gastos_personales',
  reducirCategoriaLibre: '',
  reducirMetaMensual: '',
  fondoId: '',
  capacidadAhorroMensual: '',
});

// Devuelve el valor numérico meta interpretado según el tipo
// (acumular/amortizar/comprar = metaCantidad · reducir = metaCantidadMensual).
export const parseMetaNumeric = (s: string): number => {
  if (!s) return 0;
  // Acepta "80.000" (formato es-ES) y "80000".
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};
