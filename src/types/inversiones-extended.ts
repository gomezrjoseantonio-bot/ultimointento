// src/types/inversiones-extended.ts
// ATLAS HORIZON: Extended investment types with differentiated model by typology

// ============================================
// BASE COMÚN
// ============================================

import { Aportacion } from './inversiones';

interface PosicionInversionBase {
  id: number;
  nombre: string;
  entidad: string;
  valor_actual: number;
  fecha_valoracion: string;
  aportaciones: Aportacion[];
  total_aportado: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  notas?: string;
}

// ============================================
// TIPO 1: RENDIMIENTO PERIÓDICO
// ============================================

export interface RendimientoPeriodico {
  tipo_rendimiento: 'interes_fijo' | 'interes_variable';
  tasa_interes_anual: number;           // 10 for 10%
  frecuencia_pago: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  reinvertir: boolean;                  // true = added to capital
  cuenta_destino_id?: number;           // If reinvertir=false
  fecha_inicio_rendimiento: string;
  fecha_fin_rendimiento?: string;       // For term deposits
  pagos_generados: PagoRendimiento[];
}

export interface PagoRendimiento {
  id: number;
  fecha_pago: string;
  importe_bruto: number;
  retencion_fiscal: number;             // 19% IRPF in Spain
  importe_neto: number;
  cuenta_destino_id?: number;
  estado: 'pendiente' | 'pagado' | 'reinvertido';
  movimiento_id?: number;               // ID of created movement in treasury
}

export interface InversionRendimientoPeriodico extends PosicionInversionBase {
  tipo: 'cuenta_remunerada' | 'prestamo_p2p' | 'deposito_plazo';
  rendimiento: RendimientoPeriodico;
  plazo_meses?: number;                 // For P2P loans
  estado_prestamo?: 'activo' | 'vencido' | 'impagado';
}

// ============================================
// TIPO 2: DIVIDENDOS
// ============================================

export interface DividendoConfig {
  paga_dividendos: boolean;
  frecuencia_dividendos?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  politica_dividendos: 'distribucion' | 'acumulacion';
  cuenta_destino_dividendos_id?: number;
  dividendos_recibidos: DividendoRecibido[];
}

export interface DividendoRecibido {
  id: number;
  fecha_pago: string;
  dividendo_por_accion: number;
  numero_acciones: number;
  importe_bruto: number;
  retencion_fiscal: number;
  importe_neto: number;
  cuenta_destino_id: number;
  movimiento_id?: number;
}

export interface InversionConDividendos extends PosicionInversionBase {
  tipo: 'accion' | 'etf' | 'reit';
  ticker: string;
  isin?: string;
  numero_participaciones: number;
  precio_medio_compra: number;
  dividendos: DividendoConfig;
}

// ============================================
// TIPO 3: VALORACIÓN SIMPLE
// ============================================

export interface InversionValoracionSimple extends PosicionInversionBase {
  tipo: 'fondo_inversion' | 'plan_pensiones' | 'plan_empleo' | 'crypto' | 'otro';
  isin?: string;
  ticker?: string;
  numero_participaciones?: number;
  precio_medio_compra?: number;
  rentabilidad_euros: number;
  rentabilidad_porcentaje: number;
}

// ============================================
// UNION TYPE
// ============================================

export type PosicionInversionExtendida = 
  | InversionRendimientoPeriodico
  | InversionConDividendos
  | InversionValoracionSimple;

// Type guards
export function esRendimientoPeriodico(pos: PosicionInversionExtendida): pos is InversionRendimientoPeriodico {
  return ['cuenta_remunerada', 'prestamo_p2p', 'deposito_plazo'].includes(pos.tipo);
}

export function esConDividendos(pos: PosicionInversionExtendida): pos is InversionConDividendos {
  return ['accion', 'etf', 'reit'].includes(pos.tipo);
}

export function esValoracionSimple(pos: PosicionInversionExtendida): pos is InversionValoracionSimple {
  return ['fondo_inversion', 'plan_pensiones', 'plan_empleo', 'crypto', 'otro'].includes(pos.tipo);
}
