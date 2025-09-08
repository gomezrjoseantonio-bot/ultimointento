/**
 * Treasury Movement Filters - FIX PACK v1.0
 * Utilities for filter persistence and date handling
 */

import { MovementState, MovementOrigin } from '../services/db';

export interface MovementFilters {
  accountId: number | 'all';
  dateRange: 'last90days' | 'thismonth' | 'last30days' | 'custom';
  customDateFrom: string;
  customDateTo: string;
  status: MovementState | 'Todos';
  excludePersonal: boolean;
  source?: MovementOrigin | 'Todos'; // New filter for import source
}

const FILTERS_STORAGE_KEY = 'treasury.movements.filters.v1';

// Default filters as per FIX PACK v1.0 requirements
export const DEFAULT_FILTERS: MovementFilters = {
  accountId: 'all', // "Todas las cuentas" by default
  dateRange: 'last90days', // "Últimos 90 días" by default
  customDateFrom: '',
  customDateTo: '',
  status: 'Todos', // "Todos" by default
  excludePersonal: false, // OFF by default
  source: 'Todos' // New: show all sources by default
};

/**
 * Load filters from localStorage with fallback to defaults
 */
export function loadFiltersFromStorage(): MovementFilters {
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure all required properties exist with defaults
      return {
        ...DEFAULT_FILTERS,
        ...parsed
      };
    }
  } catch (error) {
    console.warn('Error loading movement filters from localStorage:', error);
  }
  return { ...DEFAULT_FILTERS };
}

/**
 * Save filters to localStorage
 */
export function saveFiltersToStorage(filters: MovementFilters): void {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.warn('Error saving movement filters to localStorage:', error);
  }
}

/**
 * Reset filters to defaults and save to localStorage
 */
export function resetFiltersToDefaults(): MovementFilters {
  const defaultFilters = { ...DEFAULT_FILTERS };
  saveFiltersToStorage(defaultFilters);
  return defaultFilters;
}

/**
 * Get date range boundaries in UTC based on filter selection
 * FIX PACK v1.0: Normalize all date comparisons to UTC
 */
export function getDateRangeBounds(
  dateRange: string,
  customFrom?: string,
  customTo?: string
): { fromDate: Date | null; toDate: Date | null } {
  const now = new Date();
  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  switch (dateRange) {
    case 'last90days':
      // Last 90 days from today
      fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    
    case 'thismonth':
      // First day of current month to now
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    
    case 'last30days':
      // Last 30 days from today
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    
    case 'custom':
      if (customFrom) {
        // Convert local date to UTC at start of day
        const localDate = new Date(customFrom);
        fromDate = new Date(Date.UTC(
          localDate.getFullYear(),
          localDate.getMonth(),
          localDate.getDate(),
          0, 0, 0, 0
        ));
      }
      if (customTo) {
        // Convert local date to UTC at end of day
        const localDate = new Date(customTo);
        toDate = new Date(Date.UTC(
          localDate.getFullYear(),
          localDate.getMonth(),
          localDate.getDate(),
          23, 59, 59, 999
        ));
      }
      break;
  }

  // Convert fromDate to UTC at start of day if not custom
  if (fromDate && dateRange !== 'custom') {
    fromDate = new Date(Date.UTC(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate(),
      0, 0, 0, 0
    ));
  }

  return { fromDate, toDate };
}

/**
 * Format date for display in user's timezone
 */
export function formatDateForDisplay(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('es-ES');
}

/**
 * Log filter application for debugging (development only)
 */
export function logFilterApplication(filters: MovementFilters, resultCount: number): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('MovementsQuery:', {
      filters,
      results: resultCount
    });
  }
}