/**
 * Spanish Formatting Utilities for FIX-EXTRACTOS
 * 
 * Handles the required Spanish formatting for dates and currency:
 * - Dates: dd/mm/yyyy format
 * - Currency: 1.234,56 € format
 */

/**
 * Format date to Spanish format (dd/mm/yyyy)
 * As required: "fechas dd/mm/yyyy"
 */
export function formatDateSpanish(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Fecha inválida';
  }
}

/**
 * Format currency to Spanish format (1.234,56 €)
 * As required: "1.234,56 €"
 */
export function formatCurrencySpanish(amount: number, currency: string = 'EUR'): string {
  try {
    if (isNaN(amount)) {
      return '0,00 €';
    }
    
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    const currencySymbol = currency === 'EUR' ? '€' : currency;
    
    // Format to 2 decimal places
    const fixedAmount = absAmount.toFixed(2);
    const [integerPart, decimalPart] = fixedAmount.split('.');
    
    // Add thousand separators (dots) to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Combine with Spanish decimal separator (comma)
    const formatted = `${formattedInteger},${decimalPart}`;
    
    return `${sign}${formatted} ${currencySymbol}`;
  } catch (error) {
    console.error('Error formatting currency:', error);
    return '0,00 €';
  }
}

/**
 * Parse Spanish date format (dd/mm/yyyy) to ISO date (yyyy-mm-dd)
 * For internal storage normalization
 */
export function parseSpanishDate(dateStr: string): string {
  try {
    // Handle various Spanish date formats
    const cleanDate = dateStr.trim();
    
    // Pattern: dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
    const patterns = [
      /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
      /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/ // ISO format yyyy-mm-dd
    ];
    
    for (const pattern of patterns) {
      const match = cleanDate.match(pattern);
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
        return date.toISOString().split('T')[0];
      }
    }
    
    throw new Error('Formato de fecha no reconocido');
  } catch (error) {
    console.error('Error parsing Spanish date:', error);
    throw new Error(`Formato de fecha inválido: ${dateStr}`);
  }
}

/**
 * Parse Spanish number format (1.234,56) to standard number
 * For internal calculations
 */
export function parseSpanishNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  try {
    // Handle Spanish format: "1.234,56" -> 1234.56
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
 * Validate that dates and amounts meet FIX-EXTRACTOS formatting requirements
 */
export function validateSpanishFormatting(movement: {
  date: string;
  amount: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate date format
  try {
    const formattedDate = formatDateSpanish(movement.date);
    if (formattedDate === 'Fecha inválida') {
      errors.push('Formato de fecha inválido');
    }
  } catch (error) {
    errors.push('Error al formatear fecha');
  }
  
  // Validate amount format
  try {
    const formattedAmount = formatCurrencySpanish(movement.amount);
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