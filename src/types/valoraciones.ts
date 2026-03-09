// src/types/valoraciones.ts
// ATLAS HORIZON: Types for monthly valuation system

export interface ValoracionHistorica {
  id?: number;
  tipo_activo: 'inmueble' | 'inversion';
  activo_id: number;
  activo_nombre: string;
  fecha_valoracion: string; // YYYY-MM
  valor: number;
  origen: 'manual' | 'importacion' | 'api_externa';
  notas?: string;
  created_at: string;
  updated_at: string;
}

export interface ValoracionesMensuales {
  id?: number;
  anio: number;
  mes: number;
  fecha_cierre: string; // YYYY-MM-DD
  patrimonio_total: number;
  inmuebles_total: number;
  inversiones_total: number;
  variacion_euros: number;
  variacion_porcentaje: number;
  total_valoraciones: number;
  created_at: string;
}

export interface ValoracionInput {
  tipo_activo: 'inmueble' | 'inversion';
  activo_id: number;
  activo_nombre: string;
  valor: number;
  notas?: string;
}

export interface ActivoParaActualizar {
  id: number;
  nombre: string;
  tipo: 'inmueble' | 'inversion';
  ultima_valoracion?: number;
  fecha_ultima_valoracion?: string;
}
