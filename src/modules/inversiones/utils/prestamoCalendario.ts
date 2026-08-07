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

import type { SubtipoPrestamo } from '../../../types/inversiones';
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
