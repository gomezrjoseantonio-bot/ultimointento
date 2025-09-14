/**
 * Enhanced Functionality Demonstration
 * 
 * This example shows all the implemented enhancements working together:
 * 1. Enhanced FEIN OCR processing with better Spanish text extraction
 * 2. Automatic amortization schedule generation on loan save
 * 3. Bank integration with logo and IBAN formatting
 * 4. Demo cleanup functionality
 */

// Example of enhanced FEIN data extraction
const mockEnhancedFEINExtraction = {
  // Enhanced bank entity extraction
  bancoEntidad: 'Banco Santander', // Cleaned from "Banco Santander, S.A."
  
  // Enhanced IBAN processing (supports various masking formats)
  cuentaCargoIban: 'ES12 0049 **** **** **** 5678', // Normalized formatting
  ibanMascarado: true,
  
  // Enhanced bonification detection with comprehensive Spanish keywords
  bonificaciones: [
    { 
      tipo: 'NOMINA', 
      descripcion: 'Nómina', 
      descuento: 0.005, 
      condicion: 'Ingresos ≥ 2500 €' 
    },
    { 
      tipo: 'SEGURO_HOGAR', 
      descripcion: 'Seguro de hogar', 
      descuento: 0.0025 
    },
    { 
      tipo: 'RECIBOS', 
      descripcion: 'Domiciliación', 
      descuento: 0.0015, 
      condicion: '≥ 3 recibos últimos 6 meses' 
    },
    { 
      tipo: 'TARJETA', 
      descripcion: 'Tarjeta uso mensual', 
      descuento: 0.001, 
      condicion: '≥ 8 usos/mes' 
    }
  ],
  
  // Improved confidence scoring
  confidence: 0.92 // High confidence due to complete data extraction
};

// Example of automatic amortization schedule generation
const loanCreationExample = {
  // When this loan is created, amortization schedule is automatically generated
  inmuebleId: 'property_123',
  nombre: 'Préstamo FEIN - Enhanced',
  principalInicial: 250000,
  principalVivo: 250000,
  fechaFirma: '2024-01-15',
  plazoMesesTotal: 300, // 25 years
  tipo: 'VARIABLE',
  valorIndiceActual: 0.025,
  diferencial: 0.012,
  
  // Auto-generated results:
  // - 300 payment periods calculated
  // - Monthly payment computed using French amortization
  // - Total interest calculated
  // - Payment schedule persisted and cached
  // - Regenerated automatically when parameters change
};

// Example of enhanced bank integration
const bankIntegrationExample = {
  iban: 'ES1200491234567890123456',
  
  // Enhanced bank information extraction:
  bankInfo: {
    bankCode: '0049',
    bankKey: 'Santander',
    logoUrl: '/assets/bank-logos/santander.svg'
  },
  
  // Enhanced IBAN formatting:
  formatted: {
    iban: 'ES12 0049 1234 5678 9012 3456',
    maskedIban: 'ES12 **** **** **** **** 3456',
    bankKey: 'Santander',
    logoUrl: '/assets/bank-logos/santander.svg'
  }
};

// Example of demo cleanup execution
const demoCleanupExample = {
  // Enhanced detection patterns identify demo data:
  demoMovements: [
    'Demo payment for testing',
    'Movimiento de ejemplo',
    'Test transaction'
  ],
  
  demoAccounts: [
    'Demo Test Account',
    'Cuenta de prueba'
  ],
  
  // Cleanup results:
  results: {
    removedMovements: 15,
    removedAccounts: 3,
    accountsProcessed: 147,
    errors: 0
  }
};

export {
  mockEnhancedFEINExtraction,
  loanCreationExample,
  bankIntegrationExample,
  demoCleanupExample
};