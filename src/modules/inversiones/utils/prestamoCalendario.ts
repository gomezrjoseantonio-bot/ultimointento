// Calendario de cobros de un préstamo · helpers de la UI de Inversiones
// (modal de alta/edición y ficha de detalle).
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
//
// El cuadro de amortización vive en `services/prestamoInversionCuadro` porque
// también lo consume Tesorería; se re-exporta aquí para que el módulo tenga una
// sola puerta de entrada al calendario del préstamo.

import type { SubtipoPrestamo } from '../../../types/inversiones';
import { PERIODO_MESES, type FrecuenciaCobro } from '../../../services/prestamoInversionCuadro';

export {
  addMonthsISO,
  calcularCuadroPrestamo,
  cobroPrevistoDelMes,
  cuadroDePosicion,
  estadoPrestamoA,
  PERIODO_MESES,
  PERIODOS_ANIO,
  primerCobroPorDefecto,
  toDateInput,
} from '../../../services/prestamoInversionCuadro';
export type {
  CobroPrevisto,
  CuadroPrestamo,
  CuadroPrestamoParams,
  EstadoPrestamo,
  FrecuenciaCobro,
  ModalidadDevolucion,
  PeriodoPrestamo,
} from '../../../services/prestamoInversionCuadro';

export const SUBTIPO_PRESTAMO_LABEL: Record<SubtipoPrestamo, string> = {
  p2p: 'Préstamo P2P',
  empresa: 'Préstamo a empresa',
  familiar: 'Préstamo a familiar',
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
