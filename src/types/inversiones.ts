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
  importe: number; // Para aportaciones: importe invertido. Para reembolsos: importe recibido (precio de venta)
  tipo: 'aportacion' | 'reembolso' | 'dividendo';
  notas?: string;
  cuenta_cargo_id?: number; // Account from which the contribution is made
  unidades_vendidas?: number; // Participaciones/acciones vendidas (si aplica)
  coste_adquisicion_fifo?: number; // Coste de adquisición calculado por FIFO
  ganancia_perdida?: number; // importe - coste_adquisicion_fifo
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
  // NOTE: fecha_compra and cuenta_cargo_id are optional here to maintain
  // backward compatibility with positions persisted before this feature was
  // introduced. The creation form validates both fields as required for new
  // positions, so consumers can assume they are always present on records
  // saved after DB v26. For older records the fields may be absent.
  fecha_compra?: string;           // ISO date – when was/will be purchased
  cuenta_cargo_id?: number;        // Account from which the purchase amount was/will be debited
  plan_aportaciones?: PlanAportaciones; // Scheduled periodic contributions

  // ── Bloque ③: Liquidación ────────────────────────────────────────────────
  plan_liquidacion?: PlanLiquidacion;

  // ── Campos del formulario adaptativo ────────────────────────────────────
  numero_participaciones?: number;    // Para accion, etf, reit, crypto
  precio_medio_compra?: number;       // Para accion, etf, reit, crypto
  cuenta_cobro_id?: number;           // Cuenta destino de rescates/ventas/dividendos
  duracion_meses?: number;            // Para prestamo_p2p y deposito_plazo
  modalidad_devolucion?: 'solo_intereses' | 'capital_e_intereses'; // Para prestamo_p2p
  frecuencia_cobro?: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'al_vencimiento'; // Para prestamo_p2p
  liquidacion_intereses?: 'al_vencimiento' | 'mensual' | 'trimestral' | 'anual'; // Para deposito_plazo
  retencion_fiscal?: number;          // % retención fiscal (0, 19, 21, 23, 27)

  // Metadata
  notas?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}
