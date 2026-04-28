// Helpers de presentación · Financiación v5.
//
// Factorizamos la lógica derivada que consumen las sub-páginas (Dashboard,
// Listado, Snowball, Calendario y Detalle) para que los componentes no
// hagan cálculos. La lógica de negocio (cálculo de cuadros, fiscalidad,
// migraciones) sigue en los services del repositorio (NO se duplica).

import type { Prestamo, PlanPagos, PeriodoPago, Bonificacion } from '../../types/prestamos';
import type { BankPalette, LoanKind, LoanRow } from './types';

const BANK_KEYWORDS: Record<string, BankPalette> = {
  unicaja: { bg: '#0F4FA0', fg: '#FFFFFF', abbr: 'UN' },
  ing: { bg: '#FF6200', fg: '#FFFFFF', abbr: 'ING' },
  sabadell: { bg: '#0E4F8C', fg: '#FFFFFF', abbr: 'SB' },
  santander: { bg: '#EC0000', fg: '#FFFFFF', abbr: 'SA' },
  bbva: { bg: '#004481', fg: '#FFFFFF', abbr: 'BB' },
  caixa: { bg: '#00509D', fg: '#FFFFFF', abbr: 'CX' },
  bankinter: { bg: '#FF6900', fg: '#FFFFFF', abbr: 'BK' },
  abanca: { bg: '#003B71', fg: '#FFFFFF', abbr: 'AB' },
  kutxabank: { bg: '#005EAB', fg: '#FFFFFF', abbr: 'KB' },
  openbank: { bg: '#E2231A', fg: '#FFFFFF', abbr: 'OB' },
};

/**
 * Devuelve la paleta de logo para un banco · matching por substring.
 * Fallback · iniciales del banco con el oro corporativo.
 */
export const getBankPalette = (banco: string): BankPalette => {
  const k = banco.toLowerCase();
  for (const key of Object.keys(BANK_KEYWORDS)) {
    if (k.includes(key)) return BANK_KEYWORDS[key];
  }
  const abbr = banco
    .replace(/[^a-zA-ZÁÉÍÓÚáéíóúÑñ ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return { bg: '#B88A3E', fg: '#FFFFFF', abbr: abbr || '?' };
};

const sumDestinosPct = (destinos: Prestamo['destinos'], filter: (tipo: string) => boolean): number => {
  if (!destinos || destinos.length === 0) return 0;
  return destinos
    .filter((d) => filter(d.tipo))
    .reduce((s, d) => s + (d.porcentaje ?? 0), 0);
};

/** Inferimos el "tipo lógico" de un préstamo · hipoteca/personal/pignora. */
export const inferLoanKind = (p: Prestamo): LoanKind => {
  const garantias = p.garantias ?? [];
  if (garantias.some((g) => g.tipo === 'PIGNORATICIA')) return 'pignora';
  if (garantias.some((g) => g.tipo === 'HIPOTECARIA')) return 'hipoteca';
  if (p.ambito === 'INMUEBLE') return 'hipoteca';
  return 'personal';
};

const reduccionEfectivaPP = (b: Bonificacion): number => {
  // `reduccionPuntosPorcentuales` viene en fracción (0.003 = 0.30 pp).
  // Convertimos a "puntos porcentuales" para restar al TIN base.
  if (Number.isFinite(b.reduccionPuntosPorcentuales)) {
    return Number(b.reduccionPuntosPorcentuales) * 100;
  }
  return Number(b.impacto?.puntos ?? 0);
};

const ESTADOS_BONIF_ACTIVAS: Bonificacion['estado'][] = [
  'ACTIVO_POR_GRACIA',
  'ACTIVO_POR_CUMPLIMIENTO',
  'CUMPLIDA',
];

/**
 * TIN efectivo aproximado · para FIJO · `tipoNominalAnualFijo`. Para VARIABLE/MIXTO
 * · suma índice + diferencial. Aplica bonificaciones activas (estado en gracia ·
 * cumplimiento · cumplida).
 */
export const effectiveTIN = (p: Prestamo): number => {
  let base = 0;
  if (p.tipo === 'FIJO') base = p.tipoNominalAnualFijo ?? 0;
  else if (p.tipo === 'VARIABLE') base = (p.valorIndiceActual ?? 0) + (p.diferencial ?? 0);
  else if (p.tipo === 'MIXTO') base = p.tipoNominalAnualMixtoFijo ?? 0;

  const aplicadas = (p.bonificaciones ?? [])
    .filter((b) => ESTADOS_BONIF_ACTIVAS.includes(b.estado))
    .reduce((s, b) => s + reduccionEfectivaPP(b), 0);

  const tope = p.maximoBonificacionPorcentaje ?? p.topeBonificacionesTotal;
  const aplica = tope ? Math.min(aplicadas, tope * 100) : aplicadas;
  return Math.max(0, base - aplica);
};

const monthsBetween = (start: Date, end: Date): number => {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
};

/**
 * Cuota mensual aproximada · sistema francés. Si el préstamo todavía está en
 * carencia, devuelve sólo la parte de intereses sobre principalVivo.
 */
export const cuotaMensualAprox = (p: Prestamo): number => {
  const i = effectiveTIN(p) / 100 / 12;
  const n = Math.max(1, p.plazoMesesTotal - p.cuotasPagadas);
  const C = p.principalVivo;
  if (i === 0) return C / n;
  return (C * i) / (1 - Math.pow(1 + i, -n));
};

/**
 * Fecha de vencimiento aproximada · firma + plazoMesesTotal.
 */
export const fechaVencimiento = (p: Prestamo): string | null => {
  if (!p.fechaFirma) return null;
  const f = new Date(p.fechaFirma);
  if (Number.isNaN(f.getTime())) return null;
  f.setMonth(f.getMonth() + p.plazoMesesTotal);
  return f.toISOString();
};

const aliasFromPrestamo = (p: Prestamo): string => p.nombre || 'Préstamo sin nombre';

/** Extrae el banco a partir del nombre · primera palabra antes de · / · */
const bancoFromNombre = (p: Prestamo): string => {
  const n = (p.nombre || '').trim();
  if (!n) return '—';
  const sep = /\s+[·•|-]\s+/;
  const parts = n.split(sep);
  return parts[0]?.trim() || n;
};

const destinosResumen = (p: Prestamo): string => {
  const d = p.destinos ?? [];
  if (d.length === 0) return 'sin destinos definidos';
  return d
    .map((x) => {
      const pct = x.porcentaje != null ? ` ${x.porcentaje.toFixed(0)}%` : '';
      const tipo = x.tipo
        .toLowerCase()
        .replace('_', ' ');
      return `${tipo}${pct}`;
    })
    .join(' · ');
};

const garantiasResumen = (p: Prestamo): string => {
  const g = p.garantias ?? [];
  if (g.length === 0) return 'sin garantía registrada';
  return g.map((x) => x.tipo.toLowerCase()).join(' · ');
};

export const loanRowFromPrestamo = (
  p: Prestamo,
  intDeducibles2025?: number,
): LoanRow => {
  const cuotaMensual = cuotaMensualAprox(p);
  const principal = p.principalInicial || 0;
  const vivo = p.principalVivo || 0;
  const amort = Math.max(0, principal - vivo);
  const porc = principal > 0 ? (amort / principal) * 100 : 0;
  const venc = fechaVencimiento(p);
  const cuotasRestantes = Math.max(0, p.plazoMesesTotal - p.cuotasPagadas);
  const intDed = intDeducibles2025 ?? 0;
  const intDedPctNum = sumDestinosPct(p.destinos, (t) => t === 'ADQUISICION' || t === 'REFORMA');
  return {
    id: p.id,
    alias: aliasFromPrestamo(p),
    banco: bancoFromNombre(p),
    kind: inferLoanKind(p),

    principalInicial: principal,
    capitalVivo: vivo,
    amortizado: amort,
    porcentajeAmortizado: porc,
    cuotaMensual,
    tin: effectiveTIN(p),
    fechaFirma: p.fechaFirma ?? null,
    fechaVencimiento: venc,
    cuotasRestantes,
    destinosResumen: destinosResumen(p),
    garantiasResumen: garantiasResumen(p),
    intDeducibles: intDed,
    intDeduciblesPct: intDedPctNum,
    raw: p,
  };
};

export const sumLoans = <T extends keyof LoanRow>(rows: LoanRow[], key: T): number =>
  rows.reduce((s, r) => s + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);

export const formatEUR0 = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export const formatPct = (n: number, decimals = 1): string =>
  `${n.toFixed(decimals).replace('.', ',')}%`;

export const formatYear = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return String(d.getFullYear());
};

export const monthsLeftLabel = (rest: number): string => {
  if (rest <= 0) return 'vencido';
  const years = Math.round((rest / 12) * 10) / 10;
  if (years >= 1) return `${years.toFixed(1).replace('.', ',')} años rest.`;
  return `${rest} m rest.`;
};

export const labelKind = (k: LoanKind): string => {
  if (k === 'hipoteca') return 'Hipoteca';
  if (k === 'personal') return 'Personal';
  if (k === 'pignora') return 'Pignoraticia';
  return 'Otro';
};

export const yearsBetween = (startISO?: string, endISO?: string | null): number => {
  if (!startISO || !endISO) return 0;
  const a = new Date(startISO);
  const b = new Date(endISO);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, monthsBetween(a, b)) / 12;
};

/** Próximas cuotas a pagar este mes (basado en plan o estimación). */
export interface UpcomingCuota {
  prestamoId: string;
  alias: string;
  banco: string;
  fechaISO: string;
  diasHasta: number;
  cuota: number;
  capital: number;
  interes: number;
  urgente: boolean;
}

const diffDaysUTC = (a: Date, b: Date): number => {
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da - db) / 86_400_000);
};

export const upcomingCuotasFromPlanes = (
  prestamos: Prestamo[],
  planes: Map<string, PlanPagos | null>,
  reference = new Date(),
): UpcomingCuota[] => {
  const start = new Date(reference);
  start.setDate(reference.getDate() - 2);
  const end = new Date(reference);
  end.setDate(reference.getDate() + 30);

  const out: UpcomingCuota[] = [];
  for (const p of prestamos) {
    const plan = planes.get(p.id);
    const target = plan?.periodos?.find((per) => {
      const d = new Date(per.fechaCargo);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end && !per.pagado;
    });
    if (target) {
      const fechaD = new Date(target.fechaCargo);
      const diff = diffDaysUTC(fechaD, reference);
      out.push({
        prestamoId: p.id,
        alias: aliasFromPrestamo(p),
        banco: bancoFromNombre(p),
        fechaISO: target.fechaCargo,
        diasHasta: diff,
        cuota: target.cuota ?? cuotaMensualAprox(p),
        capital: target.amortizacion ?? 0,
        interes: target.interes ?? 0,
        urgente: diff <= 7,
      });
      continue;
    }
    // Fallback · estimar próximo cargo según diaCargoMes.
    const day = Math.min(28, p.diaCargoMes || 1);
    const candidate = new Date(reference.getFullYear(), reference.getMonth(), day);
    if (candidate < reference) candidate.setMonth(candidate.getMonth() + 1);
    if (candidate > end) continue;
    const cuota = cuotaMensualAprox(p);
    const interes = (p.principalVivo * effectiveTIN(p)) / 100 / 12;
    out.push({
      prestamoId: p.id,
      alias: aliasFromPrestamo(p),
      banco: bancoFromNombre(p),
      fechaISO: candidate.toISOString(),
      diasHasta: diffDaysUTC(candidate, reference),
      cuota,
      capital: cuota - interes,
      interes,
      urgente: diffDaysUTC(candidate, reference) <= 7,
    });
  }
  return out.sort((a, b) => a.diasHasta - b.diasHasta);
};

/** Cuotas mensuales de un año concreto desde el plan. Fallback · cuota constante. */
export const cuotasDelAnio = (
  prestamo: Prestamo,
  plan: PlanPagos | null | undefined,
  year: number,
): { mes: number; cuota: number; capital: number; interes: number; pagado?: boolean }[] => {
  if (plan?.periodos?.length) {
    return plan.periodos
      .filter((per: PeriodoPago) => {
        const d = new Date(per.fechaCargo);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
      })
      .map((per: PeriodoPago) => {
        const d = new Date(per.fechaCargo);
        return {
          mes: d.getMonth() + 1,
          cuota: per.cuota ?? 0,
          capital: per.amortizacion ?? 0,
          interes: per.interes ?? 0,
          pagado: per.pagado,
        };
      });
  }
  const cuota = cuotaMensualAprox(prestamo);
  const interes = (prestamo.principalVivo * effectiveTIN(prestamo)) / 100 / 12;
  return Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    cuota,
    capital: Math.max(0, cuota - interes),
    interes,
  }));
};

/** Gradiente vencimiento · "+X €/mes" liberados al amortizar fin del préstamo. */
export interface Escalon {
  year: number;
  prestamoId: string;
  alias: string;
  banco: string;
  cuotaLiberada: number;
  cuotasRestantes: number;
  tin: number;
}

export const buildEscalones = (rows: LoanRow[]): Escalon[] => {
  return rows
    .map((r) => ({
      year: r.fechaVencimiento ? new Date(r.fechaVencimiento).getFullYear() : 0,
      prestamoId: r.id,
      alias: r.alias,
      banco: r.banco,
      cuotaLiberada: r.cuotaMensual,
      cuotasRestantes: r.cuotasRestantes,
      tin: r.tin,
    }))
    .filter((e) => e.year > 0)
    .sort((a, b) => a.year - b.year);
};
