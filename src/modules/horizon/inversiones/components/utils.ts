// utils.ts
// ATLAS HORIZON: Shared utilities for Inversiones module

import { PosicionInversion } from '../../../../types/inversiones';
import { PositionRow } from './types';

// ─── Color Tokens (using CSS variables) ───────────────────────────────────────
// Semantic colors using CSS variable references
export const COLORS = {
  // Navy palette
  navy900: 'var(--navy-900, #042C5E)',
  navy100: 'var(--navy-100, #E8EFF7)',
  
  // Teal accent
  teal600: 'var(--teal-600, #1DA0BA)',
  teal100: 'var(--teal-100, #E6F7FA)',
  
  // Chart colors
  c1: 'var(--c1, #042C5E)',
  c2: 'var(--c2, #1DA0BA)',
  c3: 'var(--c3, #5B8DB8)',
  c4: 'var(--c4, #A8C4DE)',
  c5: 'var(--c5, #C8D0DC)',
  c6: 'var(--c6, #303A4C)',
  
  // Grey palette
  grey900: 'var(--grey-900, #1A2332)',
  grey700: 'var(--grey-700, #303A4C)',
  grey500: 'var(--grey-500, #6C757D)',
  grey400: 'var(--grey-400, #9CA3AF)',
  grey300: 'var(--grey-300, #C8D0DC)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey100: 'var(--grey-100, #EEF1F5)',
  grey50: 'var(--grey-50, #F8F9FA)',
  white: 'var(--white, #FFFFFF)',
  
  // Semantic
  positive: 'var(--s-pos, #042C5E)',
  positiveBg: 'var(--s-pos-bg, #E8EFF7)',
  negative: 'var(--s-neg, #303A4C)',
  negativeBg: 'var(--s-neg-bg, #EEF1F5)',
};

// Hex values for Recharts/charts that don't support CSS variables
export const CHART_COLORS = {
  navy900: '#042C5E',
  teal600: '#1DA0BA',
  c2: '#5B8DB8',
  c3: '#1DA0BA',
  c4: '#A8C4DE',
  c5: '#C8D0DC',
  grey300: '#C8D0DC',
  grey500: '#6C757D',
  grey700: '#303A4C',
};

// Color palette for positions
export const POSITION_COLORS = [
  '#042C5E', // navy-900
  '#5B8DB8', // c2
  '#1DA0BA', // teal-600
  '#A8C4DE', // c4
  '#C8D0DC', // c5
];

// ─── Formatters ───────────────────────────────────────────────────────────────
export const formatCurrency = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' €';

export const formatPercent = (n: number): string =>
  `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

// ─── Date helpers ─────────────────────────────────────────────────────────────
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

export const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// ─── CAGR Calculation ─────────────────────────────────────────────────────────
export const calculateEstimatedCagr = (position: PosicionInversion): number => {
  const totalAportado = Number(position.total_aportado || 0);
  const valorActual = Number(position.valor_actual || 0);
  if (totalAportado <= 0 || valorActual <= 0) return 0;

  const allDates = [
    parseDate(position.fecha_compra),
    parseDate(position.created_at),
    ...((position.aportaciones || []).map((a) => parseDate(a.fecha))),
  ].filter((date): date is Date => date instanceof Date);

  if (!allDates.length) return 0;

  const startDate = allDates.reduce((earliest, current) =>
    current.getTime() < earliest.getTime() ? current : earliest
  );
  const endDate = parseDate(position.fecha_valoracion) ?? new Date();
  const elapsedYears = Math.max(
    (endDate.getTime() - startDate.getTime()) / MS_PER_YEAR,
    0
  );

  if (elapsedYears <= 0) return 0;

  return (Math.pow(valorActual / totalAportado, 1 / elapsedYears) - 1) * 100;
};

export const resolveAnnualReturn = (position: PosicionInversion): number => {
  // For periodic-yield types (loans, deposits, remunerated accounts): use the configured interest rate
  const tiposRendimientoPeriodico = [
    'prestamo_p2p',
    'deposito_plazo',
    'deposito',
    'cuenta_remunerada',
  ];
  if (tiposRendimientoPeriodico.includes(position.tipo)) {
    const rendObj = (position as any).rendimiento;
    if (
      rendObj &&
      typeof rendObj === 'object' &&
      Number.isFinite(Number(rendObj.tasa_interes_anual))
    ) {
      return Number(rendObj.tasa_interes_anual);
    }
  }

  // For market-valued assets: CAGR based on value appreciation
  const estimatedCagr = calculateEstimatedCagr(position);
  if (Number.isFinite(estimatedCagr) && Math.abs(estimatedCagr) > 0.0001) {
    return estimatedCagr;
  }

  // Fallback: try extracting rate from rendimiento object (any type)
  const rendObj = (position as any).rendimiento;
  if (
    rendObj &&
    typeof rendObj === 'object' &&
    Number.isFinite(Number(rendObj.tasa_interes_anual))
  ) {
    return Number(rendObj.tasa_interes_anual);
  }

  return 0;
};

// ─── Chart Data Builders ──────────────────────────────────────────────────────
export const buildEvolucionInversiones = (positions: PositionRow[]) => {
  const currentYear = new Date().getFullYear();

  // Find the earliest real purchase year from positions
  const fechasCompra = positions
    .map((p) =>
      p.fechaCompra ? new Date(p.fechaCompra).getFullYear() : NaN
    )
    .filter((y) => y > 2000 && y <= currentYear);

  if (fechasCompra.length === 0 && positions.length > 0) {
    // No purchase dates available — show only the current year
    const totalAportado = positions.reduce((sum, p) => sum + p.aportado, 0);
    const totalValor = positions.reduce((sum, p) => sum + p.valor, 0);
    return [{ year: String(currentYear), aportado: totalAportado, valor: totalValor }];
  }

  const primerAño = Math.min(...fechasCompra);

  // Build real data points per year based on when positions were created
  const result: { year: string; aportado: number; valor: number }[] = [];
  let acumuladoAportado = 0;

  for (let año = primerAño; año <= currentYear; año++) {
    // Sum contributions from positions created in or before this year
    const aportadoAño = positions
      .filter((p) => {
        if (!p.fechaCompra) return false;
        return new Date(p.fechaCompra).getFullYear() === año;
      })
      .reduce((sum, p) => sum + p.aportado, 0);

    acumuladoAportado += aportadoAño;

    result.push({
      year: String(año),
      aportado: acumuladoAportado,
      valor:
        año === currentYear
          ? positions.reduce((sum, p) => sum + p.valor, 0)
          : acumuladoAportado, // past years without stored valuations: use cost basis
    });
  }

  return result;
};

export const buildProyInv = (
  years: number,
  base: number,
  aportado: number,
  portfolioRate: number
) => {
  const rate = portfolioRate / 100;
  return Array.from({ length: years + 1 }, (_, i) => ({
    year: String(new Date().getFullYear() + i),
    valor: Math.round(base * Math.pow(1 + rate, i)),
    coste: aportado, // constant — we don't assume future contributions
  }));
};

export const buildIndividualEvolucion = (position: PositionRow) => {
  const currentYear = new Date().getFullYear();
  const añoCompra = position.fechaCompra
    ? new Date(position.fechaCompra).getFullYear()
    : NaN;
  const añoInicio =
    añoCompra > 2000 && añoCompra <= currentYear ? añoCompra : currentYear;

  // Historical: only from actual purchase year to today
  const hist: { year: string; hist: number | null; proy: number | null }[] = [];
  for (let año = añoInicio; año <= currentYear; año++) {
    hist.push({
      year: String(año),
      hist:
        año === añoInicio
          ? position.aportado
          : año === currentYear
          ? position.valor
          : position.aportado, // past years without stored valuations: use cost basis
      proy: año === currentYear ? position.valor : null,
    });
  }

  // Planes de pensión: sin proyección de rentabilidad (no hay CAGR fiable sin histórico de valor)
  if (position.tipo === 'plan_pensiones') {
    return hist;
  }

  // Projection: use real rentAnual (now includes interest rate for loans)
  const tasa = Math.max(0, position.rentAnual / 100);

  // For loans with a maturity, limit projection horizon
  const tiposConVencimiento = [
    'prestamo_p2p',
    'deposito_plazo',
    'deposito',
    'cuenta_remunerada',
  ];
  const esRentaFija = tiposConVencimiento.includes(position.tipo);
  const maxAñosProyeccion =
    esRentaFija && position.duracionMeses
      ? Math.ceil(position.duracionMeses / 12)
      : 10;

  const proy: { year: string; hist: number | null; proy: number | null }[] = [];
  for (let i = 1; i <= 3; i++) {
    const añoTarget = currentYear + i * 2;
    if (añoTarget > currentYear + maxAñosProyeccion) break;
    proy.push({
      year: String(añoTarget),
      hist: null,
      proy: esRentaFija
        ? position.valor // Loans/deposits: principal doesn't grow in market value
        : Math.round(position.valor * Math.pow(1 + tasa, i * 2)),
    });
  }

  return [...hist, ...proy];
};

// ─── Position Mapper ──────────────────────────────────────────────────────────
export const mapPosicionesToRows = (data: PosicionInversion[]): PositionRow[] => {
  if (!data.length) return [] as PositionRow[];

  const totalValor = data.reduce((sum, p) => sum + p.valor_actual, 0);
  const mapped: PositionRow[] = data.map((p: PosicionInversion, index) => {
    const rentabilidadAnual = resolveAnnualReturn(p);
    const peso = totalValor > 0 ? (p.valor_actual / totalValor) * 100 : 0;
    return {
      id: String(p.id),
      alias: p.nombre,
      broker: p.entidad,
      tipo: p.tipo,
      aportado: p.total_aportado,
      valor: p.valor_actual,
      rentPct: p.rentabilidad_porcentaje,
      rentAnual: Number.isFinite(rentabilidadAnual) ? rentabilidadAnual : 0,
      peso: Number(peso.toFixed(1)),
      color: POSITION_COLORS[index % POSITION_COLORS.length],
      tag: null,
      fechaCompra: p.fecha_compra || p.created_at || null,
      duracionMeses: p.duracion_meses ?? null,
    };
  });

  // Mark best performer
  if (mapped.length > 0) {
    const bestIdx = mapped.reduce(
      (best, item, index, arr) =>
        item.rentAnual > arr[best].rentAnual ? index : best,
      0
    );
    mapped[bestIdx] = { ...mapped[bestIdx], tag: 'Top performer' };
  }

  return mapped;
};
