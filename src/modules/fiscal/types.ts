// Tipos compartidos del módulo Fiscal (v5).
// Reflejan filas de presentación que consumen tabs y subpáginas.
//
// Los tipos del modelo (`EjercicioFiscal`, `EstadoEjercicio`, etc.) viven en
// `src/types/fiscal.ts` y NO se duplican aquí.

import type { EjercicioFiscal, EstadoEjercicio } from '../../types/fiscal';

export interface EjercicioRow {
  ejercicio: number;
  estado: EstadoEjercicio;
  estadoLabel: string;
  /** "vivo" / "en curso" / etc · estilo etiqueta para chips. */
  cuotaResultadoEur: number;
  resultadoLabel: 'a_pagar' | 'a_devolver' | 'cero';
  fechaUltimaActualizacion: string | null;
  documentosCount: number;
  prescribeAnio: number | null;
  raw: EjercicioFiscal;
}
