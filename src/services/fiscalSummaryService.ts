// fiscalSummaryService — operates on gastosInmueble (unified store)
// fiscalSummaries store eliminated in phase F

import { initDB, FiscalSummary, Document, AEATCarryForward } from './db';
import { getExerciseStatus } from './aeatClassificationService';
import { getRentalDaysForYear, updateFiscalSummaryWithAEAT } from './aeatAmortizationService';
import { calcularAmortizacionMobiliarioAnual } from './mobiliarioActivoService';
import { getTotalMejorasHastaEjercicio } from './mejoraActivoService';
import {
  generarOperacionesDesdeIntereses,
  generarOperacionesDesdeRecurrentes,
} from './operacionFiscalService';
import { gastosInmuebleService } from './gastosInmuebleService';
import { calculateAEATLimits } from '../utils/aeatUtils';
import { getEjercicio } from './ejercicioResolverService';
import {
  getCarryForwardsDisponibles,
  consumirArrastresAplicados,
} from './carryForwardService';
import { calcularImputacion } from './imputacionRentaService';
import { getRendimientoFiscal, normalizeRefCatastral } from './rendimientoActivoService';

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

/**
 * Extract a FiscalSummary for the property from `aeat.declaracionCompleta`
 * cuando el inmueble está identificado en la declaración (matching por
 * refCatastral · `normalizeRefCatastral` compartido con
 * `rendimientoActivoService` para evitar drift), o del snapshot global como
 * fallback. El snapshot global AEAT solo trae 9 casillas G/H del bloque
 * resumen — los gastos por inmueble (0105, 0109, 0112…0117) viven en
 * `decl.inmuebles[i].gastos`.
 */
async function extraerSummaryDeAEAT(
  db: Awaited<ReturnType<typeof initDB>>,
  aeat: NonNullable<Awaited<ReturnType<typeof getEjercicio>>>['aeat'],
  propertyId: number,
  exerciseYear: number,
): Promise<FiscalSummary> {
  const snapshot = aeat?.snapshot ?? {};
  const decl = aeat?.declaracionCompleta;

  // Localiza el inmueble en la declaración matcheando por refCatastral
  // del property (mismo patrón que usa el distribuidor de imports).
  let inmDecl: any | undefined;
  if (decl?.inmuebles && decl.inmuebles.length > 0) {
    const property = await db.get('properties', propertyId);
    const refProperty = normalizeRefCatastral(property?.cadastralReference);
    if (refProperty) {
      inmDecl = decl.inmuebles.find(
        (i: any) => normalizeRefCatastral(i.refCatastral) === refProperty,
      );
    }
  }

  const g = inmDecl?.gastos ?? {};
  const pickSnap = (casilla: string) =>
    snapshot[`${propertyId}_${casilla}`] ?? snapshot[casilla];
  const pickGasto = (declVal: number | undefined, casilla: string) =>
    typeof declVal === 'number' && Number.isFinite(declVal)
      ? declVal
      : (pickSnap(casilla) ?? 0);

  return {
    propertyId,
    exerciseYear,
    box0089: pickSnap('0089'),
    box0103: inmDecl?.arrastresRecibidos ?? inmDecl?.gastosPendientesPrevios ?? pickSnap('0103'),
    box0104: inmDecl?.gastosPendientesPreviosAplicados ?? pickSnap('0104'),
    box0107: pickGasto(g.gastosAplicados, '0107'),
    box0108: inmDecl?.gastosPendientesGenerados ?? pickSnap('0108'),
    box0105: pickGasto(g.interesesFinanciacion, '0105'),
    box0106: pickGasto(g.reparacionConservacion, '0106'),
    box0109: pickGasto(g.comunidad, '0109'),
    box0112: pickGasto(g.serviciosTerceros, '0112'),
    box0113: pickGasto(g.suministros, '0113'),
    box0114: pickGasto(g.seguros, '0114'),
    box0115: pickGasto(g.ibiTasas, '0115'),
    box0117: pickGasto(g.amortizacionMobiliario ?? inmDecl?.amortizacionMobiliario, '0117'),
    box0129: pickSnap('0129') ?? 0,
    box0130: inmDecl?.baseAmortizacion ?? pickSnap('0130') ?? 0,
    box0131: inmDecl?.amortizacionAnualInmueble ?? pickSnap('0131') ?? 0,
    mejorasTotal: 0,
    deductibleExcess: 0,
    constructionValue: 0,
    annualDepreciation: 0,
    status: getExerciseStatus(exerciseYear),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate fiscal summary for a property and year — computed in memory from gastosInmueble.
 * Does NOT persist to any store.
 */
export const calculateFiscalSummary = async (
  propertyId: number,
  exerciseYear: number
): Promise<FiscalSummary> => {
  const db = await initDB();

  // ═══ GUARD: Declared/prescribed exercises → frozen AEAT snapshot ═══
  let ej;
  try {
    ej = await getEjercicio(exerciseYear);
  } catch {
    ej = null;
  }

  if (ej && (ej.estado === 'declarado' || ej.estado === 'prescrito') && ej.aeat) {
    return extraerSummaryDeAEAT(db, ej.aeat, propertyId, exerciseYear);
  }

  // ═══ FULL CALCULATION from gastosInmueble ═══
  await generarOperacionesDesdeRecurrentes(propertyId, exerciseYear);
  await generarOperacionesDesdeIntereses(propertyId, exerciseYear);

  const casillas = await gastosInmuebleService.getSumaPorCasilla(propertyId, exerciseYear);
  const diasArrendados = await getRentalDaysForYear(propertyId, exerciseYear);
  const diasDisponibles = isLeapYear(exerciseYear) ? 366 : 365;
  const box0117 = await calcularAmortizacionMobiliarioAnual(propertyId, exerciseYear, diasArrendados, diasDisponibles);
  const mejorasTotal = await getTotalMejorasHastaEjercicio(propertyId, exerciseYear);

  const summary: FiscalSummary = {
    propertyId,
    exerciseYear,
    box0105: casillas['0105'] || 0,
    box0106: casillas['0106'] || 0,
    box0109: casillas['0109'] || 0,
    box0112: casillas['0112'] || 0,
    box0113: casillas['0113'] || 0,
    box0114: casillas['0114'] || 0,
    box0115: casillas['0115'] || 0,
    box0117: box0117 || 0,
    box0129: casillas['0129'] || 0,
    box0130: casillas['0130'] || 0,
    box0131: casillas['0131'] || 0,
    mejorasTotal,
    deductibleExcess: 0,
    constructionValue: 0,
    annualDepreciation: 0,
    status: getExerciseStatus(exerciseYear),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const property = await db.get('properties', propertyId);
  if (property) {
    try {
      const updatedSummary = await updateFiscalSummaryWithAEAT(propertyId, exerciseYear);
      summary.constructionValue = updatedSummary.constructionValue;
      summary.annualDepreciation = updatedSummary.annualDepreciation;
      summary.aeatAmortization = updatedSummary.aeatAmortization;
    } catch {
      // AEAT amortization calculation failed — keep zeros
    }
  }

  // Calculate income from contracts
  const allContracts = await db.getAll('contracts');
  const propertyContracts = (allContracts as any[]).filter((c: any) => {
    const matchesProperty = (c.inmuebleId === propertyId) || (c.propertyId === propertyId);
    if (!matchesProperty) return false;
    const inicio = new Date(c.fechaInicio ?? c.startDate);
    const fin = new Date(c.fechaFin ?? c.endDate ?? `${exerciseYear}-12-31`);
    return inicio.getFullYear() <= exerciseYear && fin.getFullYear() >= exerciseYear;
  });

  let ingresosIntegros = 0;
  for (const contract of propertyContracts) {
    const renta = contract.rentaMensual ?? 0;
    const inicio = new Date(contract.fechaInicio ?? contract.startDate);
    const fin = new Date(contract.fechaFin ?? contract.endDate ?? `${exerciseYear}-12-31`);
    const mesInicio = inicio.getFullYear() < exerciseYear ? 1 : inicio.getMonth() + 1;
    const mesFin = fin.getFullYear() > exerciseYear ? 12 : fin.getMonth() + 1;
    const meses = Math.max(0, mesFin - mesInicio + 1);
    ingresosIntegros += renta * meses;
  }
  summary.box0102 = ingresosIntegros;

  // ═══ S-FISCAL-FIXES Fix 3 · N3 imputación renta a disposición → box0089 ═══
  try {
    const imp = await calcularImputacion(propertyId, exerciseYear);
    summary.box0089 = imp.imputacion;
  } catch {
    summary.box0089 = 0;
  }

  // ═══ S-FISCAL-FIXES Fix 1 · N4 tope intereses+reparación ═══
  // 1. Arrastres entrantes disponibles (ejercicios previos, no caducados, no consumidos)
  const cfsDisponibles = await getCarryForwardsDisponibles(propertyId, exerciseYear);
  const arrastresEntrantesDisponibles = cfsDisponibles.total;

  // 2. Aplicar arrastres entrantes primero (tope = ingresos íntegros)
  const arrastresAplicados = Math.min(arrastresEntrantesDisponibles, ingresosIntegros);

  // 3. Tope efectivo restante para intereses+reparación
  const topeEfectivo = Math.max(0, ingresosIntegros - arrastresAplicados);

  // 4. Aplicar intereses+reparación hasta tope efectivo
  const interesesReparacionTotal = (summary.box0105 || 0) + (summary.box0106 || 0);
  const interesesReparacionAplicados = Math.min(interesesReparacionTotal, topeEfectivo);

  // 5. Exceso de intereses+reparación que arrastra a 4 ejercicios siguientes
  const excesoArrastre = Math.max(0, interesesReparacionTotal - interesesReparacionAplicados);

  summary.box0103 = arrastresEntrantesDisponibles;
  summary.box0104 = arrastresAplicados;
  summary.box0107 = interesesReparacionAplicados;
  summary.box0108 = excesoArrastre;

  // Backwards compat: keep `deductibleExcess` and call to calculateAEATLimits
  // to derive desgloses por concepto (financiación vs reparación) que algunos
  // consumidores legados pueden usar.
  const { appliedFinancing, appliedRepairs } = calculateAEATLimits(
    topeEfectivo,
    summary.box0105 || 0,
    summary.box0106 || 0,
  );
  summary.deductibleExcess = excesoArrastre;

  // 6. Consumir arrastres entrantes en FIFO
  if (arrastresAplicados > 0) {
    await consumirArrastresAplicados(cfsDisponibles.detalle, arrastresAplicados);
  }

  // 7. Persistir exceso saliente como nuevo arrastre (expira en ejercicio + 4)
  const existingCfsThisYear = await db.getAllFromIndex('aeatCarryForwards', 'propertyId', propertyId);
  const existingCf = (existingCfsThisYear as AEATCarryForward[]).find((cf) => cf.taxYear === exerciseYear);
  if (excesoArrastre > 0) {
    const carryForwardType: 'excess_0105' | 'excess_0106' | 'excess_mixed' =
      (summary.box0105 || 0) > 0 && (summary.box0106 || 0) > 0
        ? 'excess_mixed'
        : (summary.box0105 || 0) > 0
          ? 'excess_0105'
          : 'excess_0106';
    const cfRecord: Omit<AEATCarryForward, 'id'> = {
      propertyId,
      taxYear: exerciseYear,
      totalIncome: ingresosIntegros,
      financingAndRepair: interesesReparacionTotal,
      limitApplied: interesesReparacionAplicados,
      excessAmount: excesoArrastre,
      expirationYear: exerciseYear + 4,
      remainingAmount: excesoArrastre,
      carryForwardType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existingCf) {
      await db.put('aeatCarryForwards', { ...cfRecord, id: existingCf.id, createdAt: existingCf.createdAt });
    } else {
      await db.add('aeatCarryForwards', cfRecord);
    }
  } else if (existingCf && existingCf.remainingAmount !== 0) {
    // Ya no genera exceso: marcar el arrastre anterior como consumido sin importe
    await db.put('aeatCarryForwards', {
      ...existingCf,
      totalIncome: ingresosIntegros,
      financingAndRepair: interesesReparacionTotal,
      limitApplied: interesesReparacionAplicados,
      excessAmount: 0,
      remainingAmount: 0,
      updatedAt: new Date().toISOString(),
    });
  }

  // Silenciar no-uso de variables (mantenidas por compatibilidad downstream)
  void appliedFinancing;
  void appliedRepairs;

  return summary;
};

export const getFiscalSummary = async (
  propertyId: number,
  exerciseYear: number
): Promise<FiscalSummary> => {
  return calculateFiscalSummary(propertyId, exerciseYear);
};

export const refreshFiscalSummariesForDocument = async (document: Document): Promise<void> => {
  if (document.metadata.entityType !== 'property' || !document.metadata.entityId) return;
  const exerciseYear = document.metadata.aeatClassification?.exerciseYear
    || (document.metadata.financialData?.issueDate
      ? new Date(document.metadata.financialData.issueDate).getFullYear()
      : new Date().getFullYear());
  await calculateFiscalSummary(document.metadata.entityId, exerciseYear);
};

export const getPropertyFiscalSummaries = async (propertyId: number): Promise<FiscalSummary[]> => {
  // Get all distinct ejercicios from gastosInmueble for this property
  const gastos = await gastosInmuebleService.getByInmueble(propertyId);
  const ejercicios = [...new Set(gastos.map(g => g.ejercicio))].sort();
  const summaries: FiscalSummary[] = [];
  for (const ej of ejercicios) {
    summaries.push(await calculateFiscalSummary(propertyId, ej));
  }
  return summaries;
};

export const getYearFiscalSummaries = async (exerciseYear: number): Promise<FiscalSummary[]> => {
  const db = await initDB();
  const properties = await db.getAll('properties');
  const summaries: FiscalSummary[] = [];
  for (const p of properties) {
    if (!p.id) continue;
    // Only calculate if there are gastos for this property+year
    const gastos = await gastosInmuebleService.getByInmuebleYEjercicio(p.id, exerciseYear);
    if (gastos.length > 0) {
      summaries.push(await calculateFiscalSummary(p.id, exerciseYear));
    }
  }
  return summaries;
};

export const exportFiscalData = async (
  propertyId: number,
  exerciseYear: number
): Promise<{
  summary: FiscalSummary;
  documents: Document[];
  csvData: string;
}> => {
  const db = await initDB();
  const summary = await calculateFiscalSummary(propertyId, exerciseYear);
  const allDocuments = await db.getAll('documents');
  const documents = allDocuments.filter((doc) => doc.metadata.entityType === 'property' && doc.metadata.entityId === propertyId);

  const headers = ['Casilla', 'Importe'];
  const rows = [
    ['0105', summary.box0105],
    ['0106', summary.box0106],
    ['0109', summary.box0109],
    ['0112', summary.box0112],
    ['0113', summary.box0113],
    ['0114', summary.box0114],
    ['0115', summary.box0115],
    ['0117', summary.box0117],
  ];
  const csvData = [headers.join(','), ...rows.map(([box, amount]) => `${box},${amount}`)].join('\n');

  return { summary, documents, csvData };
};

export const calculateCarryForwards = async (
  propertyId: number,
  ejercicio?: number
): Promise<Array<{
  exerciseYear: number;
  excessAmount: number;
  remainingAmount: number;
  expirationYear: number;
  appliedThisYear?: number;
  expiresThisYear?: boolean;
}>> => {
  const summaries = await getPropertyFiscalSummaries(propertyId);
  const currentYear = ejercicio ?? new Date().getFullYear();

  const excessSummaries = summaries
    .filter((s) => s.deductibleExcess && s.deductibleExcess > 0 && s.exerciseYear >= currentYear - 4 && s.exerciseYear + 4 >= currentYear)
    .sort((a, b) => a.exerciseYear - b.exerciseYear);

  const db = await initDB();
  const allIngresos = await db.getAll('ingresos');
  const result = [];

  for (const summary of excessSummaries) {
    const expirationYear = summary.exerciseYear + 4;
    const expiresThisYear = expirationYear === currentYear;
    const yearsToApply = Array.from({ length: 4 }, (_, i) => summary.exerciseYear + 1 + i)
      .filter((year) => year <= currentYear);

    let totalApplied = 0;
    let appliedThisYear = 0;

    for (const year of yearsToApply) {
      const yearIncome = allIngresos
        .filter((ingreso: any) => {
          const incomeDate = new Date(ingreso.fecha_emision);
          return incomeDate.getFullYear() === year
            && ingreso.destino === 'inmueble_id'
            && ingreso.destino_id === propertyId
            && ingreso.estado === 'cobrado';
        })
        .reduce((sum: number, ingreso: any) => sum + ingreso.importe, 0);

      const yearSummary = summaries.find((item) => item.exerciseYear === year);
      const competingExpenses = yearSummary ? (yearSummary.box0105 + yearSummary.box0106) : 0;
      const availableForCarryforward = Math.max(0, yearIncome - competingExpenses);
      const remainingExcess = (summary.deductibleExcess || 0) - totalApplied;
      const canApply = Math.min(availableForCarryforward, remainingExcess);

      if (canApply > 0) {
        totalApplied += canApply;
        if (year === currentYear) appliedThisYear = canApply;
      }
    }

    result.push({
      exerciseYear: summary.exerciseYear,
      excessAmount: summary.deductibleExcess || 0,
      remainingAmount: Math.max(0, (summary.deductibleExcess || 0) - totalApplied),
      expirationYear,
      appliedThisYear,
      expiresThisYear,
    });
  }

  return result;
};

export const getCarryForwardsAppliedThisYear = async (propertyId?: number): Promise<number> => {
  const db = await initDB();
  const currentYear = new Date().getFullYear();

  let propertyIds: number[];
  if (propertyId) {
    propertyIds = [propertyId];
  } else {
    let inmuebleIds: number[] = [];
    try {
      inmuebleIds = (await getEjercicio(currentYear))?.inmuebleIds ?? [];
    } catch { /* resolver unavailable */ }

    if (inmuebleIds.length > 0) {
      propertyIds = inmuebleIds;
    } else {
      const allProperties = await db.getAll('properties');
      propertyIds = allProperties
        .filter((p) => {
          if (p.state === 'activo') return true;
          if (p.state === 'vendido' || (p as any).state === 'sold') {
            const saleDate = (p as any).saleDate || (p as any).fechaVenta;
            return saleDate && new Date(saleDate).getFullYear() === currentYear;
          }
          return false;
        })
        .map((p) => p.id!);
    }
  }

  let totalApplied = 0;
  for (const propId of propertyIds) {
    const carryForwards = await calculateCarryForwards(propId);
    totalApplied += carryForwards.reduce((sum, cf) => sum + (cf.appliedThisYear || 0), 0);
  }

  return totalApplied;
};

// ═══════════════════════════════════════════════════════════════════════════
// SPEC-CC-FISCAL-UI-REPLACE-v1 · sub-tarea 1 · hueco 1
// calculateFiscalSummaryExtended — extiende calculateFiscalSummary con
// las casillas de rendimiento (0149/0150/0154) y metadatos del ejercicio.
// ═══════════════════════════════════════════════════════════════════════════

export type ModoDeclaracionFiscal = 'I' | 'II' | 'III' | 'IV' | 'V';
export type MetodoProrrateoFiscal = 'dias_habitacion' | 'superficie' | 'ingresos' | null;

export interface FiscalSummaryExtended extends FiscalSummary {
  box0101: number;
  box0102: number;
  box0103: number;
  box0104: number;
  box0107: number;
  box0108: number;
  box0149: number;
  box0150: number;
  box0154: number;

  modoDeclaracion: ModoDeclaracionFiscal;
  diasArrendado: number;
  diasDisposicion: number;
  porcentajeReduccion: number;
  metodoProrrateo?: MetodoProrrateoFiscal;

  /**
   * Subset de campos del inmueble en `coord.aeat.declaracionCompleta.inmuebles[]`
   * relevantes para reconstruir la sección "Amortización" de F3 fielmente a
   * la declaración. Sólo está poblado cuando el ejercicio está declarado y
   * el inmueble se localizó en la declaración por refCatastral.
   *
   * Cuando este objeto está presente, `inmuebleCasillasService` lee la
   * amortización SOLO de aquí — no del store `properties.aeatAmortization`
   * (que contiene datos catastrales generales, no lo declarado).
   */
  declaracionInmueble?: DeclaracionInmuebleSnapshot;
}

export interface DeclaracionInmuebleSnapshot {
  /** 0123 — valor catastral total declarado */
  valorCatastralTotal?: number;
  /** 0124 — valor catastral construcción */
  valorCatastralConstruccion?: number;
  /** 0125 — % construcción */
  porcentajeConstruccion?: number;
  /** 0126 — importe adquisición */
  precioAdquisicion?: number;
  /** 0127 — gastos inherentes adquisición */
  gastosAdquisicion?: number;
  /** 0130 — base de amortización (cuando se declara amortización estándar) */
  baseAmortizacion?: number;
  /** 0131 (estándar) o 0132 (casos especiales) según `usaCasosEspeciales` */
  amortizacionAnualInmueble?: number;
  /** True cuando el inmueble declara amortización por casos especiales
   *  (modo III · alquiler de habitaciones o situaciones especiales). En ese
   *  caso `inmuebleCasillasService` no debe pintar el bloque 0123/0124/
   *  0125/0126/0130 (que no existe en la declaración) y debe etiquetar la
   *  amortización como 0132 en lugar de 0131. */
  usaCasosEspeciales: boolean;
  /** Múltiples `<Arrendamiento>` con `tipoArrendamiento` distinto · señal
   *  de inmueble mixto (larga + temporada). */
  tieneArrendamientosMixtos: boolean;
  /** Número total de `<Arrendamiento>` declarados (1 por unidad/habitación). */
  numArrendamientos: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function detectarModoDeclaracion(
  property: { usoTipo?: string; alquilerPorHabitaciones?: { activo: boolean } } | null,
  contractsDelAño: Array<{ modalidad?: string; unidadTipo?: string; fechaInicio?: string; fechaFin?: string }>,
  diasArrendado: number,
  diasTotal: number,
  inmDecl?: DeclaracionInmuebleSnapshot | null,
): ModoDeclaracionFiscal {
  if (property?.usoTipo === 'vivienda_habitual') return 'IV';

  // ── Señales fiables desde la declaración importada ────────────────────
  // Cuando el año está declarado y tenemos el inmueble en el XML, los
  // arrendamientos del propio Modelo 100 son la fuente más fiable: cada
  // habitación o unidad va en un <Arrendamiento> separado y la modalidad
  // (vivienda vs no_vivienda) está explícita. La presencia de amortización
  // por casos especiales (`usaCasosEspeciales`) o de varios arrendamientos
  // distintos es suficiente para clasificar como III.
  if (inmDecl) {
    if (inmDecl.usaCasosEspeciales) return 'III';
    if (inmDecl.tieneArrendamientosMixtos) return 'III';
    if (inmDecl.numArrendamientos > 1) return 'III';
  }

  const habitaciones = contractsDelAño.some((c) => c.unidadTipo === 'habitacion');
  const modalidades = new Set(contractsDelAño.map((c) => c.modalidad).filter(Boolean));
  const tieneCorta = modalidades.has('vacacional') || modalidades.has('temporada');
  const tieneLarga = modalidades.has('habitual');

  if (property?.alquilerPorHabitaciones?.activo || habitaciones) return 'III';
  if (tieneLarga && tieneCorta) return 'III';
  if (tieneCorta && !tieneLarga) return 'V';
  if (tieneLarga && !tieneCorta) {
    if (diasArrendado > 0 && diasArrendado < diasTotal - 7) return 'II';
    return 'I';
  }
  if (property?.usoTipo === 'mixto') return 'III';
  if (property?.usoTipo === 'turistico' || property?.usoTipo === 'temporada') return 'V';
  if (property?.usoTipo === 'larga_estancia') return 'I';
  if (diasArrendado > 0 && diasArrendado < diasTotal - 7) return 'II';
  return 'I';
}

function detectarPorcentajeReduccion(
  modo: ModoDeclaracionFiscal,
  contractsDelAño: Array<{ modalidad?: string; reduccionLeyVivienda?: number }>,
): number {
  if (modo === 'IV') return 0;
  if (modo === 'V') return 0;
  const explicit = contractsDelAño
    .map((c) => c.reduccionLeyVivienda)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  if (explicit.length > 0) return Math.max(...explicit);
  if (modo === 'I' || modo === 'II' || modo === 'III') return 60;
  return 0;
}

async function buildDeclaracionInmuebleSnapshot(
  db: Awaited<ReturnType<typeof initDB>>,
  propertyId: number,
  exerciseYear: number,
): Promise<DeclaracionInmuebleSnapshot | undefined> {
  let ej;
  try {
    ej = await getEjercicio(exerciseYear);
  } catch {
    return undefined;
  }
  const decl = ej?.aeat?.declaracionCompleta;
  if (!decl?.inmuebles || decl.inmuebles.length === 0) return undefined;

  const property = await db.get('properties', propertyId);
  const refProperty = normalizeRefCatastral(property?.cadastralReference);
  if (!refProperty) return undefined;
  const inm: any = decl.inmuebles.find(
    (i: any) => normalizeRefCatastral(i.refCatastral) === refProperty,
  );
  if (!inm) return undefined;

  const arrends: any[] = inm.arrendamientos ?? [];
  const tiposArrendamiento = new Set(arrends.map((a) => a.tipoArrendamiento).filter(Boolean));
  // Casos especiales (0132): la AEAT lo marca cuando hay amortización
  // declarada SIN bloque catastral (sin base, sin VC construcción) — es la
  // huella típica del alquiler por habitaciones / situaciones especiales.
  // FA32 caso real: amortizacionAnualInmueble=816,12 con baseAmortizacion=0.
  const amortInmueble = inm.amortizacionAnualInmueble ?? 0;
  const baseAmort = inm.baseAmortizacion ?? 0;
  const usaCasosEspeciales = amortInmueble > 0 && baseAmort === 0;

  return {
    valorCatastralTotal: inm.valorCatastralTotal ?? inm.valorCatastral,
    valorCatastralConstruccion: inm.valorCatastralConstruccion,
    porcentajeConstruccion: inm.porcentajeConstruccion,
    precioAdquisicion: inm.precioAdquisicion,
    gastosAdquisicion: inm.gastosAdquisicion,
    baseAmortizacion: baseAmort > 0 ? baseAmort : undefined,
    amortizacionAnualInmueble: amortInmueble > 0 ? amortInmueble : undefined,
    usaCasosEspeciales,
    tieneArrendamientosMixtos: tiposArrendamiento.size > 1,
    numArrendamientos: arrends.length,
  };
}

function detectarMetodoProrrateo(
  modo: ModoDeclaracionFiscal,
  property: { alquilerPorHabitaciones?: { activo: boolean } } | null,
): MetodoProrrateoFiscal {
  if (modo !== 'III' && modo !== 'II') return null;
  if (property?.alquilerPorHabitaciones?.activo) return 'dias_habitacion';
  return 'dias_habitacion';
}

export const calculateFiscalSummaryExtended = async (
  propertyId: number,
  exerciseYear: number,
): Promise<FiscalSummaryExtended> => {
  const db = await initDB();
  const property = await db.get('properties', propertyId);
  const refCatastral = property?.cadastralReference ?? '';

  const summary = await calculateFiscalSummary(propertyId, exerciseYear);
  const rendimiento = await getRendimientoFiscal(propertyId, refCatastral, exerciseYear);

  const diasTotal = isLeapYear(exerciseYear) ? 366 : 365;
  const diasArrendado = rendimiento.diasArrendado > 0
    ? rendimiento.diasArrendado
    : await getRentalDaysForYear(propertyId, exerciseYear);
  const diasDisposicion = rendimiento.diasDisposicion > 0
    ? rendimiento.diasDisposicion
    : Math.max(0, diasTotal - diasArrendado);

  const allContracts = (await db.getAll('contracts')) as any[];
  const contractsDelAño = allContracts.filter((c: any) => {
    const matchesProperty = (c.inmuebleId === propertyId) || (c.propertyId === propertyId);
    if (!matchesProperty) return false;
    const inicio = new Date(c.fechaInicio ?? c.startDate ?? `${exerciseYear}-01-01`);
    const fin = new Date(c.fechaFin ?? c.endDate ?? `${exerciseYear}-12-31`);
    return inicio.getFullYear() <= exerciseYear && fin.getFullYear() >= exerciseYear;
  });

  // ── Snapshot de la declaración del inmueble (cuando el año está
  //    declarado y el inmueble se localiza por refCatastral). Alimenta
  //    tanto la detección de modo (III/mixto/habitaciones) como la
  //    sección "Amortización" de F3 (que en años declarados debe leer
  //    SOLO de aquí, no de `property.aeatAmortization`). ─────────────
  const declaracionInmueble = await buildDeclaracionInmuebleSnapshot(db, propertyId, exerciseYear);

  const modoDeclaracion = detectarModoDeclaracion(
    property as any,
    contractsDelAño,
    diasArrendado,
    diasTotal,
    declaracionInmueble,
  );
  const porcentajeReduccion = detectarPorcentajeReduccion(modoDeclaracion, contractsDelAño);
  const metodoProrrateo = detectarMetodoProrrateo(modoDeclaracion, property as any);

  // ── 0149 / 0150 / 0154 ────────────────────────────────────────────────
  // Si rendimientoActivoService devuelve datos de XML AEAT (fuente='xml_aeat'),
  // usar esos valores tal cual (snapshot del Modelo 100 ya calculado).
  // En otro caso, calcular según la fórmula del spec §3.2:
  //   0149 = 0102 − 0104 − 0107 − Σ(0109..0117) − amortizacionInmueble − amortizacionMobiliario − amortizacionMejoras
  //   0150 = reducción Ley Vivienda aplicada (rendimientoActivoService.reduccionVivienda
  //          en modo XML; en modo atlas: % × 0149 si el modo lo permite, default 60% del rendimiento positivo).
  //   0154 = 0149 − 0150
  let box0149: number;
  let box0150: number;
  let box0154: number;

  if (rendimiento.fuente === 'xml_aeat') {
    box0149 = round2(rendimiento.rendimientoNeto);
    box0150 = round2(rendimiento.reduccionVivienda);
    box0154 = round2(rendimiento.rendimientoNetoReducido);

    // Cuando el snapshot XML AEAT está disponible, los ingresos íntegros de
    // arrendamiento (0102) reflejan SOLO las rentas declaradas, no la renta
    // imputada (0089). Mezclarlas inflaba la 0102 con los días a disposición
    // de inmuebles mixtos (caso T64 4D 2024: 7.420,68 vs 7.160,00 correcto).
    // La renta imputada se conserva en `summary.box0089` y la UI la pinta
    // como línea separada en la sección de ingresos.
    const ingresosXML = round2(rendimiento.rentasDeclaradas);
    if (ingresosXML > 0) {
      summary.box0102 = ingresosXML;
    }
    const imputadaXML = round2(rendimiento.rentaImputada);
    if (imputadaXML > 0) {
      summary.box0089 = imputadaXML;
    }
  } else {
    const ingresos = summary.box0102 ?? 0;
    const arrastresAplicados = summary.box0104 ?? 0;
    const interesesReparacion = summary.box0107 ?? 0;
    const otrosGastos =
      (summary.box0109 ?? 0) +
      (summary.box0112 ?? 0) +
      (summary.box0113 ?? 0) +
      (summary.box0114 ?? 0) +
      (summary.box0115 ?? 0);
    const amortizacionInmueble = summary.box0131 ?? 0;
    const amortizacionMobiliario = summary.box0117 ?? 0;
    // box0129 = "Mejoras realizadas en el ejercicio" (CAPEX completo, no
    // amortización deducible). La amortización anual de mejoras se reparte
    // a 3% durante la vida útil y se acumula vía `aeatAmortizationService` /
    // `getTotalMejorasHastaEjercicio`, pero el desglose por año aún no se
    // expone como casilla independiente. Usamos 0 aquí para no restar el
    // CAPEX completo (lo que distorsionaría el rendimiento neto). Cuando
    // exista un servicio que devuelva el cargo anual de amortización de
    // mejoras del ejercicio, sustituir este 0.
    const amortizacionMejoras = 0;

    box0149 = round2(
      ingresos
        - arrastresAplicados
        - interesesReparacion
        - otrosGastos
        - amortizacionInmueble
        - amortizacionMobiliario
        - amortizacionMejoras,
    );

    if (porcentajeReduccion > 0 && box0149 > 0) {
      box0150 = round2(box0149 * (porcentajeReduccion / 100));
    } else {
      box0150 = 0;
    }
    box0154 = round2(box0149 - box0150);
  }

  return {
    ...summary,
    box0101: diasArrendado,
    box0102: summary.box0102 ?? 0,
    box0103: summary.box0103 ?? 0,
    box0104: summary.box0104 ?? 0,
    box0107: summary.box0107 ?? 0,
    box0108: summary.box0108 ?? 0,
    box0149,
    box0150,
    box0154,
    modoDeclaracion,
    diasArrendado,
    diasDisposicion,
    porcentajeReduccion,
    metodoProrrateo,
    declaracionInmueble,
  };
};
