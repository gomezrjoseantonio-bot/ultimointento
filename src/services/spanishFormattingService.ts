/**
 * Centralized Spanish Formatting Service
 * 
 * Provides consistent Spanish (es-ES) formatting using the Intl API
 * with proper thousand separators and decimal formatting
 */

import { safeMatch } from '../utils/safe';

/**
 * Format currency to Spanish format with thousand separators
 * Example: 1234.56 → "1.234,56 €"
 */
export function formatSpanishCurrency(amount: number, currency: string = 'EUR'): string {
  if (isNaN(amount)) {
    return '0,00 €';
  }
  
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency,
    useGrouping: true, // Enable thousand separators
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  
  // Replace non-breaking space with regular space for consistency
  return formatted.replace(/\u00A0/g, ' ');
}

/**
 * Format percentage to Spanish format  
 * Example: 0.0425 → "4,3 %"
 */
export function formatSpanishPercentage(value: number, decimals: number = 1): string {
  if (isNaN(value)) {
    return '0,0 %';
  }
  
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'percent',
    useGrouping: true,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
  
  // Replace non-breaking space with regular space for consistency
  return formatted.replace(/\u00A0/g, ' ');
}

/**
 * Format number to Spanish format with thousand separators
 * Example: 1234.56 → "1.234,56"
 */
export function formatSpanishNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) {
    return '0,00';
  }
  
  return new Intl.NumberFormat('es-ES', {
    style: 'decimal',
    useGrouping: true,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

/**
 * Format date to Spanish format (dd/mm/yyyy)
 * Example: "2024-01-15" → "15/01/2024"
 */
export function formatSpanishDate(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida';
    }
    
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Fecha inválida';
  }
}

/**
 * Parse Spanish number format (1.234,56) to standard number
 * Example: "1.234,56" → 1234.56
 */
export function parseSpanishNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  try {
    // Handle Spanish format: "1.234,56" → 1234.56
    const cleanValue = value.toString()
      .replace(/\./g, '') // Remove thousand separators
      .replace(/,/g, '.'); // Replace decimal comma with dot
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    console.error('Error parsing Spanish number:', error);
    return 0;
  }
}

/**
 * Parse Spanish date format to ISO date
 * Example: "15/01/2024" → "2024-01-15"
 */
export function parseSpanishDate(dateStr: string): string {
  try {
    // Handle various Spanish date formats
    const cleanDate = dateStr.trim();
    
    // Pattern: dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
    const patterns = [
      /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/,
      /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/ // ISO format yyyy-mm-dd
    ];
    
    for (const pattern of patterns) {
      const match = safeMatch(cleanDate, pattern);
      if (match) {
        let day, month, year;
        
        if (pattern === patterns[1]) {
          // ISO format yyyy-mm-dd
          [, year, month, day] = match;
        } else {
          // Spanish format dd/mm/yyyy
          [, day, month, year] = match;
        }
        
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);
        
        // Validate date components
        if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
          continue;
        }
        
        // Create date and return ISO format
        const date = new Date(yearNum, monthNum - 1, dayNum);
        
        // Validate the date was created correctly
        if (date.getFullYear() === yearNum && 
            date.getMonth() === monthNum - 1 && 
            date.getDate() === dayNum) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    
    throw new Error(`Formato de fecha inválido: ${dateStr}`);
  } catch (error) {
    throw new Error(`Formato de fecha inválido: ${dateStr}`);
  }
}

/**
 * Validate Spanish formatting requirements
 */
export function validateSpanishFormatting(movement: {
  date: string;
  amount: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate date format
  try {
    const formattedDate = formatSpanishDate(movement.date);
    if (formattedDate === 'Fecha inválida') {
      errors.push('Formato de fecha inválido');
    }
  } catch (error) {
    errors.push('Error al formatear fecha');
  }
  
  // Validate amount format
  try {
    const formattedAmount = formatSpanishCurrency(movement.amount);
    if (formattedAmount === '0,00 €' && movement.amount !== 0) {
      errors.push('Formato de importe inválido');
    }
  } catch (error) {
    errors.push('Error al formatear importe');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}