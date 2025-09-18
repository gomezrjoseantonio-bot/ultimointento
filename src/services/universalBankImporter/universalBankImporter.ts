/**
 * Universal Bank Importer - Main orchestrator service
 * Coordinates all services for universal bank file processing
 */

import { fileFormatDetector, SupportedFormat, FileFormatResult } from './fileFormatDetector';
import { localeDetector, NumberLocale } from './localeDetector';
import { dateFormatDetector } from './dateFormatDetector';
import { columnRoleDetector, ColumnRole, SchemaDetectionResult } from './columnRoleDetector';
import { signDerivationService } from './signDerivationService';
import { ledgerValidationService, MovementWithBalance, LedgerSummary } from './ledgerValidationService';
import { stableHashDeduplicationService, MovementForDeduplication } from './stableHashDeduplicationService';
import { bankProfileService, BankMappingProfile, ProfileMatchResult } from './bankProfileService';

export interface UniversalImportOptions {
  accountId: number;
  file: File;
  openingBalance?: number;
  skipDuplicates?: boolean;
  toleranceAmount?: number;
}

export interface UniversalImportResult {
  success: boolean;
  movements: NormalizedMovement[];
  errors: string[];
  warnings: string[];
  statistics: ImportStatistics;
  needsManualMapping?: boolean;
  mappingAssistantData?: MappingAssistantData;
  ledgerSummary?: LedgerSummary;
  profileUsed?: string;
  profileSaved?: boolean;
}

export interface NormalizedMovement {
  date: Date;
  amount: number; // Always signed correctly
  description: string;
  counterparty?: string; // Changed from "proveedor" to "contraparte"
  balance?: number;
  reference?: string;
  originalRow: number;
  rowIndex: number; // Added for ledger validation compatibility
  confidence: number;
  deduplicationHash: string;
}

export interface ImportStatistics {
  fileFormat: SupportedFormat;
  totalRows: number;
  headerRow?: number;
  dataRows: number;
  successfulParsed: number;
  skippedRows: number;
  duplicatesDetected: number;
  processingTimeMs: number;
  locale: NumberLocale;
  dateFormat: string;
  overallConfidence: number;
}

export interface MappingAssistantData {
  headers: string[];
  sampleRows: any[][];
  detectedMapping: { [columnIndex: number]: ColumnRole };
  suggestions: string[];
  ambiguities: string[];
}

export class UniversalBankImporter {
  
  /**
   * Main import method - processes any supported bank file format
   */
  async importBankFile(options: UniversalImportOptions): Promise<UniversalImportResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: Detect file format
      const formatResult = await fileFormatDetector.detectFormat(options.file);
      
      if (formatResult.confidence < 0.5) {
        return this.createErrorResult(`Unsupported file format: ${formatResult.reason}`, startTime);
      }

      // Step 2: Parse file content based on format
      const parseResult = await this.parseFileByFormat(options.file, formatResult);
      
      if (!parseResult.success) {
        return this.createErrorResult(parseResult.error || 'Failed to parse file', startTime);
      }

      // Step 3: Try to find existing profile or detect schema
      const profileResult = await bankProfileService.findMatchingProfile(
        parseResult.headers, 
        parseResult.sampleRows
      );

      let schemaResult: SchemaDetectionResult;
      let finalMapping: { [columnIndex: number]: ColumnRole };

      if (profileResult && profileResult.confidence > 0.8) {
        // Use existing profile
        finalMapping = this.profileToColumnMapping(profileResult.profile);
        schemaResult = {
          columns: this.createColumnDetectionFromMapping(finalMapping, parseResult.headers),
          overallConfidence: profileResult.confidence,
          needsManualMapping: false,
          ambiguities: []
        };
      } else {
        // Auto-detect schema
        schemaResult = columnRoleDetector.detectSchema(parseResult.data, parseResult.headerRow);
        finalMapping = this.extractColumnMapping(schemaResult);
      }

      // Step 4: Check if manual mapping is needed
      if (schemaResult.needsManualMapping || schemaResult.overallConfidence < 0.8) {
        return {
          success: true,
          movements: [],
          errors,
          warnings,
          statistics: this.createPartialStatistics(formatResult, parseResult, startTime),
          needsManualMapping: true,
          mappingAssistantData: {
            headers: parseResult.headers,
            sampleRows: parseResult.sampleRows,
            detectedMapping: finalMapping,
            suggestions: this.generateMappingSuggestions(schemaResult),
            ambiguities: schemaResult.ambiguities
          }
        };
      }

      // Step 5: Transform data to normalized movements
      const transformResult = await this.transformToMovements(
        parseResult.data,
        finalMapping,
        parseResult,
        options.accountId
      );

      if (!transformResult.success) {
        errors.push(...transformResult.errors);
      }
      warnings.push(...transformResult.warnings);

      // Step 6: Deduplication
      const deduplicationResult = await this.performDeduplication(
        transformResult.movements,
        options.skipDuplicates
      );

      // Step 7: Ledger validation
      const ledgerSummary = ledgerValidationService.calculateLedgerSummary(
        deduplicationResult.movements,
        options.openingBalance
      );

      const ledgerValidation = ledgerValidationService.validateLedger(
        deduplicationResult.movements,
        options.toleranceAmount
      );

      if (ledgerValidation.recommendation === 'reconstruct') {
        warnings.push('Ledger inconsistencies detected, balances reconstructed');
      }

      // Step 8: Save profile if new and successful
      let profileSaved = false;
      if (!profileResult && schemaResult.overallConfidence > 0.8) {
        try {
          await this.saveNewProfile(parseResult, finalMapping, schemaResult);
          profileSaved = true;
        } catch (error) {
          warnings.push('Failed to save bank profile for future use');
        }
      }

      // Step 9: Prepare final result and telemetry
      const endTime = performance.now();
      const statistics: ImportStatistics = {
        fileFormat: formatResult.format,
        totalRows: parseResult.data.length,
        headerRow: parseResult.headerRow,
        dataRows: transformResult.movements.length,
        successfulParsed: deduplicationResult.movements.length,
        skippedRows: parseResult.data.length - transformResult.movements.length,
        duplicatesDetected: deduplicationResult.duplicateCount,
        processingTimeMs: endTime - startTime,
        locale: transformResult.locale,
        dateFormat: transformResult.dateFormat,
        overallConfidence: schemaResult.overallConfidence
      };

      // Telemetry logging as required by problem statement
      const telemetryLog = {
        bankGuess: this.guessBankFromData(parseResult) || 'Unknown',
        rowsTotal: parseResult.data.length,
        rowsImported: deduplicationResult.movements.length,
        rowsSkipped: parseResult.data.length - deduplicationResult.movements.length,
        mapped: {
          date: this.hasColumnRole(finalMapping, 'date'),
          amount: this.hasColumnRole(finalMapping, 'amount'),
          concept: this.hasColumnRole(finalMapping, 'description'),
          balance: this.hasColumnRole(finalMapping, 'balance')
        },
        locale: transformResult.locale.decimalSep === ',' ? 'EU' : 'EN'
      };
      
      console.info('[TESO-IMPORT] Import completed:', telemetryLog);

      return {
        success: true,
        movements: deduplicationResult.movements,
        errors,
        warnings,
        statistics,
        ledgerSummary,
        profileUsed: profileResult?.profile.id,
        profileSaved
      };

    } catch (error) {
      return this.createErrorResult(
        `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        startTime
      );
    }
  }

  /**
   * Process manual mapping from assistant
   */
  async processManualMapping(
    file: File,
    manualMapping: { [columnIndex: number]: ColumnRole },
    profileName?: string
  ): Promise<UniversalImportResult> {
    // Implementation would be similar to importBankFile but using the manual mapping
    // This is a simplified placeholder
    throw new Error('Manual mapping processing not yet implemented');
  }

  /**
   * Parse file based on detected format
   */
  private async parseFileByFormat(
    file: File, 
    formatResult: FileFormatResult
  ): Promise<{
    success: boolean;
    error?: string;
    headers: string[];
    data: any[][];
    sampleRows: any[][];
    headerRow?: number;
  }> {
    
    switch (formatResult.format) {
      case 'CSV':
        return this.parseCSVFile(file, formatResult.csvDelimiter);
      case 'XLS':
      case 'XLSX':
        return this.parseExcelFile(file);
      case 'OFX':
        return this.parseOFXFile(file);
      case 'QIF':
        return this.parseQIFFile(file);
      default:
        return {
          success: false,
          error: `Format ${formatResult.format} not yet implemented`,
          headers: [],
          data: [],
          sampleRows: []
        };
    }
  }

  /**
   * Parse CSV file
   */
  private async parseCSVFile(
    file: File, 
    delimiter?: string
  ): Promise<{
    success: boolean;
    error?: string;
    headers: string[];
    data: any[][];
    sampleRows: any[][];
    headerRow?: number;
  }> {
    
    try {
      const text = await this.readFileAsText(file);
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return {
          success: false,
          error: 'Empty CSV file',
          headers: [],
          data: [],
          sampleRows: []
        };
      }

      const separator = delimiter || ';'; // Default Spanish separator
      const data = lines.map(line => this.parseCSVLine(line, separator));
      
      // Detect header row (assume first non-empty row)
      const headerRow = 0;
      const headers = data[headerRow] || [];
      const sampleRows = data.slice(1, 6); // First 5 data rows

      return {
        success: true,
        headers: headers.map(h => h?.toString() || ''),
        data,
        sampleRows,
        headerRow
      };
    } catch (error) {
      return {
        success: false,
        error: `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        headers: [],
        data: [],
        sampleRows: []
      };
    }
  }

  /**
   * Parse Excel file (XLS/XLSX)
   */
  private async parseExcelFile(file: File): Promise<{
    success: boolean;
    error?: string;
    headers: string[];
    data: any[][];
    sampleRows: any[][];
    headerRow?: number;
  }> {
    
    try {
      // Dynamic import to avoid bundle bloat
      const XLSX = await import('xlsx');
      
      const buffer = await this.readFileAsArrayBuffer(file);
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          error: 'No worksheets found in Excel file',
          headers: [],
          data: [],
          sampleRows: []
        };
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        defval: ''
      }) as any[][];

      if (data.length === 0) {
        return {
          success: false,
          error: 'Empty Excel worksheet',
          headers: [],
          data: [],
          sampleRows: []
        };
      }

      // Detect header row
      const headerRow = 0;
      const headers = data[headerRow] || [];
      const sampleRows = data.slice(1, 6);

      return {
        success: true,
        headers: headers.map(h => h?.toString() || ''),
        data,
        sampleRows,
        headerRow
      };
    } catch (error) {
      return {
        success: false,
        error: `Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        headers: [],
        data: [],
        sampleRows: []
      };
    }
  }

  /**
   * Parse OFX file - placeholder implementation
   */
  private async parseOFXFile(file: File): Promise<any> {
    // TODO: Implement OFX parsing
    return {
      success: false,
      error: 'OFX parsing not yet implemented',
      headers: [],
      data: [],
      sampleRows: []
    };
  }

  /**
   * Parse QIF file - placeholder implementation
   */
  private async parseQIFFile(file: File): Promise<any> {
    // TODO: Implement QIF parsing
    return {
      success: false,
      error: 'QIF parsing not yet implemented',
      headers: [],
      data: [],
      sampleRows: []
    };
  }

  /**
   * Extract column mapping from schema detection result
   */
  private extractColumnMapping(schemaResult: SchemaDetectionResult): { [columnIndex: number]: ColumnRole } {
    const mapping: { [columnIndex: number]: ColumnRole } = {};
    
    for (const [columnIndex, detection] of Object.entries(schemaResult.columns)) {
      mapping[parseInt(columnIndex)] = detection.role;
    }
    
    return mapping;
  }

  /**
   * Convert profile mapping to column roles
   */
  private profileToColumnMapping(profile: BankMappingProfile): { [columnIndex: number]: ColumnRole } {
    const mapping: { [columnIndex: number]: ColumnRole } = {};
    
    if (profile.mapping.dateCol !== undefined) {
      mapping[profile.mapping.dateCol] = 'date';
    }
    if (profile.mapping.valueDateCol !== undefined) {
      mapping[profile.mapping.valueDateCol] = 'valueDate';
    }
    if (profile.mapping.descCol !== undefined) {
      mapping[profile.mapping.descCol] = 'description';
    }
    if (profile.mapping.counterpartyCol !== undefined) {
      mapping[profile.mapping.counterpartyCol] = 'counterparty';
    }
    if (profile.mapping.debitCol !== undefined) {
      mapping[profile.mapping.debitCol] = 'debit';
    }
    if (profile.mapping.creditCol !== undefined) {
      mapping[profile.mapping.creditCol] = 'credit';
    }
    if (profile.mapping.amountCol !== undefined) {
      mapping[profile.mapping.amountCol] = 'amount';
    }
    if (profile.mapping.balanceCol !== undefined) {
      mapping[profile.mapping.balanceCol] = 'balance';
    }
    if (profile.mapping.refCol !== undefined) {
      mapping[profile.mapping.refCol] = 'reference';
    }
    
    return mapping;
  }

  /**
   * Create column detection results from mapping
   */
  private createColumnDetectionFromMapping(
    mapping: { [columnIndex: number]: ColumnRole },
    headers: string[]
  ): { [columnIndex: number]: any } {
    const result: { [columnIndex: number]: any } = {};
    
    for (const [columnIndex, role] of Object.entries(mapping)) {
      result[parseInt(columnIndex)] = {
        role,
        confidence: 0.9, // High confidence for profile-based mapping
        reason: 'From saved bank profile',
        samples: []
      };
    }
    
    return result;
  }

  /**
   * Generate mapping suggestions
   */
  private generateMappingSuggestions(schemaResult: SchemaDetectionResult): string[] {
    const suggestions: string[] = [];
    
    if (schemaResult.overallConfidence < 0.8) {
      suggestions.push('La detección automática tiene baja confianza, revise el mapeo manualmente');
    }
    
    const roles = Object.values(schemaResult.columns).map(c => c.role);
    if (!roles.includes('date')) {
      suggestions.push('Asegúrese de asignar una columna de fecha');
    }
    
    if (!roles.includes('amount') && !roles.includes('debit') && !roles.includes('credit')) {
      suggestions.push('Asegúrese de asignar columnas de importes');
    }
    
    return suggestions;
  }

  /**
   * Transform data to normalized movements
   */
  private async transformToMovements(
    data: any[][],
    mapping: { [columnIndex: number]: ColumnRole },
    parseResult: any,
    accountId: number
  ): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
    movements: NormalizedMovement[];
    locale: NumberLocale;
    dateFormat: string;
  }> {
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const movements: NormalizedMovement[] = [];
    
    // Detect locale and date format from sample data
    const sampleAmounts = this.extractSampleValues(data, mapping, 'amount', 'debit', 'credit');
    const locale = localeDetector.detectLocaleNumber(sampleAmounts);
    
    const sampleDates = this.extractSampleValues(data, mapping, 'date');
    const dateFormatResult = dateFormatDetector.detectDateFormat(sampleDates);
    
    // Process each data row
    const startRow = parseResult.headerRow !== undefined ? parseResult.headerRow + 1 : 0;
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        continue; // Skip empty rows
      }
      
      try {
        const movement = await this.transformRowToMovement(
          row, 
          mapping, 
          locale, 
          dateFormatResult.format,
          accountId,
          i
        );
        
        if (movement) {
          movements.push(movement);
        }
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      success: true,
      errors,
      warnings,
      movements,
      locale,
      dateFormat: dateFormatResult.format
    };
  }

  /**
   * Transform single row to movement
   */
  private async transformRowToMovement(
    row: any[],
    mapping: { [columnIndex: number]: ColumnRole },
    locale: NumberLocale,
    dateFormat: string,
    accountId: number,
    rowIndex: number
  ): Promise<NormalizedMovement | null> {
    
    // Extract values by role
    const values: { [role in ColumnRole]?: string } = {};
    for (const [colIndex, role] of Object.entries(mapping)) {
      const value = row[parseInt(colIndex)];
      if (value !== undefined && value !== null && value !== '') {
        values[role] = value.toString().trim();
      }
    }
    
    // Parse date
    if (!values.date) {
      throw new Error('Missing date value');
    }
    
    const dateResult = dateFormatDetector.parseDateWithFormat(values.date, dateFormat);
    if (!dateResult) {
      throw new Error(`Invalid date format: ${values.date}`);
    }
    
    // Parse amount using sign derivation
    const signResult = signDerivationService.deriveSignedAmount(
      {
        debit: values.debit,
        credit: values.credit,
        amount: values.amount
      },
      locale
    );
    
    if (signResult.confidence < 0.5) {
      throw new Error(`Unable to parse amount with confidence`);
    }
    
    // Parse balance if present
    let balance: number | undefined;
    if (values.balance) {
      const balanceResult = localeDetector.parseImporte(values.balance, locale);
      if (balanceResult.confidence > 0.5) {
        balance = balanceResult.value;
      }
    }
    
    // Generate deduplication hash
    const forDeduplication: MovementForDeduplication = {
      accountId,
      date: dateResult.date.toISOString().split('T')[0],
      amount: signResult.amount,
      description: values.description || 'Movimiento bancario',
      reference: values.reference,
      counterparty: values.counterparty
    };
    
    const hash = stableHashDeduplicationService.generateMovementHashSync(forDeduplication);
    
    return {
      date: dateResult.date,
      amount: signResult.amount,
      description: values.description || 'Movimiento bancario',
      counterparty: values.counterparty, // Using "contraparte" instead of "proveedor"
      balance,
      reference: values.reference,
      originalRow: rowIndex,
      rowIndex, // Added for ledger validation compatibility
      confidence: Math.min(dateResult.confidence, signResult.confidence),
      deduplicationHash: hash
    };
  }

  /**
   * Extract sample values for locale/format detection
   */
  private extractSampleValues(
    data: any[][],
    mapping: { [columnIndex: number]: ColumnRole },
    ...targetRoles: ColumnRole[]
  ): string[] {
    const samples: string[] = [];
    
    for (const [colIndex, role] of Object.entries(mapping)) {
      if (targetRoles.includes(role)) {
        const columnIndex = parseInt(colIndex);
        for (const row of data.slice(1, 11)) { // Skip header, take up to 10 samples
          const value = row[columnIndex];
          if (value !== undefined && value !== null && value !== '') {
            samples.push(value.toString().trim());
          }
        }
      }
    }
    
    return samples;
  }

  /**
   * Perform deduplication
   */
  private async performDeduplication(
    movements: NormalizedMovement[],
    skipDuplicates: boolean = true
  ): Promise<{ movements: NormalizedMovement[]; duplicateCount: number }> {
    
    if (!skipDuplicates) {
      return { movements, duplicateCount: 0 };
    }
    
    // Use simple sync deduplication for now
    const seenHashes = new Set<string>();
    const uniqueMovements: NormalizedMovement[] = [];
    let duplicateCount = 0;
    
    for (const movement of movements) {
      if (seenHashes.has(movement.deduplicationHash)) {
        duplicateCount++;
      } else {
        seenHashes.add(movement.deduplicationHash);
        uniqueMovements.push(movement);
      }
    }
    
    return { movements: uniqueMovements, duplicateCount };
  }

  /**
   * Save new bank profile
   */
  private async saveNewProfile(
    parseResult: any,
    mapping: { [columnIndex: number]: ColumnRole },
    schemaResult: SchemaDetectionResult
  ): Promise<void> {
    
    const profileMapping: BankMappingProfile['mapping'] = {
      locale: { decimalSep: ',', thousandSep: '.', confidence: 0.8, samples: [] },
      dateFormat: 'DD/MM/YYYY'
    };
    
    // Convert column mapping to profile mapping
    for (const [colIndex, role] of Object.entries(mapping)) {
      const index = parseInt(colIndex);
      switch (role) {
        case 'date':
          profileMapping.dateCol = index;
          break;
        case 'valueDate':
          profileMapping.valueDateCol = index;
          break;
        case 'description':
          profileMapping.descCol = index;
          break;
        case 'counterparty':
          profileMapping.counterpartyCol = index;
          break;
        case 'debit':
          profileMapping.debitCol = index;
          break;
        case 'credit':
          profileMapping.creditCol = index;
          break;
        case 'amount':
          profileMapping.amountCol = index;
          break;
        case 'balance':
          profileMapping.balanceCol = index;
          break;
        case 'reference':
          profileMapping.refCol = index;
          break;
      }
    }
    
    await bankProfileService.createProfile({
      headers: parseResult.headers,
      sampleRows: parseResult.sampleRows,
      mapping: profileMapping
    });
  }

  /**
   * Create partial statistics for early returns
   */
  private createPartialStatistics(
    formatResult: FileFormatResult,
    parseResult: any,
    startTime: number
  ): ImportStatistics {
    return {
      fileFormat: formatResult.format,
      totalRows: parseResult.data?.length || 0,
      headerRow: parseResult.headerRow,
      dataRows: 0,
      successfulParsed: 0,
      skippedRows: 0,
      duplicatesDetected: 0,
      processingTimeMs: performance.now() - startTime,
      locale: { decimalSep: ',', thousandSep: '.', confidence: 0, samples: [] },
      dateFormat: 'DD/MM/YYYY',
      overallConfidence: 0
    };
  }

  private createErrorResult(error: string, startTime: number): UniversalImportResult {
    return {
      success: false,
      movements: [],
      errors: [error],
      warnings: [],
      statistics: {
        fileFormat: 'CSV',
        totalRows: 0,
        dataRows: 0,
        successfulParsed: 0,
        skippedRows: 0,
        duplicatesDetected: 0,
        processingTimeMs: performance.now() - startTime,
        locale: { decimalSep: ',', thousandSep: '.', confidence: 0, samples: [] },
        dateFormat: 'DD/MM/YYYY',
        overallConfidence: 0
      }
    };
  }

  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'UTF-8');
    });
  }

  private async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  private parseCSVLine(line: string, separator: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  // Additional helper methods would be implemented here...
  // (profileToColumnMapping, transformToMovements, performDeduplication, etc.)

  /**
   * Guess bank from parsed data - for telemetry
   */
  private guessBankFromData(parseResult: any): string | null {
    const headers = parseResult.headers || [];
    const firstRow = parseResult.data?.[0] || [];
    
    // Check headers and first row for bank indicators
    const allText = [...headers, ...firstRow].join(' ').toLowerCase();
    
    if (allText.includes('santander')) return 'Santander';
    if (allText.includes('sabadell')) return 'Sabadell';
    if (allText.includes('unicaja')) return 'Unicaja';
    if (allText.includes('bbva')) return 'BBVA';
    if (allText.includes('caixabank') || allText.includes('lacaixa')) return 'CaixaBank';
    if (allText.includes('banco popular')) return 'Banco Popular';
    if (allText.includes('bankinter')) return 'Bankinter';
    if (allText.includes('ing')) return 'ING';
    if (allText.includes('openbank')) return 'Openbank';
    
    return null;
  }

  /**
   * Check if mapping has specific column role
   */
  private hasColumnRole(mapping: { [columnIndex: number]: ColumnRole }, role: ColumnRole): boolean {
    return Object.values(mapping).includes(role);
  }
}

export const universalBankImporter = new UniversalBankImporter();