// ============================================================================
// Deducción por inversión en vivienda habitual · régimen transitorio
// (DT 18ª LIRPF) · Fase 2 del modelo de vivienda habitual
// ============================================================================
//
// Aplica SOLO a quien adquirió su vivienda habitual antes del 01-01-2013 (y
// venía practicando la deducción en 2012 o antes · no verificable con los
// datos de la app → se asume y se emite warning). Tipo 15% (7,5% estatal +
// 7,5% autonómico) sobre una base máxima de 9.040 €/año formada por los pagos
// del préstamo (capital + intereses) destinados a la adquisición.
//
// Modelo de datos (sin entidades nuevas · disciplina anti-Frankenstein):
//   · Vivienda habitual = inmueble con `usoTipo === 'vivienda_habitual'`.
//   · Préstamo vinculado = `estructuraCompra.prestamoVinculadoId` (FK directa),
//     `destinos[].inmuebleId` (modelo v2) o `inmuebleId`/`afectacionesInmueble`
//     (legacy) · la fracción del préstamo imputable sale de getAllocationFactor.
//   · Titularidad (PR #1493): en tributación individual computa el % del
//     declarante; en conjunta, declarante + pareja (la declaración integra a
//     ambos). El límite de 9.040 € es POR DECLARACIÓN, no por persona.
// ============================================================================

import { initDB, Property } from './db';
import type { Prestamo, PeriodoPago } from '../types/prestamos';
import { prestamosService, getAllocationFactor } from './prestamosService';

// ─── Constantes DT 18ª ───────────────────────────────────────────────────────

export const DT18_FECHA_LIMITE = '2013-01-01'; // adquisición anterior a esta fecha
export const DT18_LIMITE_BASE = 9040;          // base máxima anual (€)
export const DT18_TIPO_ESTATAL = 0.075;        // 7,5%
export const DT18_TIPO_AUTONOMICO = 0.075;     // 7,5%
export const DT18_TIPO_TOTAL = DT18_TIPO_ESTATAL + DT18_TIPO_AUTONOMICO;

// ─── Tipos de resultado ──────────────────────────────────────────────────────

export interface DetallePrestamoDT18 {
  prestamoId: string;
  intereses: number;      // € del ejercicio imputables al inmueble
  capital: number;        // € del ejercicio imputables al inmueble
  factorPrestamo: number; // fracción 0..1 del préstamo destinada al inmueble
}

export interface DeduccionViviendaHabitualResult {
  aplicable: boolean;
  base: number;              // min(pagos computables, 9.040)
  deduccion: number;         // 15% × base
  tramoEstatal: number;      // 7,5% × base
  tramoAutonomico: number;   // 7,5% × base
  inmuebleId?: number;
  alias?: string;
  detalle: DetallePrestamoDT18[];
  warnings: string[];
}

const RESULTADO_NO_APLICABLE: DeduccionViviendaHabitualResult = {
  aplicable: false,
  base: 0,
  deduccion: 0,
  tramoEstatal: 0,
  tramoAutonomico: 0,
  detalle: [],
  warnings: [],
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─── Funciones puras (exportadas para testing) ──────────────────────────────

/** Elegibilidad temporal DT 18ª · adquisición estrictamente anterior a 2013. */
export function esElegibleDT18(purchaseDate: string | undefined | null): boolean {
  if (!purchaseDate) return false;
  return purchaseDate < DT18_FECHA_LIMITE;
}

/**
 * Suma capital + intereses de los periodos del plan cuyo cargo cae en el
 * ejercicio. Usa el cuadro programado (pagadas o no) · coherente con cómo la
 * app proyecta el resto de magnitudes del ejercicio corriente.
 */
export function sumarPagosEjercicio(
  plan: { periodos: Array<Pick<PeriodoPago, 'fechaCargo' | 'interes' | 'amortizacion'>> },
  ejercicio: number,
): { intereses: number; capital: number; total: number } {
  let intereses = 0;
  let capital = 0;
  for (const p of plan.periodos) {
    if (new Date(p.fechaCargo).getFullYear() === ejercicio) {
      intereses += p.interes;
      capital += p.amortizacion;
    }
  }
  return {
    intereses: round2(intereses),
    capital: round2(capital),
    total: round2(intereses + capital),
  };
}

/**
 * % de titularidad computable según tributación (modelo #1493).
 * Individual → solo el declarante. Conjunta → declarante + pareja (con
 * titularidad 'yo' la pareja persiste 0, así que la suma es inocua).
 */
export function pctTitularidadComputable(
  property: Pick<Property, 'porcentajePropiedad' | 'porcentajePropiedadPareja'>,
  tributacion: 'individual' | 'conjunta',
): number {
  const pctDeclarante = property.porcentajePropiedad ?? 100;
  const pctPareja = property.porcentajePropiedadPareja ?? 0;
  const pct = tributacion === 'conjunta' ? pctDeclarante + pctPareja : pctDeclarante;
  return Math.min(Math.max(pct, 0), 100);
}

/** Base y deducción DT 18ª a partir de los pagos computables del ejercicio. */
export function calcularImportesDT18(pagosComputables: number): {
  base: number;
  deduccion: number;
  tramoEstatal: number;
  tramoAutonomico: number;
} {
  const base = round2(Math.min(Math.max(pagosComputables, 0), DT18_LIMITE_BASE));
  const tramoEstatal = round2(base * DT18_TIPO_ESTATAL);
  const tramoAutonomico = round2(base * DT18_TIPO_AUTONOMICO);
  return {
    base,
    deduccion: round2(tramoEstatal + tramoAutonomico),
    tramoEstatal,
    tramoAutonomico,
  };
}

// ─── Descubrimiento de préstamos vinculados ─────────────────────────────────

/**
 * Préstamos vinculados a un inmueble por CUALQUIERA de los mecanismos vivos:
 * FK directa (estructuraCompra), destinos v2, o legacy (inmuebleId /
 * afectacionesInmueble). Dedupe por id.
 */
export function prestamosVinculadosAInmueble(
  property: Pick<Property, 'id' | 'estructuraCompra'>,
  prestamos: Prestamo[],
): Prestamo[] {
  const inmuebleId = String(property.id);
  const fkDirecta = property.estructuraCompra?.prestamoVinculadoId;
  const vistos = new Set<string>();
  const out: Prestamo[] = [];
  for (const p of prestamos) {
    const porFk = fkDirecta != null && p.id === fkDirecta;
    const porDestinos = (p.destinos ?? []).some((d) => d.inmuebleId === inmuebleId);
    const porLegacy =
      p.inmuebleId === inmuebleId ||
      (p.afectacionesInmueble ?? []).some((a) => a.inmuebleId === inmuebleId);
    if ((porFk || porDestinos || porLegacy) && !vistos.has(p.id)) {
      vistos.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/**
 * Fracción del préstamo imputable al inmueble. Si el vínculo es la FK directa
 * de estructuraCompra y el préstamo no declara destinos/legacy para este
 * inmueble, se asume 100% (préstamo dado de alta para financiar esta compra).
 */
export function factorPrestamoParaInmueble(
  property: Pick<Property, 'id' | 'estructuraCompra'>,
  prestamo: Prestamo,
): number {
  const factor = getAllocationFactor(prestamo, String(property.id));
  if (factor > 0) return Math.min(factor, 1);
  return property.estructuraCompra?.prestamoVinculadoId === prestamo.id ? 1 : 0;
}

// ─── Orquestador ────────────────────────────────────────────────────────────

/**
 * Calcula la deducción DT 18ª del ejercicio para la vivienda habitual del
 * declarante (inmueble con usoTipo 'vivienda_habitual' adquirido pre-2013 con
 * préstamo vinculado). Devuelve resultado no aplicable (0) si no se cumplen
 * las condiciones · nunca lanza (el IRPF no debe romperse por esta pieza).
 */
export async function calcularDeduccionViviendaHabitualEjercicio(
  ejercicio: number,
  tributacion: 'individual' | 'conjunta',
): Promise<DeduccionViviendaHabitualResult> {
  try {
    const db = await initDB();
    const properties: Property[] = await db.getAll('properties');
    const vivienda = properties.find(
      (p) => p.usoTipo === 'vivienda_habitual' && p.state === 'activo',
    );
    if (!vivienda || vivienda.id == null) return RESULTADO_NO_APLICABLE;
    if (!esElegibleDT18(vivienda.purchaseDate)) return RESULTADO_NO_APLICABLE;

    const todos = await prestamosService.getAllPrestamos();
    const vinculados = prestamosVinculadosAInmueble(vivienda, todos);
    if (vinculados.length === 0) {
      return {
        ...RESULTADO_NO_APLICABLE,
        inmuebleId: vivienda.id,
        alias: vivienda.alias,
        warnings: [
          'Vivienda habitual pre-2013 sin préstamo vinculado · la deducción DT 18ª requiere financiación · vincula la hipoteca en Financiación',
        ],
      };
    }

    const detalle: DetallePrestamoDT18[] = [];
    let pagosImputables = 0;
    for (const prestamo of vinculados) {
      const factor = factorPrestamoParaInmueble(vivienda, prestamo);
      if (factor <= 0) continue;
      const plan = await prestamosService.getPaymentPlan(prestamo.id);
      if (!plan) continue;
      const pagos = sumarPagosEjercicio(plan, ejercicio);
      if (pagos.total <= 0) continue;
      detalle.push({
        prestamoId: prestamo.id,
        intereses: round2(pagos.intereses * factor),
        capital: round2(pagos.capital * factor),
        factorPrestamo: factor,
      });
      pagosImputables += pagos.total * factor;
    }
    if (pagosImputables <= 0) return { ...RESULTADO_NO_APLICABLE, inmuebleId: vivienda.id, alias: vivienda.alias };

    const pct = pctTitularidadComputable(vivienda, tributacion);
    const importes = calcularImportesDT18(pagosImputables * (pct / 100));

    return {
      aplicable: importes.deduccion > 0,
      ...importes,
      inmuebleId: vivienda.id,
      alias: vivienda.alias,
      detalle,
      warnings: [
        'Deducción DT 18ª aplicada asumiendo que se practicó en 2012 o ejercicios anteriores (requisito legal no verificable con los datos de la app)',
      ],
    };
  } catch (err) {
    console.error('[deduccionViviendaHabitual] error calculando DT 18ª', err);
    return RESULTADO_NO_APLICABLE;
  }
}
