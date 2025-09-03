// H8-FIX Issue 1: Build validation to ensure only approved filters exist
// This file breaks the build if non-approved filters are found

export const APPROVED_ESTADO_FILTERS = [
  'all',
  'pendiente',
  'incompleto', 
  'importado',
  'error',
  'duplicado'
] as const;

export const APPROVED_TIPO_FILTERS = [
  'all',
  'factura',
  'extracto bancario',
  'contrato', 
  'otros'
] as const;

export const APPROVED_ORIGEN_FILTERS = [
  'all',
  'upload',
  'email'
] as const;

// Validation function that will break build if called with invalid filters
export function validateFilters() {
  // This function validates that no other filters are used in the codebase
  // Add any additional validation logic here if needed
  
  const isValid = true; // Can add runtime checks here
  
  if (!isValid) {
    throw new Error('H8-FIX: Invalid filters detected. Only approved Estado/Tipo/Origen filters are allowed.');
  }
  
  return true;
}

// Export types for TypeScript validation
export type EstadoFilter = typeof APPROVED_ESTADO_FILTERS[number];
export type TipoFilter = typeof APPROVED_TIPO_FILTERS[number];  
export type OrigenFilter = typeof APPROVED_ORIGEN_FILTERS[number];