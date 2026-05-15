/**
 * fiscalResolverService.ts
 *
 * PUERTA ÚNICA de datos fiscales por ejercicio.
 *
 * REGLA ARQUITECTÓNICA:
 *   AÑO DECLARADO (2020-2024) → LEER snapshot. NUNCA calcular.
 *   AÑO PENDIENTE (2025)      → LEER snapshot si existe, sino "—"
 *   AÑO EN CURSO (2026)       → CALCULAR en vivo desde stores
 */

import { initDB, SnapshotDeclaracion } from './db';
import { getDeclaracion, getEjercicio, getTodosLosEjercicios } from './ejercicioResolverService';
import type { EjercicioFiscalCoord, ResumenFiscal } from './ejercicioResolverService';
import { obtenerDeclaracionParaEjercicio } from './declaracionResolverService';
import type { DeclaracionIRPF } from './irpfCalculationService';

// ═══════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════

export type EstadoEjercicioFiscal = 'en_curso' | 'pendiente' | 'declarado';
export type FuenteDatosEjercicio = 'pdf_aeat' | 'xml_aeat' | 'atlas' | 'sin_datos';

export interface InmuebleEjercicio {
  refCatastral: string;
  direccion: string;
  valorCatastral: number;
  rendimiento: number;
  diasDisposicion: number;
}

export interface DatosFiscalesEjercicio {
  año: number;
  estado: EstadoEjercicioFiscal;
  fuente: FuenteDatosEjercicio;

  // Resultado principal
  resultado: number | null;        // casilla 0695
  tipoResultado: 'pagar' | 'devolver' | null;

  // Resumen (casillas del Modelo 100)
  resumen: {
    baseLiquidableGeneral: number | null;     // 0505
    baseLiquidableAhorro: number | null;      // 0510
    cuotaIntegraEstatal: number | null;       // 0545
    cuotaIntegraAutonomica: number | null;    // 0546
    cuotaLiquidaEstatal: number | null;       // 0570
    cuotaLiquidaAutonomica: number | null;    // 0571
  };

  // Secciones desglosadas
  rendimientosTrabajo: number | null;
  rendimientosInmuebles: number | null;
  rendimientosActividades: number | null;
  rendimientosAhorro: number | null;

  // Base imponible
  baseImponibleGeneral: number | null;
  baseImponibleAhorro: number | null;

  // Cuota y retenciones
  cuotaIntegra: number | null;
  retenciones: number | null;

  // Snapshot completo (para expandir secciones)
  casillas: Record<string, number> | null;

  // Inmuebles del ejercicio
  inmuebles: InmuebleEjercicio[] | null;

  // Declaración completa (available for en_curso or if snapshot has declaracionCompleta)
  declaracionCompleta: DeclaracionIRPF | null;
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function safeNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sumNullable(...values: (number | null | undefined)[]): number | null {
  let sum = 0;
  let anyValid = false;
  for (const v of values) {
    const n = safeNum(v);
    if (n !== null) {
      sum += n;
      anyValid = true;
    }
  }
  return anyValid ? sum : null;
}

function getEstado(año: number): EstadoEjercicioFiscal {
  const hoy = new Date();
  const añoActual = hoy.getFullYear();
  if (año === añoActual) return 'en_curso';
  if (año === añoActual - 1) {
    const finCampaña = new Date(añoActual, 5, 30);
    return hoy <= finCampaña ? 'pendiente' : 'declarado';
  }
  return 'declarado';
}

function detectarFuente(
  coordEj: EjercicioFiscalCoord | null,
  snapshotDecl: SnapshotDeclaracion | null,
  hasPDF: boolean,
): FuenteDatosEjercicio {
  if (coordEj?.aeat?.fuenteImportacion === 'xml') return 'xml_aeat';
  if (hasPDF) return 'pdf_aeat';
  if (coordEj?.aeat) return 'pdf_aeat';
  if (snapshotDecl?.origen === 'importacion_manual') return 'pdf_aeat';
  if (coordEj?.atlas) return 'atlas';
  return 'sin_datos';
}

function extraerInmueblesDeSnapshot(c: Record<string, number>): InmuebleEjercicio[] {
  const inmuebles: InmuebleEjercicio[] = [];
  // Look for indexed property casillas (e.g. RC_1, RC_2 or immId_0109)
  const seen = new Set<string>();
  for (const key of Object.keys(c)) {
    // Pattern: <number>_<casilla> e.g. "1_0109"
    const match = key.match(/^(\d+)_(\d{4})$/);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      const propId = match[1];
      inmuebles.push({
        refCatastral: String(c[`${propId}_RC`] ?? ''),
        direccion: String(c[`${propId}_DIR`] ?? ''),
        valorCatastral: c[`${propId}_VC`] ?? 0,
        rendimiento: c[`${propId}_0109`] ?? 0,
        diasDisposicion: c[`${propId}_DIAS`] ?? 365,
      });
    }
  }
  return inmuebles;
}

function buildEmptyResult(año: number): DatosFiscalesEjercicio {
  return {
    año,
    estado: getEstado(año),
    fuente: 'sin_datos',
    resultado: null,
    tipoResultado: null,
    resumen: {
      baseLiquidableGeneral: null,
      baseLiquidableAhorro: null,
      cuotaIntegraEstatal: null,
      cuotaIntegraAutonomica: null,
      cuotaLiquidaEstatal: null,
      cuotaLiquidaAutonomica: null,
    },
    rendimientosTrabajo: null,
    rendimientosInmuebles: null,
    rendimientosActividades: null,
    rendimientosAhorro: null,
    baseImponibleGeneral: null,
    baseImponibleAhorro: null,
    cuotaIntegra: null,
    retenciones: null,
    casillas: null,
    inmuebles: null,
    declaracionCompleta: null,
  };
}

// ═══════════════════════════════════════════════
// Desde snapshot AEAT (casillas) — AÑOS DECLARADOS
// ═══════════════════════════════════════════════

function resolverDesdeSnapshot(
  año: number,
  casillas: Record<string, number>,
  fuente: FuenteDatosEjercicio,
  resumenCoord: ResumenFiscal | null,
  declaracionCompleta: DeclaracionIRPF | null,
): DatosFiscalesEjercicio {
  const c = casillas;
  const resultado = safeNum(c['0695']) ?? safeNum(c['0670']) ?? safeNum(resumenCoord?.resultado) ?? null;

  return {
    año,
    estado: getEstado(año),
    fuente,
    resultado,
    tipoResultado: resultado !== null ? (resultado < 0 ? 'devolver' : 'pagar') : null,
    resumen: {
      baseLiquidableGeneral: safeNum(c['0505']) ?? safeNum(resumenCoord?.baseLiquidableGeneral),
      baseLiquidableAhorro: safeNum(c['0510']) ?? safeNum(resumenCoord?.baseLiquidableAhorro),
      cuotaIntegraEstatal: safeNum(c['0545']) ?? safeNum(resumenCoord?.cuotaIntegraEstatal),
      cuotaIntegraAutonomica: safeNum(c['0546']) ?? safeNum(resumenCoord?.cuotaIntegraAutonomica),
      cuotaLiquidaEstatal: safeNum(c['0570']) ?? safeNum(resumenCoord?.cuotaLiquidaEstatal),
      cuotaLiquidaAutonomica: safeNum(c['0571']) ?? safeNum(resumenCoord?.cuotaLiquidaAutonomica),
    },
    rendimientosTrabajo: safeNum(c['0022']) ?? safeNum(c['0025']) ?? safeNum(c['TPTOTAL']),
    rendimientosInmuebles: safeNum(c['0155']),
    rendimientosActividades: safeNum(c['0154']) ?? safeNum(c['0150']),
    rendimientosAhorro: safeNum(c['0041']) ?? safeNum(c['0040']) ?? safeNum(c['B1RNR']),
    baseImponibleGeneral: safeNum(c['0435']) ?? safeNum(resumenCoord?.baseImponibleGeneral),
    baseImponibleAhorro: safeNum(c['0460']) ?? safeNum(resumenCoord?.baseImponibleAhorro),
    cuotaIntegra: sumNullable(safeNum(c['0545']), safeNum(c['0546'])) ?? safeNum(resumenCoord?.cuotaIntegra),
    retenciones: safeNum(c['0609']) ?? safeNum(c['RETENCIONESTOTAL']),
    casillas: c,
    inmuebles: extraerInmueblesDeSnapshot(c),
    declaracionCompleta,
  };
}

// ═══════════════════════════════════════════════
// Desde DeclaracionIRPF (cálculo en vivo o snapshot con declaracionCompleta)
// ═══════════════════════════════════════════════

function resolverDesdeDeclaracion(
  año: number,
  decl: DeclaracionIRPF,
  fuente: FuenteDatosEjercicio,
  resumenCoord: ResumenFiscal | null,
): DatosFiscalesEjercicio {
  const resultado = safeNum(decl.resultado) ?? safeNum(resumenCoord?.resultado) ?? null;
  const liq = decl.liquidacion;
  const red = decl.reducciones;

  // Rendimientos del trabajo
  const trabajo = decl.baseGeneral?.rendimientosTrabajo;
  const rendTrabajo = trabajo ? safeNum(trabajo.rendimientoNeto) : null;

  // Rendimientos de inmuebles
  const inmuebles = decl.baseGeneral?.rendimientosInmuebles ?? [];
  const rendInmuebles = inmuebles.length > 0
    ? inmuebles.reduce((s, i) => s + (i.rendimientoNetoReducido ?? i.rendimientoNeto ?? 0), 0)
    : null;

  // Rendimientos de actividades
  const autonomo = decl.baseGeneral?.rendimientosAutonomo;
  const rendActividades = autonomo ? safeNum(autonomo.rendimientoNeto) : null;

  // Rendimientos del ahorro
  const ahorro = decl.baseAhorro;
  const rendAhorro = ahorro && ahorro.total !== 0 ? safeNum(ahorro.total) : null;

  // Cuota íntegra
  const cuotaIntegraEstatal = safeNum(liq.cuotaBaseGeneral) ?? safeNum(resumenCoord?.cuotaIntegraEstatal);
  const cuotaIntegraAutonomica = safeNum(liq.cuotaBaseAhorro) ?? safeNum(resumenCoord?.cuotaIntegraAutonomica);

  const baseLiqGeneral = safeNum(liq.baseImponibleGeneral) != null
    ? Math.max(0, (liq.baseImponibleGeneral ?? 0) - (red?.total ?? 0))
    : null;

  return {
    año,
    estado: getEstado(año),
    fuente,
    resultado,
    tipoResultado: resultado !== null ? (resultado < 0 ? 'devolver' : 'pagar') : null,
    resumen: {
      baseLiquidableGeneral: safeNum(resumenCoord?.baseLiquidableGeneral) ?? baseLiqGeneral,
      baseLiquidableAhorro: safeNum(resumenCoord?.baseLiquidableAhorro) ?? safeNum(liq.baseImponibleAhorro),
      cuotaIntegraEstatal: safeNum(resumenCoord?.cuotaIntegraEstatal) ?? cuotaIntegraEstatal,
      cuotaIntegraAutonomica: safeNum(resumenCoord?.cuotaIntegraAutonomica) ?? cuotaIntegraAutonomica,
      cuotaLiquidaEstatal: safeNum(resumenCoord?.cuotaLiquidaEstatal) ?? cuotaIntegraEstatal,
      cuotaLiquidaAutonomica: safeNum(resumenCoord?.cuotaLiquidaAutonomica) ?? cuotaIntegraAutonomica,
    },
    rendimientosTrabajo: rendTrabajo,
    rendimientosInmuebles: rendInmuebles,
    rendimientosActividades: rendActividades,
    rendimientosAhorro: rendAhorro,
    baseImponibleGeneral: safeNum(liq.baseImponibleGeneral),
    baseImponibleAhorro: safeNum(liq.baseImponibleAhorro),
    cuotaIntegra: safeNum(liq.cuotaIntegra) ?? safeNum(resumenCoord?.cuotaIntegra),
    retenciones: safeNum(decl.retenciones?.total),
    casillas: null,
    inmuebles: inmuebles.map((inm) => ({
      refCatastral: '',
      direccion: inm.alias || `Inmueble ${inm.inmuebleId}`,
      valorCatastral: 0,
      rendimiento: inm.rendimientoNetoReducido ?? inm.rendimientoNeto ?? 0,
      diasDisposicion: inm.diasVacio ?? 0,
    })),
    declaracionCompleta: decl,
  };
}

// ═══════════════════════════════════════════════
// RESOLVER PRINCIPAL
// ═══════════════════════════════════════════════

export async function resolverDatosEjercicio(año: number): Promise<DatosFiscalesEjercicio> {
  const estado = getEstado(año);

  // 1. Try ejercicioResolverService (the coord store)
  let coordEj: EjercicioFiscalCoord | null = null;
  let coordResumen: ResumenFiscal | null = null;
  let coordSnapshot: Record<string, number> | null = null;
  try {
    const decl = await getDeclaracion(año);
    coordResumen = decl.resumen;
    coordSnapshot = decl.snapshot;
    coordEj = await getEjercicio(año);
  } catch {
    // Coord store may not exist
  }

  // 2. Check for PDF
  let hasPDF = false;
  try {
    const db = await initDB();
    const docs = await db.getAll('documents');
    hasPDF = (docs as Array<{ type?: string; metadata?: { ejercicio?: number } }>)
      .some((d) => d.type === 'declaracion_irpf' && d.metadata?.ejercicio === año);
  } catch {
    // DB access error
  }

  const fuente = detectarFuente(coordEj, null, hasPDF);

  // 3. For declared years: use snapshot data, DO NOT calculate
  if (estado === 'declarado' || (estado === 'pendiente' && (coordEj?.aeat || hasPDF))) {
    // AEAT snapshot from coordEj takes priority
    if (coordSnapshot && Object.keys(coordSnapshot).length > 0) {
      // Try to also get declaracionCompleta from snapshotsDeclaracion store
      let declCompleta: DeclaracionIRPF | null = null;
      try {
        const result = await obtenerDeclaracionParaEjercicio(año);
        if (result.fuente === 'declarado' || result.fuente === 'importado') {
          declCompleta = result.declaracion;
        }
      } catch { /* ignore */ }

      return resolverDesdeSnapshot(año, coordSnapshot, fuente, coordResumen, declCompleta);
    }

    // Fallback: try snapshotsDeclaracion store
    try {
      const db = await initDB();
      const snapshots = (await db.getAllFromIndex('snapshotsDeclaracion', 'ejercicio', año)) as SnapshotDeclaracion[];
      const best = snapshots
        .sort((a, b) => b.fechaSnapshot.localeCompare(a.fechaSnapshot))[0];

      if (best) {
        const declCompleta = best.datos?.declaracionCompleta as DeclaracionIRPF | undefined;
        if (best.casillasAEAT && Object.keys(best.casillasAEAT).length > 0) {
          return resolverDesdeSnapshot(año, best.casillasAEAT, fuente, coordResumen, declCompleta ?? null);
        }
        if (declCompleta) {
          return resolverDesdeDeclaracion(año, declCompleta, fuente, coordResumen);
        }
      }
    } catch { /* ignore */ }

    // ejerciciosFiscales store eliminado en V62 — datos migrados a ejerciciosFiscalesCoord

    // Still no data — return empty
    const result = buildEmptyResult(año);
    result.fuente = fuente;
    return result;
  }

  // 4. For año en_curso → calculate live
  if (estado === 'en_curso') {
    try {
      const { declaracion } = await obtenerDeclaracionParaEjercicio(año);
      return resolverDesdeDeclaracion(año, declaracion, 'atlas', coordResumen);
    } catch {
      return buildEmptyResult(año);
    }
  }

  // 5. Pendiente without AEAT → try ATLAS calculation
  if (estado === 'pendiente') {
    // Check if there's coordSnapshot (ATLAS calc)
    if (coordSnapshot && Object.keys(coordSnapshot).length > 0 && coordResumen) {
      return resolverDesdeSnapshot(año, coordSnapshot, 'atlas', coordResumen, null);
    }

    try {
      const { declaracion, fuente: declFuente } = await obtenerDeclaracionParaEjercicio(año);
      const f = declFuente === 'vivo' ? 'atlas' as const : fuente;
      return resolverDesdeDeclaracion(año, declaracion, f, coordResumen);
    } catch {
      return buildEmptyResult(año);
    }
  }

  return buildEmptyResult(año);
}

// ═══════════════════════════════════════════════
// HELPER: Cargar todos los ejercicios para historial
// ═══════════════════════════════════════════════

export async function resolverTodosLosEjercicios(): Promise<DatosFiscalesEjercicio[]> {
  const añoActual = new Date().getFullYear();
  const años = Array.from({ length: 7 }, (_, i) => añoActual - i);

  // Bootstrap ejerciciosCoord so they exist
  try {
    await getTodosLosEjercicios();
  } catch { /* ignore */ }

  const results = await Promise.all(años.map((año) => resolverDatosEjercicio(año)));
  return results.sort((a, b) => b.año - a.año);
}

// ═══════════════════════════════════════════════
// HELPER: Format fiscal values (NEVER show NaN)
// ═══════════════════════════════════════════════

export function formatFiscalValue(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' €';
}

export function formatFiscalValueShort(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(v)) + ' €';
}

// ═══════════════════════════════════════════════════════════════════════════
// SPEC-CC-FISCAL-UI-REPLACE-v1 · sub-tarea 1 · hueco 2 · getTimelineMultiAño
// ═══════════════════════════════════════════════════════════════════════════

export interface ObligacionFiscalTimeline {
  modelo: '100' | '303' | '130' | '184';
  periodo: '1T' | '2T' | '3T' | '4T' | 'anual';
  fechaLimite: string;
  estado: 'cumplida' | 'pendiente' | 'vencida' | 'futura' | 'con_deuda';
  importe?: number;
}

export interface TimelineAño {
  año: number;
  estado: EstadoEjercicioFiscal;
  resultadoIRPF: number | null;
  obligaciones: ObligacionFiscalTimeline[];
  paralela?: { fecha: string; resultadoDesfase: number };
  prescribe: string | null;
}

const PRESCRIPCION_AÑOS = 4;

function calcularFechaPrescripcion(añoEjercicio: number): string {
  const finCampaña = new Date(añoEjercicio + 1, 5, 30);
  const fechaPrescripcion = new Date(finCampaña);
  fechaPrescripcion.setFullYear(finCampaña.getFullYear() + PRESCRIPCION_AÑOS);
  return fechaPrescripcion.toISOString().slice(0, 10);
}

function fechaLimiteIRPFAnual(añoEjercicio: number): string {
  return `${añoEjercicio + 1}-06-30`;
}

function clasificarEstadoObligacion(
  fechaLimiteISO: string,
  estadoEjercicio: EstadoEjercicioFiscal,
): 'cumplida' | 'pendiente' | 'vencida' | 'futura' {
  const hoy = new Date();
  const limite = new Date(fechaLimiteISO);
  if (limite > hoy) return 'futura';
  if (estadoEjercicio === 'declarado' || estadoEjercicio === 'prescrito' as any) return 'cumplida';
  if (estadoEjercicio === 'pendiente') return 'pendiente';
  return 'vencida';
}

export async function getTimelineMultiAño(minAño: number, maxAño: number): Promise<TimelineAño[]> {
  if (minAño > maxAño) return [];
  const años = Array.from({ length: maxAño - minAño + 1 }, (_, i) => minAño + i);
  const hoy = new Date();
  const añoActual = hoy.getFullYear();

  const results = await Promise.all(
    años.map(async (año) => {
      const datos = await resolverDatosEjercicio(año);
      const obligaciones: ObligacionFiscalTimeline[] = [];

      // Modelo 100 anual
      const fechaIRPF = fechaLimiteIRPFAnual(año);
      obligaciones.push({
        modelo: '100',
        periodo: 'anual',
        fechaLimite: fechaIRPF,
        estado: clasificarEstadoObligacion(fechaIRPF, datos.estado),
        importe: datos.resultado ?? undefined,
      });

      // Prescripción · 4 años desde fin de campaña (30/06)
      const prescribe = año < añoActual - PRESCRIPCION_AÑOS
        ? null
        : calcularFechaPrescripcion(año);

      return {
        año,
        estado: datos.estado,
        resultadoIRPF: datos.resultado,
        obligaciones,
        prescribe,
      };
    }),
  );

  return results.sort((a, b) => b.año - a.año);
}

// ═══════════════════════════════════════════════════════════════════════════
// SPEC-CC-FISCAL-UI-REPLACE-v1 · sub-tarea 1 · hueco 3 · getResumenGlobal
// ═══════════════════════════════════════════════════════════════════════════

export interface ResumenGlobalFiscal {
  totalEjercicios: number;
  enCurso: number;
  pendientes: number;
  declarados: number;
  prescritos: number;

  proyeccionAñoActual: number | null;
  borradorAñoPendiente: number | null;
  deudaAbierta: number;
  arrastresVivos: number;

  campañaActual?: { ejercicio: number; ventana: { from: string; to: string }; abierta: boolean };
}

// Tabla hardcoded de ventanas IRPF AEAT (datos públicos · campaña empieza ~abril
// y cierra 30/06 del año siguiente al ejercicio).
const VENTANAS_IRPF: Record<number, { from: string; to: string }> = {
  2020: { from: '2021-04-07', to: '2021-06-30' },
  2021: { from: '2022-04-06', to: '2022-06-30' },
  2022: { from: '2023-04-11', to: '2023-06-30' },
  2023: { from: '2024-04-03', to: '2024-07-01' },
  2024: { from: '2025-04-02', to: '2025-06-30' },
  2025: { from: '2026-04-01', to: '2026-06-30' },
  2026: { from: '2027-04-07', to: '2027-06-30' },
};

function obtenerCampañaActual(): ResumenGlobalFiscal['campañaActual'] {
  const hoy = new Date();
  for (const [añoStr, ventana] of Object.entries(VENTANAS_IRPF)) {
    const ejercicio = Number(añoStr);
    const from = new Date(ventana.from);
    const to = new Date(ventana.to);
    if (hoy >= from && hoy <= to) {
      return { ejercicio, ventana, abierta: true };
    }
  }
  // Si ninguna ventana abierta · devolver la más próxima en el futuro
  const futurasOrdenadas = Object.entries(VENTANAS_IRPF)
    .map(([año, v]) => ({ ejercicio: Number(año), ventana: v, fromDate: new Date(v.from) }))
    .filter((c) => c.fromDate > hoy)
    .sort((a, b) => a.fromDate.getTime() - b.fromDate.getTime());
  if (futurasOrdenadas.length > 0) {
    const next = futurasOrdenadas[0];
    return { ejercicio: next.ejercicio, ventana: next.ventana, abierta: false };
  }
  return undefined;
}

async function calcularArrastresVivos(añoActual: number): Promise<number> {
  const db = await initDB();

  // 1. Carryforwards de gastos (aeatCarryForwards) · vivos = remainingAmount > 0 y expirationYear >= añoActual
  let totalCarry = 0;
  try {
    const all = (await db.getAll('aeatCarryForwards')) as Array<{
      remainingAmount: number;
      expirationYear: number;
    }>;
    totalCarry = all
      .filter((cf) => cf.remainingAmount > 0 && cf.expirationYear >= añoActual)
      .reduce((sum, cf) => sum + cf.remainingAmount, 0);
  } catch { /* store puede no existir en DBs antiguas */ }

  // 2. Pérdidas patrimoniales del ahorro pendientes
  let totalPerdidas = 0;
  try {
    const todas = (await db.getAll('perdidasPatrimonialesAhorro')) as Array<{
      importePendiente: number;
      ejercicioCaducidad: number;
      estado: string;
    }>;
    totalPerdidas = todas
      .filter((p) => p.importePendiente > 0 && p.ejercicioCaducidad >= añoActual && p.estado !== 'caducado')
      .reduce((sum, p) => sum + p.importePendiente, 0);
  } catch { /* store puede no existir */ }

  return Math.round((totalCarry + totalPerdidas) * 100) / 100;
}

export async function getResumenGlobal(): Promise<ResumenGlobalFiscal> {
  const hoy = new Date();
  const añoActual = hoy.getFullYear();
  const añoPendiente = añoActual - 1;

  // Counts por estado · 7 ejercicios (añoActual - 6 .. añoActual)
  const ejercicios = await resolverTodosLosEjercicios();
  let enCurso = 0;
  let pendientes = 0;
  let declarados = 0;
  let prescritos = 0;
  for (const ej of ejercicios) {
    if (ej.estado === 'en_curso') enCurso++;
    else if (ej.estado === 'pendiente') pendientes++;
    else if (ej.estado === 'declarado') {
      // ejercicios > 4 años atrás = prescritos
      if (ej.año <= añoActual - PRESCRIPCION_AÑOS - 1) prescritos++;
      else declarados++;
    }
  }

  // Proyección año actual · estimacionFiscalEnCursoService
  let proyeccionAñoActual: number | null = null;
  try {
    const { calcularEstimacionEnCurso } = await import('./estimacionFiscalEnCursoService');
    const est = await calcularEstimacionEnCurso(añoActual);
    proyeccionAñoActual = est?.resultadoEstimado.resultadoEstimado ?? null;
  } catch { /* servicio no disponible o error · dejar null */ }

  // Borrador año pendiente
  let borradorAñoPendiente: number | null = null;
  try {
    const datos = await resolverDatosEjercicio(añoPendiente);
    borradorAñoPendiente = datos.resultado;
  } catch { /* dejar null */ }

  // Deuda abierta · deudasFiscalesService
  let deudaAbierta = 0;
  try {
    const { getTotalAbierto } = await import('./deudasFiscalesService');
    deudaAbierta = await getTotalAbierto();
  } catch { /* servicio no disponible */ }

  // Arrastres vivos
  const arrastresVivos = await calcularArrastresVivos(añoActual);

  return {
    totalEjercicios: ejercicios.length,
    enCurso,
    pendientes,
    declarados,
    prescritos,
    proyeccionAñoActual,
    borradorAñoPendiente,
    deudaAbierta,
    arrastresVivos,
    campañaActual: obtenerCampañaActual(),
  };
}
