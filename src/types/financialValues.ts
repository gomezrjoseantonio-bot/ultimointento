export interface FinancialValuationItem {
  id: string;
  name: string;
  value: number;
  /** Tipo de inversión legible (solo para inversiones, opcional). */
  tipo?: string;
}

export interface FinancialValuesSnapshot {
  ipcMonthlyPercent: number | null;
  euriborPercent: number | null;
  effectiveDate: string;
  realEstateValuations: FinancialValuationItem[];
  investmentValuations: FinancialValuationItem[];
  updatedAt: string | null;
}

export interface SaveFinancialValuesInput {
  ipcMonthlyPercent: number | null;
  euriborPercent: number | null;
  effectiveDate?: string;
  realEstateValuations: FinancialValuationItem[];
  investmentValuations: FinancialValuationItem[];
}
