// fiscalSummaryService — operates on gastosInmueble (unified store)
// fiscalSummaries store eliminated in phase F

import { initDB, FiscalSummary, Document, AEATCarryForward } from './db';
import { getExerciseStatus } from './aeatClassificationService';
import { getRentalDaysForYear, updateFiscalSummaryWithAEAT } from './aeatAmortizationService';
import { calcularAmortizacionMobiliarioAnual } from './mobiliarioActivoService';
import { getTotalMejorasHastaEjercicio, getTotalReparacionesEjercicio } from './mejoraActivoService';
import {
  generarOperacionesDesdeIntereses,
  generarOperacionesDesdeRecurrentes,
} from './operacionFiscalService';
import { gastosInmuebleService } from './gastosInmuebleService';
import { calculateAEATLimits } from '../utils/aeatUtils';
import { getEjercicio } from './ejercicioResolverService';

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
    box0105: snapshot[`${propertyId}_0105`] ?? snapshot['0105'] ?? 0,
    box0106: snapshot[`${propertyId}_0106`] ?? snapshot['0106'] ?? 0,
    box0109: snapshot[`${propertyId}_0109`] ?? snapshot['0109'] ?? 0,
    box0112: snapshot[`${propertyId}_0112`] ?? snapshot['0112'] ?? 0,
    box0113: snapshot[`${propertyId}_0113`] ?? snapshot['0113'] ?? 0,
    box0114: snapshot[`${propertyId}_0114`] ?? snapshot['0114'] ?? 0,
    box0115: snapshot[`${propertyId}_0115`] ?? snapshot['0115'] ?? 0,
    box0117: snapshot[`${propertyId}_0117`] ?? snapshot['0117'] ?? 0,
    capexTotal: 0,
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
  const capexTotal = await getTotalMejorasHastaEjercicio(propertyId, exerciseYear);
  const reparacionesFromMejoras = await getTotalReparacionesEjercicio(propertyId, exerciseYear);

  const summary: FiscalSummary = {
    propertyId,
    exerciseYear,
    box0105: casillas['0105'] || 0,
    box0106: (casillas['0106'] || 0) + reparacionesFromMejoras,
    box0109: casillas['0109'] || 0,
    box0112: casillas['0112'] || 0,
    box0113: casillas['0113'] || 0,
    box0114: casillas['0114'] || 0,
    box0115: casillas['0115'] || 0,
    box0117: box0117 || 0,
    capexTotal,
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

  // Deductible excess calculation
  const { excess } = calculateAEATLimits(ingresosIntegros, summary.box0105, summary.box0106);
  summary.deductibleExcess = excess;

  // Persist carryforward records (these go to aeatCarryForwards, not fiscalSummaries)
  if (excess > 0) {
    const cfRecord: Omit<AEATCarryForward, 'id'> = {
      propertyId,
      taxYear: exerciseYear,
      totalIncome: ingresosIntegros,
      financingAndRepair: summary.box0105 + summary.box0106,
      limitApplied: ingresosIntegros,
      excessAmount: excess,
      expirationYear: exerciseYear + 4,
      remainingAmount: excess,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const allCfs = await db.getAllFromIndex('aeatCarryForwards', 'propertyId', propertyId);
    const existingCf = (allCfs as AEATCarryForward[]).find((cf) => cf.taxYear === exerciseYear);
    if (existingCf) {
      await db.put('aeatCarryForwards', { ...cfRecord, id: existingCf.id, createdAt: existingCf.createdAt });
    } else {
      await db.add('aeatCarryForwards', cfRecord);
    }
  }

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
      inmuebleIds = (await getEjercicio(currentYear)).inmuebleIds;
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
