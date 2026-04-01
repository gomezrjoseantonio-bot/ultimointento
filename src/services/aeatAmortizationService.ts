// H9-FISCAL: AEAT Amortization Service
import { initDB, Property, PropertyImprovement, FiscalSummary } from './db';
import { actualizarMejora, crearMejora, eliminarMejora, getMejorasHastaEjercicio } from './mejoraActivoService';

export interface UnifiedPropertyFiscalData {
  acquisitionType: 'onerosa' | 'lucrativa' | 'mixta';
  acquisitionAmount: number;
  acquisitionExpenses: number;
  cadastralValue: number;
  constructionCadastralValue: number;
  constructionPercentage: number;
  acquisitionDate: string;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickPositiveNumber = (...values: unknown[]): number => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};

export const getAcquisitionExpensesFallback = (property: Property): number => {
  const costs = property.acquisitionCosts;
  if (!costs) return 0;

  const acquisitionExpenseValues: number[] = [
    costs.itp ?? 0,
    costs.iva ?? 0,
    costs.notary ?? 0,
    costs.registry ?? 0,
    costs.management ?? 0,
    costs.psi ?? 0,
    costs.realEstate ?? 0,
  ];

  return acquisitionExpenseValues.reduce((sum, value) => sum + value, 0);
};

export const getConstructionPercentageFromValues = (
  cadastralValue: number,
  constructionCadastralValue: number,
): number => {
  if (cadastralValue <= 0 || constructionCadastralValue <= 0) return 0;
  return (constructionCadastralValue / cadastralValue) * 100;
};

/**
 * Lee los datos fiscales del inmueble unificando `aeatAmortization` y `fiscalData`.
 * Prioridad: datos explícitos AEAT > ficha principal del inmueble.
 */
export const getUnifiedFiscalData = (property: Property): UnifiedPropertyFiscalData => {
  const aeat = property.aeatAmortization;
  const fiscalData = property.fiscalData;

  const cadastralValue = pickPositiveNumber(
    aeat?.cadastralValue,
    fiscalData?.cadastralValue,
  );

  const constructionCadastralValue = pickPositiveNumber(
    aeat?.constructionCadastralValue,
    fiscalData?.constructionCadastralValue,
  );

  // Always recalculate from actual values when both are available for accuracy;
  // only use stored percentage as fallback when one of the values is missing.
  const calculatedPct = getConstructionPercentageFromValues(cadastralValue, constructionCadastralValue);
  const constructionPercentage = calculatedPct > 0
    ? calculatedPct
    : pickPositiveNumber(aeat?.constructionPercentage, fiscalData?.constructionPercentage);

  return {
    acquisitionType: aeat?.acquisitionType ?? 'onerosa',
    acquisitionAmount: pickPositiveNumber(
      aeat?.onerosoAcquisition?.acquisitionAmount,
      property.acquisitionCosts?.price,
    ),
    acquisitionExpenses: pickPositiveNumber(
      aeat?.onerosoAcquisition?.acquisitionExpenses,
      getAcquisitionExpensesFallback(property),
    ),
    cadastralValue,
    constructionCadastralValue,
    constructionPercentage,
    acquisitionDate: aeat?.firstAcquisitionDate ?? property.purchaseDate ?? '',
  };
};

export interface ImprovementUpdatePayload {
  year: number;
  amount: number;
  date?: string;
  daysInYear?: number;
  counterpartyNIF?: string;
  description: string;
}

export interface AEATAmortizationCalculation {
  // Base calculation
  calculationMethod: 'general' | 'special';
  baseAmount: number; // Base amortizable
  percentageApplied: number; // Percentage applied
  daysRented: number;
  daysAvailable: number;
  
  // Amortization amounts
  propertyAmortization: number;
  improvementsAmortization: number;
  furnitureAmortization: number;
  totalAmortization: number;
  
  // Tracking for future sales
  accumulatedStandard: number; // 3% acumulado
  accumulatedActual: number; // Real deducido
  
  // Details
  specialCaseJustification?: string;
  breakdown: {
    constructionCost: number;
    cadastralConstructionValue: number;
    historicalImprovements: number;
    selectedBase: 'construction-cost' | 'cadastral-value';
  };
}

/**
 * Calculate AEAT amortization for a property and year
 */
export const calculateAEATAmortization = async (
  propertyId: number,
  exerciseYear: number,
  daysRented: number = 365
): Promise<AEATAmortizationCalculation> => {
  const db = await initDB();
  
  // Get property data
  const property = await db.get('properties', propertyId);
  if (!property) {
    throw new Error(`Property ${propertyId} not found`);
  }

  const unified = getUnifiedFiscalData(property);
  const daysAvailable = isLeapYear(exerciseYear) ? 366 : 365;
  
  // Default calculation - general rule
  let calculationMethod: 'general' | 'special' = 'general';
  let percentageApplied = 0.03; // 3% default
  let specialCaseJustification: string | undefined;

  // Calculate construction cost (oneroso acquisition)
  let constructionCost = 0;
  if (unified.acquisitionType === 'onerosa' || unified.acquisitionType === 'mixta') {
    const totalCost = unified.acquisitionAmount + unified.acquisitionExpenses;
    if (unified.constructionPercentage > 0) {
      constructionCost = totalCost * (unified.constructionPercentage / 100);
    }
  }

  // Get cadastral construction value
  const cadastralConstructionValue = unified.constructionCadastralValue;

  // Add historical improvements with new-store fallback
  let historicalImprovements = 0;
  let allImprovements: PropertyImprovement[] = [];

  try {
    const mejorasNuevo = await db.getAllFromIndex('mejorasActivo', 'inmuebleId', propertyId) as any[];
    // Only 'mejora' and 'ampliacion' increase amortization base; 'reparacion' goes to box 0106
    const mejorasCapitalizables = mejorasNuevo.filter((m: any) => m?.tipo !== 'reparacion');
    historicalImprovements = mejorasCapitalizables
      .filter((mejora: any) => toNumber(mejora?.ejercicio) <= exerciseYear)
      .reduce((total: number, mejora: any) => total + toNumber(mejora?.importe), 0);

    allImprovements = mejorasCapitalizables
      .map((mejora: any) => ({
        propertyId,
        year: toNumber(mejora?.ejercicio),
        amount: toNumber(mejora?.importe),
        date: mejora?.fecha,
        daysInYear: toNumber(mejora?.diasEnEjercicio) || undefined,
        counterpartyNIF: mejora?.proveedorNIF,
        description: mejora?.descripcion ?? 'Mejora',
        createdAt: mejora?.createdAt ?? '',
        updatedAt: mejora?.updatedAt ?? '',
      }))
      .filter((mejora) => mejora.year > 0 && mejora.amount > 0);
  } catch {
    try {
      allImprovements = await db.getAllFromIndex('propertyImprovements', 'propertyId', propertyId);
      historicalImprovements = allImprovements
        .filter(imp => imp.year <= exerciseYear)
        .reduce((total, imp) => total + imp.amount, 0);
    } catch {
      historicalImprovements = 0;
      allImprovements = [];
    }
  }

  // Calculate base amount - Rule: max(construction cost, cadastral construction value)
  const baseConstructionCost = constructionCost + historicalImprovements;
  const cadastralBase = cadastralConstructionValue + historicalImprovements;
  const baseAmount = Math.max(baseConstructionCost, cadastralBase);
  
  const selectedBase = baseConstructionCost >= cadastralBase ? 'construction-cost' : 'cadastral-value';

  // Check for special cases
  if (property.aeatAmortization?.specialCase) {
    const specialCase = property.aeatAmortization.specialCase;
    calculationMethod = 'special';
    
    switch (specialCase.type) {
      case 'usufructo-temporal':
        if (specialCase.usufructoDuration) {
          percentageApplied = 1 / specialCase.usufructoDuration;
          specialCaseJustification = `Usufructo temporal (${specialCase.usufructoDuration} años): coste/duración`;
        }
        break;
        
      case 'usufructo-vitalicio':
        percentageApplied = 0.03;
        specialCaseJustification = 'Usufructo vitalicio: 3% del coste';
        break;
        
      case 'parcial-alquiler':
        if (specialCase.rentedPercentage) {
          percentageApplied = 0.03 * (specialCase.rentedPercentage / 100);
          specialCaseJustification = `Alquiler parcial (${specialCase.rentedPercentage}%): 3% sobre proporción alquilada`;
        }
        break;
        
      case 'sin-valor-catastral':
        const landPercentage = specialCase.estimatedLandPercentage || 10;
        const constructionPercentage = 100 - landPercentage;
        percentageApplied = 0.03;
        specialCaseJustification = `Sin valor catastral: 3% sobre construcción estimada (${constructionPercentage}% del coste)`;
        break;
        
      case 'porcentaje-menor':
        if (specialCase.customPercentage) {
          percentageApplied = specialCase.customPercentage / 100;
          specialCaseJustification = `Porcentaje voluntario: ${specialCase.customPercentage}%`;
        }
        break;
    }
  }

  // Calculate property amortization with day proration
  const dailyAmortization = (baseAmount * percentageApplied) / daysAvailable;
  const propertyAmortization = dailyAmortization * daysRented;

  // Calculate improvements amortization for current year
  const currentYearImprovements = (await getMejorasHastaEjercicio(propertyId, exerciseYear))
    .filter((improvement) => improvement.ejercicio === exerciseYear);
  let improvementsAmortization = 0;

  for (const improvement of currentYearImprovements) {
    const improvementDays = improvement.diasEnEjercicio
      || (improvement.fecha ? Math.max(1, Math.ceil((new Date(exerciseYear, 11, 31).getTime() - new Date(improvement.fecha).getTime()) / (1000 * 60 * 60 * 24)) + 1) : daysAvailable);
    const improvementDailyAmortization = (improvement.importe * percentageApplied) / daysAvailable;
    improvementsAmortization += improvementDailyAmortization * improvementDays;
  }

  // Furniture amortization (separate calculation at 10% annual)
  let furnitureAmortization = 0;
  try {
    const { calcularAmortizacionMobiliarioAnual } = await import('./mobiliarioActivoService');
    furnitureAmortization = await calcularAmortizacionMobiliarioAnual(
      propertyId,
      exerciseYear,
      daysRented,
      daysAvailable,
    );
  } catch {
    furnitureAmortization = 0;
  }

  const totalAmortization = propertyAmortization + improvementsAmortization + furnitureAmortization;

  // Calculate accumulated amounts for future sales tracking
  const accumulatedStandard = baseAmount * 0.03; // Always track 3% for future sales
  const accumulatedActual = totalAmortization;

  return {
    calculationMethod,
    baseAmount,
    percentageApplied,
    daysRented,
    daysAvailable,
    propertyAmortization,
    improvementsAmortization,
    furnitureAmortization,
    totalAmortization,
    accumulatedStandard,
    accumulatedActual,
    specialCaseJustification,
    breakdown: {
      constructionCost: baseConstructionCost,
      cadastralConstructionValue,
      historicalImprovements,
      selectedBase
    }
  };
};

/**
 * Get rental days for a property in a given year from contracts
 */
export const getRentalDaysForYear = async (
  propertyId: number,
  exerciseYear: number
): Promise<number> => {
  const db = await initDB();
  
  // Prefer explicit occupancy settings from propertyDays when available
  const propertyDays = await db.getAllFromIndex('propertyDays', 'property-year', [propertyId, exerciseYear]);
  const occupancy = propertyDays?.[0] as any;
  if (occupancy && typeof occupancy.daysRented === 'number') {
    return Math.max(0, occupancy.daysRented);
  }

  // Fallback: derive from active contracts
  const allContracts = await db.getAllFromIndex('contracts', 'propertyId', propertyId);
  const activeContracts = allContracts.filter(contract => {
    const startYear = new Date(contract.startDate).getFullYear();
    const endYear = contract.endDate ? new Date(contract.endDate).getFullYear() : 9999;
    return startYear <= exerciseYear && endYear >= exerciseYear;
  });

  if (activeContracts.length === 0) {
    return 0;
  }

  // Calculate days for each contract and take the maximum
  // (assuming property is fully rented when any contract is active)
  let maxDays = 0;
  
  for (const contract of activeContracts) {
    const yearStart = new Date(exerciseYear, 0, 1);
    const yearEnd = new Date(exerciseYear, 11, 31);
    
    const contractStart = new Date(contract.startDate);
    const contractEnd = contract.endDate ? new Date(contract.endDate) : yearEnd;
    
    const effectiveStart = contractStart > yearStart ? contractStart : yearStart;
    const effectiveEnd = contractEnd < yearEnd ? contractEnd : yearEnd;
    
    if (effectiveStart <= effectiveEnd) {
      const days = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      maxDays = Math.max(maxDays, days);
    }
  }

  return maxDays;
};

/**
 * Update fiscal summary with AEAT amortization calculation
 */
export const updateFiscalSummaryWithAEAT = async (
  propertyId: number,
  exerciseYear: number
): Promise<FiscalSummary> => {
  const db = await initDB();
  
  // Get rental days
  const daysRented = await getRentalDaysForYear(propertyId, exerciseYear);
  
  // Calculate AEAT amortization
  const aeatCalc = await calculateAEATAmortization(propertyId, exerciseYear, daysRented);
  
  // Get existing fiscal summary
  const existingSummaries = await db.getAllFromIndex('fiscalSummaries', 'property-year', [propertyId, exerciseYear]);
  
  let fiscalSummary: FiscalSummary;
  
  if (existingSummaries.length > 0) {
    fiscalSummary = existingSummaries[0];
  } else {
    // Create new fiscal summary
    fiscalSummary = {
      propertyId,
      exerciseYear,
      box0105: 0,
      box0106: 0,
      box0109: 0,
      box0112: 0,
      box0113: 0,
      box0114: 0,
      box0115: 0,
      box0117: 0,
      capexTotal: 0,
      constructionValue: aeatCalc.baseAmount,
      annualDepreciation: aeatCalc.totalAmortization,
      status: exerciseYear < new Date().getFullYear() ? 'Prescrito' : 'Vivo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Update with AEAT calculation
  fiscalSummary.annualDepreciation = aeatCalc.totalAmortization;
  fiscalSummary.constructionValue = aeatCalc.baseAmount;
  fiscalSummary.aeatAmortization = {
    daysRented: aeatCalc.daysRented,
    daysAvailable: aeatCalc.daysAvailable,
    calculationMethod: aeatCalc.calculationMethod,
    baseAmount: aeatCalc.baseAmount,
    percentageApplied: aeatCalc.percentageApplied,
    propertyAmortization: aeatCalc.propertyAmortization,
    improvementsAmortization: aeatCalc.improvementsAmortization,
    furnitureAmortization: aeatCalc.furnitureAmortization,
    totalAmortization: aeatCalc.totalAmortization,
    specialCaseJustification: aeatCalc.specialCaseJustification,
    accumulatedStandard: aeatCalc.accumulatedStandard,
    accumulatedActual: aeatCalc.accumulatedActual
  };
  fiscalSummary.updatedAt = new Date().toISOString();

  // Save the updated summary
  if (fiscalSummary.id) {
    await db.put('fiscalSummaries', fiscalSummary);
  } else {
    const id = await db.add('fiscalSummaries', fiscalSummary) as number;
    fiscalSummary.id = id;
  }

  return fiscalSummary;
};

/**
 * Add a property improvement
 */
export const addPropertyImprovement = async (
  improvement: Omit<PropertyImprovement, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PropertyImprovement> => {
  const mejora = await crearMejora({
    inmuebleId: improvement.propertyId,
    ejercicio: improvement.year,
    fecha: improvement.date,
    descripcion: improvement.description,
    tipo: 'mejora',
    importe: improvement.amount,
    diasEnEjercicio: improvement.daysInYear,
    proveedorNIF: improvement.counterpartyNIF || 'PENDIENTE',
  });

  return {
    id: mejora.id,
    propertyId: mejora.inmuebleId,
    year: mejora.ejercicio,
    amount: mejora.importe,
    date: mejora.fecha,
    daysInYear: mejora.diasEnEjercicio,
    counterpartyNIF: mejora.proveedorNIF,
    description: mejora.descripcion,
    createdAt: mejora.createdAt,
    updatedAt: mejora.updatedAt,
  };
};

/**
 * Get all improvements for a property
 */
export const getPropertyImprovements = async (propertyId: number): Promise<PropertyImprovement[]> => {
  const mejoras = await getMejorasHastaEjercicio(propertyId, Number.MAX_SAFE_INTEGER);
  return mejoras.map((mejora) => ({
    id: mejora.id,
    propertyId: mejora.inmuebleId,
    year: mejora.ejercicio,
    amount: mejora.importe,
    date: mejora.fecha,
    daysInYear: mejora.diasEnEjercicio,
    counterpartyNIF: mejora.proveedorNIF,
    description: mejora.descripcion,
    createdAt: mejora.createdAt,
    updatedAt: mejora.updatedAt,
  }));
};

/**
 * Delete a property improvement
 */
export const deletePropertyImprovement = async (improvementId: number): Promise<void> => {
  await eliminarMejora(improvementId);
};

export const updateImprovement = async (
  propertyId: string,
  improvementId: string,
  data: ImprovementUpdatePayload
): Promise<void> => {
  const parsedPropertyId = Number(propertyId);
  const parsedImprovementId = Number(improvementId);

  if (!Number.isFinite(parsedPropertyId) || !Number.isFinite(parsedImprovementId)) {
    throw new Error('Identificadores de mejora inválidos');
  }

  const mejoras = await getMejorasHastaEjercicio(parsedPropertyId, Number.MAX_SAFE_INTEGER);
  const existing = mejoras.find((mejora) => mejora.id === parsedImprovementId && mejora.inmuebleId === parsedPropertyId);
  if (!existing) {
    throw new Error('Mejora no encontrada para el inmueble indicado');
  }

  await actualizarMejora(parsedImprovementId, {
    ejercicio: data.year,
    importe: data.amount,
    fecha: data.date,
    diasEnEjercicio: data.daysInYear,
    proveedorNIF: data.counterpartyNIF || existing.proveedorNIF,
    descripcion: data.description,
  });
};

// Helper function
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Format currency in Spanish locale
 */
export const formatEsCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format percentage in Spanish locale
 */
export const formatEsPercentage = (percentage: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(percentage);
};
