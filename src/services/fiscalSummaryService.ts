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

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

/**
 * Extract a FiscalSummary-like object from an AEAT snapshot for a given property.
 */
function extraerSummaryDeSnapshot(
  snapshot: Record<string, number>,
  propertyId: number,
  exerciseYear: number,
): FiscalSummary {
  return {
    propertyId,
    exerciseYear,
    box0089: snapshot[`${propertyId}_0089`] ?? snapshot['0089'],
    box0103: snapshot[`${propertyId}_0103`] ?? snapshot['0103'],
    box0104: snapshot[`${propertyId}_0104`] ?? snapshot['0104'],
    box0107: snapshot[`${propertyId}_0107`] ?? snapshot['0107'],
    box0108: snapshot[`${propertyId}_0108`] ?? snapshot['0108'],
    box0105: snapshot[`${propertyId}_0105`] ?? snapshot['0105'] ?? 0,
    box0106: snapshot[`${propertyId}_0106`] ?? snapshot['0106'] ?? 0,
    box0109: snapshot[`${propertyId}_0109`] ?? snapshot['0109'] ?? 0,
    box0112: snapshot[`${propertyId}_0112`] ?? snapshot['0112'] ?? 0,
    box0113: snapshot[`${propertyId}_0113`] ?? snapshot['0113'] ?? 0,
    box0114: snapshot[`${propertyId}_0114`] ?? snapshot['0114'] ?? 0,
    box0115: snapshot[`${propertyId}_0115`] ?? snapshot['0115'] ?? 0,
    box0117: snapshot[`${propertyId}_0117`] ?? snapshot['0117'] ?? 0,
    box0129: snapshot[`${propertyId}_0129`] ?? snapshot['0129'] ?? 0,
    box0130: snapshot[`${propertyId}_0130`] ?? snapshot['0130'] ?? 0,
    box0131: snapshot[`${propertyId}_0131`] ?? snapshot['0131'] ?? 0,
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
    return extraerSummaryDeSnapshot(ej.aeat.snapshot, propertyId, exerciseYear);
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
