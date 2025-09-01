// Spanish number formatting utilities

export const formatEuro = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
  
  // Remove currency symbols and normalize decimal separator
  const cleaned = input
    .replace(/[€\s]/g, '')
    .replace(/\./g, '') // Remove thousands separator
    .replace(',', '.'); // Change decimal separator to dot
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
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
  
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

export const parsePercentageInput = (input: string): number | null => {
  if (!input || input.trim() === '') {
    return null;
  }
  
  // Remove % symbol and spaces, normalize decimal separator
  const cleaned = input
    .replace(/[%\s]/g, '')
    .replace(/\./g, '') // Remove thousands separator if any
    .replace(',', '.'); // Change decimal separator to dot
  
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