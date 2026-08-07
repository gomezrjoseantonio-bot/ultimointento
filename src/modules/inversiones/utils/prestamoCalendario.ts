// Calendario de cobros de un préstamo · helpers compartidos entre el modal
// de alta/edición (`AltaPrestamoModal`) y la ficha de detalle
// (`FichaRendimientoPeriodico`).
//
// Modelo de fechas del préstamo:
//   · `fecha_compra`                       → firma del préstamo
//   · `rendimiento.fecha_primer_cobro`     → fecha a partir de la cual se
//                                            reciben los intereses
//   · `rendimiento.fecha_inicio_rendimiento` → inicio del devengo. El generador
//     (`rendimientosService`) emite el primer pago un periodo DESPUÉS de esta
//     fecha, así que se guarda como `primer cobro − 1 periodo`.
//   · `rendimiento.meses_cobro` / `dia_cobro` → derivados del primer cobro ·
//     los usa la previsión de tesorería (`treasurySyncService`).
//   · `rendimiento.fecha_fin_rendimiento`  → vencimiento (firma + duración).

import type { PosicionInversion, SubtipoPrestamo } from '../../../types/inversiones';
import { addMonthsClampedUTC } from '../../../utils/recurrenceDateUtils';

export type FrecuenciaCobro = 'mensual' | 'trimestral' | 'semestral' | 'anual';

/** Meses que separan dos cobros consecutivos según la frecuencia. */
export const PERIODO_MESES: Record<FrecuenciaCobro, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Nº de cobros al año según la frecuencia. */
export const PERIODOS_ANIO: Record<FrecuenciaCobro, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

export const SUBTIPO_PRESTAMO_LABEL: Record<SubtipoPrestamo, string> = {
  p2p: 'Préstamo P2P',
  empresa: 'Préstamo a empresa',
  familiar: 'Préstamo a familiar',
};

/** `YYYY-MM-DD` de una fecha ISO (o cadena vacía si no es válida). */
export const toDateInput = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

/**
 * Suma (o resta, con `months` negativo) meses a una fecha `YYYY-MM-DD`
 * recortando el día al último del mes destino. Devuelve `YYYY-MM-DD`.
 */
export const addMonthsISO = (isoDate: string, months: number): string => {
  if (!isoDate) return '';
  const d = addMonthsClampedUTC(isoDate, months);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/**
 * Meses naturales (1-12) en los que cae un cobro, partiendo del mes del primer
 * cobro y avanzando de periodo en periodo. Ej. primer cobro en marzo con
 * frecuencia trimestral → [3, 6, 9, 12].
 */
export const mesesCobroDesde = (
  isoPrimerCobro: string,
  frecuencia: FrecuenciaCobro,
): number[] => {
  const mesInicial = Number(isoPrimerCobro.slice(5, 7));
  if (!Number.isFinite(mesInicial) || mesInicial < 1 || mesInicial > 12) return [];
  const paso = PERIODO_MESES[frecuencia] ?? 1;
  const total = Math.max(1, Math.round(12 / paso));
  const meses: number[] = [];
  for (let i = 0; i < total; i++) {
    meses.push(((mesInicial - 1 + i * paso) % 12) + 1);
  }
  return meses.sort((a, b) => a - b);
};

/** Día del mes (1-31) del primer cobro. */
export const diaCobroDesde = (isoPrimerCobro: string): number | undefined => {
  const dia = Number(isoPrimerCobro.slice(8, 10));
  return Number.isFinite(dia) && dia >= 1 && dia <= 31 ? dia : undefined;
};

/**
 * Primer cobro por defecto a partir de la firma:
 * · modalidades periódicas → firma + 1 periodo
 * · bullet (`al_vencimiento`) → firma + duración (todo al vencimiento)
 */
export const primerCobroPorDefecto = (
  fechaFirma: string,
  frecuencia: FrecuenciaCobro,
  modalidadAlVencimiento: boolean,
  duracionMeses: number,
): string => {
  if (!fechaFirma) return '';
  const meses = modalidadAlVencimiento
    ? Math.max(1, Math.round(duracionMeses) || 12)
    : PERIODO_MESES[frecuencia] ?? 1;
  return addMonthsISO(fechaFirma, meses);
};

// ── Cuadro de amortización ────────────────────────────────────────────────
// Fuente única para "cuánto capital sigue vivo hoy". Sin él, un préstamo con
// cuota francesa se pintaba siempre por su capital inicial aunque llevara
// media vida amortizada.

export type ModalidadDevolucion =
  | 'solo_intereses'
  | 'capital_e_intereses'
  | 'al_vencimiento';

export interface PeriodoPrestamo {
  /** Nº de cuota, empezando en 1. */
  numero: number;
  /** Fecha de cobro (`YYYY-MM-DD`). */
  fecha: string;
  /** Importe bruto total de la cuota (interés + amortización). */
  cuota: number;
  /** Parte de intereses de la cuota. */
  interes: number;
  /** Parte de capital devuelto en la cuota. */
  amortizacion: number;
  /** Capital que sigue vivo DESPUÉS de pagar esta cuota. */
  saldoPendiente: number;
}

export interface CuadroPrestamo {
  periodos: PeriodoPrestamo[];
  /** Cuota constante (francesa) o interés por periodo en el resto. */
  cuota: number;
  capitalInicial: number;
  totalIntereses: number;
  periodosAnio: number;
  modalidad: ModalidadDevolucion;
  /** true si el capital se devuelve poco a poco en cada cuota. */
  amortiza: boolean;
}

export interface CuadroPrestamoParams {
  capital: number;
  tinAnual: number;
  duracionMeses: number;
  frecuencia: FrecuenciaCobro;
  modalidad: ModalidadDevolucion;
  /** Fecha del primer cobro (`YYYY-MM-DD`). */
  primerCobro: string;
}

const redondear = (n: number): number => Math.round(n * 100) / 100;

/**
 * Cuadro completo del préstamo, cuota a cuota.
 *
 * · `capital_e_intereses` → amortización francesa: cuota constante
 *   `C = P·i / (1 − (1+i)^−n)`, con la parte de intereses cayendo y la de
 *   capital subiendo en cada periodo. Con TIN 0 la cuota es `P / n`.
 * · `solo_intereses` → intereses del periodo en cada cuota y el capital
 *   íntegro en la última.
 * · `al_vencimiento` → una única cuota con todos los intereses y el capital.
 *
 * Devuelve `null` si faltan datos para construirlo.
 */
export function calcularCuadroPrestamo(
  params: CuadroPrestamoParams,
): CuadroPrestamo | null {
  const { capital, tinAnual, duracionMeses, frecuencia, modalidad, primerCobro } = params;
  if (!(capital > 0) || !(duracionMeses > 0) || !primerCobro) return null;
  if (!Number.isFinite(tinAnual) || tinAnual < 0) return null;

  const periodosAnio = PERIODOS_ANIO[frecuencia] ?? 12;
  const pasoMeses = PERIODO_MESES[frecuencia] ?? 1;
  const anios = duracionMeses / 12;

  if (modalidad === 'al_vencimiento') {
    const interes = redondear(capital * (tinAnual / 100) * anios);
    return {
      periodos: [
        {
          numero: 1,
          fecha: primerCobro,
          cuota: redondear(capital + interes),
          interes,
          amortizacion: capital,
          saldoPendiente: 0,
        },
      ],
      cuota: redondear(capital + interes),
      capitalInicial: capital,
      totalIntereses: interes,
      periodosAnio,
      modalidad,
      amortiza: false,
    };
  }

  const nPeriodos = Math.max(1, Math.round(duracionMeses / pasoMeses));
  const tasaPeriodo = tinAnual / 100 / periodosAnio;

  let cuotaConstante = 0;
  if (modalidad === 'capital_e_intereses') {
    cuotaConstante =
      tasaPeriodo > 0
        ? (capital * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -nPeriodos))
        : capital / nPeriodos;
  } else {
    cuotaConstante = capital * tasaPeriodo;
  }

  const periodos: PeriodoPrestamo[] = [];
  let saldo = capital;
  let totalIntereses = 0;

  for (let k = 0; k < nPeriodos; k++) {
    const esUltima = k === nPeriodos - 1;
    const interes = redondear(saldo * tasaPeriodo);
    let amortizacion: number;

    if (modalidad === 'capital_e_intereses') {
      // La última cuota liquida el saldo restante · absorbe los redondeos.
      amortizacion = esUltima ? saldo : redondear(cuotaConstante - interes);
    } else {
      amortizacion = esUltima ? saldo : 0;
    }
    if (amortizacion > saldo) amortizacion = saldo;

    saldo = redondear(saldo - amortizacion);
    totalIntereses = redondear(totalIntereses + interes);
    periodos.push({
      numero: k + 1,
      fecha: addMonthsISO(primerCobro, k * pasoMeses),
      cuota: redondear(interes + amortizacion),
      interes,
      amortizacion: redondear(amortizacion),
      saldoPendiente: saldo,
    });
  }

  return {
    periodos,
    cuota: redondear(cuotaConstante),
    capitalInicial: capital,
    totalIntereses,
    periodosAnio,
    modalidad,
    amortiza: modalidad === 'capital_e_intereses',
  };
}

export interface EstadoPrestamo {
  /** Capital que sigue vivo a la fecha consultada. */
  saldoPendiente: number;
  /** Capital ya devuelto. */
  capitalAmortizado: number;
  /** % del capital inicial ya devuelto (0-100). */
  pctAmortizado: number;
  /** Intereses devengados hasta la fecha, según el cuadro. */
  interesesAcumulados: number;
  /** Cuotas ya vencidas. */
  cuotasPagadas: number;
  /** Siguiente cuota pendiente, si queda alguna. */
  proximaCuota: PeriodoPrestamo | null;
}

/**
 * Foto del préstamo a una fecha dada (`YYYY-MM-DD`, por defecto hoy):
 * cuánto capital queda vivo, cuánto se ha devuelto y qué intereses se han
 * devengado. Cuenta como vencidas las cuotas con fecha <= la consultada.
 */
export function estadoPrestamoA(
  cuadro: CuadroPrestamo,
  fechaISO: string,
): EstadoPrestamo {
  const corte = fechaISO.slice(0, 10);
  let saldoPendiente = cuadro.capitalInicial;
  let interesesAcumulados = 0;
  let cuotasPagadas = 0;
  let proximaCuota: PeriodoPrestamo | null = null;

  for (const periodo of cuadro.periodos) {
    if (periodo.fecha && periodo.fecha <= corte) {
      saldoPendiente = periodo.saldoPendiente;
      interesesAcumulados = redondear(interesesAcumulados + periodo.interes);
      cuotasPagadas++;
    } else if (!proximaCuota) {
      proximaCuota = periodo;
    }
  }

  const capitalAmortizado = redondear(cuadro.capitalInicial - saldoPendiente);
  return {
    saldoPendiente,
    capitalAmortizado,
    pctAmortizado:
      cuadro.capitalInicial > 0 ? (capitalAmortizado / cuadro.capitalInicial) * 100 : 0,
    interesesAcumulados,
    cuotasPagadas,
    proximaCuota,
  };
}

/**
 * Construye el cuadro a partir de una posición persistida, resolviendo los
 * huecos de las posiciones antiguas (frecuencia del rendimiento, primer cobro
 * derivado del inicio del devengo o de la firma).
 */
export function cuadroDePosicion(posicion: PosicionInversion): CuadroPrestamo | null {
  const rendimiento = posicion.rendimiento as
    | { tasa_interes_anual?: number; frecuencia_pago?: FrecuenciaCobro; fecha_primer_cobro?: string; fecha_inicio_rendimiento?: string }
    | undefined;

  const capital = Number(posicion.total_aportado ?? posicion.valor_actual ?? 0);
  const tinAnual = Number(rendimiento?.tasa_interes_anual ?? NaN);
  const duracionMeses = Number(posicion.duracion_meses ?? NaN);
  if (!(capital > 0) || !Number.isFinite(tinAnual) || !(duracionMeses > 0)) return null;

  const frecuenciaCobro = posicion.frecuencia_cobro;
  const frecuencia: FrecuenciaCobro =
    frecuenciaCobro && frecuenciaCobro !== 'al_vencimiento'
      ? frecuenciaCobro
      : rendimiento?.frecuencia_pago ?? 'anual';
  const modalidad: ModalidadDevolucion = posicion.modalidad_devolucion ?? 'solo_intereses';

  let primerCobro = toDateInput(rendimiento?.fecha_primer_cobro);
  if (!primerCobro && rendimiento?.fecha_inicio_rendimiento) {
    primerCobro = addMonthsISO(
      toDateInput(rendimiento.fecha_inicio_rendimiento),
      PERIODO_MESES[frecuencia] ?? 1,
    );
  }
  if (!primerCobro && posicion.fecha_compra) {
    primerCobro = primerCobroPorDefecto(
      toDateInput(posicion.fecha_compra),
      frecuencia,
      modalidad === 'al_vencimiento',
      duracionMeses,
    );
  }
  if (!primerCobro) return null;

  return calcularCuadroPrestamo({
    capital,
    tinAnual,
    duracionMeses,
    frecuencia,
    modalidad,
    primerCobro,
  });
}
