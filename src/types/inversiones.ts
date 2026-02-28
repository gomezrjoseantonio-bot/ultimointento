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
  cuenta_cargo_id?: number; // Account from which the contribution is made
}

// ── Bloque ①: Plan de Aportaciones Periódicas ──────────────────────────────
export interface PlanAportaciones {
  activo: boolean;
  importe: number;
  frecuencia: 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
  meses: number[];           // [1,4,7,10] etc.
  dia_cargo: number;
  cuenta_cargo_id: number;
  fecha_inicio: string;      // ISO date
  fecha_fin?: string;        // ISO date (optional, empty = indefinite)
}

// ── Bloque ③: Plan de Liquidación ──────────────────────────────────────────
export interface PlanLiquidacion {
  activo: boolean;
  tipo_liquidacion: 'vencimiento' | 'venta' | 'rescate';
  fecha_estimada: string;    // ISO date
  liquidacion_total: boolean;
  importe_estimado: number;
  cuenta_destino_id: number;
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

  // ── Bloque ①: Compra / Creación ──────────────────────────────────────────
  fecha_compra?: string;           // ISO date – when was/will be purchased
  cuenta_cargo_id?: number;        // Account from which the purchase amount was/will be debited
  plan_aportaciones?: PlanAportaciones; // Scheduled periodic contributions

  // ── Bloque ③: Liquidación ────────────────────────────────────────────────
  plan_liquidacion?: PlanLiquidacion;
  
  // Metadata
  notas?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}
