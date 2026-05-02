/**
 * Tipos y configuración para el cálculo de libertad financiera.
 *
 * Aplica el patrón ADR: STANDARD por defecto + parametrizable desde Ajustes.
 * Ver `docs/ADR-libertad-financiera-parametrizable.md`.
 */

/**
 * Configuración de cómo se calcula la libertad financiera para este usuario.
 */
export interface LibertadConfig {
  /**
   * Qué cuenta como "renta pasiva" en el numerador del cruce.
   *
   * - 'alquiler-neto'             solo rentas de alquiler netas (alquiler − OPEX − cuota préstamo). STANDARD.
   * - 'alquiler-neto-mas-cupon'   suma cupones esperados de inversiones (dividendos, intereses bonos)
   * - 'alquiler-neto-mas-swr'     suma retiro 4% del patrimonio inversiones (regla SWR)
   *
   * T27.4.1: solo se implementa 'alquiler-neto'. Los otros 2 se aceptan como parámetro
   * pero la función lanza error hasta que se implementen.
   */
  alcanceRentaPasiva: 'alquiler-neto' | 'alquiler-neto-mas-cupon' | 'alquiler-neto-mas-swr';

  /**
   * Regla del cruce: cuándo se considera libertad alcanzada.
   *
   * - 'simple'     primer mes en que renta pasiva ≥ gastos vida. STANDARD.
   * - 'sostenido'  primer mes que cumple Y se mantiene N meses siguientes (ver mantenimientoMinMeses)
   * - 'con-margen' primer mes en que renta pasiva ≥ gastos × (1 + colchonPctSobreGastos)
   *
   * T27.4.1: solo se implementa 'simple'. Los otros 2 se aceptan pero error hasta implementar.
   */
  reglaCruce: 'simple' | 'sostenido' | 'con-margen';

  /**
   * Solo aplica si `reglaCruce === 'sostenido'`. Default 12 meses.
   */
  mantenimientoMinMeses?: number;

  /**
   * Solo aplica si `reglaCruce === 'con-margen'`. Default 0.10 (10%).
   */
  colchonPctSobreGastos?: number;

  /**
   * Horizonte de proyección en años. Default 25.
   * Quien consume la función decide: landing puede pedir 12, simulador puede pedir 30, etc.
   */
  horizonteAnios: number;
}

/**
 * STANDARD: default que ATLAS aplica si el usuario no ha personalizado.
 */
export const STANDARD_LIBERTAD_CONFIG: LibertadConfig = {
  alcanceRentaPasiva: 'alquiler-neto',
  reglaCruce: 'simple',
  horizonteAnios: 25,
};

/**
 * Datos reales que la función pura necesita para calcular.
 * El servicio que la envuelve se encarga de poblar esto desde el repo.
 */
export interface DatosRealesLibertad {
  /** Renta pasiva mensual real HOY: suma de rentas netas de contratos activos (alquiler − OPEX − cuota préstamo) */
  rentaPasivaActualMensual: number;

  /** Gasto de vida mensual del usuario: viene del singleton Escenario o input manual */
  gastosVidaMensual: number;

  /** Lista de hitos del Escenario: cada uno con fecha e impacto mensual sobre la renta pasiva */
  hitos: HitoLibertad[];

  /** Mes actual de referencia: ISO yyyy-mm */
  mesReferencia: string;
}

export interface HitoLibertad {
  id: string;
  fecha: string;             // ISO yyyy-mm-dd
  tipo: 'compra' | 'venta' | 'revisionRenta' | 'amortizacionExtraordinaria' | 'cambioGastosVida';
  impactoMensual: number;    // € · positivo o negativo
}

/**
 * Supuestos macro del simulador. Por defecto cero (no asume inflación ni subidas).
 * El simulador (T27.4.3) los pasará como parámetro cuando el usuario mueva sliders.
 */
export interface SupuestosLibertad {
  /** Inflación anual proyectada en % · ej 2.5 = 2.5% */
  inflacionAnualPct: number;

  /** Subida anual de rentas en % · ej 3.0 = 3% */
  subidaAnualRentasPct: number;

  /** Subida anual de gastos vida en % · default = inflacionAnualPct */
  subidaAnualGastosVidaPct?: number;
}

export const SUPUESTOS_NEUTROS_LIBERTAD: SupuestosLibertad = {
  inflacionAnualPct: 0,
  subidaAnualRentasPct: 0,
};

/**
 * Resultado de la proyección.
 */
export interface ResultadoLibertad {
  /** Año/mes en que se cruza: null si no se cruza dentro del horizonte */
  cruceLibertad: { anio: number; mes: number; isoYM: string } | null;

  /** Serie temporal mensual desde mesReferencia hasta horizonte */
  serie: PuntoSerieLibertad[];

  /** % cobertura HOY: rentaPasivaActual / gastosVida × 100 */
  pctCoberturaActual: number;

  /** Faltan X € al mes para llegar a libertad: 0 si ya cubre */
  faltaMensualActual: number;

  /** Resumen amigable: "faltan 5 años y 5 meses" · null si no cruza */
  faltanTexto: string | null;
}

export interface PuntoSerieLibertad {
  isoYM: string;            // ej '2026-05'
  rentaPasiva: number;      // €/mes proyectada en ese mes
  gastosVida: number;       // €/mes proyectada en ese mes
  cubierto: boolean;        // rentaPasiva >= condición de cruce según config
  pctCobertura: number;     // rentaPasiva / gastosVida × 100
}
