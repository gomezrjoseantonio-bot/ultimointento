// Loan types for amortization calculation system

export interface Prestamo {
  id: number;
  nombre: string;
  entidad: string;

  // Amount and conditions
  capital_inicial: number;
  tasa_interes_anual: number;
  plazo_meses: number;
  tipo_interes: 'FIJO' | 'VARIABLE';

  // Critical dates
  fecha_inicio: string;           // Formalization date
  fecha_primera_cuota: string;    // First payment due date

  // Associated account
  cuenta_domiciliacion_id?: number;

  // Amortization schedule
  cuadro_amortizacion: CuotaPrestamo[];

  // Status
  activo: boolean;
  capital_pendiente: number;

  // Metadata
  created_at: string;
  updated_at: string;
  notas?: string;
}

export interface CuotaPrestamo {
  numero: number;
  fecha: string;
  fecha_vencimiento: string;

  // Payment composition
  cuota_total: number;
  amortizacion_capital: number;
  intereses: number;

  // Loan status
  capital_pendiente: number;

  // Period information
  dias_periodo: number;           // Actual days in the period
  tasa_periodo: number;           // Rate applied (may vary for variable rate)

  // Payment status
  pagado: boolean;
  fecha_pago_real?: string;
  movimiento_id?: number;         // Link to treasury movement
}

export interface ConfiguracionPrestamo {
  capital: number;
  tasa_anual: number;
  plazo_meses: number;
  fecha_inicio: string;
  fecha_primera_cuota: string;
  tipo: 'FIJO' | 'VARIABLE';
}
