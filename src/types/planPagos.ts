// ============================================================================
// El cuadro de amortización · los tipos
// ============================================================================
//
// Salen de `types/prestamos.ts`, que estaba a una línea del tope de tamaño que
// vigila el marcador de salud: cualquier campo nuevo lo cruzaba, y el siguiente
// que tocara el cuadro se encontraría el trinquete en rojo sin saber por qué.
//
// El corte no es por tamaño, es por tema: un préstamo es lo que se pactó —tipo,
// plazo, comisiones, bonificaciones—, y esto es lo que sale de aplicarlo, recibo
// a recibo. `types/prestamos.ts` los reexporta, así que ningún import cambia.
// ============================================================================

export interface PeriodoPago {
  periodo: number;                // 1..N
  devengoDesde: string;          // ISO date
  devengoHasta: string;          // ISO date
  fechaCargo: string;            // ISO date
  cuota: number;                 // €
  interes: number;               // €
  amortizacion: number;          // €
  principalFinal: number;        // €
  esProrrateado?: boolean;       // first period prorated
  esSoloIntereses?: boolean;     // interest-only period
  diasDevengo?: number;          // for prorated calculations
  pagado: boolean;
  fechaPagoReal?: string;
  movimientoTesoreriaId?: string;
  /**
   * Esta línea es una ENTREGA DE CAPITAL, no un recibo · §6 bis · quater.
   *
   * La apunta `amortizarAnticipado` cuando se adelanta dinero: lleva el capital
   * que entra y los intereses corridos que se liquidan, pero no es una cuota
   * que el banco vaya a girar.
   *
   * Nació al planificar amortizaciones recurrentes. Con una sola operación se
   * podía distinguir por la fecha —la línea cae justo el día del corte, así que
   * el filtro `fechaCargo > desde` la dejaba fuera sin nombrarla—, pero un plan
   * mete doce al año DENTRO del tramo que se cuenta, y sin marca se contaban
   * como recibos: «209 → 214 meses» después de meter 2.400 €. El plazo subía
   * por amortizar, que es la misma cara del error que ya dio `!pagado` en su
   * día. Doce lo hacen imposible de sostener, así que la línea dice lo que es.
   */
  esAdelantoDeCapital?: boolean;
}

export interface PlanPagos {
  prestamoId: string;
  fechaGeneracion: string;       // ISO timestamp
  periodos: PeriodoPago[];
  resumen: {
    totalIntereses: number;
    totalCuotas: number;
    fechaFinalizacion: string;
  };
  metadata?: {
    source?: 'generated' | 'property_sale' | 'loan_settlement' | 'wizard_v2_generated';
    operationType?: 'TOTAL' | 'PARTIAL';
    operationDate?: string;
    partialMode?: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  };
}

export interface CalculoAmortizacion {
  modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  importeAmortizar: number;
  fechaAmortizacion: string;

  // Results
  penalizacion: number;
  nuevaCuota?: number;           // if REDUCIR_CUOTA
  nuevoplazo?: number;           // if REDUCIR_PLAZO
  nuevaFechaFin?: string;
  interesesAhorrados: number;
  puntoEquilibrio?: number;      // months to break even
}
