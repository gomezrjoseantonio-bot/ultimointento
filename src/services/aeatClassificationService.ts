import { AEATFiscalType, AEATBox } from './db';

// AEAT fiscal classification mapping
export const AEAT_CLASSIFICATION_MAP: Record<AEATFiscalType, AEATBox> = {
  'financiacion': '0105',
  'reparacion-conservacion': '0106', 
  'comunidad': '0109',
  'servicios-personales': '0112',
  'suministros': '0113',
  'seguros': '0114',
  'tributos-locales': '0115',
  'amortizacion-muebles': '0117',
  'capex-mejora-ampliacion': '0106' // CAPEX doesn't go to expense boxes, handled separately
};

// Category mapping to AEAT classification
export const CATEGORY_TO_AEAT: Record<string, AEATFiscalType> = {
  'Intereses y financiación': 'financiacion',
  'Reparación y conservación': 'reparacion-conservacion',
  'Comunidad': 'comunidad',
  'Servicios de terceros': 'servicios-personales',
  'Suministros': 'suministros',
  'Seguros': 'seguros',
  'Tributos locales': 'tributos-locales',
  'Amortización de muebles': 'amortizacion-muebles',
  'Mejora (CAPEX)': 'capex-mejora-ampliacion'
};

// Provider-based classification hints
export const PROVIDER_CLASSIFICATION_HINTS: Record<string, AEATFiscalType> = {
  // Utilities
  'IBERDROLA': 'suministros',
  'ENDESA': 'suministros', 
  'NATURGY': 'suministros',
  'REPSOL': 'suministros',
  'WEKIWI': 'suministros',
  'AQUALIA': 'suministros',
  'CANAL ISABEL II': 'suministros',
  
  // Insurance
  'MAPFRE': 'seguros',
  'ZURICH': 'seguros',
  'AXA': 'seguros',
  'ALLIANZ': 'seguros',
  
  // Banking/Financing
  'BBVA': 'financiacion',
  'SANTANDER': 'financiacion',
  'CAIXABANK': 'financiacion',
  'BANKINTER': 'financiacion',
  'ING': 'financiacion',
  
  // Local taxes
  'AYUNTAMIENTO': 'tributos-locales',
  'DIPUTACION': 'tributos-locales',
  'SUMA GESTIÓN TRIBUTARIA': 'tributos-locales'
};

/**
 * Suggest AEAT classification based on provider and amount
 */
export const suggestAEATClassification = (
  provider: string, 
  amount: number,
  description?: string
): { fiscalType: AEATFiscalType; box: AEATBox; confidence: number } => {
  const upperProvider = provider.toUpperCase();
  const upperDescription = description?.toUpperCase() || '';
  
  // Check provider hints first
  for (const [key, fiscalType] of Object.entries(PROVIDER_CLASSIFICATION_HINTS)) {
    if (upperProvider.includes(key)) {
      return {
        fiscalType,
        box: AEAT_CLASSIFICATION_MAP[fiscalType],
        confidence: 0.9
      };
    }
  }
  
  // Check description for keywords
  if (upperDescription.includes('COMUNIDAD') || upperDescription.includes('COMMUNITY')) {
    return { fiscalType: 'comunidad', box: '0109', confidence: 0.8 };
  }
  
  if (upperDescription.includes('SEGURO') || upperDescription.includes('INSURANCE')) {
    return { fiscalType: 'seguros', box: '0114', confidence: 0.8 };
  }
  
  if (upperDescription.includes('IBI') || upperDescription.includes('BASURA') || upperDescription.includes('WASTE')) {
    return { fiscalType: 'tributos-locales', box: '0115', confidence: 0.8 };
  }
  
  // CAPEX heuristic based on amount threshold
  if (amount > 1000) {
    return { fiscalType: 'capex-mejora-ampliacion', box: '0106', confidence: 0.3 };
  }
  
  // Default to repair & conservation with low confidence
  return { fiscalType: 'reparacion-conservacion', box: '0106', confidence: 0.3 };
};

/**
 * Determine if exercise year is "Vivo" (active for deduction) or "Prescrito" (historical)
 */
export const getExerciseStatus = (exerciseYear: number): 'Vivo' | 'Prescrito' => {
  const currentYear = new Date().getFullYear();
  // Last 4 fiscal years are "Vivo" (deductible)
  return (currentYear - exerciseYear) <= 4 ? 'Vivo' : 'Prescrito';
};

/**
 * Extract exercise year from document date or period
 */
export const extractExerciseYear = (
  issueDate?: string,
  servicePeriodTo?: string
): number => {
  // Use service period end date if available, otherwise issue date
  const dateStr = servicePeriodTo || issueDate;
  if (dateStr) {
    const date = new Date(dateStr);
    return date.getFullYear();
  }
  return new Date().getFullYear();
};

/**
 * Format euro amounts in Spanish locale
 */
export const formatEuro = (amount: number): string => {
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
export const formatPercentage = (value: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
};

/**
 * Get AEAT box display name
 */
export const getAEATBoxDisplayName = (box: AEATBox): string => {
  const names: Record<AEATBox, string> = {
    '0105': 'Intereses financiación',
    '0106': 'Reparación/conservación', 
    '0109': 'Comunidad',
    '0112': 'Servicios de terceros',
    '0113': 'Suministros',
    '0114': 'Seguros',
    '0115': 'Tributos locales',
    '0117': 'Amortización muebles'
  };
  return names[box];
};

/**
 * Check if a fiscal type represents CAPEX
 */
export const isCapexType = (fiscalType: AEATFiscalType): boolean => {
  return fiscalType === 'capex-mejora-ampliacion';
};