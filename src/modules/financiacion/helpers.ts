// Helpers de presentación · Financiación v5.
//
// Factorizamos la lógica derivada que consumen las sub-páginas (Dashboard,
// Listado, Snowball, Calendario y Detalle) para que los componentes no
// hagan cálculos. La lógica de negocio (cálculo de cuadros, fiscalidad,
// migraciones) sigue en los services del repositorio (NO se duplica).

import type { Prestamo, PlanPagos, PeriodoPago } from '../../types/prestamos';
import { tramoVigente } from '../../services/prestamos/tramosDeTipo';
import {
  cuadroDe,
  getCuota,
  getCuotasDelAnio,
  getFechaVencimiento,
  getInteresesDelAnio,
  getTinVigente,
} from '../../services/prestamos/consulta';
import { interesesTotalDeducible } from '../../services/prestamosService';
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

/** Hoy, en ISO · el día contra el que se pregunta «¿a qué tipo vas ahora?». */
const hoyISO = (): string => new Date().toISOString().slice(0, 10);

/**
 * El TIN de HOY antes de bonificar · el del tramo que rige ahora mismo.
 *
 * Antes se leía del campo del arranque, así que un mixto anunciaba su tipo de
 * teaser hasta el último recibo: la Unicaja de Jose —36 meses al 2,600 % y
 * después Euríbor + 1,750— habría seguido diciendo 2,600 % en 2043. Y un
 * variable ignoraba las revisiones apuntadas de sus cartas, que son hechos.
 */
export const tinBase = (p: Prestamo): number => tramoVigente(p, hoyISO()).tinBase;

/** El TIN que se paga hoy · el del tramo vigente, ya bonificado. */
export const effectiveTIN = (p: Prestamo): number => getTinVigente(p, hoyISO());

const monthsBetween = (start: Date, end: Date): number => {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
};

/**
 * La cuota que tendría este préstamo **a otro TIN** · para el «¿y si?».
 *
 * Es lo que hace falta para enseñar a qué cuota vas si pierdes una bonificación
 * (§6 ter), y por eso el tipo se pasa aparte. Pero la cuota la calcula el motor
 * sobre un préstamo hipotético, no una fórmula escrita aquí: escribirla otra vez
 * es lo que hacía que la misma cuota valiese dos cosas distintas según qué
 * pantalla la enseñara.
 */
export const cuotaMensualConTin = (p: Prestamo, tinAnual: number): number => {
  const comoSiFuera: Prestamo = {
    ...p,
    tipo: 'FIJO',
    tipoNominalAnualFijo: tinAnual,
    // Sin bonificaciones: el tipo que se pasa YA es el efectivo, y dejarlas
    // puestas lo rebajaría una segunda vez.
    bonificaciones: [],
  };
  return getCuota(comoSiFuera, hoyISO());
};

/** La cuota de hoy · la del cuadro, con su tramo y sus bonificaciones. */
export const cuotaMensualAprox = (p: Prestamo): number => getCuota(p, hoyISO());

/**
 * Cuándo se paga la última cuota · la del cuadro.
 *
 * Era «firma + plazoMesesTotal», que ignora la carencia —que corre todos los
 * vencimientos—, los días sueltos del arranque y cualquier amortización
 * anticipada. De ahí salía el «libre en enero de 2037» que no cuadraba con el
 * calendario de al lado.
 */
export const fechaVencimiento = (p: Prestamo): string | null => getFechaVencimiento(p);

const aliasFromPrestamo = (p: Prestamo): string => p.nombre || 'Préstamo sin nombre';

/**
 * De qué banco es este préstamo.
 *
 * **Del campo `banco`**, que existe y nadie leía. Se sacaba de la primera
 * palabra del nombre libre, así que dos préstamos del mismo banco contaban como
 * dos entidades distintas en cuanto sus nombres no empezaran igual: de ahí las
 * «9 entidades» del panel de Jose, que son 9 préstamos en 5 bancos.
 *
 * Los préstamos viejos pueden no tenerlo puesto, y para esos se sigue mirando
 * el nombre — pero como último recurso, no como fuente.
 */
const bancoDelPrestamo = (p: Prestamo): string => {
  const dicho = (p.banco || '').trim();
  if (dicho) return dicho;

  const n = (p.nombre || '').trim();
  if (!n) return '—';
  const parts = n.split(/\s+[·•|-]\s+/);
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
    banco: bancoDelPrestamo(p),
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
        banco: bancoDelPrestamo(p),
        fechaISO: target.fechaCargo,
        diasHasta: diff,
        cuota: target.cuota ?? cuotaMensualAprox(p),
        capital: target.amortizacion ?? 0,
        interes: target.interes ?? 0,
        urgente: diff <= 7,
      });
      continue;
    }
    // Sin plan guardado, el cuadro · que también sabe qué día se cobra y cuánto
    // de esa cuota es capital. Aquí se estimaba el cargo por `diaCargoMes` y el
    // interés como «capital vivo por el TIN entre doce», o sea un recibo
    // inventado con fecha inventada, indistinguible en pantalla de uno real.
    const delCuadro = cuadroDe(p).plan.periodos.find((per) => {
      const d = new Date(per.fechaCargo);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end && !per.pagado;
    });
    if (!delCuadro) continue;
    const diff = diffDaysUTC(new Date(delCuadro.fechaCargo), reference);
    out.push({
      prestamoId: p.id,
      alias: aliasFromPrestamo(p),
      banco: bancoDelPrestamo(p),
      fechaISO: delCuadro.fechaCargo,
      diasHasta: diff,
      cuota: delCuadro.cuota,
      capital: delCuadro.amortizacion,
      interes: delCuadro.interes,
      urgente: diff <= 7,
    });
  }
  return out.sort((a, b) => a.diasHasta - b.diasHasta);
};

/**
 * Los recibos de un año · del plan guardado, y si no lo hay, del cuadro.
 *
 * Sin plan se devolvían **doce meses de cuota plana**, uno por mes del año,
 * existiera o no el préstamo en enero, con el interés congelado al de hoy. Un
 * calendario inventado que se pintaba igual que uno de verdad — y para un mixto
 * que revisa a mitad de año, doce cifras equivocadas.
 */
export const cuotasDelAnio = (
  prestamo: Prestamo,
  plan: PlanPagos | null | undefined,
  year: number,
): { mes: number; cuota: number; capital: number; interes: number; pagado?: boolean }[] => {
  const periodos: PeriodoPago[] = plan?.periodos?.length
    ? plan.periodos.filter((per) => {
        const d = new Date(per.fechaCargo);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
      })
    : getCuotasDelAnio(prestamo, year);

  return periodos.map((per) => ({
    mes: new Date(per.fechaCargo).getMonth() + 1,
    cuota: per.cuota ?? 0,
    capital: per.amortizacion ?? 0,
    interes: per.interes ?? 0,
    pagado: per.pagado,
  }));
};

/**
 * Los intereses de un año que además son DEDUCIBLES · §5, defecto D5.
 *
 * Dos preguntas encadenadas y cada una en su sitio: cuánto interés se paga ese
 * año lo dice el cuadro (`getInteresesDelAnio`), y qué parte de él se deduce lo
 * dice el destino del capital (`interesesTotalDeducible`).
 *
 * Se venía estimando el interés del año como `capitalVivo × TIN`, o sea el de
 * un año entero al tipo de hoy sobre el capital de hoy: ni el capital baja a lo
 * largo del año, ni el tipo se queda quieto en un mixto, ni el préstamo tiene
 * por qué haber existido en enero.
 */
export const interesDeducibleDelAnio = (prestamo: Prestamo, year: number): number => {
  try {
    return interesesTotalDeducible(prestamo, getInteresesDelAnio(prestamo, year));
  } catch {
    return 0;
  }
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
      // Lo que se libera es la cuota que se estará pagando ESE DÍA, no la de
      // hoy: la Unicaja acaba en 2043 pagando su cuota variable, no los 454,66 €
      // del tramo fijo. Con la de hoy, el escalón de un mixto se quedaba corto
      // justo en el préstamo más largo, que es el que más pesa.
      cuotaLiberada: r.fechaVencimiento ? getCuota(r.raw, r.fechaVencimiento) : r.cuotaMensual,
      cuotasRestantes: r.cuotasRestantes,
      tin: r.tin,
    }))
    .filter((e) => e.year > 0)
    .sort((a, b) => a.year - b.year);
};
