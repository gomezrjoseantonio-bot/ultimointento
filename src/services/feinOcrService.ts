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
    try {
      // Validate file is PDF
      if (file.type !== 'application/pdf') {
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
        return {
          success: false,
          errors: ['No se pudo procesar el documento FEIN. Verifique que sea un PDF legible.'],
          warnings: [],
          fieldsExtracted: [],
          fieldsMissing: []
        };
      }

      // Extract FEIN-specific data from OCR text
      const feinData = this.extractFEINData(ocrResult.data.raw_text);
      const validation = this.validateFEINData(feinData);
      
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
      console.error('Error processing FEIN document:', error);
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
      tipo: this.extractTipoInteres(text),
      
      // Variable/Mixed specific
      indice: this.extractIndice(text),
      diferencial: this.extractDiferencial(text),
      tramoFijoAnos: this.extractTramoFijo(text),
      
      // Account and dates
      cuentaCargoIban: this.extractIBAN(text),
      fechaPrimerPago: this.extractFechaPrimerPago(text),
      
      // Bonifications and commissions
      bonificaciones: this.extractBonificaciones(text),
      comisionApertura: this.extractComisionApertura(text),
      comisionAmortizacionParcial: this.extractComisionAmortizacion(text),
      comisionCancelacionTotal: this.extractComisionCancelacion(text),
      
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
    // Look for capital patterns: "importe", "capital", "prestado", etc.
    const capitalPatterns = [
      /(?:capital|importe|prestado|financiado)[:\s]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*€?/i,
      /([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*€?\s*(?:capital|importe|prestado)/i
    ];

    for (const pattern of capitalPatterns) {
      const match = this.extractMatch(text, pattern);
      if (match) {
        return this.parseSpanishNumber(match);
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

  private extractTipoInteres(text: string): 'FIJO' | 'VARIABLE' | 'MIXTO' | undefined {
    if (text.includes('mixto')) return 'MIXTO';
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
    const ibanPattern = /ES[0-9]{2}\s*[0-9]{4}\s*[0-9]{4}\s*[0-9]{4}\s*[0-9]{4}\s*[0-9]{4}/i;
    const match = this.extractMatch(text, ibanPattern, 0); // Get full match, not group
    return match ? match.replace(/\s/g, '') : undefined;
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

  private extractBonificaciones(text: string): FEINBonificacion[] {
    const bonificaciones: FEINBonificacion[] = [];
    
    // Common bonification patterns
    const patterns = [
      { type: 'SEGURO_HOGAR', keywords: ['seguro hogar', 'seguro vivienda'] },
      { type: 'SEGURO_VIDA', keywords: ['seguro vida'] },
      { type: 'RECIBOS', keywords: ['domiciliación', 'recibos'] },
      { type: 'TARJETA', keywords: ['tarjeta', 'card'] },
      { type: 'PLAN_PENSIONES', keywords: ['plan pensiones', 'pensión'] },
      { type: 'INGRESOS_RECURRENTES', keywords: ['nómina', 'ingresos recurrentes'] }
    ];

    patterns.forEach(({ type, keywords }) => {
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          // Try to find discount percentage
          const discountPattern = new RegExp(`${keyword}[^0-9]*([0-9]+[.,][0-9]+)\\s*%?`, 'i');
          const discountMatch = this.extractMatch(text, discountPattern);
          
          bonificaciones.push({
            tipo: type as any,
            descripcion: keyword,
            descuento: discountMatch ? this.parsePercentage(discountMatch) : undefined
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

  private validateFEINData(data: FEINData): { errors: string[], warnings: string[], missingMandatoryFields: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingMandatoryFields: string[] = [];

    // Mandatory fields validation
    if (!data.capitalInicial) missingMandatoryFields.push('Capital inicial');
    if (!data.tin && !data.tae) missingMandatoryFields.push('TIN o TAE');
    if (!data.plazoAnos && !data.plazoMeses) missingMandatoryFields.push('Plazo');
    if (!data.tipo) missingMandatoryFields.push('Tipo de interés');

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