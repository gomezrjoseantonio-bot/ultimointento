// DocAI FEIN Normalization Module
// Normalizes Google Document AI entities to Spanish format with confidence tracking

interface DocAIEntity {
  type: string;
  mentionText: string;
  normalizedValue?: any;
  confidence: number;
}

interface NormalizeFeinInput {
  entities: DocAIEntity[];
  text?: string;
}

interface NormalizedFeinFields {
  capital_inicial?: string;      // "250.000,00 €"
  plazoMeses?: number;           // 300
  tin?: string;                  // "3,25 %"
  tae?: string;                  // "3,41 %"
  cuota?: string;                // "1.263,45 €"
  sistemaAmortizacion?: string;  // "Francés"
  indice?: string;               // "Euríbor 12M"
  diferencial?: string;          // "+1,50 %"
  vinculaciones?: string[];      // ["Nómina", "Seguro hogar", …]
  comisiones?: Record<string,string>; // { apertura: "0,50 %", … }
  gastos?: Record<string,string>;     // { tasación: "400,00 €", … }
  fechaOferta?: string;          // "01/02/2024"
  validez?: string;              // "15/02/2024"
  cuentaCargo?: string;          // "ES12…"
}

interface FieldConfidence {
  confidence: number;
  source?: string;
}

interface NormalizeFeinResult {
  fields: NormalizedFeinFields;
  byField: Record<string, FieldConfidence>;
  confidenceGlobal: number;
  pending: string[];
}

/**
 * Normalizes FEIN data from Google Document AI to Spanish format
 */
export function normalizeFeinFromDocAI(input: NormalizeFeinInput): NormalizeFeinResult {
  const fields: NormalizedFeinFields = {};
  const byField: Record<string, FieldConfidence> = {};
  const pending: string[] = [];

  // Map DocAI entities to normalized fields
  mapEntities(input.entities, fields, byField);

  // Apply precision booster for missing fields
  if (input.text) {
    applyPrecisionBooster(input.text, fields, byField);
  }

  // Calculate global confidence based on critical fields
  const confidenceGlobal = calculateGlobalConfidence(byField);

  // Identify pending fields (confidence < 0.60 or missing)
  identifyPendingFields(fields, byField, pending);

  // Validate relationships
  validateFieldRelationships(fields);

  return {
    fields,
    byField,
    confidenceGlobal,
    pending
  };
}

/**
 * Map DocAI entities to normalized fields
 */
function mapEntities(entities: DocAIEntity[], fields: NormalizedFeinFields, byField: Record<string, FieldConfidence>): void {
  for (const entity of entities) {
    const type = entity.type.toLowerCase();
    const confidence = entity.confidence;
    const text = entity.mentionText;
    const normalizedValue = entity.normalizedValue;

    // Loan amount / principal → capital_inicial
    if (type.includes('loan_amount') || type.includes('principal') || type.includes('amount')) {
      const amount = extractMoneyValue(normalizedValue, text);
      if (amount !== null) {
        fields.capital_inicial = formatEuroAmount(amount);
        byField.capital_inicial = { confidence, source: 'docai:' + type };
      }
    }

    // Term months or years → plazoMeses
    else if (type.includes('term_months') || type.includes('term')) {
      const months = extractTermInMonths(normalizedValue, text);
      if (months !== null) {
        fields.plazoMeses = months;
        byField.plazoMeses = { confidence, source: 'docai:' + type };
      }
    }

    // Interest rate → tin
    else if (type.includes('interest_rate') || type.includes('tin')) {
      const rate = extractPercentageValue(normalizedValue, text);
      if (rate !== null) {
        fields.tin = formatPercentage(rate);
        byField.tin = { confidence, source: 'docai:' + type };
      }
    }

    // APR → tae
    else if (type.includes('apr') || type.includes('tae')) {
      const rate = extractPercentageValue(normalizedValue, text);
      if (rate !== null) {
        fields.tae = formatPercentage(rate);
        byField.tae = { confidence, source: 'docai:' + type };
      }
    }

    // Monthly payment → cuota
    else if (type.includes('monthly_payment') || type.includes('payment') || type.includes('cuota')) {
      const amount = extractMoneyValue(normalizedValue, text);
      if (amount !== null) {
        fields.cuota = formatEuroAmount(amount);
        byField.cuota = { confidence, source: 'docai:' + type };
      }
    }

    // Amortization type → sistemaAmortizacion
    else if (type.includes('amortization_type') || type.includes('amortization')) {
      const system = normalizeAmortizationSystem(text);
      if (system) {
        fields.sistemaAmortizacion = system;
        byField.sistemaAmortizacion = { confidence, source: 'docai:' + type };
      }
    }

    // Index → indice
    else if (type.includes('index') || type.includes('reference')) {
      const index = normalizeIndex(text);
      if (index) {
        fields.indice = index;
        byField.indice = { confidence, source: 'docai:' + type };
      }
    }

    // Margin/spread → diferencial
    else if (type.includes('margin') || type.includes('spread') || type.includes('diferencial')) {
      const rate = extractPercentageValue(normalizedValue, text);
      if (rate !== null) {
        fields.diferencial = formatDifferential(rate);
        byField.diferencial = { confidence, source: 'docai:' + type };
      }
    }

    // Fees → comisiones
    else if (type.includes('fees') || type.includes('commission')) {
      if (!fields.comisiones) fields.comisiones = {};
      const feeType = extractFeeType(type, text);
      const feeValue = extractPercentageValue(normalizedValue, text);
      if (feeType && feeValue !== null) {
        fields.comisiones[feeType] = formatPercentage(feeValue);
        byField[`comisiones_${feeType}`] = { confidence, source: 'docai:' + type };
      }
    }

    // Charges/expenses → gastos
    else if (type.includes('charges') || type.includes('expenses') || type.includes('gasto')) {
      if (!fields.gastos) fields.gastos = {};
      const expenseType = extractExpenseType(type, text);
      const expenseValue = extractMoneyValue(normalizedValue, text);
      if (expenseType && expenseValue !== null) {
        fields.gastos[expenseType] = formatEuroAmount(expenseValue);
        byField[`gastos_${expenseType}`] = { confidence, source: 'docai:' + type };
      }
    }

    // Offer date → fechaOferta
    else if (type.includes('offer_date') || type.includes('date_offer')) {
      const date = extractDateValue(normalizedValue, text);
      if (date) {
        fields.fechaOferta = formatSpanishDate(date);
        byField.fechaOferta = { confidence, source: 'docai:' + type };
      }
    }

    // Valid until → validez
    else if (type.includes('valid_until') || type.includes('expiry') || type.includes('validez')) {
      const date = extractDateValue(normalizedValue, text);
      if (date) {
        fields.validez = formatSpanishDate(date);
        byField.validez = { confidence, source: 'docai:' + type };
      }
    }

    // IBAN/account → cuentaCargo
    else if (type.includes('iban') || type.includes('account_number')) {
      const iban = normalizeIban(text);
      if (iban) {
        fields.cuentaCargo = iban;
        byField.cuentaCargo = { confidence, source: 'docai:' + type };
      }
    }

    // Bonifications/discounts → vinculaciones
    else if (type.includes('bonifications') || type.includes('discounts') || type.includes('benefits')) {
      if (!fields.vinculaciones) fields.vinculaciones = [];
      const benefit = extractBenefit(text);
      if (benefit && !fields.vinculaciones.includes(benefit)) {
        fields.vinculaciones.push(benefit);
        byField[`vinculaciones_${fields.vinculaciones.length}`] = { confidence, source: 'docai:' + type };
      }
    }
  }
}

/**
 * Extract money value from DocAI normalized value or text
 */
function extractMoneyValue(normalizedValue: any, text: string): number | null {
  // Try normalized value first
  if (normalizedValue?.moneyValue) {
    const units = parseFloat(normalizedValue.moneyValue.units || '0');
    const nanos = parseFloat(normalizedValue.moneyValue.nanos || '0') / 1000000000;
    return units + nanos;
  }

  // Fallback to text parsing
  const match = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
  if (match) {
    return parseSpanishNumber(match[1]);
  }

  return null;
}

/**
 * Extract percentage value from DocAI normalized value or text
 */
function extractPercentageValue(normalizedValue: any, text: string): number | null {
  // Try normalized value first
  if (normalizedValue?.text) {
    const match = normalizedValue.text.match(/(\d+[.,]\d*)/);
    if (match) {
      return parseSpanishNumber(match[1]);
    }
  }

  // Fallback to text parsing
  const match = text.match(/(\d{1,2}[.,]\d{2})\s*%/);
  if (match) {
    return parseSpanishNumber(match[1]);
  }

  return null;
}

/**
 * Extract term in months from DocAI data
 */
function extractTermInMonths(normalizedValue: any, text: string): number | null {
  // Check for years first and convert
  const yearMatch = text.match(/(\d+)\s*a[ñn]os?/i);
  if (yearMatch) {
    return parseInt(yearMatch[1]) * 12;
  }

  // Check for months
  const monthMatch = text.match(/(\d+)\s*meses?/i);
  if (monthMatch) {
    return parseInt(monthMatch[1]);
  }

  // Try normalized value
  if (normalizedValue?.text) {
    const numMatch = normalizedValue.text.match(/(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      // Heuristic: if > 50, probably months; if <= 50, probably years
      return num > 50 ? num : num * 12;
    }
  }

  return null;
}

/**
 * Extract date value from DocAI data
 */
function extractDateValue(normalizedValue: any, text: string): Date | null {
  // Try normalized date value
  if (normalizedValue?.dateValue) {
    const { year, month, day } = normalizedValue.dateValue;
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  // Fallback to text parsing (various formats)
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
    /(\d{1,2})-(\d{1,2})-(\d{4})/    // DD-MM-YYYY
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.startsWith('(\\d{4})')) {
        // YYYY-MM-DD format
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        // DD/MM/YYYY or DD-MM-YYYY format
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      }
    }
  }

  return null;
}

/**
 * Parse Spanish number format (1.234,56 → 1234.56)
 */
function parseSpanishNumber(text: string): number {
  const normalized = text.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

/**
 * Format amount in Spanish Euro format
 */
function formatEuroAmount(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format percentage in Spanish format
 */
function formatPercentage(rate: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rate / 100).replace('%', ' %');
}

/**
 * Format differential with + sign
 */
function formatDifferential(rate: number): string {
  const formatted = formatPercentage(rate);
  return rate >= 0 ? `+${formatted}` : formatted;
}

/**
 * Format date in Spanish format (DD/MM/YYYY)
 */
function formatSpanishDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${day}/${month}/${year}`;
}

/**
 * Normalize amortization system
 */
function normalizeAmortizationSystem(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('francés') || lower.includes('frances') || lower.includes('french')) {
    return 'Francés';
  }
  if (lower.includes('alemán') || lower.includes('aleman') || lower.includes('german')) {
    return 'Alemán';
  }
  if (lower.includes('americano') || lower.includes('american')) {
    return 'Americano';
  }
  return null;
}

/**
 * Normalize index reference
 */
function normalizeIndex(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('euribor') || lower.includes('euríbor')) {
    if (lower.includes('12') || lower.includes('anual')) {
      return 'Euríbor 12M';
    }
    if (lower.includes('6') || lower.includes('semestral')) {
      return 'Euríbor 6M';
    }
    return 'Euríbor 12M'; // Default
  }
  if (lower.includes('irph')) {
    return 'IRPH';
  }
  return null;
}

/**
 * Extract fee type from entity type and text
 */
function extractFeeType(type: string, text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('apertura') || type.includes('opening')) {
    return 'apertura';
  }
  if (lower.includes('mantenimiento') || type.includes('maintenance')) {
    return 'mantenimiento';
  }
  if (lower.includes('amortización') || lower.includes('amortizacion') || type.includes('prepayment')) {
    return 'amortizacion_anticipada';
  }
  if (lower.includes('subrogación') || lower.includes('subrogacion') || type.includes('subrogation')) {
    return 'subrogacion';
  }
  return 'otros';
}

/**
 * Extract expense type from entity type and text
 */
function extractExpenseType(type: string, text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('tasación') || lower.includes('tasacion') || type.includes('appraisal')) {
    return 'tasacion';
  }
  if (lower.includes('notaría') || lower.includes('notaria') || type.includes('notary')) {
    return 'notaria';
  }
  if (lower.includes('registro') || type.includes('registry')) {
    return 'registro';
  }
  if (lower.includes('gestoría') || lower.includes('gestoria') || type.includes('management')) {
    return 'gestoria';
  }
  return 'otros';
}

/**
 * Normalize IBAN format
 */
function normalizeIban(text: string): string | null {
  const iban = text.replace(/\s/g, '').toUpperCase();
  if (iban.match(/^ES\d{22}$/)) {
    return iban;
  }
  // Handle partial IBAN
  if (iban.includes('*') && iban.length >= 4) {
    return iban;
  }
  return null;
}

/**
 * Extract benefit/bonification from text
 */
function extractBenefit(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('nómina') || lower.includes('nomina')) {
    return 'Nómina';
  }
  if (lower.includes('recibo') || lower.includes('domiciliación')) {
    return 'Recibos';
  }
  if (lower.includes('tarjeta')) {
    return 'Tarjeta';
  }
  if (lower.includes('seguro') && lower.includes('hogar')) {
    return 'Seguro hogar';
  }
  if (lower.includes('seguro') && lower.includes('vida')) {
    return 'Seguro vida';
  }
  if (lower.includes('plan') && lower.includes('pensiones')) {
    return 'Plan pensiones';
  }
  if (lower.includes('alarma')) {
    return 'Alarma';
  }
  return null;
}

/**
 * Calculate global confidence based on critical fields
 */
function calculateGlobalConfidence(byField: Record<string, FieldConfidence>): number {
  const criticalFields = ['capital_inicial', 'plazoMeses', 'tin', 'tae', 'cuota'];
  const weights = { capital_inicial: 0.3, plazoMeses: 0.2, tin: 0.25, tae: 0.15, cuota: 0.1 };
  
  let weightedSum = 0;
  let totalWeight = 0;
  let allRegexBased = true;

  for (const field of criticalFields) {
    if (byField[field]) {
      const weight = weights[field as keyof typeof weights] || 0.1;
      let confidence = byField[field].confidence;
      
      // Check if this field was filled by regex vs DocAI
      if (byField[field].source?.startsWith('docai:')) {
        allRegexBased = false;
      }
      
      weightedSum += confidence * weight;
      totalWeight += weight;
    }
  }

  let globalConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  // If all fields are regex-based, cap confidence between 0.65-0.75
  if (allRegexBased && totalWeight > 0) {
    globalConfidence = Math.min(Math.max(globalConfidence, 0.65), 0.75);
  }

  return Math.round(globalConfidence * 100) / 100;
}

/**
 * Identify fields with low confidence or missing
 */
function identifyPendingFields(
  fields: NormalizedFeinFields, 
  byField: Record<string, FieldConfidence>, 
  pending: string[]
): void {
  const criticalFields = {
    capital_inicial: 'Importe',
    plazoMeses: 'Plazo',
    tin: 'TIN',
    tae: 'TAE',
    cuota: 'Cuota',
    sistemaAmortizacion: 'Sistema amortización',
    indice: 'Índice referencia',
    diferencial: 'Diferencial'
  };

  for (const [fieldKey, displayName] of Object.entries(criticalFields)) {
    const fieldValue = fields[fieldKey as keyof NormalizedFeinFields];
    const fieldConfidence = byField[fieldKey];
    
    if (!fieldValue || !fieldConfidence || fieldConfidence.confidence < 0.60) {
      pending.push(displayName);
    }
  }
}

/**
 * Validate relationships between fields
 */
function validateFieldRelationships(fields: NormalizedFeinFields): void {
  // Validate TAE >= TIN
  if (fields.tae && fields.tin) {
    const taeValue = parseSpanishNumber(fields.tae.replace(' %', ''));
    const tinValue = parseSpanishNumber(fields.tin.replace(' %', ''));
    
    if (taeValue < tinValue) {
      console.warn('TAE validation warning: TAE should be >= TIN', { tae: taeValue, tin: tinValue });
    }
  }

  // Validate plazo coherence (already handled in extractTermInMonths)
  
  // Other validations could be added here
}

/**
 * Apply precision booster using Spanish regex patterns to fill missing fields
 */
function applyPrecisionBooster(
  docText: string, 
  fields: NormalizedFeinFields, 
  byField: Record<string, FieldConfidence>
): void {
  const filledFields: string[] = [];
  
  // Only apply if field is missing or empty
  
  // capital_inicial: /Capital( (solicitado|inicial))?:?\s*([0-9\.\s]+,\d{2})\s*€/i
  if (!fields.capital_inicial) {
    const capitalRegex = /Capital( (solicitado|inicial))?:?\s*([0-9\.\s]+,\d{2})\s*€/i;
    const match = docText.match(capitalRegex);
    if (match && match[3]) {
      const amount = parseSpanishNumber(match[3]);
      fields.capital_inicial = formatEuroAmount(amount);
      byField.capital_inicial = { confidence: 0.70, source: 'regex:capital' };
      filledFields.push('capital_inicial');
    }
  }

  // plazoMeses: prioritize años → meses, then meses
  if (!fields.plazoMeses) {
    // Try years first: /Plazo:?\s*(\d{1,2})\s*años?/i  ⇒ 12
    const yearRegex = /Plazo:?\s*(\d{1,2})\s*años?/i;
    const yearMatch = docText.match(yearRegex);
    if (yearMatch && yearMatch[1]) {
      fields.plazoMeses = parseInt(yearMatch[1]) * 12;
      byField.plazoMeses = { confidence: 0.75, source: 'regex:plazo_anos' };
      filledFields.push('plazoMeses');
    } else {
      // Try months: /Plazo:?\s*(\d{1,3})\s*meses?/i
      const monthRegex = /Plazo:?\s*(\d{1,3})\s*meses?/i;
      const monthMatch = docText.match(monthRegex);
      if (monthMatch && monthMatch[1]) {
        fields.plazoMeses = parseInt(monthMatch[1]);
        byField.plazoMeses = { confidence: 0.75, source: 'regex:plazo_meses' };
        filledFields.push('plazoMeses');
      }
    }
  }

  // tin: /TIN:?\s*([\d,\.\-]+)\s*%/i
  if (!fields.tin) {
    const tinRegex = /TIN:?\s*([\d,\.\-]+)\s*%/i;
    const match = docText.match(tinRegex);
    if (match && match[1]) {
      const rate = parseSpanishNumber(match[1]);
      fields.tin = formatPercentage(rate);
      byField.tin = { confidence: 0.70, source: 'regex:tin' };
      filledFields.push('tin');
    }
  }

  // tae: /TAE:?\s*([\d,\.\-]+)\s*%/i
  if (!fields.tae) {
    const taeRegex = /TAE:?\s*([\d,\.\-]+)\s*%/i;
    const match = docText.match(taeRegex);
    if (match && match[1]) {
      const rate = parseSpanishNumber(match[1]);
      fields.tae = formatPercentage(rate);
      byField.tae = { confidence: 0.70, source: 'regex:tae' };
      filledFields.push('tae');
    }
  }

  // cuota: /(Cuota (mensual )?(aprox\.?|estimada)?:?)\s*([0-9\.\s]+,\d{2})\s*€/i
  if (!fields.cuota) {
    const cuotaRegex = /(Cuota( mensual)?( aprox\.?| aproximada| estimada)?:?)\s*([0-9\.\s]+,\d{2})\s*€/i;
    const match = docText.match(cuotaRegex);
    if (match && match[4]) {
      const amount = parseSpanishNumber(match[4]);
      fields.cuota = formatEuroAmount(amount);
      byField.cuota = { confidence: 0.70, source: 'regex:cuota' };
      filledFields.push('cuota');
    }
  }

  // indice: /(EURIBOR)\s*(?:[0-9]{1,2}\s*m(es)?(es)?)?/i ⇒ normaliza a 'EURIBOR_12M' si aparece "12" cerca
  if (!fields.indice) {
    const indiceRegex = /(EURIBOR)\s*(?:([0-9]{1,2})\s*m(es)?(es)?)?/i;
    const match = docText.match(indiceRegex);
    if (match) {
      let normalizedIndex = 'EURIBOR_12M'; // Default
      if (match[2]) {
        const months = parseInt(match[2]);
        if (months === 6) {
          normalizedIndex = 'EURIBOR_6M';
        } else if (months === 12) {
          normalizedIndex = 'EURIBOR_12M';
        }
      }
      fields.indice = normalizedIndex;
      byField.indice = { confidence: 0.75, source: 'regex:indice' };
      filledFields.push('indice');
    }
  }

  // diferencial: /(Diferencial|spread):?\s*\+?([\d,\.\-]+)\s*%/i
  if (!fields.diferencial) {
    const diferencialRegex = /(Diferencial|spread):?\s*\+?([\d,\.\-]+)\s*%/i;
    const match = docText.match(diferencialRegex);
    if (match && match[2]) {
      const rate = parseSpanishNumber(match[2]);
      fields.diferencial = formatDifferential(rate);
      byField.diferencial = { confidence: 0.70, source: 'regex:diferencial' };
      filledFields.push('diferencial');
    }
  }

  // sistema: /(Sistema de amortización|Amortización):?\s*(Franc[e|é]s|Alem[a|á]n)/i ⇒ 'FRANCES'|'ALEMAN'
  if (!fields.sistemaAmortizacion) {
    const sistemaRegex = /(Sistema de amortización|Amortización):?\s*(Franc[e|é]s|Alem[a|á]n)/i;
    const match = docText.match(sistemaRegex);
    if (match && match[2]) {
      const system = match[2].toLowerCase();
      if (system.includes('franc')) {
        fields.sistemaAmortizacion = 'FRANCES';
      } else if (system.includes('alem')) {
        fields.sistemaAmortizacion = 'ALEMAN';
      }
      byField.sistemaAmortizacion = { confidence: 0.75, source: 'regex:sistema' };
      filledFields.push('sistemaAmortizacion');
    }
  }

  // IBAN: /\bES\d{2}\s?\d{4}\s?\d{4}\s?\d{2}\s?\d{10}\b/ ⇒ formatea con espacios cada 4
  if (!fields.cuentaCargo) {
    const ibanRegex = /\bES\d{2}[\s\d]{20,}\b/;
    const match = docText.match(ibanRegex);
    if (match) {
      // Clean and validate IBAN format
      const cleanIban = match[0].replace(/\s/g, '');
      if (cleanIban.length === 24 && cleanIban.match(/^ES\d{22}$/)) {
        // Format with spaces every 4 characters
        const formattedIban = cleanIban.replace(/(.{4})/g, '$1 ').trim();
        fields.cuentaCargo = formattedIban;
        byField.cuentaCargo = { confidence: 0.75, source: 'regex:iban' };
        filledFields.push('cuentaCargo');
      }
    }
  }

  // Safe logging (no sensitive data)
  if (filledFields.length > 0) {
    console.info('[FEIN] booster', { filled: filledFields });
  }
}