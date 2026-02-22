// src/types/inversiones.ts
// ATLAS HORIZON: Investment positions types

export type TipoPosicion = 
  // Rendimiento periódico
  | 'cuenta_remunerada'
  | 'prestamo_p2p'
  | 'deposito_plazo'
  // Dividendos
  | 'accion'
  | 'etf'
  | 'reit'
  // Valoración simple
  | 'fondo_inversion'
  | 'plan_pensiones'
  | 'plan_empleo'
  | 'crypto'
  | 'otro'
  // Legacy (backward compatibility)
  | 'deposito';

export interface Aportacion {
  id: number;
  fecha: string; // ISO date
  importe: number;
  tipo: 'aportacion' | 'reembolso' | 'dividendo';
  notas?: string;
}

export interface PosicionInversion {
  id: number;
  nombre: string;
  tipo: TipoPosicion;
  entidad: string; // Banco/broker
  isin?: string; // Para fondos/ETFs
  ticker?: string; // Para acciones
  
  // Valoración
  valor_actual: number;
  fecha_valoracion: string; // ISO date
  
  // Histórico
  aportaciones: Aportacion[];
  total_aportado: number; // Calculado: sum(aportaciones) - sum(reembolsos)
  
  // Rentabilidad
  rentabilidad_euros: number; // valor_actual - total_aportado
  rentabilidad_porcentaje: number; // (rentabilidad_euros / total_aportado) * 100
  
  // Metadata
  notas?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}
