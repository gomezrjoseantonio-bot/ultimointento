// src/pages/GestionInmuebles/venta/wizardTypes.ts
// Estado compartido del wizard de venta en 3 pasos.

export interface LoanToCancel {
  loanId: string;
  alias: string;
  banco?: string;
  outstandingPrincipal: number;
  comisionContrato: number;           // % o valor leído del préstamo (informativo)
  comisionFinalAplicadaInput: string; // editable en el formulario
  comisionFinalAplicada: number;      // parsed
}

export interface VentaWizardState {
  step: 1 | 2 | 3;

  // Step 1 · Operación
  sellDate: string;
  salePrice: number;
  salePriceInput: string;
  buyerNif: string;

  // Step 1 · Gastos de venta
  agencyCommission: number;
  agencyCommissionInput: string;
  saleNotary: number;
  saleNotaryInput: string;
  saleRegistry: number;
  saleRegistryInput: string;
  municipalTax: number;
  municipalTaxInput: string;

  // Step 1 · Cuenta destino
  settlementAccountId: number | '';

  // Step 2 · Cancelación hipoteca
  loansToCancel: LoanToCancel[];
  loansLoaded: boolean;
}

export const makeInitialWizardState = (): VentaWizardState => ({
  step: 1,
  sellDate: new Date().toISOString().slice(0, 10),
  salePrice: 0,
  salePriceInput: '',
  buyerNif: '',
  agencyCommission: 0,
  agencyCommissionInput: '',
  saleNotary: 0,
  saleNotaryInput: '',
  saleRegistry: 0,
  saleRegistryInput: '',
  municipalTax: 0,
  municipalTaxInput: '',
  settlementAccountId: '',
  loansToCancel: [],
  loansLoaded: false,
});
