// FEIN OCR Service - Specialized OCR processing for FEIN documents
// Extends unifiedOcrService for FEIN-specific extraction

import { unifiedOcrService } from './unifiedOcrService';
import { FEINData, FEINBonificacion, FEINProcessingResult } from '../types/fein';
import { safeMatch } from '../utils/safe';

export class FEINOCRService {
  private static instance: FEINOCRService;
  
  static getInstance(): FEINOCRService {
    if (!FEINOCRService.instance) {
      FEINOCRService.instance = new FEINOCRService();
    }
    return FEINOCRService.instance;
  }

  /**
   * Process FEIN document and extract loan information
   * @param file - PDF file containing FEIN
   * @returns Structured FEIN data with validation
   */
  async processFEINDocument(file: File): Promise<FEINProcessingResult> {
    console.log('[FEIN] Starting FEIN processing:', file.name);
    
    try {
      // Validate file is PDF
      if (file.type !== 'application/pdf') {
        console.log('[FEIN] Invalid file type:', file.type);
        return {
          success: false,
          errors: ['Solo se permiten archivos PDF para documentos FEIN'],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: []
        };
      }

      // Process through unified OCR service
      const ocrResult = await unifiedOcrService.processDocument(file);
      
      if (!ocrResult.success || !ocrResult.data?.raw_text) {
        console.log('[FEIN] OCR processing failed:', ocrResult);
        return {
          success: false,
          errors: ['No se pudo procesar el documento FEIN. Verifique que sea un PDF legible.'],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: []
        };
      }

      console.log('[FEIN] OCR successful, extracting FEIN data...');

      // Check if this is actually a FEIN document
      const isFEINDocument = this.validateFEINDocument(ocrResult.data.raw_text);
      if (!isFEINDocument.isValid) {
        console.log('[FEIN] Document validation failed:', isFEINDocument.reason);
        return {
          success: false,
          errors: [isFEINDocument.reason || 'El documento no parece ser una FEIN válida'],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: []
        };
      }

      // Extract FEIN-specific data from OCR text
      const feinData = this.extractFEINData(ocrResult.data.raw_text);
      const validation = this.validateExtractedFEINData(feinData);
      
      console.log(`[FEIN] Extraction complete. Fields extracted: ${this.getExtractedFields(feinData).join(', ')}`);
      
      return {
        success: true,
        data: feinData,
        errors: validation.errors,
        warnings: validation.warnings,
        confidence: this.calculateConfidence(feinData),
        fieldsExtracted: this.getExtractedFields(feinData),
        fieldsMissing: validation.missingMandatoryFields
      };

    } catch (error) {
      console.error('[FEIN] Error processing FEIN document:', error);
      return {
        success: false,
        errors: ['Error interno procesando el documento FEIN'],
        warnings: [],
        fieldsExtracted: [],
        fieldsMissing: []
      };
    }
  }

  /**
   * Extract structured data from FEIN OCR text
   */
  private extractFEINData(rawText: string): FEINData {
    const text = rawText.toLowerCase();
    
    return {
      // Bank/Entity extraction
      bancoEntidad: this.extractBankEntity(text),
      
      // Financial conditions
      capitalInicial: this.extractCapital(text),
      tin: this.extractTIN(text),
      tae: this.extractTAE(text),
      plazoAnos: this.extractPlazoAnos(text),
      plazoMeses: this.extractPlazoMeses(text),
      tipo: this.extractTipoInteres(text, rawText), // Pass original text for better pattern matching
      
      // Variable/Mixed specific
      indice: this.extractIndice(text),
      diferencial: this.extractDiferencial(text),
      tramoFijoAnos: this.extractTramoFijo(text),
      periodicidadRevision: this.extractPeriodicidadRevision(text),
      
      // Account and dates
      cuentaCargoIban: this.extractIBAN(text),
      ibanMascarado: this.isIBANMasked(text),
      fechaPrimerPago: this.extractFechaPrimerPago(text),
      fechaEmisionFEIN: this.extractFechaEmisionFEIN(text),
      
      // Bonifications and commissions
      bonificaciones: this.extractBonificaciones(text, rawText),
      comisionApertura: this.extractComisionApertura(text),
      comisionAmortizacionParcial: this.extractComisionAmortizacion(text),
      comisionCancelacionTotal: this.extractComisionCancelacion(text),
      comisionSubrogacion: this.extractComisionSubrogacion(text),
      
      rawText
    };
  }

  /**
   * Safely extract matched group from regex
   */
  private extractMatch(text: string, pattern: RegExp, groupIndex: number = 1): string | undefined {
    const match = safeMatch(text, pattern);
    return match && match[groupIndex] ? match[groupIndex] : undefined;
  }

  private extractBankEntity(text: string): string | undefined {
    // Common Spanish bank patterns
    const bankPatterns = [
      /banco\s+([a-záéíóúñ\s]+)/i,
      /caixa\s+([a-záéíóúñ\s]+)/i,
      /bbva\s*([a-záéíóúñ\s]*)/i,
      /santander\s*([a-záéíóúñ\s]*)/i,
      /sabadell\s*([a-záéíóúñ\s]*)/i,
      /bankia\s*([a-záéíóúñ\s]*)/i,
      /ing\s+([a-záéíóúñ\s]*)/i,
      /entidad\s*financiera[:\s]*([a-záéíóúñ\s]+)/i
    ];

    for (const pattern of bankPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return match.trim();
      }
    }
    return undefined;
  }

  private extractCapital(text: string): number | undefined {
    // Enhanced patterns for Spanish capital detection
    const capitalPatterns = [
      /(?:capital|importe|prestado|financiado)[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*€?/i,
      /([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*€?\s*(?:capital|importe|prestado|del\s+préstamo)/i,
      /importe\s+del\s+préstamo[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*€?/i,
      /capital\s+inicial[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*€?/i
    ];

    for (const pattern of capitalPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        const amount = this.parseSpanishNumber(match);
        // Validate reasonable range for mortgage capital
        if (amount >= 1000 && amount <= 10000000) {
          return amount;
        }
      }
    }
    return undefined;
  }

  private extractTIN(text: string): number | undefined {
    const tinPatterns = [
      /tin[:\s]*([0-9]+[.,][0-9]+)\s*%?/i,
      /tipo\s+nominal[:\s]*([0-9]+[.,][0-9]+)\s*%?/i,
      /interés\s+nominal[:\s]*([0-9]+[.,][0-9]+)\s*%?/i
    ];

    for (const pattern of tinPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parsePercentage(match);
      }
    }
    return undefined;
  }

  private extractTAE(text: string): number | undefined {
    const taePatterns = [
      /tae[:\s]*([0-9]+[.,][0-9]+)\s*%?/i,
      /tasa\s+anual\s+equivalente[:\s]*([0-9]+[.,][0-9]+)\s*%?/i
    ];

    for (const pattern of taePatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parsePercentage(match);
      }
    }
    return undefined;
  }

  private extractPlazoAnos(text: string): number | undefined {
    const plazoPatterns = [
      /plazo[:\s]*([0-9]+)\s*años?/i,
      /([0-9]+)\s*años?\s*(?:de\s*)?plazo/i,
      /duración[:\s]*([0-9]+)\s*años?/i
    ];

    for (const pattern of plazoPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return parseInt(match);
      }
    }
    return undefined;
  }

  private extractPlazoMeses(text: string): number | undefined {
    const plazoPatterns = [
      /plazo[:\s]*([0-9]+)\s*meses?/i,
      /([0-9]+)\s*meses?\s*(?:de\s*)?plazo/i,
      /duración[:\s]*([0-9]+)\s*meses?/i
    ];

    for (const pattern of plazoPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return parseInt(match);
      }
    }
    return undefined;
  }

  private extractTipoInteres(text: string, originalText?: string): 'FIJO' | 'VARIABLE' | 'MIXTO' | undefined {
    // Check for mixed indicators first (more specific)
    if (text.includes('mixto') || 
        (text.includes('periodo fijo') && text.includes('posteriormente variable'))) {
      return 'MIXTO';
    }
    
    // Heuristic: if appears "Tipo fijo/TIN" and NO "Euríbor", is Fixed
    const hasTipoFijo = text.includes('tipo fijo') || text.includes('tin');
    const hasEuribor = text.includes('euribor') || text.includes('euríbor');
    const hasDiferencial = text.includes('diferencial');
    
    if (hasTipoFijo && !hasEuribor) {
      return 'FIJO';
    }
    
    // If appears "Euríbor" and "diferencial", is Variable
    if (hasEuribor && hasDiferencial) {
      return 'VARIABLE';
    }
    
    // Simple keyword matching as fallback
    if (text.includes('variable')) return 'VARIABLE';
    if (text.includes('fijo')) return 'FIJO';
    
    return undefined;
  }

  private extractIndice(text: string): string | undefined {
    if (text.includes('euribor')) return 'EURIBOR';
    if (text.includes('irph')) return 'IRPH';
    return undefined;
  }

  private extractDiferencial(text: string): number | undefined {
    const difPatterns = [
      /diferencial[:\s]*([0-9]+[.,][0-9]+)\s*%?/i,
      /\+\s*([0-9]+[.,][0-9]+)\s*%?\s*diferencial/i
    ];

    for (const pattern of difPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parsePercentage(match);
      }
    }
    return undefined;
  }

  private extractTramoFijo(text: string): number | undefined {
    const tramoPatterns = [
      /tramo\s+fijo[:\s]*([0-9]+)\s*años?/i,
      /periodo\s+fijo[:\s]*([0-9]+)\s*años?/i
    ];

    for (const pattern of tramoPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return parseInt(match);
      }
    }
    return undefined;
  }

  private extractIBAN(text: string): string | undefined {
    // Enhanced IBAN patterns including masked ones
    const ibanPatterns = [
      /ES[0-9*]{2}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}/i,
      /iban[:\s]*ES[0-9*]{2}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}/i,
      /cuenta[:\s]*ES[0-9*]{2}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}/i
    ];
    
    for (const pattern of ibanPatterns) {
      const match = this.extractMatch(text, pattern, 0); // Get full match, not group
      if (match) {
        // Extract just the IBAN part and clean spaces
        const iban = match.replace(/.*?(ES[0-9*]{22}).*/, '$1').replace(/\s/g, '');
        if (iban.startsWith('ES') && iban.length === 24) {
          return iban;
        }
      }
    }
    return undefined;
  }

  private extractFechaPrimerPago(text: string): string | undefined {
    const fechaPatterns = [
      /primer\s+pago[:\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i,
      /fecha\s+(?:primer|inicial)[:\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i
    ];

    for (const pattern of fechaPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parseSpanishDate(match);
      }
    }
    return undefined;
  }

  private extractPeriodicidadRevision(text: string): number | undefined {
    const patterns = [
      /revisión[:\s]*cada\s*([0-9]+)\s*meses?/i,
      /periodicidad[:\s]*(?:de\s*)?revisión[:\s]*([0-9]+)\s*meses?/i,
      /revisión[:\s]*([0-9]+)\s*meses?/i,
      /([0-9]+)\s*meses?\s*(?:de\s*)?revisión/i
    ];

    for (const pattern of patterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        const months = parseInt(match);
        // Only accept common review periods
        if (months === 6 || months === 12) {
          return months;
        }
      }
    }
    return undefined;
  }

  private isIBANMasked(text: string): boolean {
    // Check if IBAN contains asterisks/masking
    const ibanPattern = /ES[0-9*]{2}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}\s*[0-9*]{4}/i;
    const match = text.match(ibanPattern);
    return match ? match[0].includes('*') : false;
  }

  private extractFechaEmisionFEIN(text: string): string | undefined {
    const patterns = [
      /fecha\s+(?:de\s+)?emisión[:\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i,
      /emitida?\s+(?:el\s+)?([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i,
      /fecha\s+fein[:\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i
    ];

    for (const pattern of patterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parseSpanishDate(match);
      }
    }
    return undefined;
  }

  private extractComisionSubrogacion(text: string): number | undefined {
    const patterns = [
      /comisión\s+(?:de\s+)?subrogación[:\s]*([0-9]+[.,][0-9]+)\s*%?/i,
      /subrogación[:\s]*([0-9]+[.,][0-9]+)\s*%?\s*comisión/i
    ];

    for (const pattern of patterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parsePercentage(match);
      }
    }
    return undefined;
  }

  private extractBonificaciones(text: string, originalText?: string): FEINBonificacion[] {
    const bonificaciones: FEINBonificacion[] = [];
    const fullText = originalText || text;
    
    // Enhanced bonification patterns with structured format
    const patterns = [
      { 
        type: 'SEGURO_HOGAR', 
        keywords: ['seguro hogar', 'seguro vivienda', 'seguro del hogar'],
        conditions: /seguro\s+hogar.*?(\d+[.,]\d+)\s*%?/i
      },
      { 
        type: 'SEGURO_VIDA', 
        keywords: ['seguro vida', 'seguro de vida'],
        conditions: /seguro\s+vida.*?(\d+[.,]\d+)\s*%?/i
      },
      { 
        type: 'RECIBOS', 
        keywords: ['domiciliación', 'recibos', 'domiciliaciones'],
        conditions: /(?:domiciliación|recibos).*?≥?\s*([0-9]+).*?(\d+[.,]\d+)\s*%?/i
      },
      { 
        type: 'TARJETA', 
        keywords: ['tarjeta', 'card', 'tarjetas'],
        conditions: /tarjeta.*?≥?\s*([0-9]+)\s*(?:usos?|operaciones?).*?(\d+[.,]\d+)\s*%?/i
      },
      { 
        type: 'PLAN_PENSIONES', 
        keywords: ['plan pensiones', 'pensión', 'plan de pensiones'],
        conditions: /plan\s+pensiones.*?(\d+[.,]\d+)\s*%?/i
      },
      { 
        type: 'NOMINA', 
        keywords: ['nómina', 'nomina', 'ingresos recurrentes'],
        conditions: /nómina.*?≥?\s*([0-9.,]+)\s*€?.*?(\d+[.,]\d+)\s*%?/i
      }
    ];

    patterns.forEach(({ type, keywords, conditions }) => {
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          // Try to extract detailed conditions and discount
          const conditionMatch = fullText.match(conditions);
          let descuento: number | undefined;
          let condicion: string | undefined;
          
          if (conditionMatch) {
            if (type === 'NOMINA') {
              condicion = `Ingresos ≥ ${conditionMatch[1]} €`;
              descuento = conditionMatch[2] ? this.parsePercentage(conditionMatch[2]) : undefined;
            } else if (type === 'TARJETA') {
              condicion = `≥ ${conditionMatch[1]} usos/mes`;
              descuento = conditionMatch[2] ? this.parsePercentage(conditionMatch[2]) : undefined;
            } else if (type === 'RECIBOS') {
              condicion = `≥ ${conditionMatch[1]} recibos últimos 6 meses`;
              descuento = conditionMatch[2] ? this.parsePercentage(conditionMatch[2]) : undefined;
            } else {
              descuento = this.parsePercentage(conditionMatch[1]);
            }
          } else {
            // Fallback: try to find any percentage near the keyword
            const discountPattern = new RegExp(`${keyword}[^0-9]*([0-9]+[.,][0-9]+)\\s*%?`, 'i');
            const discountMatch = this.extractMatch(text, discountPattern);
            descuento = discountMatch ? this.parsePercentage(discountMatch) : undefined;
          }
          
          bonificaciones.push({
            tipo: type as any,
            descripcion: keyword,
            descuento,
            condicion
          });
        }
      });
    });

    return bonificaciones;
  }

  private extractComisionApertura(text: string): number | undefined {
    const patterns = [
      /comisión\s+apertura[:\s]*([0-9]+[.,][0-9]+)\s*%?/i,
      /apertura[:\s]*([0-9]+[.,][0-9]+)\s*%?\s*comisión/i
    ];

    for (const pattern of patterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parsePercentage(match);
      }
    }
    return undefined;
  }

  private extractComisionAmortizacion(text: string): number | undefined {
    const patterns = [
      /comisión\s+amortización\s+parcial[:\s]*([0-9]+[.,][0-9]+)\s*%?/i,
      /amortización\s+parcial[:\s]*([0-9]+[.,][0-9]+)\s*%?\s*comisión/i
    ];

    for (const pattern of patterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parsePercentage(match);
      }
    }
    return undefined;
  }

  private extractComisionCancelacion(text: string): number | undefined {
    const patterns = [
      /comisión\s+cancelación\s+(?:total|anticipada)[:\s]*([0-9]+[.,][0-9]+)\s*%?/i,
      /cancelación\s+(?:total|anticipada)[:\s]*([0-9]+[.,][0-9]+)\s*%?\s*comisión/i
    ];

    for (const pattern of patterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parsePercentage(match);
      }
    }
    return undefined;
  }

  private parseSpanishNumber(str: string): number {
    // Parse Spanish number format: 123.456,78
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }

  private parsePercentage(str: string): number {
    // Parse percentage and convert to decimal
    const num = parseFloat(str.replace(',', '.'));
    return num > 1 ? num / 100 : num; // If > 1, assume it's in percentage format
  }

  private parseSpanishDate(str: string): string {
    // Convert Spanish date format to ISO
    const parts = str.split(/[/-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = '20' + year; // Assume 21st century
      }
      return `${year}-${month}-${day}`;
    }
    return str;
  }

  /**
   * Validate if the document is actually a FEIN
   */
  private validateFEINDocument(rawText: string): { isValid: boolean; reason?: string } {
    const text = rawText.toLowerCase();
    
    // Must contain FEIN identifier
    const hasFEINMarker = text.includes('ficha europea de información normalizada') || 
                         text.includes('fein');
    
    if (!hasFEINMarker) {
      return { 
        isValid: false, 
        reason: 'El documento no contiene los marcadores de FEIN requeridos' 
      };
    }

    // Must contain at least one financial term
    const financialTerms = ['tae', 'tin', 'euríbor', 'euribor', 'diferencial', 'plazo', 'comisiones', 'vinculaciones', 'bonificaciones'];
    const hasFinancialTerm = financialTerms.some(term => text.includes(term));
    
    if (!hasFinancialTerm) {
      return { 
        isValid: false, 
        reason: 'El documento no contiene términos financieros esperados en una FEIN' 
      };
    }

    return { isValid: true };
  }

  private validateExtractedFEINData(data: FEINData): { errors: string[], warnings: string[], missingMandatoryFields: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingMandatoryFields: string[] = [];

    // Mandatory fields validation
    if (!data.capitalInicial) missingMandatoryFields.push('capitalInicial');
    if (!data.tin && !data.tae) missingMandatoryFields.push('tin o tae');
    if (!data.plazoAnos && !data.plazoMeses) missingMandatoryFields.push('plazo');
    if (!data.tipo) missingMandatoryFields.push('tipo');

    // Business logic validation
    if (data.capitalInicial && data.capitalInicial < 1000) {
      warnings.push('Capital muy bajo para un préstamo hipotecario');
    }

    if (data.tin && (data.tin < 0 || data.tin > 0.2)) {
      warnings.push('TIN fuera del rango habitual (0%-20%)');
    }

    if (data.plazoAnos && data.plazoAnos > 50) {
      warnings.push('Plazo muy largo para un préstamo');
    }

    // Variable loan validation
    if (data.tipo === 'VARIABLE' && !data.indice) {
      warnings.push('Préstamo variable sin índice de referencia identificado');
    }

    if (data.tipo === 'VARIABLE' && !data.diferencial) {
      warnings.push('Préstamo variable sin diferencial identificado');
    }

    // Mixed loan validation
    if (data.tipo === 'MIXTO' && !data.tramoFijoAnos) {
      warnings.push('Préstamo mixto sin período fijo identificado');
    }

    return { errors, warnings, missingMandatoryFields };
  }

  private calculateConfidence(data: FEINData): number {
    let score = 0;
    let total = 0;

    // Critical fields (higher weight)
    const criticalFields = [
      'capitalInicial', 'tin', 'tae', 'plazoAnos', 'plazoMeses', 'tipo'
    ];
    
    criticalFields.forEach(field => {
      total += 2;
      if (data[field as keyof FEINData]) score += 2;
    });

    // Optional fields (lower weight)
    const optionalFields = [
      'bancoEntidad', 'cuentaCargoIban', 'fechaPrimerPago', 'bonificaciones'
    ];
    
    optionalFields.forEach(field => {
      total += 1;
      if (data[field as keyof FEINData]) score += 1;
    });

    return total > 0 ? score / total : 0;
  }

  private getExtractedFields(data: FEINData): string[] {
    const fields: string[] = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== 'rawText') {
        if (Array.isArray(value) && value.length > 0) {
          fields.push(key);
        } else if (!Array.isArray(value)) {
          fields.push(key);
        }
      }
    });

    return fields;
  }
}

export const feinOcrService = FEINOCRService.getInstance();