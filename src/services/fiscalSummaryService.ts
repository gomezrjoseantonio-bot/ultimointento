import { initDB, FiscalSummary, Document, AEATCarryForward } from './db';
import { getExerciseStatus } from './aeatClassificationService';
import { getRentalDaysForYear, updateFiscalSummaryWithAEAT } from './aeatAmortizationService';
import { calcularAmortizacionMobiliarioAnual } from './mobiliarioActivoService';
import { getTotalMejorasHastaEjercicio, getTotalReparacionesEjercicio } from './mejoraActivoService';
import {
  generarOperacionesDesdeIntereses,
  generarOperacionesDesdeRecurrentes,
  getResumenCasillasAEAT,
} from './operacionFiscalService';
import { calculateAEATLimits } from '../utils/aeatUtils';

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

/**
 * Calculate or update fiscal summary for a property and year
 */
export const calculateFiscalSummary = async (
  propertyId: number,
  exerciseYear: number
): Promise<FiscalSummary> => {
  const db = await initDB();

  await generarOperacionesDesdeRecurrentes(propertyId, exerciseYear);
  await generarOperacionesDesdeIntereses(propertyId, exerciseYear);

  const casillas = await getResumenCasillasAEAT(propertyId, exerciseYear);
  const diasArrendados = await getRentalDaysForYear(propertyId, exerciseYear);
  const diasDisponibles = isLeapYear(exerciseYear) ? 366 : 365;
  const box0117 = await calcularAmortizacionMobiliarioAnual(propertyId, exerciseYear, diasArrendados, diasDisponibles);
  const capexTotal = await getTotalMejorasHastaEjercicio(propertyId, exerciseYear);
  // Reparaciones registered as MejoraActivo tipo='reparacion' → add to box 0106
  const reparacionesFromMejoras = await getTotalReparacionesEjercicio(propertyId, exerciseYear);

  const summary: Omit<FiscalSummary, 'id'> = {
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
    // Use unified AEAT amortization calculation with fallback to fiscalData/acquisitionCosts
    const updatedSummary = await updateFiscalSummaryWithAEAT(propertyId, exerciseYear);
    summary.constructionValue = updatedSummary.constructionValue;
    summary.annualDepreciation = updatedSummary.annualDepreciation;
    summary.aeatAmortization = updatedSummary.aeatAmortization;
  }

  const financingAndRepairs = summary.box0105 + summary.box0106;
  // Query contracts: check both inmuebleId (new) and propertyId (legacy) fields
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

  const { applied: limitApplied, excess } = calculateAEATLimits(ingresosIntegros, summary.box0105, summary.box0106);
  summary.deductibleExcess = excess;

  if (excess > 0) {
    const cfRecord: Omit<AEATCarryForward, 'id'> = {
      propertyId,
      taxYear: exerciseYear,
      totalIncome: ingresosIntegros,
      financingAndRepair: financingAndRepairs,
      limitApplied,
      excessAmount: excess,
      expirationYear: exerciseYear + 4,
      remainingAmount: excess,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const allCfs = await db.getAllFromIndex('aeatCarryForwards', 'propertyId', propertyId);
    const existingCf = (allCfs as AEATCarryForward[]).find((cf) => cf.taxYear === exerciseYear);
    if (existingCf) {
      await db.put('aeatCarryForwards', {
        ...cfRecord,
        id: existingCf.id,
        createdAt: existingCf.createdAt,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await db.add('aeatCarryForwards', cfRecord);
    }
  } else {
    const allCfs = await db.getAllFromIndex('aeatCarryForwards', 'propertyId', propertyId);
    const existingCf = (allCfs as AEATCarryForward[]).find((cf) => cf.taxYear === exerciseYear);
    if (existingCf) {
      await db.delete('aeatCarryForwards', existingCf.id!);
    }
  }

  const existingIndex = await db.getAllFromIndex('fiscalSummaries', 'property-year', [propertyId, exerciseYear]);
  if (existingIndex.length > 0) {
    const existing = existingIndex[0];
    const updated = { ...summary, id: existing.id, createdAt: existing.createdAt };
    await db.put('fiscalSummaries', updated);
    return updated;
  }

  const id = (await db.add('fiscalSummaries', summary)) as number;
  return { ...summary, id };
};

/**
 * Get fiscal summary for property and year, creating if needed
 */
export const getFiscalSummary = async (
  propertyId: number,
  exerciseYear: number
): Promise<FiscalSummary> => {
  const db = await initDB();

  const existing = await db.getAllFromIndex('fiscalSummaries', 'property-year', [propertyId, exerciseYear]);
  if (existing.length > 0) {
    return existing[0];
  }

  return calculateFiscalSummary(propertyId, exerciseYear);
};

/**
 * Refresh fiscal summaries when documents are updated
 */
export const refreshFiscalSummariesForDocument = async (document: Document): Promise<void> => {
  if (document.metadata.entityType !== 'property' || !document.metadata.entityId) {
    return;
  }

  const exerciseYear = document.metadata.aeatClassification?.exerciseYear
    || (document.metadata.financialData?.issueDate
      ? new Date(document.metadata.financialData.issueDate).getFullYear()
      : new Date().getFullYear());

  await calculateFiscalSummary(document.metadata.entityId, exerciseYear);
};

export const getPropertyFiscalSummaries = async (propertyId: number): Promise<FiscalSummary[]> => {
  const db = await initDB();
  return db.getAllFromIndex('fiscalSummaries', 'propertyId', propertyId);
};

export const getYearFiscalSummaries = async (exerciseYear: number): Promise<FiscalSummary[]> => {
  const db = await initDB();
  return db.getAllFromIndex('fiscalSummaries', 'exerciseYear', exerciseYear);
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
  const summary = await getFiscalSummary(propertyId, exerciseYear);
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

/**
 * Calculate carryforward amounts for deductible excess with proper AEAT 4-year limit
 */
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
    .filter((summary) => summary.deductibleExcess && summary.deductibleExcess > 0 && summary.exerciseYear >= currentYear - 4 && summary.exerciseYear + 4 >= currentYear)
    .sort((a, b) => a.exerciseYear - b.exerciseYear);

  const db = await initDB();
  const allIngresos = await db.getAll('ingresos');
  const result = [];

  for (const summary of excessSummaries) {
    const expirationYear = summary.exerciseYear + 4;
    const expiresThisYear = expirationYear === currentYear;
    const yearsToApply = Array.from({ length: 4 }, (_, index) => summary.exerciseYear + 1 + index)
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
        if (year === currentYear) {
          appliedThisYear = canApply;
        }
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

/**
 * Get total carryforwards applied in current year for KPI
 */
export const getCarryForwardsAppliedThisYear = async (propertyId?: number): Promise<number> => {
  const db = await initDB();
  const properties = propertyId
    ? [propertyId]
    : (await db.getAll('properties')).filter((property) => property.state === 'activo').map((property) => property.id!);

  let totalApplied = 0;
  for (const propId of properties) {
    const carryForwards = await calculateCarryForwards(propId);
    totalApplied += carryForwards.reduce((sum, carryForward) => sum + (carryForward.appliedThisYear || 0), 0);
  }

  return totalApplied;
};
