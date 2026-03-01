export interface CotizacionSSConfig {
  baseMaximaMensual: number;
  contingenciasComunes: { empresa: number; trabajador: number };
  desempleo: { empresa: number; trabajador: number };
  formacionProfesional: { empresa: number; trabajador: number };
  mei: { empresa: number; trabajador: number };
}

export const COTIZACION_SS_DEFAULTS: Record<number, CotizacionSSConfig> = {
  2024: {
    baseMaximaMensual: 4720.50,
    contingenciasComunes: { empresa: 23.60, trabajador: 4.70 },
    desempleo: { empresa: 5.50, trabajador: 1.55 },
    formacionProfesional: { empresa: 0.60, trabajador: 0.10 },
    mei: { empresa: 0.67, trabajador: 0.13 },
  },
  2025: {
    baseMaximaMensual: 4909.50,
    contingenciasComunes: { empresa: 23.60, trabajador: 4.70 },
    desempleo: { empresa: 5.50, trabajador: 1.55 },
    formacionProfesional: { empresa: 0.60, trabajador: 0.10 },
    mei: { empresa: 0.67, trabajador: 0.13 },
  },
  2026: {
    baseMaximaMensual: 5101.20,
    contingenciasComunes: { empresa: 23.60, trabajador: 4.70 },
    desempleo: { empresa: 5.50, trabajador: 1.55 },
    formacionProfesional: { empresa: 0.60, trabajador: 0.10 },
    mei: { empresa: 0.75, trabajador: 0.15 },
  },
};

export function getBaseMaxima(año: number): number {
  return COTIZACION_SS_DEFAULTS[año]?.baseMaximaMensual
    ?? COTIZACION_SS_DEFAULTS[Math.max(...Object.keys(COTIZACION_SS_DEFAULTS).map(Number).filter(y => y <= año))]?.baseMaximaMensual
    ?? 4909.50;
}

export function getSSDefaults(año: number): CotizacionSSConfig {
  const keys = Object.keys(COTIZACION_SS_DEFAULTS).map(Number).filter(y => y <= año);
  const bestYear = keys.length > 0 ? Math.max(...keys) : 2025;
  return COTIZACION_SS_DEFAULTS[bestYear] ?? COTIZACION_SS_DEFAULTS[2025];
}
