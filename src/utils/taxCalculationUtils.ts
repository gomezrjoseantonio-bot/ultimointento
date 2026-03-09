// Enhanced tax calculation utilities for Spanish property transactions
// Following exact specifications from comment requirements

import { formatSpanishCurrency } from '../services/spanishFormattingService';
import { getLocationFromPostalCode, getITPRateForCCAA } from './locationUtils';

// Enhanced ITP calculation with base amount support
export interface ITPCalculationResult {
  importe: number;
  porcentaje: number;
  baseImponible: number;
  ccaa: string;
}

// Base ITP calculation modes
export type BaseITPModo = 'auto' | 'manual';

export interface BaseITPConfig {
  modo: BaseITPModo;
  valor: number | null; // Used when modo is 'manual'
}

/**
 * Calculate ITP with configurable base amount
 */
export function calculateITPWithBase(
  precioCompra: number,
  postalCode: string,
  baseConfig: BaseITPConfig
): ITPCalculationResult | null {
  const location = getLocationFromPostalCode(postalCode);
  if (!location) {
    return null;
  }

  const itpRate = getITPRateForCCAA(location.ccaa);
  const baseImponible = baseConfig.modo === 'manual' && baseConfig.valor 
    ? baseConfig.valor 
    : precioCompra;

  const importe = Math.round((baseImponible * itpRate / 100) * 100) / 100;

  return {
    importe,
    porcentaje: itpRate,
    baseImponible,
    ccaa: location.ccaa
  };
}

/**
 * Calculate IVA for new construction
 */
export function calculateIVAAmount(precioCompra: number): {
  importe: number;
  porcentaje: number;
} {
  const rate = 10.0; // Standard IVA rate for new construction
  const importe = Math.round((precioCompra * rate / 100) * 100) / 100;
  
  return {
    importe,
    porcentaje: rate
  };
}

/**
 * Calculate AJD for new construction
 */
export function calculateAJDAmount(precioCompra: number): {
  importe: number;
  porcentaje: number;
} {
  const rate = 1.5; // Standard AJD rate
  const importe = Math.round((precioCompra * rate / 100) * 100) / 100;
  
  return {
    importe,
    porcentaje: rate
  };
}

/**
 * Format percentage for chip display (always shows like "6%" never "0.06")
 */
export function formatPercentageChip(percentage: number): string {
  return `${Math.round(percentage * 100) / 100}%`;
}

/**
 * Format euro amount for display with Spanish formatting
 */
export function formatEuroDisplay(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '— €';
  }
  
  return formatSpanishCurrency(amount);
}

/**
 * Parse Spanish euro input to number
 */
export function parseSpanishEuroInput(input: string): number {
  if (!input) return 0;
  
  // Remove currency symbol and spaces
  const cleaned = input
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Handle Spanish number format: 1.234,56 -> 1234.56
  const withDecimal = cleaned
    .replace(/\./g, '') // Remove thousand separators
    .replace(/,/g, '.'); // Replace decimal comma with dot
    
  const parsed = parseFloat(withDecimal);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

/**
 * Detect if CCAA has special tax considerations
 */
export function getSpecialTaxWarning(ccaa: string): string | null {
  const ccaaLower = ccaa.toLowerCase();
  
  if (ccaaLower === 'canarias') {
    return 'En Canarias aplica IGIC (no IVA). Ajusta el importe si procede.';
  }
  
  if (ccaaLower === 'ceuta' || ccaaLower === 'melilla') {
    return 'En Ceuta/Melilla aplica IPSI. Ajusta el importe si procede.';
  }
  
  return null;
}

/**
 * Get CCAA from postal code with fallback
 */
export function getCCAAFromPostalCode(postalCode: string): {
  ccaa: string;
  isKnown: boolean;
} {
  const location = getLocationFromPostalCode(postalCode);
  
  if (location) {
    return {
      ccaa: location.ccaa,
      isKnown: true
    };
  }
  
  return {
    ccaa: 'Desconocida',
    isKnown: false
  };
}