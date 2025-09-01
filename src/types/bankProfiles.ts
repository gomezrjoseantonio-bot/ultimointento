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
  date: string;
  valueDate?: string;
  amount: number;
  description: string;
  counterparty?: string;
  originalRow: number;
  rawData: Record<string, any>;
}

export interface BankDetectionResult {
  bankKey: string;
  bankVersion: string;
  score: number;
  profile: BankProfile;
}

export interface ParseResult {
  movements: ParsedMovement[];
  totalRows: number;
  errors: string[];
  detectedBank?: BankDetectionResult;
  preview: ParsedMovement[];
  metadata: {
    bankKey?: string;
    bankVersion?: string;
    sheetName?: string;
    headerRow: number;
    headersOriginal: string[];
    rowsImported: number;
    rowsOmitted: number;
    rowsInvalid: number;
    importedAt: string;
    fileName: string;
    mime: string;
    size: number;
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