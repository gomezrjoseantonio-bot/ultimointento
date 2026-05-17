// Tipos · store `benchmarksReferencia` (T-INVERSIONES-DETALLE-PP-v1 · §4.A).
// PR 1 · solo tipos · el store y el service se añaden en PR 2 (bump DB v71→v72).

export type TipoBenchmark =
  | 'indice_equity'
  | 'indice_renta_fija'
  | 'inflacion'
  | 'etf_referencia';

export interface BenchmarkReferencia {
  id: string;                                // uuid
  codigo: string;                            // 'MSCI_WORLD_EUR' · 'SP500_EUR' · 'CPI_ES' · etc.
  nombre: string;
  tipo: TipoBenchmark;
  divisa: string;                            // 'EUR' · 'USD'
  descripcion: string;
  valoresAnuales: Record<number, number>;    // { 2020: 5.8, 2021: 21.8, ... } · % anual
  fuenteUrl?: string;
  notaInterna?: string;
  ultimaActualizacion: string | null;        // ISO date · null si nunca cargado
  fechaCreacion: string;                     // ISO date
  fechaModificacion: string;                 // ISO date
}
