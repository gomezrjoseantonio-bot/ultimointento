/**
 * S-WIZARD-CUENTA-V3 · función pura para preview live del wizard de cuenta.
 * CERO consultas a stores · CERO efectos · misma función para preview live
 * y para validación al guardar.
 *
 * Cubre:
 *   · Saldo inicial.
 *   · Intereses brutos anuales estimados (cuentas remuneradas).
 *   · Intereses por período (mensual/trimestral/semestral/anual).
 */

/**
 * `EFECTIVO` es una cuenta más · el dinero del bolsillo.
 *
 * Existe para que una retirada de cajero sea lo que es —una transferencia
 * interna: el dinero no se va, cambia de sitio— en vez de un gasto que hunde
 * el patrimonio el día que sacas 200 €. No tiene IBAN ni banco, y para el
 * cálculo se comporta como una corriente sin remunerar.
 */
/**
 * `TARJETA_CREDITO` ya no está (V88 · VOCABULARIO §3).
 *
 * Una tarjeta no es un sitio donde hay dinero, así que no tenía saldo que
 * calcular: lo que se enseñaba era el crédito disponible, que es otra cosa.
 * Ahora vive en `Tarjeta`, con su límite y su ciclo.
 */
export type CuentaTipo = 'CORRIENTE' | 'EFECTIVO';
export type FrecuenciaLiquidacion = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export interface CuentaCalcInput {
  tipo: CuentaTipo;
  /** Sólo aplica a las cuentas bancarias · no al efectivo. */
  saldoInicial?: number;
  /** Sólo aplica a las cuentas bancarias · no al efectivo. */
  esRemunerada?: boolean;
  /** TAE anual en porcentaje (ej. 2.5 = 2.5%). */
  taeAnual?: number;
  /** Para cálculo de intereses por período. */
  frecuenciaLiquidacion?: FrecuenciaLiquidacion;
}

export interface CuentaResumen {
  /** El saldo inicial introducido. */
  saldoInicial: number;
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
  const saldoInicial = safe(input.saldoInicial);

  let interesesAnualesEstimados = 0;
  let interesesPorPeriodo = 0;

  if (input.esRemunerada) {
    const baseSaldo = safe(input.saldoInicial);
    const tae = safe(input.taeAnual);
    interesesAnualesEstimados = (baseSaldo * tae) / 100;
    const periodos = PERIODOS_POR_ANNO[input.frecuenciaLiquidacion ?? 'anual'];
    interesesPorPeriodo = interesesAnualesEstimados / periodos;
  }

  return {
    saldoInicial: round2(saldoInicial),
    interesesAnualesEstimados: round2(interesesAnualesEstimados),
    interesesPorPeriodo: round2(interesesPorPeriodo),
  };
}
