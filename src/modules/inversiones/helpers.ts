// Helpers de presentación · Inversiones v5.
//
// Factorizamos aquí la lógica derivada que sirve a las 4 sub-páginas
// (Resumen · Cartera · Rendimientos · Individual) para que los componentes
// no contengan cálculos. La lógica de negocio (CRUD posiciones · aportaciones)
// se mantiene en los services del repositorio (NO se duplica aquí).

import type { PosicionInversion } from '../../types/inversiones';
import type { PositionRow } from './types';

// Paleta de gráficos · ciclamos colores entre posiciones para diferenciar
// líneas y donut sin acoplarnos a tokens semánticos. Ver §5.1 guía v5.
export const POSITION_COLORS = [
  '#0E2A47',
  '#5B8DB8',
  '#1DA0BA',
  '#A8C4DE',
  '#C8D0DC',
];

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const TIPOS_RENTA_FIJA = new Set([
  'prestamo_p2p',
  'deposito_plazo',
  'deposito',
  'cuenta_remunerada',
]);

const TIPOS_CON_VENCIMIENTO = TIPOS_RENTA_FIJA;

/**
 * Formato moneda EUR sin decimales (estilo dashboard).
 * Para detalle/tabla con 2 decimales · usar `formatCurrency2`.
 */
export const formatCurrency = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' €';

export const formatCurrency2 = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export const formatPercent = (n: number): string =>
  `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

/**
 * CAGR estimado a partir de la primera aportación / fecha compra.
 */
export const calculateEstimatedCagr = (position: PosicionInversion): number => {
  const totalAportado = Number(position.total_aportado || 0);
  const valorActual = Number(position.valor_actual || 0);
  if (totalAportado <= 0 || valorActual <= 0) return 0;

  const allDates = [
    parseDate(position.fecha_compra),
    parseDate(position.created_at),
    ...((position.aportaciones || []).map((a) => parseDate(a.fecha))),
  ].filter((d): d is Date => d instanceof Date);

  if (!allDates.length) return 0;

  const startDate = allDates.reduce((earliest, current) =>
    current.getTime() < earliest.getTime() ? current : earliest,
  );
  const endDate = parseDate(position.fecha_valoracion) ?? new Date();
  const elapsedYears = Math.max(
    (endDate.getTime() - startDate.getTime()) / MS_PER_YEAR,
    0,
  );
  if (elapsedYears <= 0) return 0;

  return (Math.pow(valorActual / totalAportado, 1 / elapsedYears) - 1) * 100;
};

export const resolveAnnualReturn = (position: PosicionInversion): number => {
  if (TIPOS_RENTA_FIJA.has(position.tipo)) {
    const rendObj = (position as unknown as { rendimiento?: { tasa_interes_anual?: number } })
      .rendimiento;
    if (rendObj && Number.isFinite(Number(rendObj.tasa_interes_anual))) {
      return Number(rendObj.tasa_interes_anual);
    }
  }

  const cagr = calculateEstimatedCagr(position);
  if (Number.isFinite(cagr) && Math.abs(cagr) > 0.0001) return cagr;

  // Fallback genérico · cualquier tipo con tasa configurada.
  const rendObj = (position as unknown as { rendimiento?: { tasa_interes_anual?: number } })
    .rendimiento;
  if (rendObj && Number.isFinite(Number(rendObj.tasa_interes_anual))) {
    return Number(rendObj.tasa_interes_anual);
  }
  return 0;
};

/**
 * Mapea `PosicionInversion[]` a filas de presentación con peso y "Top performer".
 */
export const mapPosicionesToRows = (data: PosicionInversion[]): PositionRow[] => {
  if (!data.length) return [];
  const totalValor = data.reduce((sum, p) => sum + p.valor_actual, 0);
  const mapped: PositionRow[] = data.map((p, i) => {
    const rentAnual = resolveAnnualReturn(p);
    const peso = totalValor > 0 ? (p.valor_actual / totalValor) * 100 : 0;
    return {
      id: String(p.id),
      alias: p.nombre,
      broker: p.entidad,
      tipo: p.tipo,
      aportado: p.total_aportado,
      valor: p.valor_actual,
      rentPct: p.rentabilidad_porcentaje,
      rentAnual: Number.isFinite(rentAnual) ? rentAnual : 0,
      peso: Number(peso.toFixed(1)),
      color: POSITION_COLORS[i % POSITION_COLORS.length],
      tag: null,
      fechaCompra: p.fecha_compra || p.created_at || null,
      duracionMeses: p.duracion_meses ?? null,
    };
  });

  if (mapped.length > 0) {
    const bestIdx = mapped.reduce(
      (best, item, idx, arr) => (item.rentAnual > arr[best].rentAnual ? idx : best),
      0,
    );
    mapped[bestIdx] = { ...mapped[bestIdx], tag: 'Top performer' };
  }
  return mapped;
};

// ── Series para gráficos ────────────────────────────────────────────────────

export const buildEvolucionInversiones = (positions: PositionRow[]) => {
  const currentYear = new Date().getFullYear();
  const fechasCompra = positions
    .map((p) => (p.fechaCompra ? new Date(p.fechaCompra).getFullYear() : NaN))
    .filter((y) => y > 2000 && y <= currentYear);

  if (fechasCompra.length === 0 && positions.length > 0) {
    const totalAportado = positions.reduce((s, p) => s + p.aportado, 0);
    const totalValor = positions.reduce((s, p) => s + p.valor, 0);
    return [{ year: String(currentYear), aportado: totalAportado, valor: totalValor }];
  }

  const primerAño = Math.min(...fechasCompra);
  const result: { year: string; aportado: number; valor: number }[] = [];
  let acumuladoAportado = 0;
  for (let año = primerAño; año <= currentYear; año++) {
    const aportadoAño = positions
      .filter((p) => p.fechaCompra && new Date(p.fechaCompra).getFullYear() === año)
      .reduce((s, p) => s + p.aportado, 0);
    acumuladoAportado += aportadoAño;
    result.push({
      year: String(año),
      aportado: acumuladoAportado,
      valor:
        año === currentYear
          ? positions.reduce((s, p) => s + p.valor, 0)
          : acumuladoAportado,
    });
  }
  return result;
};

export const buildProyInv = (
  years: number,
  base: number,
  aportado: number,
  portfolioRate: number,
) => {
  const rate = portfolioRate / 100;
  return Array.from({ length: years + 1 }, (_, i) => ({
    year: String(new Date().getFullYear() + i),
    valor: Math.round(base * Math.pow(1 + rate, i)),
    coste: aportado,
  }));
};

export const buildIndividualEvolucion = (position: PositionRow) => {
  const currentYear = new Date().getFullYear();
  const añoCompra = position.fechaCompra
    ? new Date(position.fechaCompra).getFullYear()
    : NaN;
  const añoInicio =
    añoCompra > 2000 && añoCompra <= currentYear ? añoCompra : currentYear;

  const hist: { year: string; hist: number | null; proy: number | null }[] = [];
  for (let año = añoInicio; año <= currentYear; año++) {
    hist.push({
      year: String(año),
      hist:
        año === añoInicio
          ? position.aportado
          : año === currentYear
            ? position.valor
            : position.aportado,
      proy: año === currentYear ? position.valor : null,
    });
  }
  if (position.tipo === 'plan_pensiones') return hist;

  const tasa = Math.max(0, position.rentAnual / 100);
  const esRentaFija = TIPOS_CON_VENCIMIENTO.has(position.tipo);
  const maxAñosProyeccion =
    esRentaFija && position.duracionMeses ? Math.ceil(position.duracionMeses / 12) : 10;

  const proy: { year: string; hist: number | null; proy: number | null }[] = [];
  for (let i = 1; i <= 3; i++) {
    const añoTarget = currentYear + i * 2;
    if (añoTarget > currentYear + maxAñosProyeccion) break;
    proy.push({
      year: String(añoTarget),
      hist: null,
      proy: esRentaFija
        ? position.valor
        : Math.round(position.valor * Math.pow(1 + tasa, i * 2)),
    });
  }
  return [...hist, ...proy];
};

export const calcularHorizonteProyeccion = (
  pos: PositionRow,
): { años: number; meses: number | null } => {
  switch (pos.tipo) {
    case 'prestamo_p2p':
    case 'deposito_plazo':
    case 'deposito':
      if (pos.duracionMeses && pos.duracionMeses > 0) {
        return { años: pos.duracionMeses / 12, meses: pos.duracionMeses };
      }
      return { años: 5, meses: null };
    case 'plan_pensiones':
    case 'plan_empleo':
      return { años: 20, meses: null };
    case 'cuenta_remunerada':
      return { años: 10, meses: null };
    default:
      return { años: 10, meses: null };
  }
};

export const TIPO_LABEL: Record<string, string> = {
  cuenta_remunerada: 'Cuenta remunerada',
  prestamo_p2p: 'Préstamo P2P',
  deposito_plazo: 'Depósito a plazo',
  deposito: 'Depósito',
  fondo_inversion: 'Fondo inversión',
  etf: 'ETF',
  reit: 'REIT',
  accion: 'Acción',
  crypto: 'Crypto',
  plan_pensiones: 'Plan pensiones',
  plan_empleo: 'Plan empleo',
  otro: 'Otro',
};

export const labelTipo = (t: string): string => TIPO_LABEL[t] ?? t.replace(/_/g, ' ');
