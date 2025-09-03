import { initDB, FiscalSummary, Document } from './db';
import { AEAT_CLASSIFICATION_MAP, getExerciseStatus, isCapexType } from './aeatClassificationService';
import { updateFiscalSummaryWithAEAT } from './aeatAmortizationService';

/**
 * Calculate or update fiscal summary for a property and year
 */
export const calculateFiscalSummary = async (
  propertyId: number, 
  exerciseYear: number
): Promise<FiscalSummary> => {
  const db = await initDB();
  
  // Get all documents for this property and year
  const allDocuments = await db.getAll('documents');
  const propertyDocuments = allDocuments.filter(doc => 
    doc.metadata.entityType === 'property' &&
    doc.metadata.entityId === propertyId &&
    doc.metadata.aeatClassification?.exerciseYear === exerciseYear &&
    doc.metadata.status === 'Asignado' &&
    doc.metadata.financialData?.amount
  );

  // Initialize totals
  const summary: Omit<FiscalSummary, 'id'> = {
    propertyId,
    exerciseYear,
    box0105: 0, // Interests/financing
    box0106: 0, // R&C
    box0109: 0, // Community
    box0112: 0, // Personal services
    box0113: 0, // Utilities
    box0114: 0, // Insurance
    box0115: 0, // Local taxes
    box0117: 0, // Furniture amortization
    capexTotal: 0, // CAPEX total (increases construction value)
    deductibleExcess: 0,
    constructionValue: 0,
    annualDepreciation: 0,
    status: getExerciseStatus(exerciseYear),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Aggregate by AEAT box
  for (const doc of propertyDocuments) {
    const { aeatClassification, financialData } = doc.metadata;
    if (!aeatClassification?.fiscalType || !financialData?.amount) continue;

    const amount = financialData.amount;

    if (isCapexType(aeatClassification.fiscalType)) {
      summary.capexTotal += amount;
    } else {
      const box = AEAT_CLASSIFICATION_MAP[aeatClassification.fiscalType as keyof typeof AEAT_CLASSIFICATION_MAP];
      switch (box) {
        case '0105': summary.box0105 += amount; break;
        case '0106': summary.box0106 += amount; break;
        case '0109': summary.box0109 += amount; break;
        case '0112': summary.box0112 += amount; break;
        case '0113': summary.box0113 += amount; break;
        case '0114': summary.box0114 += amount; break;
        case '0115': summary.box0115 += amount; break;
        case '0117': summary.box0117 += amount; break;
      }
    }
  }

  // Get property to calculate construction value and depreciation using AEAT rules
  const property = await db.get('properties', propertyId);
  if (property && property.aeatAmortization) {
    // Use AEAT amortization calculation
    const updatedSummary = await updateFiscalSummaryWithAEAT(propertyId, exerciseYear);
    // Merge with our calculated summary, preserving AEAT calculations
    summary.constructionValue = updatedSummary.constructionValue;
    summary.annualDepreciation = updatedSummary.annualDepreciation;
    summary.aeatAmortization = updatedSummary.aeatAmortization;
  } else if (property) {
    // Fallback to legacy calculation for properties without AEAT data
    const baseConstructionValue = property.fiscalData?.constructionCadastralValue || 
                                 (property.acquisitionCosts.price * 0.7); // 70% estimate if no cadastral value

    // Add CAPEX from all previous years including current
    const allSummaries = await db.getAllFromIndex('fiscalSummaries', 'propertyId', propertyId);
    const historicalCapex = allSummaries
      .filter(s => s.exerciseYear <= exerciseYear)
      .reduce((total, s) => total + s.capexTotal, 0);

    summary.constructionValue = baseConstructionValue + historicalCapex;
    summary.annualDepreciation = summary.constructionValue * 0.03; // 3% annual depreciation
  }

  // Calculate deductible excess (if 0105 + 0106 exceed rental income)
  // Note: This would need rental income data to be complete
  // For now, mark excess if 0105 + 0106 > 0 (placeholder logic)
  const financingAndRepairs = summary.box0105 + summary.box0106;
  if (financingAndRepairs > 0) {
    // TODO: Compare against actual rental income for this property/year
    // For now, assume excess if over a threshold
    summary.deductibleExcess = financingAndRepairs; // Placeholder
  }

  // Save or update the summary
  const existingIndex = await db.getAllFromIndex('fiscalSummaries', 'property-year', [propertyId, exerciseYear]);
  if (existingIndex.length > 0) {
    const existing = existingIndex[0];
    const updated = { ...summary, id: existing.id, createdAt: existing.createdAt };
    await db.put('fiscalSummaries', updated);
    return updated;
  } else {
    const id = await db.add('fiscalSummaries', summary) as number;
    return { ...summary, id };
  }
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
  
  return await calculateFiscalSummary(propertyId, exerciseYear);
};

/**
 * Refresh fiscal summaries when documents are updated
 */
export const refreshFiscalSummariesForDocument = async (document: Document): Promise<void> => {
  if (document.metadata.entityType !== 'property' || 
      !document.metadata.entityId ||
      !document.metadata.aeatClassification?.exerciseYear) {
    return;
  }

  await calculateFiscalSummary(
    document.metadata.entityId,
    document.metadata.aeatClassification.exerciseYear
  );
};

/**
 * Get all fiscal summaries for a property
 */
export const getPropertyFiscalSummaries = async (propertyId: number): Promise<FiscalSummary[]> => {
  const db = await initDB();
  return await db.getAllFromIndex('fiscalSummaries', 'propertyId', propertyId);
};

/**
 * Get fiscal summaries for all properties in a year
 */
export const getYearFiscalSummaries = async (exerciseYear: number): Promise<FiscalSummary[]> => {
  const db = await initDB();
  return await db.getAllFromIndex('fiscalSummaries', 'exerciseYear', exerciseYear);
};

/**
 * Export fiscal data for a property and year
 */
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
  
  // Get all documents for this property/year
  const allDocuments = await db.getAll('documents');
  const documents = allDocuments.filter(doc => 
    doc.metadata.entityType === 'property' &&
    doc.metadata.entityId === propertyId &&
    doc.metadata.aeatClassification?.exerciseYear === exerciseYear &&
    doc.metadata.status === 'Asignado'
  );

  // Generate CSV data
  const csvHeaders = [
    'Fecha',
    'Proveedor', 
    'Concepto',
    'Importe',
    'Casilla AEAT',
    'Tipo Fiscal',
    'Número Factura',
    'Archivo'
  ];

  const csvRows = documents.map(doc => [
    doc.metadata.financialData?.issueDate || '',
    doc.metadata.proveedor || '',
    doc.metadata.title || doc.filename,
    doc.metadata.financialData?.amount?.toString() || '0',
    doc.metadata.aeatClassification?.box || '',
    doc.metadata.aeatClassification?.fiscalType || '',
    doc.metadata.financialData?.invoiceNumber || '',
    doc.filename
  ]);

  const csvData = [csvHeaders, ...csvRows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return { summary, documents, csvData };
};

/**
 * Calculate carryforward amounts for deductible excess
 */
export const calculateCarryForwards = async (
  propertyId: number
): Promise<Array<{
  exerciseYear: number;
  excessAmount: number;
  remainingAmount: number;
  expirationYear: number;
}>> => {
  const summaries = await getPropertyFiscalSummaries(propertyId);
  const currentYear = new Date().getFullYear();
  
  // Get summaries with deductible excess from last 4 years
  const excessSummaries = summaries
    .filter(s => s.deductibleExcess && s.deductibleExcess > 0 && s.exerciseYear >= currentYear - 4)
    .sort((a, b) => a.exerciseYear - b.exerciseYear);

  return excessSummaries.map(summary => ({
    exerciseYear: summary.exerciseYear,
    excessAmount: summary.deductibleExcess || 0,
    remainingAmount: summary.deductibleExcess || 0, // TODO: Calculate actual remaining after applying to future income
    expirationYear: summary.exerciseYear + 4
  }));
};