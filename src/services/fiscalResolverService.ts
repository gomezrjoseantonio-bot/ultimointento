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

    // Fallback: try ejerciciosFiscales store (legacy)
    try {
      const db = await initDB();
      const ejFiscal = await db.get('ejerciciosFiscales', año);
      if (ejFiscal) {
        const ejAny = ejFiscal as any;
        if (ejAny.declaracionAeat?.basesYCuotas) {
          return resolverDesdeLegacyDecl(año, ejAny.declaracionAeat, fuente, coordResumen);
        }
        if (ejAny.resumen) {
          return resolverDesdeLegacyResumen(año, ejAny.resumen, fuente, coordResumen);
        }
      }
    } catch { /* ignore */ }

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

// ── Legacy helpers ────────────────────────────────────

function resolverDesdeLegacyDecl(
  año: number,
  declAeat: any,
  fuente: FuenteDatosEjercicio,
  coordResumen: ResumenFiscal | null,
): DatosFiscalesEjercicio {
  const byc = declAeat.basesYCuotas;
  const resultado = safeNum(byc?.resultadoDeclaracion) ?? safeNum(coordResumen?.resultado) ?? null;
  const trabajo = declAeat.trabajo;
  const inmuebles = declAeat.inmuebles as any[] ?? [];

  return {
    año,
    estado: getEstado(año),
    fuente,
    resultado,
    tipoResultado: resultado !== null ? (resultado < 0 ? 'devolver' : 'pagar') : null,
    resumen: {
      baseLiquidableGeneral: safeNum(byc?.baseLiquidableGeneral) ?? safeNum(coordResumen?.baseLiquidableGeneral),
      baseLiquidableAhorro: safeNum(byc?.baseLiquidableAhorro) ?? safeNum(coordResumen?.baseLiquidableAhorro),
      cuotaIntegraEstatal: safeNum(byc?.cuotaIntegraEstatal) ?? safeNum(coordResumen?.cuotaIntegraEstatal),
      cuotaIntegraAutonomica: safeNum(byc?.cuotaIntegraAutonomica) ?? safeNum(coordResumen?.cuotaIntegraAutonomica),
      cuotaLiquidaEstatal: safeNum(byc?.cuotaLiquidaEstatal) ?? safeNum(coordResumen?.cuotaLiquidaEstatal),
      cuotaLiquidaAutonomica: safeNum(byc?.cuotaLiquidaAutonomica) ?? safeNum(coordResumen?.cuotaLiquidaAutonomica),
    },
    rendimientosTrabajo: safeNum(trabajo?.rendimientoNetoReducido) ?? safeNum(trabajo?.rendimientoNeto) ?? safeNum(trabajo?.totalIngresosIntegros),
    rendimientosInmuebles: inmuebles.length > 0
      ? inmuebles.reduce((s: number, i: any) => s + (i.rendimientoNetoReducido ?? i.rendimientoNeto ?? 0), 0)
      : null,
    rendimientosActividades: declAeat.actividades
      ? (declAeat.actividades as any[]).reduce((s: number, a: any) => s + (a.rendimientoNetoReducido ?? a.rendimientoNeto ?? 0), 0) || null
      : null,
    rendimientosAhorro: safeNum(declAeat.capitalMobiliario?.rendimientoNetoReducido) ?? safeNum(declAeat.capitalMobiliario?.rendimientoNeto),
    baseImponibleGeneral: safeNum(byc?.baseImponibleGeneral) ?? safeNum(coordResumen?.baseImponibleGeneral),
    baseImponibleAhorro: safeNum(byc?.baseImponibleAhorro) ?? safeNum(coordResumen?.baseImponibleAhorro),
    cuotaIntegra: safeNum(byc?.cuotaIntegra) ?? safeNum(coordResumen?.cuotaIntegra),
    retenciones: safeNum(byc?.retencionesTotal),
    casillas: null,
    inmuebles: inmuebles.map((inm: any) => ({
      refCatastral: inm.referenciaCatastral ?? '',
      direccion: inm.direccion ?? '',
      valorCatastral: inm.valorCatastral ?? 0,
      rendimiento: inm.rendimientoNetoReducido ?? inm.rendimientoNeto ?? 0,
      diasDisposicion: inm.diasDisposicion ?? 0,
    })),
    declaracionCompleta: null,
  };
}

function resolverDesdeLegacyResumen(
  año: number,
  resumen: any,
  fuente: FuenteDatosEjercicio,
  coordResumen: ResumenFiscal | null,
): DatosFiscalesEjercicio {
  const resultado = safeNum(resumen.resultado) ?? safeNum(coordResumen?.resultado) ?? null;
  return {
    año,
    estado: getEstado(año),
    fuente,
    resultado,
    tipoResultado: resultado !== null ? (resultado < 0 ? 'devolver' : 'pagar') : null,
    resumen: {
      baseLiquidableGeneral: safeNum(coordResumen?.baseLiquidableGeneral),
      baseLiquidableAhorro: safeNum(coordResumen?.baseLiquidableAhorro),
      cuotaIntegraEstatal: safeNum(coordResumen?.cuotaIntegraEstatal),
      cuotaIntegraAutonomica: safeNum(coordResumen?.cuotaIntegraAutonomica),
      cuotaLiquidaEstatal: safeNum(coordResumen?.cuotaLiquidaEstatal),
      cuotaLiquidaAutonomica: safeNum(coordResumen?.cuotaLiquidaAutonomica),
    },
    rendimientosTrabajo: null,
    rendimientosInmuebles: null,
    rendimientosActividades: null,
    rendimientosAhorro: null,
    baseImponibleGeneral: safeNum(resumen.baseImponibleGeneral) ?? safeNum(coordResumen?.baseImponibleGeneral),
    baseImponibleAhorro: safeNum(resumen.baseImponibleAhorro) ?? safeNum(coordResumen?.baseImponibleAhorro),
    cuotaIntegra: safeNum(resumen.cuotaIntegra) ?? safeNum(coordResumen?.cuotaIntegra),
    retenciones: safeNum(resumen.retencionesYPagos),
    casillas: null,
    inmuebles: null,
    declaracionCompleta: null,
  };
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
