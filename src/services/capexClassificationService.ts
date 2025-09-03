import { initDB, CAPEX, CAPEXTipo, Document } from './db';
import toast from 'react-hot-toast';

/**
 * Enhanced CAPEX Classification Service
 * Handles classification between repairs, improvements, and furniture with proper amortization
 */

export type CAPEXNature = CAPEXTipo; // Use the existing database type

export interface CAPEXClassification {
  nature: CAPEXNature;
  description: string;
  amortizationYears: number;
  isDeductibleThisYear: boolean;
  affectsPropertyValue: boolean;
}

/**
 * Classification rules for CAPEX
 */
export const CAPEX_CLASSIFICATION_RULES: Record<CAPEXNature, CAPEXClassification> = {
  reparacion: {
    nature: 'reparacion',
    description: 'Reparación y conservación - Gasto del año',
    amortizationYears: 1, // Deducible immediately
    isDeductibleThisYear: true,
    affectsPropertyValue: false
  },
  mejora: {
    nature: 'mejora',
    description: 'Mejora - Aumenta base amortizable del inmueble',
    amortizationYears: 15, // Same as property amortization
    isDeductibleThisYear: false,
    affectsPropertyValue: true
  },
  ampliacion: {
    nature: 'ampliacion',
    description: 'Ampliación - Aumenta base amortizable del inmueble',
    amortizationYears: 15, // Same as property amortization
    isDeductibleThisYear: false,
    affectsPropertyValue: true
  },
  mobiliario: {
    nature: 'mobiliario',
    description: 'Mobiliario - Amortización lineal 10 años',
    amortizationYears: 10,
    isDeductibleThisYear: false,
    affectsPropertyValue: false
  }
};

/**
 * Classify CAPEX based on description and amount
 */
export const classifyCAPEX = (
  description: string,
  amount: number,
  existingClassification?: CAPEXNature
): CAPEXNature => {
  if (existingClassification) {
    return existingClassification;
  }

  const descLower = description.toLowerCase();

  // Furniture keywords
  const furnitureKeywords = [
    'mueble', 'mobiliario', 'silla', 'mesa', 'cama', 'armario', 'sofá',
    'electrodoméstico', 'nevera', 'lavadora', 'televisión', 'tv',
    'colchón', 'decoración', 'lámpara', 'estantería'
  ];

  // Repair keywords  
  const repairKeywords = [
    'reparación', 'reparar', 'arreglo', 'arreglar', 'mantenimiento',
    'pintura', 'pintar', 'limpieza', 'limpiar', 'revisar', 'revisión',
    'cambio bombilla', 'bombilla', 'grifo', 'persiana', 'cerradura',
    'mantenimiento', 'conservación'
  ];

  // Improvement keywords
  const improvementKeywords = [
    'reforma', 'reformar', 'ampliación', 'ampliar', 'construcción',
    'baño nuevo', 'cocina nueva', 'instalación', 'instalar',
    'aire acondicionado', 'calefacción', 'tarima', 'parquet',
    'azulejo', 'alicatar', 'fontanería nueva', 'electricidad nueva',
    'ventana nueva', 'puerta nueva'
  ];

  // Check furniture first
  if (furnitureKeywords.some(keyword => descLower.includes(keyword))) {
    return 'mobiliario';
  }

  // Check repairs
  if (repairKeywords.some(keyword => descLower.includes(keyword))) {
    return 'reparacion';
  }

  // Check improvements (including ampliacion)
  if (improvementKeywords.some(keyword => descLower.includes(keyword))) {
    return 'mejora';
  }

  // Default based on amount - higher amounts more likely to be improvements
  if (amount > 5000) {
    return 'mejora';
  } else if (amount > 1000) {
    return 'mobiliario';
  } else {
    return 'reparacion';
  }
};

/**
 * Calculate amortization for CAPEX based on its nature
 */
export const calculateCAPEXAmortization = (
  capex: CAPEX,
  exerciseYear: number
): {
  annualAmortization: number;
  remainingYears: number;
  totalAmortized: number;
  remainingValue: number;
} => {
  const classification = CAPEX_CLASSIFICATION_RULES[capex.tipo as CAPEXNature] || 
                        CAPEX_CLASSIFICATION_RULES.mejora;

  const capexYear = new Date(capex.fecha_emision).getFullYear();
  const yearsSinceAcquisition = exerciseYear - capexYear;

  if (yearsSinceAcquisition < 0) {
    // Future CAPEX
    return {
      annualAmortization: 0,
      remainingYears: classification.amortizationYears,
      totalAmortized: 0,
      remainingValue: capex.total
    };
  }

  if (classification.isDeductibleThisYear) {
    // Repairs are fully deductible in the year they occur
    return {
      annualAmortization: yearsSinceAcquisition === 0 ? capex.total : 0,
      remainingYears: 0,
      totalAmortized: capex.total,
      remainingValue: 0
    };
  }

  // Linear amortization for improvements and furniture
  const annualAmortization = capex.total / classification.amortizationYears;
  const totalAmortized = Math.min(
    capex.total,
    annualAmortization * (yearsSinceAcquisition + 1)
  );
  const remainingValue = capex.total - totalAmortized;
  const remainingYears = Math.max(
    0,
    classification.amortizationYears - yearsSinceAcquisition - 1
  );

  return {
    annualAmortization: remainingYears > 0 ? annualAmortization : 0,
    remainingYears,
    totalAmortized,
    remainingValue
  };
};

/**
 * Get amortization summary for all CAPEX of a property
 */
export const getCAPEXAmortizationSummary = async (
  propertyId: number,
  exerciseYear: number
): Promise<{
  propertyAmortization: number;
  improvementAmortization: number;
  furnitureAmortization: number;
  repairExpenses: number;
  totalAmortization: number;
  details: Array<{
    capex: CAPEX;
    classification: CAPEXClassification;
    amortization: ReturnType<typeof calculateCAPEXAmortization>;
  }>;
}> => {
  const db = await initDB();
  
  // Get all CAPEX for this property
  const allCAPEX = await db.getAll('capex');
  const propertyCAPEX = allCAPEX.filter(c => c.inmueble_id === propertyId);

  const summary = {
    propertyAmortization: 0,
    improvementAmortization: 0,
    furnitureAmortization: 0,
    repairExpenses: 0,
    totalAmortization: 0,
    details: [] as any[]
  };

  for (const capex of propertyCAPEX) {
    const nature = capex.tipo as CAPEXNature;
    const classification = CAPEX_CLASSIFICATION_RULES[nature] || CAPEX_CLASSIFICATION_RULES.mejora;
    const amortization = calculateCAPEXAmortization(capex, exerciseYear);

    summary.details.push({
      capex,
      classification,
      amortization
    });

    // Accumulate by type
    switch (nature) {
      case 'reparacion':
        summary.repairExpenses += amortization.annualAmortization;
        break;
      case 'mejora':
      case 'ampliacion':
        summary.improvementAmortization += amortization.annualAmortization;
        break;
      case 'mobiliario':
        summary.furnitureAmortization += amortization.annualAmortization;
        break;
    }
  }

  // Property base amortization (separate from improvements)
  const property = await db.get('properties', propertyId);
  if (property?.aeatAmortization?.propertyAmortization) {
    summary.propertyAmortization = property.aeatAmortization.propertyAmortization;
  }

  summary.totalAmortization = summary.propertyAmortization + 
                             summary.improvementAmortization + 
                             summary.furnitureAmortization;

  return summary;
};

/**
 * Create CAPEX from document with enhanced classification
 */
export const createCAPEXFromDocument = async (
  document: Document,
  nature?: CAPEXNature
): Promise<number> => {
  const db = await initDB();

  if (!document.metadata.entityId || document.metadata.entityType !== 'property') {
    throw new Error('Document must be assigned to a property');
  }

  const { financialData, proveedor } = document.metadata;
  if (!financialData?.amount) {
    throw new Error('Document must have financial data');
  }

  // Classify the CAPEX
  const classification = nature || classifyCAPEX(
    document.metadata.title || document.filename,
    financialData.amount
  );

  const capexClassification = CAPEX_CLASSIFICATION_RULES[classification];

  const capex: Omit<CAPEX, 'id'> = {
    inmueble_id: document.metadata.entityId,
    proveedor: proveedor || 'Proveedor no identificado',
    fecha_emision: financialData.issueDate || new Date().toISOString().split('T')[0],
    total: financialData.amount,
    tipo: classification,
    anos_amortizacion: capexClassification.amortizationYears,
    estado: 'completo',
    source_doc_id: document.id!,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const capexId = await db.add('capex', capex);
  
  toast.success(
    `CAPEX creado como ${capexClassification.description.toLowerCase()}`
  );

  return capexId as number;
};

/**
 * Update CAPEX classification
 */
export const updateCAPEXClassification = async (
  capexId: number,
  newNature: CAPEXNature
): Promise<void> => {
  const db = await initDB();

  const capex = await db.get('capex', capexId);
  if (!capex) {
    throw new Error(`CAPEX ${capexId} not found`);
  }

  const newClassification = CAPEX_CLASSIFICATION_RULES[newNature];
  
  capex.tipo = newNature;
  capex.anos_amortizacion = newClassification.amortizationYears;
  capex.updatedAt = new Date().toISOString();

  await db.put('capex', capex);

  toast.success(`CAPEX reclasificado como ${newClassification.description.toLowerCase()}`);
};

/**
 * Get CAPEX classification breakdown for export
 */
export const getCAPEXClassificationBreakdown = async (
  propertyId: number,
  exerciseYear: number
): Promise<{
  repairs: CAPEX[];
  improvements: CAPEX[];
  furniture: CAPEX[];
  totalByType: {
    repairs: number;
    improvements: number;
    furniture: number;
  };
}> => {
  const db = await initDB();
  
  const allCAPEX = await db.getAll('capex');
  const propertyCAPEX = allCAPEX.filter(c => c.inmueble_id === propertyId);

  const breakdown = {
    repairs: [] as CAPEX[],
    improvements: [] as CAPEX[],
    furniture: [] as CAPEX[],
    totalByType: {
      repairs: 0,
      improvements: 0,
      furniture: 0
    }
  };

  for (const capex of propertyCAPEX) {
    switch (capex.tipo as CAPEXNature) {
      case 'reparacion':
        breakdown.repairs.push(capex);
        breakdown.totalByType.repairs += capex.total;
        break;
      case 'mejora':
      case 'ampliacion':
        breakdown.improvements.push(capex);
        breakdown.totalByType.improvements += capex.total;
        break;
      case 'mobiliario':
        breakdown.furniture.push(capex);
        breakdown.totalByType.furniture += capex.total;
        break;
    }
  }

  return breakdown;
};