// Spanish number formatting utilities
import { parseEsNumber, formatEsCurrency, formatEsPercentage } from './numberUtils';

export const formatEuro = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  
  return formatEsCurrency(amount);
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
  const result = parseEsNumber(input);
  return result.value;
};

export const parseNumberInput = (input: string): number | null => {
  const result = parseEsNumber(input);
  return result.value;
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
  
  return formatEsPercentage(value);
};

export const parsePercentageInput = (input: string): number | null => {
  const result = parseEsNumber(input, { allowPercent: true });
  return result.value;
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