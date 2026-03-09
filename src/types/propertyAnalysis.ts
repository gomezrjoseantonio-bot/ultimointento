// Types for Property Analysis Module
// Following exact specifications from problem statement

export type PropertyDecision = 'MANTENER' | 'REVISAR' | 'VENDER';
export type RecommendationStatus = 'MANTENER' | 'REVISAR' | 'VENDER';

// Operational Performance (Base Real)
export interface OperationalPerformance {
  ingresosMensuales: number; // Monthly gross rent
  gastosOperativos: number; // Community, utilities, insurance, management, maintenance
  cuotaHipoteca: number; // Monthly mortgage payment (interest + amortization)
  cashflowNetoMensual: number; // = Ingresos - Gastos - Cuota
  cashflowAnual: number; // = Cashflow mensual × 12
}

// Financial Profitability
export interface FinancialProfitability {
  valorActualActivo: number; // Current market value
  deudaPendiente: number; // Outstanding mortgage balance
  equityActual: number; // Valor actual - Deuda pendiente
  rentabilidadBruta: number; // (Ingresos anuales / Precio total compra) × 100
  rentabilidadNeta: number; // (NOI / Precio total compra) × 100
  roiEquityReal: number; // Cashflow anual / Equity actual
  roiTotal: number; // (Cashflow + amortización + revalorización) / equity
}

// Fiscal ROI and Real Performance
export interface FiscalROI {
  impuestoRentas: number; // Cashflow anual × marginal IRPF rate (e.g. 47%)
  cashflowNetoTrasImpuestos: number; // Cashflow anual - IRPF rentas
  roiFiscalNeto: number; // (Cashflow neto tras impuestos / equity actual) × 100
  roiAlternativo: number; // Opportunity cost (configurable, e.g. 10%)
  roiDiferencial: number; // ROI fiscal neto - ROI alternativo
  conclusion: RecommendationStatus; // Automatic recommendation
}

// Sale Simulation
export interface SaleSimulation {
  precioVenta: number; // Editable sale price
  comisionVenta: number; // Editable commission (fixed amount)
  impuestos3Pct: number; // Automatic 3%
  deudaPendiente: number; // Automatic
  comisionCancelacion: number; // Automatic
  capitalLiberable: number; // = venta - comisión - impuestos - deuda - cancelación
  plusvaliaEstimada: number; // venta - (precio compra + ITP + reforma + gastos)
  irpf26Pct: number; // = plusvalía × 26%
  capitalNetoFinal: number; // = liberable - IRPF
  interesesFuturosEvitados: number; // Automatic calculation based on remaining debt
}

// Complete Property Analysis
export interface PropertyAnalysis {
  propertyId: number;
  propertyAlias: string;
  location: string;
  purchaseDate: string;
  
  // BLOQUE 1 - Current Performance
  operational: OperationalPerformance;
  financial: FinancialProfitability;
  fiscal: FiscalROI;
  
  // BLOQUE 3 - Sale Simulation
  saleSimulation: SaleSimulation;
  
  // Decision tracking (manual)
  decision?: PropertyDecision;
  decisionDate?: string;
  reviewScheduledDate?: string; // For "REVISAR" action
  targetSaleDate?: string; // For "VENDER" action
  
  // Metadata
  lastUpdated: string;
}

// Configuration for analysis
export interface AnalysisConfig {
  tipoMarginalIRPF: number; // e.g., 0.47 for 47%
  roiAlternativo: number; // e.g., 0.10 for 10%
  irpfPlusvalia: number; // e.g., 0.26 for 26%
  impuestosVenta: number; // e.g., 0.03 for 3%
}

// Default configuration
export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  tipoMarginalIRPF: 0.47,
  roiAlternativo: 0.10,
  irpfPlusvalia: 0.26,
  impuestosVenta: 0.03,
};
