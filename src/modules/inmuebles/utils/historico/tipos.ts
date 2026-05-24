import type { MotivoFin } from '../../../../services/db';

export type MotivoFinKey = MotivoFin | 'sin_clasificar';

/** Intensidad de rotación · r1 (sin rotación) … r7 (rotación muy alta). */
export type ClaseHeat = 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7';

export interface KpisHistorico {
  totalFinalizados: number;
  /** Media de duración real en meses (0 si no hay contratos). */
  duracionMediaMeses: number;
  /** Media de días vacíos entre contratos sucesivos de una misma unidad · null si no calculable. */
  diasVaciosMedios: number | null;
  /** Media de valoración (estrellas) sobre los contratos que la tienen · null si ninguno. */
  valoracionMedia: number | null;
}

export interface CeldaRotacion {
  /** Número de habitación (1..N) o null para piso completo. */
  habitacion: number | null;
  /** Nº de contratos finalizados que pasaron por esa unidad. */
  rotaciones: number;
  clase: ClaseHeat;
}

export interface RotacionInmueble {
  inmuebleId: number;
  alias: string;
  celdas: CeldaRotacion[];
}

export interface MotivoDist {
  motivo: MotivoFinKey;
  count: number;
  /** Porcentaje sobre el total de finalizados (0-100). */
  pct: number;
}

export interface RowDuracion {
  tipo: 'corta' | 'larga';
  label: string;
  duracionMediaMeses: number;
  /** Ancho de barra relativo al máximo (0-100). */
  pctBar: number;
  count: number;
}

export interface Insight {
  tipo: 'pos' | 'warn' | 'neg' | 'info';
  texto: string;
}

export interface StatsPagos {
  alDia: number | null;
  conRetraso: number | null;
  impagos: number | null;
}
