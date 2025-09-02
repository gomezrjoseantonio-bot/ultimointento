// Spanish number formatting utilities

export const formatEuro = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  
  // Format with es-ES locale to get comma as decimal separator and dot as thousands separator
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  // Add thin space before euro symbol (U+2009)
  return `${formatted} €`;
};

export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatInteger = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const parseEuroInput = (input: string): number | null => {
  if (!input || input.trim() === '') {
    return null;
  }
  
  // Remove currency symbols and spaces
  let cleaned = input.replace(/[€\s]/g, '');
  
  // Check for Anglo-Saxon format (comma before dot near end)
  if (/\d,\d{3}\.\d{1,2}$/.test(cleaned)) {
    return null; // Reject ambiguous Anglo-Saxon format
  }
  
  // Handle the case where we get a decimal number as string (e.g., "9567.8" from calculations)
  // If it looks like a simple decimal number without formatting, treat the dot as decimal separator
  if (/^\d+\.\d+$/.test(cleaned) && !cleaned.includes(',')) {
    return parseFloat(cleaned);
  }
  
  // Split by comma to check for decimal part
  const parts = cleaned.split(',');
  
  if (parts.length > 2) {
    return null; // Multiple commas not allowed
  }
  
  if (parts.length === 2) {
    // Has decimal part
    const [integerPart, decimalPart] = parts;
    
    // Decimal part should be 1-2 digits
    if (decimalPart.length > 2) {
      return null;
    }
    
    // Remove dots from integer part (thousands separators)
    const cleanInteger = integerPart.replace(/\./g, '');
    const cleanDecimal = decimalPart.padEnd(2, '0'); // Pad to 2 digits
    
    if (!/^\d+$/.test(cleanInteger) || !/^\d{1,2}$/.test(decimalPart)) {
      return null;
    }
    
    return parseFloat(`${cleanInteger}.${cleanDecimal}`);
  } else {
    // No decimal part - dots are thousands separators
    const cleanInteger = cleaned.replace(/\./g, '');
    
    if (!/^\d+$/.test(cleanInteger)) {
      return null;
    }
    
    return parseFloat(cleanInteger);
  }
};

export const parseNumberInput = (input: string): number | null => {
  if (!input || input.trim() === '') {
    return null;
  }
  
  // Remove spaces and normalize decimal separator
  const cleaned = input
    .replace(/\s/g, '')
    .replace(/\./g, '') // Remove thousands separator
    .replace(',', '.'); // Change decimal separator to dot
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

export const formatDate = (date: string | Date): string => {
  if (!date) return '—';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '—';
  
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(dateObj);
};

export const formatDateInput = (dateString: string): string => {
  // Convert from ISO format (yyyy-mm-dd) to Spanish format (dd/mm/yyyy)
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  
  return `${day}/${month}/${year}`;
};

export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  // Format percentage with comma decimal separator and thin space before %
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  
  return `${formatted} %`;
};

export const parsePercentageInput = (input: string): number | null => {
  if (!input || input.trim() === '') {
    return null;
  }
  
  // Remove % symbol and spaces
  let cleaned = input.replace(/[%\s]/g, '');
  
  // Replace comma with dot for parsing
  cleaned = cleaned.replace(',', '.');
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

export const formatEuroInput = (input: string): string => {
  const value = parseEuroInput(input);
  if (value === null) return '';
  return formatEuro(value);
};

export const formatPercentageInput = (input: string): string => {
  const value = parsePercentageInput(input);
  if (value === null) return '';
  return formatPercentage(value);
};

// Precise decimal arithmetic utilities to avoid floating point errors
export const addCurrency = (...amounts: (number | null | undefined)[]): number => {
  // Convert to cents, add, then convert back to euros
  const centsTotal = amounts
    .filter((amount): amount is number => amount !== null && amount !== undefined && !isNaN(amount))
    .reduce((sum, amount) => sum + Math.round(amount * 100), 0);
  
  return centsTotal / 100;
};

export const multiplyCurrency = (amount: number, factor: number): number => {
  // Use cents to avoid floating point precision issues
  const cents = Math.round(amount * 100);
  const result = Math.round(cents * factor);
  return result / 100;
};

// Round to 2 decimal places using "half-up" method
export const roundCurrency = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};