/**
 * Column Role Detection Service
 * Uses heuristics to detect column roles: fecha, descripción, débito/crédito, importe, saldo, referencia
 */

import { dateFormatDetector } from './dateFormatDetector';
import { localeDetector } from './localeDetector';

export type ColumnRole = 
  | 'date' 
  | 'valueDate'
  | 'description' 
  | 'counterparty'
  | 'debit' 
  | 'credit' 
  | 'amount' 
  | 'balance' 
  | 'reference'
  | 'unknown';

export interface ColumnDetectionResult {
  role: ColumnRole;
  confidence: number;
  reason: string;
  samples: string[];
}

export interface SchemaDetectionResult {
  columns: { [columnIndex: number]: ColumnDetectionResult };
  overallConfidence: number;
  needsManualMapping: boolean;
  ambiguities: string[];
}

export class ColumnRoleDetector {
  
  // Column header patterns (normalized to lowercase)
  private static readonly HEADER_PATTERNS = {
    date: [
      'fecha', 'fecha operacion', 'fecha operación', 'f operacion', 'f operación',
      'fecha mov', 'fecha movimiento', 'date', 'operation date', 'fecha de operacion',
      'fec.', 'booking date', 'valor', 'postdate' // Problem statement patterns
    ],
    valueDate: [
      'fecha valor', 'f valor', 'value date', 'f. valor', 'fecha de valor'
    ],
    description: [
      'concepto', 'descripcion', 'descripción', 'detalle', 'descripcion ampliada',
      'detalle operacion', 'detalle operación', 'description', 'observaciones',
      'motivo', 'concepto operacion', 'concepto operación', 'details', 'concept' // Problem statement patterns
    ],
    counterparty: [
      'contraparte', 'beneficiario', 'ordenante', 'entidad', 'empresa',
      'contrapartida', 'tercero', 'counterparty', 'payee', 'payer', 'proveedor'
    ],
    debit: [
      'cargo', 'cargos', 'debito', 'débito', 'debe', 'debit', 'paid out',
      'salida', 'adeudo', 'cargo en cuenta'
    ],
    credit: [
      'abono', 'abonos', 'credito', 'crédito', 'haber', 'credit', 'paid in',
      'ingreso', 'entrada', 'abono en cuenta'
    ],
    amount: [
      'importe', 'importe (€)', 'importe eur', 'cantidad', 'monto', 'valor',
      'euros', 'eur', 'movimiento', 'amount', 'saldo movimiento', 'import' // Problem statement patterns
    ],
    balance: [
      'saldo', 'saldo disponible', 'saldo tras', 'saldo después', 'balance',
      'saldo final', 'saldo resultante', 'saldo actual', 'saldo posterior'
    ],
    reference: [
      'referencia', 'ref', 'numero operacion', 'número operación', 'reference',
      'num operacion', 'núm operación', 'id operacion', 'id operación',
      'numero', 'número', 'id', 'ticket'
    ]
  };

  /**
   * Detect schema from data samples
   */
  detectSchema(data: any[][], headerRow?: number): SchemaDetectionResult {
    if (!data || data.length === 0) {
      return this.getEmptyResult();
    }

    const headers = headerRow !== undefined && data[headerRow] ? data[headerRow] : [];
    const sampleRows = this.getSampleRows(data, headerRow);
    
    if (sampleRows.length === 0) {
      return this.getEmptyResult();
    }

    const columns: { [columnIndex: number]: ColumnDetectionResult } = {};
    const ambiguities: string[] = [];

    // Detect each column role
    for (let colIndex = 0; colIndex < Math.max(headers.length, sampleRows[0]?.length || 0); colIndex++) {
      const header = headers[colIndex] || '';
      const columnSamples = sampleRows
        .map(row => row[colIndex])
        .filter(cell => cell != null && cell !== '')
        .map(cell => cell.toString().trim());

      const result = this.detectColumnRole(header, columnSamples);
      columns[colIndex] = result;

      if (result.confidence < 0.8) {
        ambiguities.push(`Column ${colIndex} (${header || 'unnamed'}): ${result.reason}`);
      }
    }

    // Validate schema and detect conflicts
    const validation = this.validateSchema(columns);
    const overallConfidence = this.calculateOverallConfidence(columns);

    return {
      columns,
      overallConfidence,
      needsManualMapping: overallConfidence < 0.8 || validation.hasConflicts,
      ambiguities: [...ambiguities, ...validation.conflicts]
    };
  }

  /**
   * Detect role for a single column
   */
  private detectColumnRole(header: string, samples: string[]): ColumnDetectionResult {
    const normalizedHeader = this.normalizeHeader(header);
    
    // 1. Try header-based detection first
    const headerResult = this.detectByHeader(normalizedHeader);
    if (headerResult.confidence >= 0.9) {
      return { ...headerResult, samples: samples.slice(0, 3) };
    }

    // 2. Try content-based detection
    const contentResult = this.detectByContent(samples);
    
    // 3. Combine results
    if (headerResult.confidence > 0.5 && contentResult.confidence > 0.5) {
      // Both methods agree
      if (headerResult.role === contentResult.role) {
        return {
          role: headerResult.role,
          confidence: Math.min((headerResult.confidence + contentResult.confidence) / 2 + 0.1, 0.95),
          reason: `Header and content analysis agree: ${headerResult.reason}`,
          samples: samples.slice(0, 3)
        };
      } else {
        // Disagreement - prefer content for data-heavy columns
        const preferContent = ['amount', 'debit', 'credit', 'balance', 'date'].includes(contentResult.role);
        return preferContent ? 
          { ...contentResult, samples: samples.slice(0, 3) } : 
          { ...headerResult, samples: samples.slice(0, 3) };
      }
    }

    // 4. Use best single result
    const bestResult = headerResult.confidence > contentResult.confidence ? headerResult : contentResult;
    return { ...bestResult, samples: samples.slice(0, 3) };
  }

  /**
   * Detect role by header text
   */
  private detectByHeader(normalizedHeader: string): { role: ColumnRole; confidence: number; reason: string } {
    for (const [role, patterns] of Object.entries(ColumnRoleDetector.HEADER_PATTERNS)) {
      for (const pattern of patterns) {
        if (normalizedHeader.includes(pattern)) {
          return {
            role: role as ColumnRole,
            confidence: 0.9,
            reason: `Header matches "${pattern}"`
          };
        }
      }
    }

    return {
      role: 'unknown',
      confidence: 0.2,
      reason: 'No header pattern match'
    };
  }

  /**
   * Detect role by column content
   */
  private detectByContent(samples: string[]): { role: ColumnRole; confidence: number; reason: string } {
    if (samples.length === 0) {
      return { role: 'unknown', confidence: 0, reason: 'No samples' };
    }

    // Date detection
    const dateResult = this.detectDateColumn(samples);
    if (dateResult.confidence > 0.7) {
      return dateResult;
    }

    // Number detection (amount, balance, debit, credit)
    const numberResult = this.detectNumberColumn(samples);
    if (numberResult.confidence > 0.7) {
      return numberResult;
    }

    // Reference detection (alphanumeric patterns)
    const refResult = this.detectReferenceColumn(samples);
    if (refResult.confidence > 0.7) {
      return refResult;
    }

    // Description/counterparty detection (text with variety)
    const textResult = this.detectTextColumn(samples);
    if (textResult.confidence > 0.6) {
      return textResult;
    }

    return {
      role: 'unknown',
      confidence: 0.3,
      reason: 'Content analysis inconclusive'
    };
  }

  /**
   * Detect if column contains dates
   */
  private detectDateColumn(samples: string[]): { role: ColumnRole; confidence: number; reason: string } {
    let parsedDates = 0;
    
    for (const sample of samples.slice(0, 10)) { // Check first 10 samples
      const result = dateFormatDetector.parseDate(sample);
      if (result && result.confidence > 0.6) {
        parsedDates++;
      }
    }

    const confidence = parsedDates / Math.min(samples.length, 10);
    
    if (confidence >= 0.6) {
      return {
        role: 'date',
        confidence: Math.min(confidence, 0.95),
        reason: `${parsedDates}/${Math.min(samples.length, 10)} samples parsed as dates`
      };
    }

    return { role: 'unknown', confidence: confidence * 0.5, reason: 'Few date matches' };
  }

  /**
   * Detect if column contains numbers (amounts, balances)
   */
  private detectNumberColumn(samples: string[]): { role: ColumnRole; confidence: number; reason: string } {
    const locale = localeDetector.detectLocaleNumber(samples);
    let parsedNumbers = 0;
    let hasNegatives = 0;
    let hasBalanceProgression = false;

    const parsedValues: number[] = [];

    for (const sample of samples.slice(0, 15)) {
      const result = localeDetector.parseImporte(sample, locale);
      if (result.confidence > 0.5) {
        parsedNumbers++;
        parsedValues.push(result.value);
        if (result.value < 0) {
          hasNegatives++;
        }
      }
    }

    const numberConfidence = parsedNumbers / Math.min(samples.length, 15);
    
    if (numberConfidence < 0.6) {
      return { role: 'unknown', confidence: numberConfidence * 0.3, reason: 'Not enough numeric values' };
    }

    // Check for balance progression (each value approximately equals previous + movement)
    if (parsedValues.length >= 3) {
      hasBalanceProgression = this.detectBalanceProgression(parsedValues);
    }

    // Determine specific number role
    if (hasBalanceProgression) {
      return {
        role: 'balance',
        confidence: Math.min(numberConfidence + 0.2, 0.95),
        reason: 'Numbers follow balance progression pattern'
      };
    }

    if (hasNegatives > 0 && hasNegatives < parsedNumbers * 0.9) {
      return {
        role: 'amount',
        confidence: Math.min(numberConfidence, 0.9),
        reason: 'Mixed positive/negative numbers suggest amounts'
      };
    }

    if (hasNegatives === 0) {
      return {
        role: 'credit', // or could be debit, but credit is more common for positive-only
        confidence: Math.min(numberConfidence, 0.8),
        reason: 'All positive numbers suggest credit column'
      };
    }

    return {
      role: 'amount',
      confidence: Math.min(numberConfidence, 0.8),
      reason: 'Numeric column, likely amounts'
    };
  }

  /**
   * Detect reference columns (alphanumeric IDs, IBANs, etc.)
   */
  private detectReferenceColumn(samples: string[]): { role: ColumnRole; confidence: number; reason: string } {
    let refPatterns = 0;
    
    for (const sample of samples.slice(0, 10)) {
      // IBAN pattern
      if (/^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{1,7}$/.test(sample)) {
        refPatterns += 2; // Strong match
      }
      // Alphanumeric ID patterns
      else if (/^[A-Z0-9]{6,20}$/.test(sample) || /^\d{10,}$/.test(sample)) {
        refPatterns++;
      }
    }

    const confidence = Math.min(refPatterns / samples.length, 0.9);
    
    if (confidence >= 0.6) {
      return {
        role: 'reference',
        confidence,
        reason: 'Alphanumeric patterns suggest reference column'
      };
    }

    return { role: 'unknown', confidence: confidence * 0.4, reason: 'Few reference patterns' };
  }

  /**
   * Detect text columns (descriptions, counterparties)
   */
  private detectTextColumn(samples: string[]): { role: ColumnRole; confidence: number; reason: string } {
    if (samples.length === 0) {
      return { role: 'unknown', confidence: 0, reason: 'No text samples' };
    }

    const avgLength = samples.reduce((sum, s) => sum + s.length, 0) / samples.length;
    const uniqueRatio = new Set(samples).size / samples.length;
    
    // Long text with high diversity suggests description
    if (avgLength > 20 && uniqueRatio > 0.7) {
      return {
        role: 'description',
        confidence: 0.8,
        reason: 'Long, diverse text suggests descriptions'
      };
    }

    // Shorter text with medium diversity suggests counterparty
    if (avgLength > 5 && uniqueRatio > 0.5) {
      return {
        role: 'counterparty',
        confidence: 0.7,
        reason: 'Diverse text suggests counterparty names'
      };
    }

    return {
      role: 'description',
      confidence: 0.5,
      reason: 'Text column, defaulting to description'
    };
  }

  /**
   * Check if numbers follow balance progression pattern
   */
  private detectBalanceProgression(values: number[]): boolean {
    if (values.length < 3) return false;

    let progressionMatches = 0;
    
    for (let i = 2; i < values.length; i++) {
      const expectedBalance = values[i - 2] + (values[i - 1] - values[i - 2]);
      const tolerance = Math.abs(values[i]) * 0.1; // 10% tolerance
      
      if (Math.abs(values[i] - expectedBalance) <= tolerance) {
        progressionMatches++;
      }
    }

    return progressionMatches >= (values.length - 2) * 0.6; // 60% must match
  }

  /**
   * Validate detected schema for conflicts
   */
  private validateSchema(columns: { [index: number]: ColumnDetectionResult }): { hasConflicts: boolean; conflicts: string[] } {
    const roleCount: { [role: string]: number } = {};
    const conflicts: string[] = [];

    // Count role assignments
    for (const [index, detection] of Object.entries(columns)) {
      const role = detection.role;
      roleCount[role] = (roleCount[role] || 0) + 1;
    }

    // Check for required roles
    if (!roleCount['date']) {
      conflicts.push('No date column detected');
    }
    
    if (!roleCount['amount'] && !roleCount['debit'] && !roleCount['credit']) {
      conflicts.push('No amount column detected');
    }

    // Check for duplicates of unique roles
    const uniqueRoles = ['date', 'balance'];
    for (const role of uniqueRoles) {
      if (roleCount[role] > 1) {
        conflicts.push(`Multiple ${role} columns detected`);
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(columns: { [index: number]: ColumnDetectionResult }): number {
    const detections = Object.values(columns);
    if (detections.length === 0) return 0;

    const totalConfidence = detections.reduce((sum, d) => sum + d.confidence, 0);
    return totalConfidence / detections.length;
  }

  /**
   * Get sample rows excluding header
   */
  private getSampleRows(data: any[][], headerRow?: number): any[][] {
    const startRow = headerRow !== undefined ? headerRow + 1 : 0;
    return data.slice(startRow, startRow + 20); // Up to 20 sample rows
  }

  /**
   * Normalize header text
   */
  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .trim()
      .replace(/[()]/g, '') // Remove parentheses
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/[áàâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ñ/g, 'n');
  }

  /**
   * Get empty result
   */
  private getEmptyResult(): SchemaDetectionResult {
    return {
      columns: {},
      overallConfidence: 0,
      needsManualMapping: true,
      ambiguities: ['No data available for analysis']
    };
  }
}

export const columnRoleDetector = new ColumnRoleDetector();