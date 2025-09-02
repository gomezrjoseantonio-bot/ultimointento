export interface BankProfile {
  bankKey: string;
  bankVersion: string;
  headerAliases: {
    date: string[];
    valueDate: string[];
    amount: string[];
    description: string[];
    counterparty: string[];
  };
  noisePatterns: string[];
  numberFormat: {
    decimal: string;
    thousand: string;
  };
  dateHints?: ('excel-serial' | 'dd/mm/yyyy' | 'dd-mm-yyyy' | 'yyyy-mm-dd')[];
  sheetNameHint?: string;
  minScore: number;
}

export interface BankProfilesData {
  profiles: BankProfile[];
}

export interface ParsedMovement {
  date: Date; // ATLAS HOTFIX: Changed to Date object for better handling
  valueDate?: Date;
  amount: number;
  description: string;
  counterparty?: string;
  balance?: number; // ATLAS HOTFIX: Added balance field
  reference?: string; // ATLAS HOTFIX: Added reference field
  originalRow?: number;
  rawData?: Record<string, any>;
  raw?: string; // ATLAS HOTFIX: Raw row data for debugging
}

export interface BankDetectionResult {
  bankKey: string;
  bankVersion?: string; // ATLAS HOTFIX: Made optional
  bankName?: string; // ATLAS HOTFIX: Added bank name
  score: number;
  confidence?: number; // ATLAS HOTFIX: Added confidence
  profile?: BankProfile; // ATLAS HOTFIX: Made optional
}

export interface ParseResult {
  success: boolean; // ATLAS HOTFIX: Added success field
  error?: string; // ATLAS HOTFIX: Added error field
  movements: ParsedMovement[];
  totalRows?: number; // ATLAS HOTFIX: Made optional
  errors?: string[]; // ATLAS HOTFIX: Made optional
  detectedBank?: BankDetectionResult;
  preview?: ParsedMovement[]; // ATLAS HOTFIX: Made optional
  metadata: {
    bankKey?: string;
    bankVersion?: string;
    bankName?: string; // ATLAS HOTFIX: Added bank name
    sheetName?: string;
    confidence?: number; // ATLAS HOTFIX: Added confidence
    headerRow?: number; // ATLAS HOTFIX: Made optional
    dataStartRow?: number; // ATLAS HOTFIX: Added data start row
    headersOriginal?: string[]; // ATLAS HOTFIX: Made optional
    rowsImported?: number; // ATLAS HOTFIX: Made optional
    rowsProcessed?: number; // ATLAS HOTFIX: Added rows processed
    rowsOmitted?: number; // ATLAS HOTFIX: Made optional
    rowsInvalid?: number; // ATLAS HOTFIX: Made optional
    columnsDetected?: number; // ATLAS HOTFIX: Added columns detected
    importedAt?: string; // ATLAS HOTFIX: Made optional
    fileName?: string; // ATLAS HOTFIX: Made optional
    mime?: string; // ATLAS HOTFIX: Made optional
    size?: number; // ATLAS HOTFIX: Made optional
    rawData?: string[][]; // ATLAS HOTFIX: Added raw data for manual mapping
    needsManualMapping?: boolean; // ATLAS HOTFIX: Added manual mapping flag
    headerDetection?: HeaderDetectionResult; // ATLAS HOTFIX: Added header detection result
    [key: string]: any; // ATLAS HOTFIX: Allow additional properties
  };
}

export interface ImportBatch {
  id: string;
  inboxItemId?: number;
  importedAt: string;
  source: string;
  bankKey?: string;
  bankVersion?: string;
  movementCount: number;
  summary: {
    horizon: number;
    pulse: number;
    omit: number;
  };
}

// ATLAS HOTFIX: Additional interfaces for robust bank parsing
export interface SheetInfo {
  name: string;
  rowCount: number;
  hasData: boolean;
}

export interface HeaderDetectionResult {
  headerRow: number;
  dataStartRow: number;
  detectedColumns: Record<string, number>;
  confidence: number;
  fallbackRequired: boolean;
}

export interface BankParseResult extends ParseResult {
  sheetInfo?: SheetInfo[];
  selectedSheet?: string;
  headerDetection?: HeaderDetectionResult;
  needsManualMapping?: boolean;
}