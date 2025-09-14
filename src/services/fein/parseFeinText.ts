// FEIN Text Parser - Extract loan fields from aggregated FEIN text
// Implements robust regex/heuristics extraction per problem statement

import { FeinLoanDraft } from '../../types/fein';

export interface FeinParseResult {
  success: boolean;
  loanDraft: FeinLoanDraft | null;
  confidence: number; // 0-1
  warnings: string[];
  errors: string[];
}

export class FeinTextParser {
  
  /**
   * Parse aggregated FEIN text and extract loan fields
   */
  static parseText(
    fullText: string, 
    sourceFileName: string, 
    totalPages: number,
    ocrProvider: string = 'mixed'
  ): FeinParseResult {
    const text = fullText.toLowerCase();
    const originalText = fullText;
    
    const warnings: string[] = [];
    const errors: string[] = [];
    
    try {
      // Create base draft
      const loanDraft: FeinLoanDraft = {
        metadata: {
          sourceFileName,
          pagesTotal: totalPages,
          pagesProcessed: totalPages,
          ocrProvider,
          processedAt: new Date().toISOString(),
          warnings: []
        },
        prestamo: {
          tipo: this.extractTipo(text),
          periodicidadCuota: 'MENSUAL', // Default for Spanish mortgages
          revisionMeses: null,
          indiceReferencia: null,
          valorIndiceActual: null,
          diferencial: null,
          tinFijo: null,
          comisionAperturaPct: null,
          comisionMantenimientoMes: null,
          amortizacionAnticipadaPct: null,
          fechaFirmaPrevista: null,
          banco: null,
          ibanCargoParcial: null
        },
        bonificaciones: []
      };

      // Extract bank/entity
      const banco = this.extractBanco(text);
      if (banco) {
        loanDraft.prestamo.banco = banco;
      } else {
        warnings.push('No se pudo identificar la entidad bancaria');
      }

      // Extract capital
      const capital = this.extractCapital(text);
      if (capital) {
        loanDraft.prestamo.capitalInicial = capital;
      } else {
        warnings.push('No se pudo extraer el capital del préstamo');
      }

      // Extract plazo
      const plazo = this.extractPlazo(text);
      if (plazo) {
        loanDraft.prestamo.plazoMeses = plazo;
      } else {
        warnings.push('No se pudo extraer el plazo del préstamo');
      }

      // Extract interest rates based on type
      if (loanDraft.prestamo.tipo === 'FIJO') {
        const tin = this.extractTIN(text);
        if (tin) loanDraft.prestamo.tinFijo = tin;
      } else if (loanDraft.prestamo.tipo === 'VARIABLE' || loanDraft.prestamo.tipo === 'MIXTO') {
        const indice = this.extractIndice(text);
        if (indice) loanDraft.prestamo.indiceReferencia = indice;
        
        const diferencial = this.extractDiferencial(text);
        if (diferencial) loanDraft.prestamo.diferencial = diferencial;
        
        const revision = this.extractRevision(text);
        if (revision) loanDraft.prestamo.revisionMeses = revision;
        
        const valorIndice = this.extractValorIndice(text);
        if (valorIndice) loanDraft.prestamo.valorIndiceActual = valorIndice;
        
        // For mixed loans, also extract fixed portion TIN
        if (loanDraft.prestamo.tipo === 'MIXTO') {
          const tinFijo = this.extractTIN(text);
          if (tinFijo) loanDraft.prestamo.tinFijo = tinFijo;
        }
      }

      // Extract commissions
      const comisionApertura = this.extractComisionApertura(text);
      if (comisionApertura !== null) loanDraft.prestamo.comisionAperturaPct = comisionApertura;
      
      const comisionMantenimiento = this.extractComisionMantenimiento(text);
      if (comisionMantenimiento !== null) loanDraft.prestamo.comisionMantenimientoMes = comisionMantenimiento;
      
      const amortizacionAnticipada = this.extractAmortizacionAnticipada(text);
      if (amortizacionAnticipada !== null) loanDraft.prestamo.amortizacionAnticipadaPct = amortizacionAnticipada;

      // Extract IBAN
      const iban = this.extractIbanParcial(text);
      if (iban) loanDraft.prestamo.ibanCargoParcial = iban;

      // Extract signature date
      const fechaFirma = this.extractFechaFirma(text);
      if (fechaFirma) loanDraft.prestamo.fechaFirmaPrevista = fechaFirma;

      // Extract suggested alias
      if (banco && capital) {
        loanDraft.prestamo.aliasSugerido = `Hipoteca ${banco} ${Math.round(capital / 1000)}K`;
      }

      // Extract bonifications
      loanDraft.bonificaciones = this.extractBonificaciones(originalText);

      // Calculate confidence
      const confidence = this.calculateConfidence(loanDraft);
      
      // Add warnings to metadata
      loanDraft.metadata.warnings = warnings;

      return {
        success: true,
        loanDraft,
        confidence,
        warnings,
        errors
      };

    } catch (error) {
      console.error('Error parsing FEIN text:', error);
      errors.push('Error interno analizando el texto FEIN');
      
      return {
        success: false,
        loanDraft: null,
        confidence: 0,
        warnings,
        errors
      };
    }
  }

  /**
   * Extract loan type
   */
  private static extractTipo(text: string): 'FIJO' | 'VARIABLE' | 'MIXTO' | null {
    if (text.includes('mixto')) return 'MIXTO';
    
    // Heuristic: if has both "euribor" and "fijo", likely MIXTO
    if (text.includes('euribor') && text.includes('fijo') && text.includes('tramo')) {
      return 'MIXTO';
    }
    
    if (text.includes('variable') || text.includes('euribor') || text.includes('revisión')) {
      return 'VARIABLE';
    }
    
    if (text.includes('fijo') || text.includes('tin')) {
      return 'FIJO';
    }
    
    return null;
  }

  /**
   * Extract bank name
   */
  private static extractBanco(text: string): string | null {
    const bankPatterns = [
      { pattern: /banco\s+santander/i, name: 'Banco Santander' },
      { pattern: /bbva/i, name: 'BBVA' },
      { pattern: /caixabank|la\s+caixa/i, name: 'CaixaBank' },
      { pattern: /banco\s+sabadell/i, name: 'Banco Sabadell' },
      { pattern: /bankinter/i, name: 'Bankinter' },
      { pattern: /ing\s+direct/i, name: 'ING' },
      { pattern: /openbank/i, name: 'Openbank' },
      { pattern: /kutxabank/i, name: 'Kutxabank' },
      { pattern: /unicaja/i, name: 'Unicaja Banco' },
      { pattern: /cajamar/i, name: 'Cajamar' },
      { pattern: /abanca/i, name: 'Abanca' },
      { pattern: /liberbank/i, name: 'Liberbank' }
    ];

    for (const { pattern, name } of bankPatterns) {
      if (pattern.test(text)) {
        return name;
      }
    }

    return null;
  }

  /**
   * Extract capital amount
   */
  private static extractCapital(text: string): number | null {
    const patterns = [
      /(?:capital|importe|principal).*?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/gi,
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€.*?(?:capital|importe|principal)/gi,
      /solicitado.*?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const amount = this.parseSpanishAmount(match[1]);
        // Validate reasonable mortgage range
        if (amount >= 10000 && amount <= 5000000) {
          return amount;
        }
      }
    }

    return null;
  }

  /**
   * Extract plazo in months
   */
  private static extractPlazo(text: string): number | null {
    // Try months first
    const monthsMatch = text.match(/plazo.*?(\d+)\s*meses/i);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1]);
      if (months >= 12 && months <= 600) return months; // 1-50 years
    }

    // Try years
    const yearsMatch = text.match(/plazo.*?(\d+)\s*años?/i);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1]);
      if (years >= 1 && years <= 50) return years * 12;
    }

    return null;
  }

  /**
   * Extract TIN
   */
  private static extractTIN(text: string): number | null {
    const patterns = [
      /tin.*?(\d{1,2},\d{1,3})\s*%/gi,
      /tipo.*?interés.*?nominal.*?(\d{1,2},\d{1,3})\s*%/gi,
      /resultante.*?(\d{1,2},\d{1,3})\s*%/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const rate = this.parseSpanishPercentage(match[1]);
        if (rate >= 0 && rate <= 20) return rate;
      }
    }

    return null;
  }

  /**
   * Extract index reference
   */
  private static extractIndice(text: string): 'EURIBOR' | 'IRPH' | null {
    if (text.includes('euribor') || text.includes('euríbor')) return 'EURIBOR';
    if (text.includes('irph')) return 'IRPH';
    return null;
  }

  /**
   * Extract diferencial
   */
  private static extractDiferencial(text: string): number | null {
    const patterns = [
      /diferencial.*?(\d{1,2},\d{1,3})\s*%/gi,
      /\+\s*(\d{1,2},\d{1,3})\s*%/gi,
      /aplicable.*?(\d{1,2},\d{1,3})\s*%/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const diff = this.parseSpanishPercentage(match[1]);
        if (diff >= 0 && diff <= 10) return diff;
      }
    }

    return null;
  }

  /**
   * Extract valor actual del índice
   */
  private static extractValorIndice(text: string): number | null {
    const patterns = [
      /valor.*?índice.*?actual.*?(\d{1,2},\d{1,3})\s*%/gi,
      /euribor.*?actual.*?(\d{1,2},\d{1,3})\s*%/gi,
      /índice.*?(\d{1,2},\d{1,3})\s*%/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const rate = this.parseSpanishPercentage(match[1]);
        if (rate >= 0 && rate <= 15) return rate;
      }
    }

    return null;
  }

  /**
   * Extract revision period
   */
  private static extractRevision(text: string): 6 | 12 | null {
    if (text.includes('semestral') || text.includes('6 meses')) return 6;
    if (text.includes('anual') || text.includes('12 meses')) return 12;
    return 12; // Default for Spanish mortgages
  }

  /**
   * Extract opening commission
   */
  private static extractComisionApertura(text: string): number | null {
    const patterns = [
      /apertura.*?(\d{1,2},\d{1,3})\s*%/gi,
      /comisión.*?apertura.*?(\d{1,2},\d{1,3})\s*%/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const commission = this.parseSpanishPercentage(match[1]);
        if (commission >= 0 && commission <= 5) return commission;
      }
    }

    // Check for "sin comisión" or "0,00%"
    if (text.includes('sin comisión') || text.includes('0,00%')) {
      return 0;
    }

    return null;
  }

  /**
   * Extract maintenance commission
   */
  private static extractComisionMantenimiento(text: string): number | null {
    const patterns = [
      /mantenimiento.*?(\d{1,3}(?:,\d{2})?)\s*€.*?mes/gi,
      /comisión.*?mantenimiento.*?(\d{1,3}(?:,\d{2})?)\s*€/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const amount = this.parseSpanishAmount(match[1]);
        if (amount >= 0 && amount <= 100) return amount;
      }
    }

    // Check for "sin comisión" or "0,00 €"
    if (text.includes('0,00 €/mes') || text.includes('sin comisión')) {
      return 0;
    }

    return null;
  }

  /**
   * Extract early amortization commission
   */
  private static extractAmortizacionAnticipada(text: string): number | null {
    const patterns = [
      /amortización.*?anticipada.*?(\d{1,2},\d{1,3})\s*%/gi,
      /cancelación.*?anticipada.*?(\d{1,2},\d{1,3})\s*%/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const commission = this.parseSpanishPercentage(match[1]);
        if (commission >= 0 && commission <= 5) return commission;
      }
    }

    // Check for "sin comisión"
    if (text.includes('sin comisión por amortización') || text.includes('0,00%')) {
      return 0;
    }

    return null;
  }

  /**
   * Extract partial IBAN
   */
  private static extractIbanParcial(text: string): string | null {
    const patterns = [
      /es\d{2}\s*\d{4}\s*\*+\s*\*+\s*\*+\s*(\d{4})/gi,
      /\*+\s*\*+\s*\*+\s*(\d{4})/gi,
      /iban.*?(\d{4})\s*$/gmi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] && match[1].length === 4) {
          return match[1];
        }
      }
    }

    return null;
  }

  /**
   * Extract fecha de firma
   */
  private static extractFechaFirma(text: string): string | null {
    const patterns = [
      /fecha.*?firma.*?(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      /firma.*?(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      /(\d{1,2}\/\d{1,2}\/\d{4})/gi
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const dateStr = match[1];
        if (this.isValidDate(dateStr)) {
          return this.parseSpanishDate(dateStr);
        }
      }
    }

    return null;
  }

  /**
   * Extract bonifications
   */
  private static extractBonificaciones(text: string): NonNullable<FeinLoanDraft['bonificaciones']> {
    const bonifications: NonNullable<FeinLoanDraft['bonificaciones']> = [];

    const patterns = [
      {
        id: 'nomina',
        keywords: ['nómina', 'nomina', 'domiciliación nómina'],
        etiqueta: 'Domiciliación de nómina'
      },
      {
        id: 'recibos',
        keywords: ['recibos', 'domiciliaciones', 'domiciliación recibos'],
        etiqueta: 'Domiciliación de recibos'
      },
      {
        id: 'tarjeta',
        keywords: ['tarjeta', 'tarjeta crédito', 'tarjeta débito'],
        etiqueta: 'Tarjeta de crédito/débito'
      },
      {
        id: 'hogar',
        keywords: ['seguro hogar', 'seguro vivienda', 'hogar obligatorio'],
        etiqueta: 'Seguro de hogar'
      },
      {
        id: 'vida',
        keywords: ['seguro vida', 'vida opcional', 'seguro de vida'],
        etiqueta: 'Seguro de vida'
      },
      {
        id: 'pensiones',
        keywords: ['plan pensiones', 'plan de pensiones'],
        etiqueta: 'Plan de pensiones'
      },
      {
        id: 'alarma',
        keywords: ['alarma', 'sistema alarma', 'seguridad'],
        etiqueta: 'Sistema de alarma'
      }
    ];

    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        if (text.toLowerCase().includes(keyword)) {
          // Try to extract discount points
          const discountRegex = new RegExp(
            `${keyword}[^0-9]*(-?\\d{1,2}[.,]\\d{1,2})\\s*(?:puntos?|pp|%)`,
            'gi'
          );
          
          const discountMatch = text.match(discountRegex);
          let descuentoPuntos: number | undefined;
          
          if (discountMatch) {
            const discountStr = discountMatch[0].match(/-?\d{1,2}[.,]\d{1,2}/)?.[0];
            if (discountStr) {
              descuentoPuntos = Math.abs(this.parseSpanishPercentage(discountStr));
            }
          }

          // Try to extract criteria
          const criterioRegex = new RegExp(`${keyword}[^.]{0,100}`, 'gi');
          const criterioMatch = text.match(criterioRegex);
          const criterio = criterioMatch ? criterioMatch[0].trim().substring(0, 80) : undefined;

          // Avoid duplicates
          if (!bonifications.some(b => b.id === pattern.id)) {
            bonifications.push({
              id: pattern.id,
              etiqueta: pattern.etiqueta,
              descuentoPuntos,
              criterio
            });
          }
          break;
        }
      }
    }

    return bonifications;
  }

  /**
   * Calculate extraction confidence
   */
  private static calculateConfidence(draft: FeinLoanDraft): number {
    let score = 0;
    let total = 0;

    // Critical fields (higher weight)
    const criticalFields = [
      'banco', 'capitalInicial', 'plazoMeses', 'tipo'
    ];

    criticalFields.forEach(field => {
      total += 2;
      if (draft.prestamo[field as keyof typeof draft.prestamo]) score += 2;
    });

    // Interest rate fields (medium weight)
    if (draft.prestamo.tipo === 'FIJO') {
      total += 2;
      if (draft.prestamo.tinFijo) score += 2;
    } else if (draft.prestamo.tipo === 'VARIABLE') {
      total += 3;
      if (draft.prestamo.indiceReferencia) score += 1;
      if (draft.prestamo.diferencial) score += 1;
      if (draft.prestamo.revisionMeses) score += 1;
    }

    // Optional fields (lower weight)
    const optionalFields = [
      'comisionAperturaPct', 'ibanCargoParcial', 'fechaFirmaPrevista'
    ];

    optionalFields.forEach(field => {
      total += 1;
      if (draft.prestamo[field as keyof typeof draft.prestamo] !== null) score += 1;
    });

    // Bonifications
    total += 1;
    if (draft.bonificaciones && draft.bonificaciones.length > 0) score += 1;

    return total > 0 ? Math.round((score / total) * 100) / 100 : 0;
  }

  /**
   * Utility: Parse Spanish number format (123.456,78)
   */
  private static parseSpanishAmount(str: string): number {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed);
  }

  /**
   * Utility: Parse Spanish percentage (2,95)
   */
  private static parseSpanishPercentage(str: string): number {
    const normalized = str.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  }

  /**
   * Utility: Parse Spanish date (dd/mm/yyyy)
   */
  private static parseSpanishDate(str: string): string {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return str;
  }

  /**
   * Utility: Validate date format
   */
  private static isValidDate(dateStr: string): boolean {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    
    return day >= 1 && day <= 31 && 
           month >= 1 && month <= 12 && 
           year >= 2020 && year <= 2030; // Reasonable range
  }
}