/**
 * Spanish Formatting Utilities for FIX-EXTRACTOS
 * 
 * Handles the required Spanish formatting for dates and currency:
 * - Dates: dd/mm/yyyy format
 * - Currency: 1.234,56 € format
 * 
 * Note: Uses centralized formatting service for consistency
 */

import { 
  formatSpanishDate as formatSpanishDateService,
  formatSpanishCurrency as formatSpanishCurrencyService,
  parseSpanishDate as parseSpanishDateService,
  parseSpanishNumber as parseSpanishNumberService,
  validateSpanishFormatting as validateSpanishFormattingService
} from '../services/spanishFormattingService';

/**
 * Format date to Spanish format (dd/mm/yyyy)
 * As required: "fechas dd/mm/yyyy"
 */
export function formatDateSpanish(date: string | Date): string {
  return formatSpanishDateService(date);
}

/**
 * Format currency to Spanish format (1.234,56 €)
 * As required: "1.234,56 €"
 */
export function formatCurrencySpanish(amount: number, currency: string = 'EUR'): string {
  return formatSpanishCurrencyService(amount, currency);
}

/**
 * Parse Spanish date format (dd/mm/yyyy) to ISO date (yyyy-mm-dd)
 * For internal storage normalization
 */
export function parseSpanishDate(dateStr: string): string {
  return parseSpanishDateService(dateStr);
}

/**
 * Parse Spanish number format (1.234,56) to standard number
 * For internal calculations
 */
export function parseSpanishNumber(value: string | number): number {
  return parseSpanishNumberService(value);
}

/**
 * Validate that dates and amounts meet FIX-EXTRACTOS formatting requirements
 */
export function validateSpanishFormatting(movement: {
  date: string;
  amount: number;
}): { isValid: boolean; errors: string[] } {
  return validateSpanishFormattingService(movement);
}