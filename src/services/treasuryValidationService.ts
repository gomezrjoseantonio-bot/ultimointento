import { Ingreso, Gasto, CAPEX, AEATFiscalType } from './db';

/**
 * Treasury Validation Service
 * 
 * Provides validation logic for Treasury records (Ingresos, Gastos, CAPEX)
 * ensuring data integrity and business rules compliance.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Income (Ingreso) Validation
export const validateIngreso = (ingreso: Partial<Ingreso>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!ingreso.proveedor_contraparte?.trim()) {
    errors.push('El proveedor/contraparte es obligatorio');
  }

  if (!ingreso.fecha_emision) {
    errors.push('La fecha de emisión es obligatoria');
  }

  if (!ingreso.fecha_prevista_cobro) {
    errors.push('La fecha prevista de cobro es obligatoria');
  }

  if (!ingreso.importe || ingreso.importe <= 0) {
    errors.push('El importe debe ser mayor que 0');
  }

  if (!ingreso.origen) {
    errors.push('El origen del ingreso es obligatorio');
  }

  if (!ingreso.destino) {
    errors.push('El destino del ingreso es obligatorio');
  }

  // Business logic validation
  if (ingreso.destino === 'inmueble_id' && !ingreso.destino_id) {
    errors.push('Debe especificar el inmueble cuando el destino es "inmueble_id"');
  }

  if (ingreso.origen === 'contrato_id' && !ingreso.origen_id) {
    errors.push('Debe especificar el contrato cuando el origen es "contrato_id"');
  }

  if (ingreso.origen === 'nomina_id' && !ingreso.origen_id) {
    errors.push('Debe especificar la nómina cuando el origen es "nomina_id"');
  }

  if (ingreso.origen === 'doc_id' && !ingreso.origen_id) {
    errors.push('Debe especificar el documento cuando el origen es "doc_id"');
  }

  // Date validation
  if (ingreso.fecha_emision && ingreso.fecha_prevista_cobro) {
    const emisionDate = new Date(ingreso.fecha_emision);
    const cobroDate = new Date(ingreso.fecha_prevista_cobro);
    
    if (cobroDate < emisionDate) {
      errors.push('La fecha prevista de cobro no puede ser anterior a la fecha de emisión');
    }
    
    // Warning for very old or future dates
    const today = new Date();
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    if (emisionDate < oneYearAgo) {
      warnings.push('La fecha de emisión es muy antigua (más de 1 año)');
    }
    
    if (cobroDate > oneYearFromNow) {
      warnings.push('La fecha prevista de cobro es muy lejana (más de 1 año)');
    }
  }

  // Amount validation
  if (ingreso.importe && ingreso.importe > 100000) {
    warnings.push('El importe es muy alto (más de 100.000€). Verifique que sea correcto.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Expense (Gasto) Validation
export const validateGasto = (gasto: Partial<Gasto>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!gasto.proveedor_nombre?.trim()) {
    errors.push('El nombre del proveedor es obligatorio');
  }

  if (!gasto.fecha_emision) {
    errors.push('La fecha de emisión es obligatoria');
  }

  if (!gasto.fecha_pago_prevista) {
    errors.push('La fecha de pago prevista es obligatoria');
  }

  if (!gasto.total || gasto.total <= 0) {
    errors.push('El total debe ser mayor que 0');
  }

  if (!gasto.categoria_AEAT) {
    errors.push('La categoría AEAT es obligatoria');
  }

  if (!gasto.destino) {
    errors.push('El destino del gasto es obligatorio');
  }

  // Business logic validation
  if (gasto.destino === 'inmueble_id' && !gasto.destino_id) {
    errors.push('Debe especificar el inmueble cuando el destino es "inmueble_id"');
  }

  // IVA validation
  if (gasto.base && gasto.iva && gasto.total) {
    const calculatedTotal = gasto.base + gasto.iva;
    const difference = Math.abs(calculatedTotal - gasto.total);
    
    if (difference > 0.02) { // Allow for 2 cent rounding difference
      errors.push(`El total (${gasto.total}€) no coincide con base + IVA (${calculatedTotal}€)`);
    }
  }

  // Date validation
  if (gasto.fecha_emision && gasto.fecha_pago_prevista) {
    const emisionDate = new Date(gasto.fecha_emision);
    const pagoDate = new Date(gasto.fecha_pago_prevista);
    
    if (pagoDate < emisionDate) {
      errors.push('La fecha de pago prevista no puede ser anterior a la fecha de emisión');
    }
    
    // Warning for very old or future dates
    const today = new Date();
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    if (emisionDate < oneYearAgo) {
      warnings.push('La fecha de emisión es muy antigua (más de 1 año)');
    }
    
    if (pagoDate > oneYearFromNow) {
      warnings.push('La fecha de pago prevista es muy lejana (más de 1 año)');
    }
  }

  // Amount validation
  if (gasto.total && gasto.total > 50000) {
    warnings.push('El importe es muy alto (más de 50.000€). Verifique que sea correcto.');
  }

  // AEAT Category specific validation
  if (gasto.categoria_AEAT === 'capex-mejora-ampliacion') {
    warnings.push('Esta categoría AEAT debería usarse para CAPEX, no gastos regulares');
  }

  if (gasto.categoria_AEAT === 'amortizacion-muebles') {
    warnings.push('Esta categoría AEAT debería usarse para CAPEX mobiliario, no gastos regulares');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// CAPEX Validation
export const validateCAPEX = (capex: Partial<CAPEX>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields validation
  if (!capex.inmueble_id) {
    errors.push('El inmueble es obligatorio');
  }

  if (!capex.proveedor?.trim()) {
    errors.push('El proveedor es obligatorio');
  }

  if (!capex.fecha_emision) {
    errors.push('La fecha de emisión es obligatoria');
  }

  if (!capex.total || capex.total <= 0) {
    errors.push('El total debe ser mayor que 0');
  }

  if (!capex.tipo) {
    errors.push('El tipo de CAPEX es obligatorio');
  }

  if (!capex.anos_amortizacion || capex.anos_amortizacion <= 0) {
    errors.push('Los años de amortización deben ser mayor que 0');
  }

  // Business logic validation
  if (capex.anos_amortizacion) {
    if (capex.tipo === 'mobiliario' && capex.anos_amortizacion !== 10) {
      warnings.push('El mobiliario típicamente se amortiza en 10 años según normativa AEAT');
    }
    
    if (capex.tipo === 'mejora' && (capex.anos_amortizacion < 10 || capex.anos_amortizacion > 50)) {
      warnings.push('Las mejoras típicamente se amortizan entre 10 y 50 años');
    }
    
    if (capex.tipo === 'ampliacion' && (capex.anos_amortizacion < 15 || capex.anos_amortizacion > 50)) {
      warnings.push('Las ampliaciones típicamente se amortizan entre 15 y 50 años');
    }
  }

  // Date validation
  if (capex.fecha_emision) {
    const emisionDate = new Date(capex.fecha_emision);
    const today = new Date();
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    if (emisionDate < oneYearAgo) {
      warnings.push('La fecha de emisión es muy antigua (más de 1 año)');
    }
    
    if (emisionDate > oneYearFromNow) {
      errors.push('La fecha de emisión no puede ser en el futuro (más de 1 año)');
    }
  }

  // Amount validation
  if (capex.total) {
    if (capex.total < 100) {
      warnings.push('El importe es muy bajo para ser considerado CAPEX (menos de 100€)');
    }
    
    if (capex.total > 200000) {
      warnings.push('El importe es muy alto (más de 200.000€). Verifique que sea correcto.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Batch validation for Treasury records
export const validateTreasuryBatch = (records: {
  ingresos?: Partial<Ingreso>[];
  gastos?: Partial<Gasto>[];
  capex?: Partial<CAPEX>[];
}): {
  ingresos: ValidationResult[];
  gastos: ValidationResult[];
  capex: ValidationResult[];
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    recordsWithWarnings: number;
  };
} => {
  const ingresoResults = (records.ingresos || []).map(validateIngreso);
  const gastoResults = (records.gastos || []).map(validateGasto);
  const capexResults = (records.capex || []).map(validateCAPEX);

  const allResults = [...ingresoResults, ...gastoResults, ...capexResults];
  
  const summary = {
    totalRecords: allResults.length,
    validRecords: allResults.filter(r => r.isValid).length,
    invalidRecords: allResults.filter(r => !r.isValid).length,
    recordsWithWarnings: allResults.filter(r => r.warnings.length > 0).length
  };

  return {
    ingresos: ingresoResults,
    gastos: gastoResults,
    capex: capexResults,
    summary
  };
};

// Helper function to format validation errors for display
export const formatValidationErrors = (result: ValidationResult): string => {
  const messages: string[] = [];
  
  if (result.errors.length > 0) {
    messages.push(`Errores: ${result.errors.join(', ')}`);
  }
  
  if (result.warnings.length > 0) {
    messages.push(`Advertencias: ${result.warnings.join(', ')}`);
  }
  
  return messages.join(' | ');
};

// Helper function to get validation status icon
export const getValidationIcon = (result: ValidationResult): 'error' | 'warning' | 'success' => {
  if (!result.isValid) return 'error';
  if (result.warnings.length > 0) return 'warning';
  return 'success';
};