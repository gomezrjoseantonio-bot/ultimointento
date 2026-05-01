// T23.6.1 · Tipo helper UI `CartaItem` (§ 1.2 spec).
//
// Helper de presentación unificado para la galería de inversiones.
// Combina posiciones de `inversiones` y planes de `planesPensiones`
// en una forma común para render de cartas.
//
// NO entra en stores · NO se persiste · solo vive en UI.

import type { PosicionInversion, TipoPosicion } from '../../../types/inversiones';
import type { PlanPensiones } from '../../../types/planesPensiones';

// ── Tipo unificado ────────────────────────────────────────────────────────────

export interface CartaItem {
  // ── Trazabilidad (origen + id original) ──────────────────────
  _origen: 'inversiones' | 'planesPensiones';
  /** ID del registro en su store nativo · numérico para inversiones · UUID para planesPensiones. */
  _idOriginal: number | string;
  /** Posición o plan original sin parsear · para navegación y operaciones. */
  _original: PosicionInversion | PlanPensiones;

  // ── Campos comunes para render galería ───────────────────────
  nombre: string;
  tipo: TipoPosicion;
  entidad: string;
  valor_actual: number;
  total_aportado: number;
  rentabilidad_euros: number;
  rentabilidad_porcentaje: number;
  /** fecha_compra para inversiones · fechaContratacion para planes de pensiones. */
  fecha_apertura?: string;

  // ── Campos específicos opcionales según tipo ─────────────────
  /** TIN / tasa de interés anual · prestamo_p2p · deposito_plazo · cuenta_remunerada. */
  tin?: number;
  /** Cuota mensual amortización · prestamo_p2p con amortización. */
  cuota_mensual?: number;
  /** Capital inicial prestado · prestamo_p2p con amortización. */
  capital_inicial?: number;
  /** Porcentaje amortizado · prestamo_p2p con amortización. */
  pct_amortizado?: number;
  /** Interés anual en euros · prestamo_p2p en curso. */
  interes_anual?: number;
  /** Frecuencia de cobro · prestamo_p2p. */
  frecuencia_cobro?: string;
  /** Fecha estimada de vencimiento · prestamo_p2p / deposito_plazo / plan_liquidacion. */
  fecha_vencimiento?: string;
  /** Precio unitario actual · accion · etf · reit · crypto. */
  precio_actual?: number;
  /** Número de participaciones / títulos / unidades · accion · etf · reit · crypto. */
  numero_participaciones?: number;
  /** CAGR estimado en porcentaje · valoración simple. */
  cagr_pct?: number;
  /** Porcentaje consolidado de RSU. */
  pct_consolidacion?: number;
  /** Año de consolidación de RSU. */
  año_consolidacion?: number;
  /**
   * Subtipo del tipo principal · para acciones RSU · préstamos a empresa propia, etc.
   * Solo se usa para render UI · NO persiste en DB.
   */
  subtipo?: 'rsu' | 'empresa_propia' | string;
}

// ── Adaptadores ───────────────────────────────────────────────────────────────

const safeNum = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Calcula la cuota mensual de amortización de un préstamo usando la
 * fórmula estándar de amortización francesa:
 *   cuota = P × r / (1 − (1 + r)^−n)
 * donde P = principal, r = tasa mensual (TIN / 12 / 100), n = plazo en meses.
 * Devuelve `undefined` si los datos son insuficientes.
 */
function calculateMonthlyPayment(
  principal: number,
  tinPct: number,
  durationMonths: number,
): number | undefined {
  if (principal <= 0 || tinPct <= 0 || durationMonths <= 0) return undefined;
  const r = tinPct / 100 / 12;
  const payment = (principal * r) / (1 - Math.pow(1 + r, -durationMonths));
  return Number.isFinite(payment) ? payment : undefined;
}

/**
 * Convierte una `PosicionInversion` del store `inversiones` en un `CartaItem`
 * normalizado para la galería unificada.
 */
export function inversionToCartaItem(p: PosicionInversion): CartaItem {
  const valorActual = safeNum(p.valor_actual);
  const totalAportado = safeNum(p.total_aportado);
  const rentEur = safeNum(p.rentabilidad_euros, valorActual - totalAportado);
  const rentPct = safeNum(
    p.rentabilidad_porcentaje,
    totalAportado > 0 ? ((valorActual - totalAportado) / totalAportado) * 100 : 0,
  );

  const tin = p.rendimiento?.tasa_interes_anual;
  const cuotaMensual =
    p.tipo === 'prestamo_p2p' && p.modalidad_devolucion === 'capital_e_intereses' && tin
      ? calculateMonthlyPayment(totalAportado, tin, p.duracion_meses ?? 0)
      : undefined;

  // Calcular interés anual en euros (para préstamos solo-intereses)
  const interesAnual =
    p.tipo === 'prestamo_p2p' && typeof tin === 'number' && Number.isFinite(tin) && valorActual > 0
      ? (valorActual * tin) / 100
      : undefined;

  // Calcular % amortizado (para préstamos con amortización)
  const capitalInicial = totalAportado > 0 ? totalAportado : undefined;
  const pctAmortizado =
    p.tipo === 'prestamo_p2p' && cuotaMensual && capitalInicial && valorActual < capitalInicial
      ? ((capitalInicial - valorActual) / capitalInicial) * 100
      : undefined;

  // Detectar subtipo RSU para acciones (heurística: total_aportado ≈ 0 y nombre/notas con "RSU")
  const esRSU =
    p.tipo === 'accion' &&
    (totalAportado < 1 ||
      /rsu/i.test(p.nombre ?? '') ||
      /rsu/i.test(p.notas ?? ''));

  // Detectar préstamo a empresa propia
  const esEmpresaPropia =
    p.tipo === 'prestamo_p2p' &&
    (/propi[ao]/i.test(p.entidad ?? '') || /empresa/i.test(p.entidad ?? ''));

  // CAGR estimado para planes y fondos
  let cagrPct: number | undefined;
  if (['plan_pensiones', 'plan_empleo', 'fondo_inversion', 'accion', 'etf', 'reit', 'crypto'].includes(p.tipo)) {
    // Calcular CAGR simple desde primera aportación
    const aps = (p.aportaciones ?? []).filter((a) => a?.fecha);
    const fechaInicio = p.fecha_compra
      ? new Date(p.fecha_compra)
      : aps.length > 0
        ? new Date(aps.slice().sort((a, b) => a.fecha.localeCompare(b.fecha))[0].fecha)
        : null;
    const fechaFin = p.fecha_valoracion ? new Date(p.fecha_valoracion) : new Date();
    if (fechaInicio && valorActual > 0 && totalAportado > 0) {
      const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
      const years = Math.max((fechaFin.getTime() - fechaInicio.getTime()) / MS_PER_YEAR, 0);
      if (years > 0.1) {
        const cagr = (Math.pow(valorActual / totalAportado, 1 / years) - 1) * 100;
        if (Number.isFinite(cagr)) cagrPct = cagr;
      }
    }
  }

  return {
    _origen: 'inversiones',
    _idOriginal: p.id,
    _original: p,

    nombre: p.nombre,
    tipo: p.tipo,
    entidad: p.entidad,
    valor_actual: valorActual,
    total_aportado: totalAportado,
    rentabilidad_euros: rentEur,
    rentabilidad_porcentaje: rentPct,
    fecha_apertura: p.fecha_compra,

    tin: typeof tin === 'number' && Number.isFinite(tin) ? tin : undefined,
    cuota_mensual: cuotaMensual,
    capital_inicial: capitalInicial,
    pct_amortizado: pctAmortizado,
    interes_anual: interesAnual,
    frecuencia_cobro: p.frecuencia_cobro,
    fecha_vencimiento: p.plan_liquidacion?.fecha_estimada,
    precio_actual: p.precio_medio_compra,
    numero_participaciones: p.numero_participaciones,
    cagr_pct: cagrPct,
    subtipo: esRSU ? 'rsu' : esEmpresaPropia ? 'empresa_propia' : undefined,
  };
}

/**
 * Convierte un `PlanPensiones` del store `planesPensiones` en un `CartaItem`
 * normalizado para la galería unificada.
 */
export function planPensionToCartaItem(plan: PlanPensiones): CartaItem {
  const valorActual = safeNum(plan.valorActual);
  const totalAportado = safeNum(plan.importeInicial);
  const rentEur = valorActual - totalAportado;
  const rentPct = totalAportado > 0 ? (rentEur / totalAportado) * 100 : 0;

  // CAGR estimado desde fechaContratacion
  let cagrPct: number | undefined;
  if (plan.fechaContratacion && valorActual > 0 && totalAportado > 0) {
    const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
    const fechaInicio = new Date(plan.fechaContratacion);
    const años = Math.max((Date.now() - fechaInicio.getTime()) / MS_PER_YEAR, 0);
    if (años > 0.1) {
      const cagr = (Math.pow(valorActual / totalAportado, 1 / años) - 1) * 100;
      if (Number.isFinite(cagr)) cagrPct = cagr;
    }
  }

  return {
    _origen: 'planesPensiones',
    _idOriginal: plan.id,
    _original: plan,

    nombre: plan.nombre,
    tipo: 'plan_pensiones',
    entidad: plan.gestoraActual,
    valor_actual: valorActual,
    total_aportado: totalAportado,
    rentabilidad_euros: rentEur,
    rentabilidad_porcentaje: rentPct,
    fecha_apertura: plan.fechaContratacion,
    cagr_pct: cagrPct,
  };
}
