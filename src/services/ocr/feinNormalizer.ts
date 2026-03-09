// FEIN Normalizer Service - Extract and aggregate FEIN data from OCR chunks
// Implements compact JSON generation and field normalization per problem statement

import { FeinLoanDraft, ChunkProcessingResult } from '../../types/fein';
import { OCR_CONFIG } from '../../config/ocr.config';

export class FeinNormalizer {
  
  /**
   * Aggregate chunk results into a single FeinLoanDraft
   * Handles deduplication and field prioritization
   */
  static aggregateChunks(
    chunks: ChunkProcessingResult[],
    sourceFileName: string,
    totalPages: number,
    ocrProvider: string = 'google'
  ): FeinLoanDraft {
    const processedPages = chunks.reduce((sum, chunk) => 
      sum + (chunk.pageRange.to - chunk.pageRange.from + 1), 0
    );

    // Start with base structure
    const draft: FeinLoanDraft = {
      metadata: {
        sourceFileName,
        pagesTotal: totalPages,
        pagesProcessed: processedPages,
        ocrProvider,
        processedAt: new Date().toISOString(),
        warnings: []
      },
      prestamo: {
        tipo: null,
        periodicidadCuota: null,
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

    // Aggregate data from all chunks
    const allData = chunks.map(chunk => chunk.extractedData);
    const allBonifications = chunks.flatMap(chunk => chunk.bonificaciones || []);

    // Merge prestamo data with prioritization (last non-null value wins)
    draft.prestamo = this.mergeLoanData(allData);
    
    // Deduplicate and merge bonifications
    draft.bonificaciones = this.mergeBonifications(allBonifications);

    // Add warnings for missing or conflicting data
    draft.metadata.warnings = this.generateWarnings(chunks, draft);

    return draft;
  }

  /**
   * Merge loan data from multiple chunks with prioritization
   * Later chunks (financial conditions section) take precedence
   */
  private static mergeLoanData(
    dataArray: Partial<FeinLoanDraft['prestamo']>[]
  ): FeinLoanDraft['prestamo'] {
    const merged: FeinLoanDraft['prestamo'] = {
      tipo: null,
      periodicidadCuota: null,
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
    };

    // Merge all chunks, later chunks override earlier ones
    for (const data of dataArray) {
      Object.keys(data).forEach(key => {
        const value = data[key as keyof typeof data];
        if (value !== null && value !== undefined) {
          (merged as any)[key] = value;
        }
      });
    }

    return merged;
  }

  /**
   * Merge and deduplicate bonifications
   */
  private static mergeBonifications(
    bonifications: NonNullable<FeinLoanDraft['bonificaciones']>
  ): FeinLoanDraft['bonificaciones'] {
    const seen = new Set<string>();
    const merged: NonNullable<FeinLoanDraft['bonificaciones']> = [];

    for (const bonif of bonifications) {
      if (!seen.has(bonif.id)) {
        seen.add(bonif.id);
        merged.push(bonif);
      }
    }

    return merged;
  }

  /**
   * Extract FEIN data from raw OCR text (single chunk)
   * This handles the core extraction logic for each chunk
   */
  static extractFromChunk(
    ocrText: string,
    chunkIndex: number,
    pageRange: { from: number; to: number }
  ): Partial<FeinLoanDraft['prestamo']> & { bonificaciones?: FeinLoanDraft['bonificaciones'] } {
    const text = ocrText.toLowerCase();
    const originalText = ocrText;

    const extracted: Partial<FeinLoanDraft['prestamo']> = {};
    const bonificaciones: NonNullable<FeinLoanDraft['bonificaciones']> = [];

    // Extract bank name
    const banco = this.extractBankName(text);
    if (banco) extracted.banco = banco;

    // Extract loan type
    const tipo = this.extractLoanType(text);
    if (tipo) extracted.tipo = tipo;

    // Extract capital amount
    const capital = this.extractCapital(text);
    if (capital) extracted.capitalInicial = capital;

    // Extract term in months
    const plazo = this.extractPlazoMeses(text);
    if (plazo) extracted.plazoMeses = plazo;

    // Extract interest rates
    const tin = this.extractTIN(text);
    if (tin) extracted.tinFijo = tin;

    const diferencial = this.extractDiferencial(text);
    if (diferencial) extracted.diferencial = diferencial;

    // Extract index reference
    const indice = this.extractIndiceReferencia(text);
    if (indice) extracted.indiceReferencia = indice;

    // Extract revision period
    const revision = this.extractRevisionMeses(text);
    if (revision) extracted.revisionMeses = revision;

    // Extract commissions
    const comisionApertura = this.extractComisionApertura(text);
    if (comisionApertura) extracted.comisionAperturaPct = comisionApertura;

    const comisionMantenimiento = this.extractComisionMantenimiento(text);
    if (comisionMantenimiento) extracted.comisionMantenimientoMes = comisionMantenimiento;

    // Extract IBAN partial
    const iban = this.extractIbanParcial(text);
    if (iban) extracted.ibanCargoParcial = iban;

    // Extract bonifications
    const extractedBonifications = this.extractBonificaciones(originalText);
    bonificaciones.push(...extractedBonifications);

    return {
      ...extracted,
      bonificaciones: bonificaciones.length > 0 ? bonificaciones : undefined
    };
  }

  /**
   * Extract bank name from text
   */
  private static extractBankName(text: string): string | null {
    // Common bank name patterns
    const bankPatterns = [
      /(?:banco\s+)?santander/i,
      /(?:banco\s+)?bbva/i,
      /caixabank|la caixa/i,
      /(?:banco\s+)?sabadell/i,
      /bankinter/i,
      /(?:banco\s+)?popular/i,
      /(?:banco\s+)?pastor/i,
      /ing\s+direct/i,
      /openbank/i,
      /kutxabank/i,
      /unicaja/i,
      /cajamar/i
    ];

    for (const pattern of bankPatterns) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizeBankName(match[0]);
      }
    }

    return null;
  }

  private static normalizeBankName(bankText: string): string {
    const normalized = bankText.toLowerCase().trim();
    
    if (normalized.includes('santander')) return 'Banco Santander';
    if (normalized.includes('bbva')) return 'BBVA';
    if (normalized.includes('caixa')) return 'CaixaBank';
    if (normalized.includes('sabadell')) return 'Banco Sabadell';
    if (normalized.includes('bankinter')) return 'Bankinter';
    if (normalized.includes('ing')) return 'ING';
    if (normalized.includes('openbank')) return 'Openbank';
    
    // Capitalize first letter for unknown banks
    return bankText.charAt(0).toUpperCase() + bankText.slice(1).toLowerCase();
  }

  /**
   * Extract loan type from text
   */
  private static extractLoanType(text: string): 'FIJO' | 'VARIABLE' | 'MIXTO' | null {
    if (text.includes('mixto')) return 'MIXTO';
    if (text.includes('variable')) return 'VARIABLE';
    if (text.includes('fijo')) return 'FIJO';
    return null;
  }

  /**
   * Extract capital amount (convert from text like "250.000,00 €" to 250000)
   */
  private static extractCapital(text: string): number | null {
    // Pattern for amounts like "250.000,00 €" or "250000 €"
    const patterns = [
      /importe.*?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/i,
      /capital.*?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/i,
      /principal.*?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.parseSpanishAmount(match[1]);
      }
    }

    return null;
  }

  /**
   * Parse Spanish amount format (123.456,78) to number (123456.78)
   */
  private static parseSpanishAmount(amountStr: string): number {
    // Remove thousand separators (.) and replace decimal comma with dot
    const normalized = amountStr.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed); // Round to avoid floating point issues
  }

  /**
   * Parse Spanish percentage (2,95 %) to number (2.95)
   */
  private static parseSpanishPercentage(percentStr: string): number {
    const normalized = percentStr.replace('%', '').replace(',', '.').trim();
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100; // Round to 2 decimals
  }

  /**
   * Extract term in months from text
   */
  private static extractPlazoMeses(text: string): number | null {
    // Try months first
    const monthsMatch = text.match(/(\d+)\s*meses/i);
    if (monthsMatch) {
      return parseInt(monthsMatch[1]);
    }

    // Convert years to months
    const yearsMatch = text.match(/(\d+)\s*a[ñn]os/i);
    if (yearsMatch) {
      return parseInt(yearsMatch[1]) * 12;
    }

    return null;
  }

  /**
   * Extract TIN (fixed interest rate)
   */
  private static extractTIN(text: string): number | null {
    const patterns = [
      /tin.*?(\d{1,2},\d{2})\s*%/i,
      /tipo.*?interés.*?nominal.*?(\d{1,2},\d{2})\s*%/i,
      /interés.*?fijo.*?(\d{1,2},\d{2})\s*%/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.parseSpanishPercentage(match[1]);
      }
    }

    return null;
  }

  /**
   * Extract diferencial (spread)
   */
  private static extractDiferencial(text: string): number | null {
    const patterns = [
      /diferencial.*?(\d{1,2},\d{2})\s*%/i,
      /margen.*?(\d{1,2},\d{2})\s*%/i,
      /\+\s*(\d{1,2},\d{2})\s*%/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.parseSpanishPercentage(match[1]);
      }
    }

    return null;
  }

  /**
   * Extract index reference
   */
  private static extractIndiceReferencia(text: string): 'EURIBOR' | 'IRPH' | null {
    if (text.includes('euribor') || text.includes('euríbor')) return 'EURIBOR';
    if (text.includes('irph')) return 'IRPH';
    return null;
  }

  /**
   * Extract revision period in months
   */
  private static extractRevisionMeses(text: string): 6 | 12 | null {
    if (text.includes('semestral') || text.includes('6 meses')) return 6;
    if (text.includes('anual') || text.includes('12 meses')) return 12;
    return null;
  }

  /**
   * Extract opening commission percentage
   */
  private static extractComisionApertura(text: string): number | null {
    const patterns = [
      /comisión.*?apertura.*?(\d{1,2},\d{2})\s*%/i,
      /apertura.*?(\d{1,2},\d{2})\s*%/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.parseSpanishPercentage(match[1]);
      }
    }

    return null;
  }

  /**
   * Extract maintenance commission in euros per month
   */
  private static extractComisionMantenimiento(text: string): number | null {
    const patterns = [
      /mantenimiento.*?(\d{1,3}(?:,\d{2})?)\s*€.*?mes/i,
      /comisión.*?mantenimiento.*?(\d{1,3}(?:,\d{2})?)\s*€/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.parseSpanishAmount(match[1]);
      }
    }

    return null;
  }

  /**
   * Extract partial IBAN (last 4 digits)
   */
  private static extractIbanParcial(text: string): string | null {
    // Look for IBAN patterns with masking
    const patterns = [
      /es\d{2}\s*\*{4}\s*\*{4}\s*\*{4}\s*\*{4}\s*(\d{4})/i,
      /\*{4}\s*\*{4}\s*\*{4}\s*(\d{4})/i,
      /\*{12}(\d{4})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract bonifications from text
   */
  private static extractBonificaciones(text: string): NonNullable<FeinLoanDraft['bonificaciones']> {
    const bonifications: NonNullable<FeinLoanDraft['bonificaciones']> = [];

    // Common bonification patterns
    const patterns = [
      { id: 'nomina', keywords: ['nómina', 'nomina', 'salario'], label: 'Domiciliación de nómina' },
      { id: 'recibos', keywords: ['recibos', 'domiciliaciones'], label: 'Domiciliación de recibos' },
      { id: 'tarjeta', keywords: ['tarjeta'], label: 'Tarjeta de crédito/débito' },
      { id: 'hogar', keywords: ['seguro.*hogar', 'hogar'], label: 'Seguro de hogar' },
      { id: 'vida', keywords: ['seguro.*vida', 'vida'], label: 'Seguro de vida' },
      { id: 'pensiones', keywords: ['plan.*pensiones', 'pensiones'], label: 'Plan de pensiones' },
      { id: 'alarma', keywords: ['alarma', 'seguridad'], label: 'Sistema de alarma' }
    ];

    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        const regex = new RegExp(keyword, 'i');
        if (regex.test(text)) {
          // Try to extract discount points
          const discountMatch = text.match(new RegExp(`${keyword}.*?(\\d{1,2},\\d{2})\\s*(?:puntos|pp|%)`, 'i'));
          const descuentoPuntos = discountMatch ? this.parseSpanishPercentage(discountMatch[1]) : undefined;

          bonifications.push({
            id: pattern.id,
            etiqueta: pattern.label,
            descuentoPuntos,
            criterio: this.extractBonificationCriterio(text, keyword)
          });
          break; // Only add once per bonification type
        }
      }
    }

    return bonifications;
  }

  /**
   * Extract bonification criteria/requirements
   */
  private static extractBonificationCriterio(text: string, keyword: string): string | undefined {
    // Try to extract requirement text near the keyword
    const regex = new RegExp(`${keyword}[^.]{0,100}`, 'i');
    const match = text.match(regex);
    if (match) {
      return match[0].trim().substring(0, 100); // Limit to 100 chars
    }
    return undefined;
  }

  /**
   * Generate warnings for incomplete or conflicting data
   */
  private static generateWarnings(chunks: ChunkProcessingResult[], draft: FeinLoanDraft): string[] {
    const warnings: string[] = [];

    // Check for missing critical fields
    if (!draft.prestamo.capitalInicial) {
      warnings.push('No se pudo extraer el capital inicial del préstamo');
    }
    if (!draft.prestamo.tipo) {
      warnings.push('No se pudo determinar el tipo de interés (fijo/variable/mixto)');
    }
    if (!draft.prestamo.banco) {
      warnings.push('No se pudo identificar la entidad bancaria');
    }

    // Check for chunk processing errors
    const failedChunks = chunks.filter(chunk => chunk.error);
    if (failedChunks.length > 0) {
      warnings.push(`${failedChunks.length} bloques de páginas no se pudieron procesar completamente`);
    }

    // Check for low confidence
    const avgConfidence = chunks.reduce((sum, chunk) => sum + chunk.confidence, 0) / chunks.length;
    if (avgConfidence < 0.7) {
      warnings.push('Confianza baja en la extracción de datos. Revisar manualmente.');
    }

    // Limit warnings to 3 as per requirements
    return warnings.slice(0, 3);
  }

  /**
   * Compact the response if it exceeds size limits
   */
  static compactResponse(draft: FeinLoanDraft): FeinLoanDraft {
    const jsonSize = JSON.stringify(draft).length;
    
    if (jsonSize <= OCR_CONFIG.responseSizeSoftLimitBytes) {
      // Still apply warning limits even for small responses
      const compacted = JSON.parse(JSON.stringify(draft));
      
      // Limit warnings to 3 most important
      if (compacted.metadata.warnings && compacted.metadata.warnings.length > 3) {
        compacted.metadata.warnings = compacted.metadata.warnings.slice(0, 3);
      }
      
      return compacted;
    }

    // Create a copy for compacting
    const compacted = JSON.parse(JSON.stringify(draft));

    // Limit warnings to 3 most important
    if (compacted.metadata.warnings && compacted.metadata.warnings.length > 3) {
      compacted.metadata.warnings = compacted.metadata.warnings.slice(0, 3);
    }

    // Truncate long string fields
    if (compacted.prestamo.aliasSugerido && compacted.prestamo.aliasSugerido.length > 50) {
      compacted.prestamo.aliasSugerido = compacted.prestamo.aliasSugerido.substring(0, 50) + '...';
    }

    // Limit bonifications
    if (compacted.bonificaciones && compacted.bonificaciones.length > 10) {
      compacted.bonificaciones = compacted.bonificaciones.slice(0, 10);
    }

    // Truncate bonification criteria
    compacted.bonificaciones?.forEach((bonif: any) => {
      if (bonif.criterio && bonif.criterio.length > 100) {
        bonif.criterio = bonif.criterio.substring(0, 100) + '...';
      }
    });

    return compacted;
  }
}