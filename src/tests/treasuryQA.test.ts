import {
  validateIngreso,
  validateGasto,
  validateCAPEX,
  validateTreasuryBatch,
  formatValidationErrors,
  getValidationIcon
} from '../services/treasuryValidationService';

describe('Treasury QA Test Suite - Core Functionality', () => {

  describe('QA Scenario 1: Income Validation Comprehensive Tests', () => {
    test('should pass validation for complete income record', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const validIngreso = {
        proveedor_contraparte: 'María García',
        fecha_emision: today,
        fecha_prevista_cobro: today,
        importe: 1200,
        origen: 'contrato_id' as const,
        origen_id: 123,
        destino: 'inmueble_id' as const,
        destino_id: 456,
        moneda: 'EUR' as const,
        estado: 'previsto' as const
      };

      const result = validateIngreso(validIngreso);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should fail validation for missing required fields', () => {
      const incompleteIngreso = {
        importe: 1000
      };

      const result = validateIngreso(incompleteIngreso);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('El proveedor/contraparte es obligatorio');
      expect(result.errors).toContain('La fecha de emisión es obligatoria');
      expect(result.errors).toContain('El origen del ingreso es obligatorio');
    });

    test('should fail validation for invalid business logic', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const invalidIngreso = {
        proveedor_contraparte: 'Test Provider',
        fecha_emision: today,
        fecha_prevista_cobro: today,
        importe: -500, // Negative amount
        origen: 'contrato_id' as const,
        // Missing origen_id for contract
        destino: 'inmueble_id' as const,
        // Missing destino_id for property
        moneda: 'EUR' as const
      };

      const result = validateIngreso(invalidIngreso);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El importe debe ser mayor que 0');
      expect(result.errors).toContain('Debe especificar el contrato cuando el origen es "contrato_id"');
      expect(result.errors).toContain('Debe especificar el inmueble cuando el destino es "inmueble_id"');
    });

    test('should warn for high amounts and old dates', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2);
      
      const warningIngreso = {
        proveedor_contraparte: 'Big Client',
        fecha_emision: oldDate.toISOString().split('T')[0],
        fecha_prevista_cobro: oldDate.toISOString().split('T')[0],
        importe: 150000, // Very high amount
        origen: 'doc_id' as const,
        origen_id: 123,
        destino: 'personal' as const,
        moneda: 'EUR' as const
      };

      const result = validateIngreso(warningIngreso);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('El importe es muy alto (más de 100.000€). Verifique que sea correcto.');
      expect(result.warnings).toContain('La fecha de emisión es muy antigua (más de 1 año)');
    });
  });

  describe('QA Scenario 2: Expense Validation Comprehensive Tests', () => {
    test('should pass validation for complete expense record', () => {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date();
      future.setDate(future.getDate() + 30);
      
      const validGasto = {
        proveedor_nombre: 'Iberdrola',
        fecha_emision: today,
        fecha_pago_prevista: future.toISOString().split('T')[0],
        total: 150,
        base: 124,
        iva: 26,
        categoria_AEAT: 'suministros' as const,
        destino: 'inmueble_id' as const,
        destino_id: 123,
        estado: 'completo' as const
      };

      const result = validateGasto(validGasto);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should validate IVA calculation correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const gastoIncorrectIVA = {
        proveedor_nombre: 'Test Provider',
        fecha_emision: today,
        fecha_pago_prevista: today,
        total: 150,
        base: 100,
        iva: 40, // 100 + 40 = 140, but total is 150 (10€ difference)
        categoria_AEAT: 'reparacion-conservacion' as const,
        destino: 'personal' as const
      };

      const result = validateGasto(gastoIncorrectIVA);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El total (150€) no coincide con base + IVA (140€)');
    });

    test('should allow small rounding differences in IVA', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const gastoSmallDifference = {
        proveedor_nombre: 'Test Provider',
        fecha_emision: today,
        fecha_pago_prevista: today,
        total: 150.01, // 1 cent difference - should be allowed
        base: 124,
        iva: 26, // 124 + 26 = 150
        categoria_AEAT: 'suministros' as const,
        destino: 'personal' as const
      };

      const result = validateGasto(gastoSmallDifference);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should warn for CAPEX categories in expenses', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const gastoCapexCategory = {
        proveedor_nombre: 'Construction Co',
        fecha_emision: today,
        fecha_pago_prevista: today,
        total: 5000,
        categoria_AEAT: 'capex-mejora-ampliacion' as const, // CAPEX category
        destino: 'personal' as const
      };

      const result = validateGasto(gastoCapexCategory);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Esta categoría AEAT debería usarse para CAPEX, no gastos regulares');
    });
  });

  describe('QA Scenario 3: CAPEX Validation Comprehensive Tests', () => {
    test('should pass validation for complete CAPEX record', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const validCapex = {
        inmueble_id: 123,
        proveedor: 'Construcciones García SL',
        fecha_emision: today,
        total: 25000,
        tipo: 'mejora' as const,
        anos_amortizacion: 20,
        estado: 'completo' as const
      };

      const result = validateCAPEX(validCapex);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should validate amortization periods correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Furniture with incorrect amortization period
      const furnitureCapex = {
        inmueble_id: 123,
        proveedor: 'Muebles Modernos',
        fecha_emision: today,
        total: 5000,
        tipo: 'mobiliario' as const,
        anos_amortizacion: 25 // Should be 10 for furniture
      };

      const result = validateCAPEX(furnitureCapex);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('El mobiliario típicamente se amortiza en 10 años según normativa AEAT');
    });

    test('should fail validation for missing required fields', () => {
      const incompleteCapex = {
        total: 10000
        // Missing all required fields
      };

      const result = validateCAPEX(incompleteCapex);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El inmueble es obligatorio');
      expect(result.errors).toContain('El proveedor es obligatorio');
      expect(result.errors).toContain('Los años de amortización deben ser mayor que 0');
    });

    test('should warn for very low and very high amounts', () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Very low CAPEX
      const lowCapex = {
        inmueble_id: 123,
        proveedor: 'Small Service',
        fecha_emision: today,
        total: 50, // Very low for CAPEX
        tipo: 'mejora' as const,
        anos_amortizacion: 10
      };

      const lowResult = validateCAPEX(lowCapex);
      expect(lowResult.isValid).toBe(true);
      expect(lowResult.warnings).toContain('El importe es muy bajo para ser considerado CAPEX (menos de 100€)');

      // Very high CAPEX
      const highCapex = {
        inmueble_id: 123,
        proveedor: 'Major Construction',
        fecha_emision: today,
        total: 250000, // Very high
        tipo: 'ampliacion' as const,
        anos_amortizacion: 25
      };

      const highResult = validateCAPEX(highCapex);
      expect(highResult.isValid).toBe(true);
      expect(highResult.warnings).toContain('El importe es muy alto (más de 200.000€). Verifique que sea correcto.');
    });
  });

  describe('QA Scenario 4: Batch Validation Tests', () => {
    test('should handle mixed batch validation correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const batchRecords = {
        ingresos: [
          // Valid income
          {
            proveedor_contraparte: 'Valid Tenant',
            fecha_emision: today,
            fecha_prevista_cobro: today,
            importe: 1200,
            origen: 'contrato_id' as const,
            origen_id: 1,
            destino: 'inmueble_id' as const,
            destino_id: 101
          },
          // Invalid income
          {
            proveedor_contraparte: 'Invalid Tenant',
            importe: -500 // Negative amount
          }
        ],
        gastos: [
          // Valid expense
          {
            proveedor_nombre: 'Valid Provider',
            fecha_emision: today,
            fecha_pago_prevista: today,
            total: 150,
            categoria_AEAT: 'suministros' as const,
            destino: 'personal' as const
          }
        ],
        capex: [
          // Valid CAPEX
          {
            inmueble_id: 123,
            proveedor: 'Valid Constructor',
            fecha_emision: today,
            total: 15000,
            tipo: 'mejora' as const,
            anos_amortizacion: 20
          }
        ]
      };

      const result = validateTreasuryBatch(batchRecords);
      
      expect(result.summary.totalRecords).toBe(4);
      expect(result.summary.validRecords).toBe(3);
      expect(result.summary.invalidRecords).toBe(1);
      
      expect(result.ingresos[0].isValid).toBe(true);
      expect(result.ingresos[1].isValid).toBe(false);
      expect(result.gastos[0].isValid).toBe(true);
      expect(result.capex[0].isValid).toBe(true);
    });

    test('should handle empty batch validation', () => {
      const emptyBatch = {
        ingresos: [],
        gastos: [],
        capex: []
      };

      const result = validateTreasuryBatch(emptyBatch);
      
      expect(result.summary.totalRecords).toBe(0);
      expect(result.summary.validRecords).toBe(0);
      expect(result.summary.invalidRecords).toBe(0);
      expect(result.summary.recordsWithWarnings).toBe(0);
    });
  });

  describe('QA Scenario 5: Helper Functions and Utilities', () => {
    test('should format validation errors correctly', () => {
      const errorResult = {
        isValid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1']
      };

      const formatted = formatValidationErrors(errorResult);
      
      expect(formatted).toBe('Errores: Error 1, Error 2 | Advertencias: Warning 1');
    });

    test('should format warnings only', () => {
      const warningResult = {
        isValid: true,
        errors: [],
        warnings: ['Warning only']
      };

      const formatted = formatValidationErrors(warningResult);
      
      expect(formatted).toBe('Advertencias: Warning only');
    });

    test('should return appropriate validation icons', () => {
      const errorResult = { isValid: false, errors: ['Error'], warnings: [] };
      expect(getValidationIcon(errorResult)).toBe('error');

      const warningResult = { isValid: true, errors: [], warnings: ['Warning'] };
      expect(getValidationIcon(warningResult)).toBe('warning');

      const successResult = { isValid: true, errors: [], warnings: [] };
      expect(getValidationIcon(successResult)).toBe('success');
    });
  });

  describe('QA Scenario 6: Edge Cases and Boundary Testing', () => {
    test('should handle zero and boundary amounts', () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Zero amount should fail
      const zeroIngreso = {
        proveedor_contraparte: 'Test',
        fecha_emision: today,
        fecha_prevista_cobro: today,
        importe: 0,
        origen: 'doc_id' as const,
        origen_id: 123,
        destino: 'personal' as const
      };

      const result = validateIngreso(zeroIngreso);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El importe debe ser mayor que 0');
    });

    test('should handle IVA boundary conditions', () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Exactly at 2-cent boundary (should pass)
      const boundaryGasto = {
        proveedor_nombre: 'Boundary Test',
        fecha_emision: today,
        fecha_pago_prevista: today,
        total: 150.02,
        base: 124,
        iva: 26.02, // 124 + 26.02 = 150.02, exact match
        categoria_AEAT: 'suministros' as const,
        destino: 'personal' as const
      };

      const boundaryResult = validateGasto(boundaryGasto);
      expect(boundaryResult.isValid).toBe(true);

      // Over 2-cent boundary (should fail)
      const overBoundaryGasto = {
        ...boundaryGasto,
        total: 150.05, // 0.03 difference > 0.02 limit
        iva: 26.02 // Keep iva same, so 124 + 26.02 = 150.02, but total = 150.05
      };

      const overResult = validateGasto(overBoundaryGasto);
      expect(overResult.isValid).toBe(false);
    });

    test('should handle whitespace-only fields', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const whitespaceIngreso = {
        proveedor_contraparte: '   ', // Only whitespace
        fecha_emision: today,
        fecha_prevista_cobro: today,
        importe: 1000,
        origen: 'doc_id' as const,
        origen_id: 123,
        destino: 'personal' as const
      };

      const result = validateIngreso(whitespaceIngreso);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El proveedor/contraparte es obligatorio');
    });

    test('should handle same-day dates', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const sameDayGasto = {
        proveedor_nombre: 'Same Day Provider',
        fecha_emision: today,
        fecha_pago_prevista: today, // Same day should be valid
        total: 100,
        categoria_AEAT: 'reparacion-conservacion' as const,
        destino: 'personal' as const
      };

      const result = validateGasto(sameDayGasto);
      expect(result.isValid).toBe(true);
    });

    test('should handle extreme amortization periods', () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Zero amortization (should fail)
      const zeroAmortizationCapex = {
        inmueble_id: 123,
        proveedor: 'Test',
        fecha_emision: today,
        total: 10000,
        tipo: 'mejora' as const,
        anos_amortizacion: 0
      };

      const result = validateCAPEX(zeroAmortizationCapex);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Los años de amortización deben ser mayor que 0');
    });
  });

  describe('QA Scenario 7: Performance and Data Integrity', () => {
    test('should handle large batch validation efficiently', () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Create large batch of valid records
      const largeBatch = {
        ingresos: Array.from({ length: 100 }, (_, i) => ({
          proveedor_contraparte: `Tenant ${i + 1}`,
          fecha_emision: today,
          fecha_prevista_cobro: today,
          importe: 1000 + i,
          origen: 'contrato_id' as const,
          origen_id: i + 1,
          destino: 'inmueble_id' as const,
          destino_id: 101
        })),
        gastos: Array.from({ length: 50 }, (_, i) => ({
          proveedor_nombre: `Provider ${i + 1}`,
          fecha_emision: today,
          fecha_pago_prevista: today,
          total: 500 + i,
          categoria_AEAT: 'reparacion-conservacion' as const,
          destino: 'personal' as const
        })),
        capex: Array.from({ length: 20 }, (_, i) => ({
          inmueble_id: 101,
          proveedor: `Constructor ${i + 1}`,
          fecha_emision: today,
          total: 10000 + i * 1000,
          tipo: 'mejora' as const,
          anos_amortizacion: 20
        }))
      };

      const startTime = Date.now();
      const result = validateTreasuryBatch(largeBatch);
      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second

      // Should validate all records correctly
      expect(result.summary.totalRecords).toBe(170);
      expect(result.summary.validRecords).toBe(170);
      expect(result.summary.invalidRecords).toBe(0);
    });
  });
});