// H9-FISCAL: AEAT Amortization Service
import { initDB, PropertyImprovement, FiscalSummary } from './db';

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

  const daysAvailable = isLeapYear(exerciseYear) ? 366 : 365;
  
  // Default calculation - general rule
  let calculationMethod: 'general' | 'special' = 'general';
  let percentageApplied = 0.03; // 3% default
  let specialCaseJustification: string | undefined;

  // Calculate construction cost (oneroso acquisition)
  let constructionCost = 0;
  if (property.aeatAmortization?.acquisitionType === 'onerosa' || 
      property.aeatAmortization?.acquisitionType === 'mixta') {
    const oneroso = property.aeatAmortization.onerosoAcquisition;
    if (oneroso) {
      const totalCost = oneroso.acquisitionAmount + oneroso.acquisitionExpenses;
      constructionCost = totalCost * (property.aeatAmortization.constructionPercentage / 100);
    }
  }

  // Get cadastral construction value
  const cadastralConstructionValue = property.aeatAmortization?.constructionCadastralValue || 0;

  // Add historical improvements
  const allImprovements = await db.getAllFromIndex('propertyImprovements', 'propertyId', propertyId);
  const historicalImprovements = allImprovements
    .filter(imp => imp.year <= exerciseYear)
    .reduce((total, imp) => total + imp.amount, 0);

  // Calculate base amount - Rule: max(construction cost, cadastral construction value)
  const baseConstructionCost = constructionCost + historicalImprovements;
  const baseAmount = Math.max(baseConstructionCost, cadastralConstructionValue + historicalImprovements);
  
  const selectedBase = baseConstructionCost >= cadastralConstructionValue ? 'construction-cost' : 'cadastral-value';

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
  const currentYearImprovements = allImprovements.filter(imp => imp.year === exerciseYear);
  let improvementsAmortization = 0;
  
  for (const improvement of currentYearImprovements) {
    const improvementDays = improvement.daysInYear || daysAvailable;
    const improvementDailyAmortization = (improvement.amount * percentageApplied) / daysAvailable;
    improvementsAmortization += improvementDailyAmortization * improvementDays;
  }

  // Furniture amortization (separate calculation at 10% annual)
  const furnitureAmortization = 0; // TODO: Implement when furniture CAPEX is tracked

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
  
  // Get all active contracts for this property
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
  const db = await initDB();
  
  const newImprovement: Omit<PropertyImprovement, 'id'> = {
    ...improvement,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const id = await db.add('propertyImprovements', newImprovement) as number;
  return { ...newImprovement, id };
};

/**
 * Get all improvements for a property
 */
export const getPropertyImprovements = async (propertyId: number): Promise<PropertyImprovement[]> => {
  const db = await initDB();
  return await db.getAllFromIndex('propertyImprovements', 'propertyId', propertyId);
};

/**
 * Delete a property improvement
 */
export const deletePropertyImprovement = async (improvementId: number): Promise<void> => {
  const db = await initDB();
  await db.delete('propertyImprovements', improvementId);
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