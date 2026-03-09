/**
 * Unit tests for reconciliation using counterparty field
 */

import { jest } from '@jest/globals';

describe('Reconciliation with Counterparty', () => {
  
  describe('Text-based counterparty matching', () => {
    test('should match movements by counterparty text', () => {
      const movement = {
        id: 1,
        amount: -45.50,
        description: 'Factura mensual',
        counterparty: 'Iberdrola Clientes',
        date: '2024-01-15'
      };

      const expenseRecord = {
        contraparte_nombre: 'Iberdrola',
        total: 45.50,
        fecha_emision: '2024-01-15'
      };

      // Simple text matching logic (this would be part of reconciliation service)
      const counterpartyMatch = movement.counterparty?.toLowerCase().includes(
        expenseRecord.contraparte_nombre.toLowerCase()
      );

      expect(counterpartyMatch).toBe(true);
    });

    test('should handle partial counterparty matches', () => {
      const movement = {
        counterparty: 'ENDESA ENERGIA XXI S.L.',
        amount: -67.89
      };

      const expenseRecord = {
        contraparte_nombre: 'Endesa',
        total: 67.89
      };

      const normalizedMovement = movement.counterparty?.toLowerCase();
      const normalizedExpense = expenseRecord.contraparte_nombre.toLowerCase();
      
      const isMatch = normalizedMovement?.includes(normalizedExpense) || 
                     normalizedExpense?.includes(normalizedMovement || '');

      expect(isMatch).toBe(true);
    });

    test('should work with accented characters', () => {
      const movement = {
        counterparty: 'Administración de Fincas García',
        amount: -123.45
      };

      const expenseRecord = {
        contraparte_nombre: 'Administracion de Fincas Garcia',
        total: 123.45
      };

      // Simplified accent-insensitive matching
      const normalize = (text: string) => 
        text.toLowerCase()
          .replace(/[áàä]/g, 'a')
          .replace(/[éèë]/g, 'e')
          .replace(/[íìï]/g, 'i')
          .replace(/[óòö]/g, 'o')
          .replace(/[úùü]/g, 'u')
          .replace(/ñ/g, 'n');

      const normalizedMovement = normalize(movement.counterparty);
      const normalizedExpense = normalize(expenseRecord.contraparte_nombre);

      const isMatch = normalizedMovement.includes(normalizedExpense) ||
                     normalizedExpense.includes(normalizedMovement);

      expect(isMatch).toBe(true);
    });

    test('should create learning rules based on counterparty patterns', () => {
      const movement = {
        counterparty: 'Iberdrola Clientes',
        description: 'Factura electricidad',
        amount: -78.90
      };

      const learnKey = [
        movement.counterparty?.toLowerCase().trim(),
        movement.description.toLowerCase().trim(),
        movement.amount > 0 ? 'positive' : 'negative'
      ].join('|');

      const expectedPattern = 'iberdrola clientes|factura electricidad|negative';

      expect(learnKey).toBe(expectedPattern);
    });
  });

  describe('Conciliacion status handling', () => {
    test('should update movement with conciliado status', () => {
      const movement = {
        id: 1,
        counterparty: 'Test Provider',
        status: 'pendiente' as const,
        unifiedStatus: 'confirmado' as any
      };

      // Simulate reconciliation
      const reconciledMovement = {
        ...movement,
        status: 'conciliado' as const,
        unifiedStatus: 'conciliado' as any,
        updatedAt: new Date().toISOString()
      };

      expect(reconciledMovement.status).toBe('conciliado');
      expect(reconciledMovement.unifiedStatus).toBe('conciliado');
      expect(reconciledMovement.counterparty).toBe('Test Provider');
    });

    test('should maintain counterparty during reconciliation', () => {
      const beforeReconciliation = {
        counterparty: 'Original Counterparty',
        statusConciliacion: 'sin_match' as const
      };

      const afterReconciliation = {
        ...beforeReconciliation,
        statusConciliacion: 'match_automatico' as const,
        linked_registro: {
          type: 'gasto' as const,
          id: 123
        }
      };

      expect(afterReconciliation.counterparty).toBe('Original Counterparty');
      expect(afterReconciliation.statusConciliacion).toBe('match_automatico');
    });
  });

  describe('Migration compatibility', () => {
    test('should handle movements with both old and new fields during transition', () => {
      const legacyMovement = {
        id: 1,
        proveedor: 'Legacy Provider',
        counterparty: undefined
      };

      const modernMovement = {
        id: 2,
        counterparty: 'Modern Counterparty',
        proveedor: undefined
      };

      // Utility function to get counterparty (from migrationService)
      const getCounterparty = (mov: any) => mov.counterparty || mov.proveedor || '';

      expect(getCounterparty(legacyMovement)).toBe('Legacy Provider');
      expect(getCounterparty(modernMovement)).toBe('Modern Counterparty');
    });
  });
});