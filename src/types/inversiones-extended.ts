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
  meses_cobro?: number[];               // NUEVO: months in which interest is collected (e.g. [3,6,9,12])
  dia_cobro?: number;                   // NUEVO: day of month on which interest arrives
  reinvertir: boolean;                  // true = added to capital
  cuenta_destino_id?: number;           // If reinvertir=false
  fecha_inicio_rendimiento: string;
  fecha_fin_rendimiento?: string;       // For term deposits
  retencion_porcentaje?: number;        // NUEVO: withholding tax %, default 19 (Spain)
  integracion_fiscal?: 'ahorro' | 'general'; // Default ahorro; general for casillas 0046-0051 y otros BIG
  pagos_generados: PagoRendimiento[];
}

export interface PagoRendimiento {
  id: number;
  fecha_pago: string;
  importe_bruto: number;
  retencion_fiscal: number;             // 19% IRPF in Spain
  importe_neto: number;
  integracion_fiscal?: 'ahorro' | 'general';
  casilla_irpf?: string;
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
  meses_cobro?: number[];               // NUEVO: months in which dividends are paid (required if paga_dividendos = true)
  dia_cobro?: number;                   // NUEVO: day of month (required if paga_dividendos = true)
  dividendo_por_accion?: number;        // NUEVO: gross dividend per share/unit (required if paga_dividendos = true)
  politica_dividendos: 'distribucion' | 'acumulacion';
  cuenta_destino_dividendos_id?: number;
  retencion_porcentaje?: number;        // NUEVO: Spanish withholding %, default 19 (required if paga_dividendos = true)
  retencion_origen_porcentaje?: number; // NUEVO: source-country withholding %, default 0 (required if paga_dividendos = true)
  integracion_fiscal?: 'ahorro' | 'general'; // Default ahorro; general for casillas 0046-0051 y otros BIG
  dividendos_recibidos?: DividendoRecibido[];
}

/** Alias following the naming convention in the problem statement */
export type DividendosConfig = DividendoConfig;

export interface DividendoRecibido {
  id: number;
  fecha_pago: string;
  dividendo_por_accion: number;
  numero_acciones: number;
  importe_bruto: number;
  retencion_fiscal: number;
  importe_neto: number;
  integracion_fiscal?: 'ahorro' | 'general';
  casilla_irpf?: string;
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

// ============================================
// BLOQUE ④: CONFIGURACIÓN FISCAL
// ============================================

export interface ConfiguracionFiscal {
  cuenta_irpf_id: number;
  mes_declaracion: number;    // default 6 (June)
  dia_declaracion: number;    // default 25
  incluir_prevision_irpf: boolean;
  minusvalias_pendientes: {
    año: number;
    importe: number;
  }[];
}

/** Tax brackets for savings income (base del ahorro) – Spain 2026 */
export const TRAMOS_AHORRO_2026 = [
  { hasta: 6000,      tipo: 0.19 },
  { hasta: 50000,     tipo: 0.21 },
  { hasta: 200000,    tipo: 0.23 },
  { hasta: 300000,    tipo: 0.27 },
  { hasta: Infinity,  tipo: 0.28 },
];
