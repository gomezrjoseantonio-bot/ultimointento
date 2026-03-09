// H-OCR-REFORM: Service for automatic categorization of invoice line items
import { InvoiceCategory } from '../components/InvoiceBreakdownModal';

// Heuristics keywords for automatic categorization
const MEJORA_KEYWORDS = [
  'reforma', 'obra', 'instalación', 'ventanas', 'eficiencia', 'cambio distribución',
  'ampliación', 'rehabilitación', 'modernización', 'renovación', 'mejora',
  'construcción', 'albañilería', 'fontanería nueva', 'electricidad nueva',
  'cocina nueva', 'baño nuevo', 'suelo', 'pavimento', 'calefacción nueva',
  'aire acondicionado', 'aislamiento', 'tejado', 'fachada', 'estructura',
  'cocina' // Kitchen renovations are usually improvements
];

const REPARACION_CONSERVACION_KEYWORDS = [
  'reparación', 'mantenimiento', 'avería', 'pintura', 'desatasco',
  'limpieza', 'revisión', 'sustitución', 'arreglo', 'conservación',
  'mantenimiento preventivo', 'reparar', 'solución', 'problema',
  'goteras', 'humedades', 'grietas', 'desgaste', 'deterioro',
  'servicio técnico', 'mano de obra', 'material consumible'
];

const MOBILIARIO_KEYWORDS = [
  'sofá', 'cama', 'colchón', 'frigorífico', 'lavadora', 'horno', 'mueble', 'lámpara',
  'mesa', 'silla', 'armario', 'estantería', 'televisor', 'microondas',
  'lavavajillas', 'nevera', 'congelador', 'vitrocerámica', 'campana extractora',
  'decoración', 'cortinas', 'alfombra', 'electrodoméstico', 'mobiliario',
  'enseres', 'equipamiento', 'menaje', 'aparatos', 'dispositivos'
];

// Categorization confidence levels
type CategorizationResult = {
  category: InvoiceCategory;
  confidence: number; // 0-1
  matchedKeywords: string[];
};

/**
 * Categorize an OCR line item based on description using heuristics
 */
export const categorizeOCRLineItem = (description: string): InvoiceCategory => {
  const result = categorizeWithConfidence(description);
  return result.category;
};

/**
 * Categorize with confidence and matched keywords for transparency
 */
export const categorizeWithConfidence = (description: string): CategorizationResult => {
  if (!description || description.trim().length === 0) {
    return {
      category: 'reparacion-conservacion',
      confidence: 0,
      matchedKeywords: []
    };
  }

  const lowerDescription = description.toLowerCase();
  
  // Check for Mejora keywords
  const mejoraMatches = MEJORA_KEYWORDS.filter(keyword => 
    lowerDescription.includes(keyword.toLowerCase())
  );
  
  // Check for R&C keywords
  const rcMatches = REPARACION_CONSERVACION_KEYWORDS.filter(keyword => 
    lowerDescription.includes(keyword.toLowerCase())
  );
  
  // Check for Mobiliario keywords
  const mobiliarioMatches = MOBILIARIO_KEYWORDS.filter(keyword => 
    lowerDescription.includes(keyword.toLowerCase())
  );

  // Calculate scores based on number of matches and keyword specificity
  const mejoraScore = calculateScore(mejoraMatches, lowerDescription);
  const rcScore = calculateScore(rcMatches, lowerDescription);
  const mobiliarioScore = calculateScore(mobiliarioMatches, lowerDescription);

  // Determine best match
  if (mejoraScore > rcScore && mejoraScore > mobiliarioScore && mejoraScore > 0.2) {
    return {
      category: 'mejora',
      confidence: mejoraScore,
      matchedKeywords: mejoraMatches
    };
  }
  
  if (mobiliarioScore > rcScore && mobiliarioScore > mejoraScore && mobiliarioScore > 0.2) {
    return {
      category: 'mobiliario',
      confidence: mobiliarioScore,
      matchedKeywords: mobiliarioMatches
    };
  }
  
  if (rcScore > 0.1) {
    return {
      category: 'reparacion-conservacion',
      confidence: rcScore,
      matchedKeywords: rcMatches
    };
  }

  // Default to R&C if no clear match (as per requirements)
  return {
    category: 'reparacion-conservacion',
    confidence: 0.1, // Low confidence default
    matchedKeywords: []
  };
};

/**
 * Calculate score based on keyword matches and context
 */
const calculateScore = (matches: string[], description: string): number => {
  if (matches.length === 0) return 0;
  
  let score = 0;
  
  // Base score from number of matches
  score += matches.length * 0.3;
  
  // Bonus for longer, more specific keywords
  matches.forEach(keyword => {
    if (keyword.length > 10) score += 0.2; // Longer keywords are more specific
    if (keyword.includes(' ')) score += 0.1; // Multi-word keywords are more specific
  });
  
  // Bonus if multiple keywords from same category match
  if (matches.length > 1) score += 0.3;
  
  // Penalize very short descriptions (likely to be ambiguous)
  if (description.length < 10) score *= 0.7;
  
  // Cap at 1.0
  return Math.min(score, 1.0);
};

/**
 * Suggest categorization for multiple line items
 */
export const categorizeMultipleItems = (descriptions: string[]): CategorizationResult[] => {
  return descriptions.map(description => categorizeWithConfidence(description));
};

/**
 * Apply minor amount rule (≤ 300€ → R&C)
 */
export const applyMinorAmountRule = (
  category: InvoiceCategory, 
  amount: number, 
  ruleEnabled: boolean = true
): InvoiceCategory => {
  if (!ruleEnabled) return category;
  
  return amount <= 300 ? 'reparacion-conservacion' : category;
};

/**
 * Get explanation for categorization decision
 */
export const getCategorizationExplanation = (result: CategorizationResult): string => {
  if (result.confidence === 0) {
    return 'Sin palabras clave identificadas. Se asigna R&C por defecto.';
  }
  
  const categoryName = {
    'mejora': 'Mejora',
    'reparacion-conservacion': 'Reparación & Conservación',
    'mobiliario': 'Mobiliario'
  }[result.category];
  
  if (result.matchedKeywords.length > 0) {
    return `Clasificado como ${categoryName} por las palabras: "${result.matchedKeywords.join('", "')}". Confianza: ${(result.confidence * 100).toFixed(0)}%`;
  }
  
  return `Clasificado como ${categoryName} con confianza baja (${(result.confidence * 100).toFixed(0)}%)`;
};

/**
 * Bulk categorization with percentage distribution fallback
 */
export const suggestDistribution = (
  lineItems: { description: string; amount: number }[],
  defaultPercentages: { mejora: number; reparacionConservacion: number; mobiliario: number } = { mejora: 0, reparacionConservacion: 100, mobiliario: 0 }
): { 
  suggestions: CategorizationResult[]; 
  recommendPercentageMode: boolean;
  totalAmount: number;
} => {
  const suggestions = lineItems.map(item => categorizeWithConfidence(item.description));
  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  
  // Recommend percentage mode if:
  // 1. No line items have high confidence (> 0.6)
  // 2. Too few line items (< 3)
  // 3. Line items are too generic/short
  
  const highConfidenceItems = suggestions.filter(s => s.confidence > 0.6);
  const recommendPercentageMode = 
    highConfidenceItems.length === 0 || 
    lineItems.length < 3 || 
    lineItems.every(item => item.description.length < 15);
  
  return {
    suggestions,
    recommendPercentageMode,
    totalAmount
  };
};

const invoiceCategorizationService = {
  categorizeOCRLineItem,
  categorizeWithConfidence,
  categorizeMultipleItems,
  applyMinorAmountRule,
  getCategorizationExplanation,
  suggestDistribution
};

export default invoiceCategorizationService;