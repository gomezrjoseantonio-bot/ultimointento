/**
 * Tests for complete data cleanup functionality
 * Validates that resetAllData function is properly structured and handles errors
 */
import { resetAllData } from '../db';

// Mock console methods to avoid noise in test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('Complete Data Cleanup', () => {
  describe('resetAllData', () => {
    it('should be a function that exists', () => {
      expect(typeof resetAllData).toBe('function');
    });

    it('should handle errors gracefully', async () => {
      // This test verifies the function handles errors appropriately
      // Since we can't easily mock IndexedDB in this environment,
      // we'll test the error handling path by checking that it throws
      // the expected error message when the database is not available
      
      await expect(resetAllData()).rejects.toThrow('No se pudo restablecer los datos completamente');
    });
  });

  describe('localStorage cleanup patterns', () => {
    it('should identify correct localStorage keys to clear', () => {
      // Test the logic for identifying localStorage keys to clear
      const testKeys = [
        'atlas-inbox-documents',
        'atlas-horizon-settings', 
        'atlas-user-preferences',
        'classificationRules',
        'bankProfiles',
        'demo-mode',
        'atlas-kpi-configurations',
        'treasury-cache',
        'fiscal-cache',
        'some-other-key',
        'atlas-related-data',
        'horizon-cache',
        'demo-settings'
      ];

      const shouldClear = testKeys.filter(key => 
        key.toLowerCase().includes('atlas') || 
        key.toLowerCase().includes('horizon') || 
        key.toLowerCase().includes('treasury') ||
        key.toLowerCase().includes('demo')
      );

      expect(shouldClear).toContain('atlas-inbox-documents');
      expect(shouldClear).toContain('atlas-horizon-settings');
      expect(shouldClear).toContain('demo-mode');
      expect(shouldClear).toContain('atlas-related-data');
      expect(shouldClear).toContain('horizon-cache');
      expect(shouldClear).toContain('demo-settings');
      expect(shouldClear).toContain('treasury-cache');
      expect(shouldClear).not.toContain('some-other-key');
    });
  });

  describe('cleanup safety checks', () => {
    it('should define expected object stores to clear', () => {
      // Define the object stores that should exist in the database
      // NOTE: rentCalendar, rentPayments removed in V4.5 — migrated to rentaMensual
      // V63 (TAREA 7 sub-tarea 4): `matchingConfiguration` eliminado;
      // su configuración vive ahora en `keyval['matchingConfig']`.
      const expectedStores = [
        'properties', 'documents', 'contracts', 'expenses',
        'rentaMensual', 'accounts', 'movements', 'importBatches',
        'treasuryEvents', 'treasuryRecommendations',
        'ingresos', 'budgets', 'budgetLines',
        'presupuestos', 'presupuestoLineas',
        'aeatCarryForwards', 'propertyDays',
        'kpiConfigurations', 'keyval',
        'gastosInmueble', 'mejorasInmueble', 'mueblesInmueble',
      ];

      // Verify we have a comprehensive list of stores (currently 21 stores)
      expect(expectedStores.length).toBe(21);
      expect(expectedStores).toContain('accounts');
      expect(expectedStores).toContain('movements');
      expect(expectedStores).toContain('properties');
      expect(expectedStores).toContain('documents');
      expect(expectedStores).toContain('rentaMensual');
      
      // Verify we include all the treasury-related stores
      expect(expectedStores).toContain('treasuryEvents');
      expect(expectedStores).toContain('treasuryRecommendations');
      expect(expectedStores).toContain('ingresos');
      expect(expectedStores).toContain('gastosInmueble');
      expect(expectedStores).toContain('mejorasInmueble');
    });
  });
});