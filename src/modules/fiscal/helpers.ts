// Helpers de presentación · Fiscal v5.
//
// Los cálculos fiscales (cuota líquida, retenciones, etc.) viven en los
// services del repositorio (`ejercicioFiscalService`,
// `estimacionFiscalEnCursoService`...). Aquí sólo derivamos datos de
// presentación a partir de `EjercicioFiscal`.

import type { EjercicioFiscal, EstadoEjercicio } from '../../types/fiscal';
import type { EjercicioRow } from './types';

const ESTADO_LABEL: Record<EstadoEjercicio, string> = {
  vivo: 'En curso',
  en_curso: 'En curso',
  pendiente_cierre: 'Pendiente cierre',
  cerrado: 'Cerrado',
  declarado: 'Declarado',
  prescrito: 'Prescrito',
};

export const labelEstado = (e: EstadoEjercicio): string => ESTADO_LABEL[e] ?? e;

/**
 * Resultado IRPF del ejercicio · positivo = a devolver · negativo = a pagar.
 * Lee de `declaracionAeat.cuotaResultadoAutoliquidacion` (casilla 0670 si está)
 * o de `calculoAtlas` como fallback.
 */
export const cuotaResultado = (ej: EjercicioFiscal): number => {
  const fromCasillas = ej.casillasRaw?.['0670'];
  if (typeof fromCasillas === 'number') return fromCasillas;
  if (typeof fromCasillas === 'string' && fromCasillas.trim() !== '') {
    const n = Number(fromCasillas);
    if (Number.isFinite(n)) return n;
  }
  const aeat = ej.declaracionAeat as { cuotaResultadoAutoliquidacion?: number } | undefined;
  if (aeat && Number.isFinite(aeat.cuotaResultadoAutoliquidacion)) {
    return Number(aeat.cuotaResultadoAutoliquidacion);
  }
  const atlas = ej.calculoAtlas as { cuotaResultadoAutoliquidacion?: number } | undefined;
  if (atlas && Number.isFinite(atlas.cuotaResultadoAutoliquidacion)) {
    return Number(atlas.cuotaResultadoAutoliquidacion);
  }
  return 0;
};

/**
 * Año de prescripción · 4 años desde declaración. Si no hay fecha de
 * declaración, usamos `cerradoAt` o devolvemos null.
 */
export const prescribeYearOf = (ej: EjercicioFiscal): number | null => {
  const ref = ej.declaradoAt || ej.cerradoAt;
  if (!ref) return null;
  const d = new Date(ref);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear() + 4;
};

export const ejercicioRowFrom = (ej: EjercicioFiscal): EjercicioRow => {
  const cuota = cuotaResultado(ej);
  const resultadoLabel: EjercicioRow['resultadoLabel'] =
    cuota > 0 ? 'a_devolver' : cuota < 0 ? 'a_pagar' : 'cero';
  return {
    ejercicio: ej.ejercicio,
    estado: ej.estado,
    estadoLabel: labelEstado(ej.estado),
    cuotaResultadoEur: cuota,
    resultadoLabel,
    fechaUltimaActualizacion: ej.updatedAt ?? null,
    documentosCount: 0,
    prescribeAnio: prescribeYearOf(ej),
    raw: ej,
  };
};

export const formatPct = (n: number, decimals = 2): string =>
  `${n.toFixed(decimals).replace('.', ',')}%`;

export const formatDateLong = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateShort = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

/** Estados visualmente "actuales" · suman al campaña en curso. */
export const ESTADOS_VIVOS: EstadoEjercicio[] = ['vivo', 'en_curso', 'pendiente_cierre'];

/** Estados ya cerrados pero no declarados. */
export const ESTADOS_CERRADOS: EstadoEjercicio[] = ['cerrado'];

/** Estados ya declarados oficialmente. */
export const ESTADOS_DECLARADOS: EstadoEjercicio[] = ['declarado'];

export const obligacionesAnioBase = [
  { modelo: '303', nombre: 'IVA trimestral', frecuencia: 'trimestral' as const },
  { modelo: '130', nombre: 'Pago fraccionado IRPF', frecuencia: 'trimestral' as const },
  { modelo: '100', nombre: 'IRPF anual', frecuencia: 'anual' as const, mesPresentacion: 6 },
  { modelo: '180', nombre: 'Retenciones · resumen anual', frecuencia: 'anual' as const, mesPresentacion: 1 },
  { modelo: '347', nombre: 'Op. terceros', frecuencia: 'anual' as const, mesPresentacion: 2 },
];

export const trimestreParaMes = (m: number): 1 | 2 | 3 | 4 => {
  if (m <= 3) return 1;
  if (m <= 6) return 2;
  if (m <= 9) return 3;
  return 4;
};
