// Helpers de presentación · Inversiones v5.
//
// Factorizamos aquí la lógica derivada que sirve a las 4 sub-páginas
// (Resumen · Cartera · Rendimientos · Individual) para que los componentes
// no contengan cálculos. La lógica de negocio (CRUD posiciones · aportaciones)
// se mantiene en los services del repositorio (NO se duplica aquí).

import type { PosicionInversion, TipoPosicion } from '../../types/inversiones';
import type { PositionRow } from './types';
import type { CartaItem } from './types/cartaItem';

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
  cuenta_remunerada: 'CUENTA REMUNERADA',
  prestamo_p2p: 'PRÉSTAMO P2P',
  deposito_plazo: 'DEPÓSITO A PLAZO',
  deposito: 'DEPÓSITO',
  fondo_inversion: 'FONDO INVERSIÓN',
  etf: 'ETF',
  reit: 'REIT',
  accion: 'ACCIONES',
  crypto: 'CRYPTO',
  plan_pensiones: 'PLAN PENSIONES',
  plan_empleo: 'PLAN EMPLEO',
  otro: 'OTRO',
};

export const labelTipo = (t: string): string => TIPO_LABEL[t] ?? t.replace(/_/g, ' ');

// ── Helpers · galería v2 (T23.1 · § 2.6 spec) ───────────────────────────────

export type GrupoPosicion = 'rendimiento_periodico' | 'dividendos' | 'valoracion_simple' | 'otro';
export type CardClass = 'plan' | 'prestamo' | 'accion' | 'cripto' | 'fondo' | 'deposito' | 'otro';

const GRUPO_RENDIMIENTO_PERIODICO: TipoPosicion[] = [
  'cuenta_remunerada',
  'prestamo_p2p',
  'deposito_plazo',
];
const GRUPO_DIVIDENDOS: TipoPosicion[] = ['accion', 'etf', 'reit'];
const GRUPO_VALORACION_SIMPLE: TipoPosicion[] = [
  'fondo_inversion',
  'plan_pensiones',
  'plan_empleo',
  'crypto',
];

/**
 * Clasifica un `TipoPosicion` en uno de los 3 grupos de visualización
 * que usa la galería v2 + las fichas detalle de 23.3. `otro` y `deposito`
 * (legacy) caen en `'otro'` y reciben placeholder mínimo.
 */
export function clasificarTipo(t: TipoPosicion): GrupoPosicion {
  if (GRUPO_RENDIMIENTO_PERIODICO.includes(t)) return 'rendimiento_periodico';
  if (GRUPO_DIVIDENDOS.includes(t)) return 'dividendos';
  if (GRUPO_VALORACION_SIMPLE.includes(t)) return 'valoracion_simple';
  return 'otro';
}

/**
 * Devuelve la clase CSS de la carta (controla el color del border-top en § Z.2.1).
 * T23.6.2 · agrupaciones correctas:
 *   plan (navy) · prestamo/deposito (gold) · accion/fondo (pos) · cripto (purple) · otro (ink-3)
 */
export function mapTipoToCardClass(t: TipoPosicion): CardClass {
  switch (t) {
    case 'plan_pensiones':
    case 'plan_empleo':
      return 'plan';
    case 'prestamo_p2p':
    case 'deposito_plazo':
    case 'cuenta_remunerada':
      return 'prestamo';
    case 'accion':
    case 'etf':
    case 'reit':
    case 'fondo_inversion':
      return 'accion';
    case 'crypto':
      return 'cripto';
    case 'deposito':
    case 'otro':
    default:
      return 'otro';
  }
}

/**
 * Etiqueta larga del tipo (debajo del logo, en la cabecera de la carta).
 */
export function getTipoLabel(t: TipoPosicion): string {
  return TIPO_LABEL[t] ?? t.replace(/_/g, ' ');
}

/**
 * Etiqueta compacta del tipo (chip top-right de la carta).
 * T23.6.2 · tabla exhaustiva §Z.2.2 spec.
 */
export function getTipoTagLabel(t: TipoPosicion): string {
  switch (t) {
    case 'plan_pensiones':
      return 'PLAN PP';
    case 'plan_empleo':
      return 'PLAN PPE';
    case 'prestamo_p2p':
      return 'P2P';
    case 'cuenta_remunerada':
      return 'CUENTA';
    case 'deposito_plazo':
    case 'deposito':
      return 'DEPÓSITO';
    case 'accion':
      return 'ACCIÓN';
    case 'etf':
      return 'ETF';
    case 'reit':
      return 'REIT';
    case 'fondo_inversion':
      return 'FONDO';
    case 'crypto':
      return 'CRYPTO';
    case 'otro':
      return 'OTRO';
    default:
      return getTipoLabel(t);
  }
}

const LOGO_CLASS_MAP: Array<{ pattern: RegExp; cls: string }> = [
  { pattern: /myinvestor/i, cls: 'myi' },
  { pattern: /smartflip/i, cls: 'smartflip' },
  { pattern: /bbva/i, cls: 'bbva' },
  { pattern: /unihouser/i, cls: 'unihouser' },
  { pattern: /santander/i, cls: 'san' },
  { pattern: /\bing\b/i, cls: 'ing' },
  { pattern: /caixa(bank)?/i, cls: 'caixa' },
  { pattern: /sabadell/i, cls: 'sab' },
  { pattern: /unicaja/i, cls: 'uni' },
  { pattern: /bnp\s*paribas|bnp/i, cls: 'bnp' },
  { pattern: /indexa\s*capital|indexa/i, cls: 'indexa' },
  { pattern: /coinbase/i, cls: 'coinbase' },
  { pattern: /binance/i, cls: 'binance' },
  { pattern: /orange|espagne/i, cls: 'orange' },
];

/**
 * Devuelve la clase CSS del logo según la entidad. Vacío si no se reconoce
 * (la carta usa el estilo neutro en ese caso).
 */
export function getLogoClass(entidad?: string | null): string {
  if (!entidad) return '';
  for (const { pattern, cls } of LOGO_CLASS_MAP) {
    if (pattern.test(entidad)) return cls;
  }
  return '';
}

/**
 * Texto a renderizar dentro del logo cuadrado (38x38). Iniciales o trocito
 * de la entidad. Si no hay entidad, devuelve `'?'` para no romper la carta.
 */
export function getLogoText(entidad?: string | null): string {
  if (!entidad) return '?';
  const trimmed = entidad.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/[\s/·.-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 3).toUpperCase();
}

/**
 * Meta del footer · cadena corta con el dato más relevante según el tipo:
 * - rendimiento periódico · "TIN X% · {N} cobros"
 * - dividendos · "div anual {X €}" o "—" si no disponible
 * - valoración simple · "CAGR {X%}" o "—"
 */
export function getFooterMeta(p: PosicionInversion): string {
  const grupo = clasificarTipo(p.tipo);
  if (grupo === 'rendimiento_periodico') {
    const tin = p.rendimiento?.tasa_interes_anual;
    const cobros = (p.aportaciones || []).filter((a) => a.tipo === 'dividendo').length;
    if (typeof tin === 'number' && Number.isFinite(tin)) {
      return cobros > 0 ? `TIN ${tin.toFixed(2)}% · ${cobros} cobros` : `TIN ${tin.toFixed(2)}%`;
    }
    return cobros > 0 ? `${cobros} cobros` : '—';
  }
  if (grupo === 'dividendos') {
    const div = p.dividendo_anual_estimado;
    if (typeof div === 'number' && div > 0) return `div anual ${formatCurrency(div)}`;
    const cobros = (p.aportaciones || []).filter((a) => a.tipo === 'dividendo').length;
    if (cobros > 0) return `${cobros} dividendos`;
    return '—';
  }
  if (grupo === 'valoracion_simple') {
    const cagr = calculateEstimatedCagr(p);
    if (Number.isFinite(cagr) && Math.abs(cagr) > 0.0001) {
      return `CAGR ${formatPercent(cagr)}`;
    }
    const aps = (p.aportaciones || []).length;
    return aps > 0 ? `${aps} aportaciones` : '—';
  }
  return '—';
}

export interface SerieValorPunto {
  x: number;
  y: number;
  fecha: string;
}

/**
 * Construye la serie de valor histórica para sparklines (`valoracion_simple`
 * y `dividendos`). Cada aportación añade su importe acumulado al total
 * aportado · el último punto pinta el `valor_actual` real.
 */
export function construirSerieValor(p: PosicionInversion): SerieValorPunto[] {
  const aps = (p.aportaciones || [])
    .filter((a) => a && a.fecha)
    .slice()
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  if (aps.length === 0) return [];

  const puntos: SerieValorPunto[] = [];
  let acumulado = 0;
  for (const ap of aps) {
    const importe = Number(ap.importe ?? 0);
    if (ap.tipo === 'reembolso') acumulado -= importe;
    else if (ap.tipo === 'aportacion') acumulado += importe;
    // 'dividendo' no afecta al capital aportado
    const ts = new Date(ap.fecha).getTime();
    puntos.push({
      x: ts,
      y: Math.max(acumulado, 0),
      fecha: ap.fecha,
    });
  }

  const valorActual = Number(p.valor_actual ?? 0);
  const fechaValoracion = p.fecha_valoracion || new Date().toISOString();
  const lastTs = new Date(fechaValoracion).getTime();
  const lastPunto = puntos[puntos.length - 1];
  if (!lastPunto || lastPunto.x < lastTs) {
    puntos.push({ x: lastTs, y: valorActual, fecha: fechaValoracion });
  } else {
    // si la última aportación es más reciente que la valoración · ajustamos
    // el último punto al valor actual conocido
    puntos[puntos.length - 1] = { ...lastPunto, y: valorActual };
  }

  return puntos;
}

/**
 * Posición se considera cerrada si:
 * - `activo === false` (campo del store · marca explícita), o
 * - `plan_liquidacion.activo` con fecha estimada anterior a hoy y liquidación total, o
 * - `total_aportado <= 0` y suma de reembolsos > 0 (todo reembolsado).
 *
 * En T23.1 esta función se usa solo como filtro defensivo · el grueso de
 * posiciones cerradas vendrá del adaptador en 23.4 · NO del store directo.
 */
export function esCerrada(p: PosicionInversion): boolean {
  if (p.activo === false) return true;
  const liq = p.plan_liquidacion;
  if (liq?.activo && liq.liquidacion_total && liq.fecha_estimada) {
    const t = new Date(liq.fecha_estimada).getTime();
    if (Number.isFinite(t) && t <= Date.now()) return true;
  }
  const aps = p.aportaciones || [];
  const reembolsos = aps
    .filter((a) => a.tipo === 'reembolso')
    .reduce((s, a) => s + Number(a.importe || 0), 0);
  if (reembolsos > 0 && (p.total_aportado ?? 0) <= 0) return true;
  return false;
}

/**
 * Color asociado al grupo · usado para el trazo del sparkline (debe coincidir
 * conceptualmente con el border-top de la carta · § Z.2.1).
 */
export function getColorByTipo(t: TipoPosicion): string {
  switch (clasificarTipo(t)) {
    case 'rendimiento_periodico':
      return 'var(--atlas-v5-gold)';
    case 'dividendos':
      return 'var(--atlas-v5-pos)';
    case 'valoracion_simple':
      return t === 'crypto' ? 'var(--atlas-v5-cripto)' : 'var(--atlas-v5-brand)';
    default:
      return 'var(--atlas-v5-ink-3)';
  }
}

/**
 * Formato delta con signo explícito (`+1.234 €` / `-1.234 €`).
 */
export function formatDelta(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(Math.round(n));
  return `${sign}${new Intl.NumberFormat('es-ES').format(abs)} €`;
}

/**
 * Clase semántica para el texto del delta · `pos` · `neg` · `muted`.
 */
export function signClass(n: number): 'pos' | 'neg' | 'muted' {
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return 'muted';
  return n > 0 ? 'pos' : 'neg';
}

/**
 * Devuelve el rango de años (formato `'2020-2024'` o `'2024'`) cubierto por
 * un conjunto de posiciones (típicamente las cerradas, para la cabecera de
 * la sección colapsable de la galería).
 */
export function rangoAnios(fechas: Array<string | null | undefined>): string {
  const years = fechas
    .map((f) => (f ? new Date(f).getFullYear() : NaN))
    .filter((y) => Number.isFinite(y) && y > 1900) as number[];
  if (years.length === 0) return '';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min}-${max}`;
}

/** Formatea una fecha ISO a "{mes abreviado} {año}" · ej. "mar 2025". */
function formatMesAnio(isoDate?: string | null): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
}


/**
 * Meta del footer para `CartaItem` · cadena corta con el dato más relevante
 * según el tipo (§Z.2.5 spec T23.6.2 · tabla de 11 casos).
 * Si dato no disponible · devuelve `'—'` · NUNCA inventa valores.
 */
export function getFooterMetaFromItem(item: CartaItem): string {
  const { tipo } = item;

  switch (tipo) {
    case 'plan_pensiones':
    case 'plan_empleo': {
      const cagr = item.cagr_pct;
      const año = item.fecha_apertura ? new Date(item.fecha_apertura).getFullYear() : null;
      if (typeof cagr === 'number' && Number.isFinite(cagr) && Math.abs(cagr) > 0.0001) {
        return año ? `CAGR ${formatPercent(cagr)} · desde ${año}` : `CAGR ${formatPercent(cagr)}`;
      }
      return año ? `desde ${año}` : '—';
    }

    case 'fondo_inversion': {
      const cagr = item.cagr_pct;
      // TER no está en CartaItem todavía · mostrar solo CAGR
      if (typeof cagr === 'number' && Number.isFinite(cagr) && Math.abs(cagr) > 0.0001) {
        return `CAGR ${formatPercent(cagr)}`;
      }
      return '—';
    }

    case 'prestamo_p2p': {
      // Detectar si es amortización (cuota_mensual presente) o solo intereses
      if (typeof item.cuota_mensual === 'number' && item.cuota_mensual > 0) {
        // Amortización (Unihouser-style)
        const cuota = formatCurrency(item.cuota_mensual);
        const vence = formatMesAnio(item.fecha_vencimiento);
        return `${cuota}/mes · vence ${vence}`;
      } else {
        // Solo intereses / bullet
        const vence = formatMesAnio(item.fecha_vencimiento);
        // Contar cobros desde el _original si disponible
        const posOrig = item._original as { rendimiento?: { pagos_generados?: Array<{ estado: string }> }; aportaciones?: Array<{ tipo: string }> };
        const cobrosRendimiento = posOrig?.rendimiento?.pagos_generados?.filter((p) => p.estado === 'pagado')?.length ?? 0;
        const cobrosAportacion = posOrig?.aportaciones?.filter((a) => a.tipo === 'dividendo')?.length ?? 0;
        const totalCobros = cobrosRendimiento + cobrosAportacion;
        // Total esperado: duracion_meses / frecuencia
        const posInv = posOrig as { duracion_meses?: number; frecuencia_cobro?: string };
        const duracion = posInv?.duracion_meses;
        const FREQ_DIV: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
        const freqMeses = item.frecuencia_cobro ? (FREQ_DIV[item.frecuencia_cobro] ?? 1) : 1;
        const totalEsperado = duracion ? Math.floor(duracion / freqMeses) : null;
        if (vence !== '—') {
          return totalEsperado != null
            ? `vence ${vence} · ${totalCobros} de ${totalEsperado} cobrados`
            : `vence ${vence}`;
        }
        return totalCobros > 0 ? `${totalCobros} cobros` : '—';
      }
    }

    case 'deposito_plazo': {
      const vence = formatMesAnio(item.fecha_vencimiento);
      const tin = item.tin;
      if (vence !== '—' && typeof tin === 'number' && Number.isFinite(tin)) {
        return `vence ${vence} · TIN ${tin.toFixed(2)}%`;
      }
      if (vence !== '—') return `vence ${vence}`;
      return '—';
    }

    case 'cuenta_remunerada': {
      const tin = item.tin;
      if (typeof tin === 'number' && Number.isFinite(tin)) {
        return `TIN ${tin.toFixed(2)}% · liquidez total`;
      }
      return 'liquidez total';
    }

    case 'accion': {
      // RSU: detectar por pct_consolidacion presente
      if (typeof item.pct_consolidacion === 'number') {
        if (item.pct_consolidacion >= 100) return 'disponible · liquidable';
        return `consolidando · ${item.pct_consolidacion.toFixed(0)}%`;
      }
      // Acciones no-RSU: dividendos
      const posOrig = item._original as { dividendo_anual_estimado?: number; aportaciones?: Array<{ tipo: string }> };
      const cobros = posOrig?.aportaciones?.filter((a) => a.tipo === 'dividendo')?.length ?? 0;
      if (cobros > 0 && item.total_aportado > 0) {
        const divAnual = posOrig?.dividendo_anual_estimado;
        const yieldPct = typeof divAnual === 'number' && divAnual > 0
          ? ((divAnual / item.valor_actual) * 100).toFixed(2)
          : null;
        return yieldPct
          ? `${cobros} dividendos · yield ${yieldPct}%`
          : `${cobros} dividendos`;
      }
      return '—';
    }

    case 'etf':
    case 'reit': {
      const posOrig = item._original as { dividendo_anual_estimado?: number; aportaciones?: Array<{ tipo: string }> };
      const cobros = posOrig?.aportaciones?.filter((a) => a.tipo === 'dividendo')?.length ?? 0;
      if (cobros > 0) {
        const divAnual = posOrig?.dividendo_anual_estimado;
        const yieldPct = typeof divAnual === 'number' && divAnual > 0 && item.valor_actual > 0
          ? ((divAnual / item.valor_actual) * 100).toFixed(2)
          : null;
        return yieldPct
          ? `${cobros} dividendos · yield ${yieldPct}%`
          : `${cobros} dividendos`;
      }
      return '—';
    }

    case 'crypto': {
      return item.entidad ? `wallet ${item.entidad}` : '—';
    }

    default:
      return '—';
  }
}
