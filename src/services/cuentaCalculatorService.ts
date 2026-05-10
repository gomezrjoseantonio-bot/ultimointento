/**
 * S-WIZARD-CUENTA-V3 · función pura para preview live del wizard de cuenta.
 * CERO consultas a stores · CERO efectos · misma función para preview live
 * y para validación al guardar.
 *
 * Cubre:
 *   · Saldo inicial / crédito disponible (varía según tipo).
 *   · Intereses brutos anuales estimados (cuentas remuneradas).
 *   · Intereses por período (mensual/trimestral/semestral/anual).
 */

export type CuentaTipo = 'CORRIENTE' | 'AHORRO' | 'TARJETA_CREDITO';
export type FrecuenciaLiquidacion = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export interface CuentaCalcInput {
  tipo: CuentaTipo;
  /** Sólo aplica a CORRIENTE/AHORRO. */
  saldoInicial?: number;
  /** Sólo aplica a TARJETA_CREDITO. */
  limiteCredito?: number;
  /** Sólo aplica a TARJETA_CREDITO. */
  deudaActual?: number;
  /** Sólo aplica a CORRIENTE/AHORRO. */
  esRemunerada?: boolean;
  /** TAE anual en porcentaje (ej. 2.5 = 2.5%). */
  taeAnual?: number;
  /** Para cálculo de intereses por período. */
  frecuenciaLiquidacion?: FrecuenciaLiquidacion;
}

export interface CuentaResumen {
  /**
   * Para CORRIENTE/AHORRO: el saldo inicial introducido.
   * Para TARJETA_CREDITO: el crédito disponible (límite − deuda).
   */
  saldoInicialOCreditoDisponible: number;
  /** Intereses brutos anuales · solo si remunerada. */
  interesesAnualesEstimados: number;
  /** Intereses brutos por período según frecuencia · solo si remunerada. */
  interesesPorPeriodo: number;
}

const PERIODOS_POR_ANNO: Record<FrecuenciaLiquidacion, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

const safe = (n: number | undefined | null): number => {
  if (typeof n !== 'number' || !Number.isFinite(n) || Number.isNaN(n)) return 0;
  return n;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function calcularCuentaResumen(input: CuentaCalcInput): CuentaResumen {
  const tipo = input.tipo;

  let saldoInicialOCreditoDisponible = 0;
  if (tipo === 'TARJETA_CREDITO') {
    const limite = safe(input.limiteCredito);
    const deuda = safe(input.deudaActual);
    saldoInicialOCreditoDisponible = limite - deuda;
  } else {
    saldoInicialOCreditoDisponible = safe(input.saldoInicial);
  }

  let interesesAnualesEstimados = 0;
  let interesesPorPeriodo = 0;

  // Las tarjetas crédito no aplican a remuneración (spec §2 sub-tarea 3 ·
  // tabla visibilidad condicional).
  if (tipo !== 'TARJETA_CREDITO' && input.esRemunerada) {
    const baseSaldo = safe(input.saldoInicial);
    const tae = safe(input.taeAnual);
    interesesAnualesEstimados = (baseSaldo * tae) / 100;
    const periodos = PERIODOS_POR_ANNO[input.frecuenciaLiquidacion ?? 'anual'];
    interesesPorPeriodo = interesesAnualesEstimados / periodos;
  }

  return {
    saldoInicialOCreditoDisponible: round2(saldoInicialOCreditoDisponible),
    interesesAnualesEstimados: round2(interesesAnualesEstimados),
    interesesPorPeriodo: round2(interesesPorPeriodo),
  };
}
