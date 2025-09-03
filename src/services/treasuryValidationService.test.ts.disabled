import {
  validateIngreso,
  validateGasto,
  validateCAPEX,
  validateTreasuryBatch,
  formatValidationErrors,
  getValidationIcon,
  ValidationResult
} from './treasuryValidationService';
import { Ingreso, Gasto, CAPEX } from './db';

describe('Treasury Validation Service QA Tests', () => {
  
  describe('QA1: Income (Ingreso) Validation Rules', () => {
    test('should validate complete and correct income record', () => {
      // Arrange
      const today = new Date().toISOString().split('T')[0];
      const validIngreso: Partial<Ingreso> = {
        proveedor_contraparte: 'John Doe',
        fecha_emision: today,
        fecha_prevista_cobro: today,
        importe: 1200,
        origen: 'contrato_id',
        origen_id: 123,
        destino: 'inmueble_id',
        destino_id: 456,
        moneda: 'EUR',
        estado: 'previsto'
      };

      // Act
      const result = validateIngreso(validIngreso);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should reject income with missing required fields', () => {
      // Arrange
      const incompleteIngreso: Partial<Ingreso> = {
        // Missing proveedor_contraparte, fecha_emision, etc.
        importe: 1000,
        moneda: 'EUR'
      };

      // Act
      const result = validateIngreso(incompleteIngreso);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El proveedor/contraparte es obligatorio');
      expect(result.errors).toContain('La fecha de emisión es obligatoria');
      expect(result.errors).toContain('La fecha prevista de cobro es obligatoria');
      expect(result.errors).toContain('El origen del ingreso es obligatorio');
      expect(result.errors).toContain('El destino del ingreso es obligatorio');
    });

    test('should reject negative or zero amounts', () => {
      // Arrange
      const ingresoWithInvalidAmount: Partial<Ingreso> = {
        proveedor_contraparte: 'Test Provider',
        fecha_emision: '2024-01-15',
        fecha_prevista_cobro: '2024-01-15',
        importe: -500, // Negative amount
        origen: 'contrato_id',
        destino: 'personal'
      };

      // Act
      const result = validateIngreso(ingresoWithInvalidAmount);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El importe debe ser mayor que 0');
    });

    test('should validate business logic for contract origin', () => {
      // Arrange
      const ingresoWithContractOrigin: Partial<Ingreso> = {
        proveedor_contraparte: 'Tenant Name',
        fecha_emision: '2024-01-15',
        fecha_prevista_cobro: '2024-01-15',
        importe: 1200,
        origen: 'contrato_id',
        // Missing origen_id for contract
        destino: 'inmueble_id',
        destino_id: 123
      };

      // Act
      const result = validateIngreso(ingresoWithContractOrigin);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Debe especificar el contrato cuando el origen es "contrato_id"');
    });

    test('should validate business logic for property destination', () => {
      // Arrange
      const ingresoWithPropertyDestination: Partial<Ingreso> = {
        proveedor_contraparte: 'Provider',
        fecha_emision: '2024-01-15',
        fecha_prevista_cobro: '2024-01-15',
        importe: 800,
        origen: 'doc_id',
        origen_id: 456,
        destino: 'inmueble_id'
        // Missing destino_id for property
      };

      // Act
      const result = validateIngreso(ingresoWithPropertyDestination);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Debe especificar el inmueble cuando el destino es "inmueble_id"');
    });

    test('should validate date logic - collection date after emission', () => {
      // Arrange
      const ingresoWithInvalidDates: Partial<Ingreso> = {
        proveedor_contraparte: 'Provider',
        fecha_emision: '2024-01-20',
        fecha_prevista_cobro: '2024-01-15', // Before emission date
        importe: 1000,
        origen: 'doc_id',
        origen_id: 123,
        destino: 'personal'
      };

      // Act
      const result = validateIngreso(ingresoWithInvalidDates);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La fecha prevista de cobro no puede ser anterior a la fecha de emisión');
    });

    test('should warn for very high amounts', () => {
      // Arrange
      const ingresoWithHighAmount: Partial<Ingreso> = {
        proveedor_contraparte: 'Big Client',
        fecha_emision: '2024-01-15',
        fecha_prevista_cobro: '2024-01-15',
        importe: 150000, // Very high amount
        origen: 'contrato_id',
        origen_id: 123,
        destino: 'inmueble_id',
        destino_id: 456
      };

      // Act
      const result = validateIngreso(ingresoWithHighAmount);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('El importe es muy alto (más de 100.000€). Verifique que sea correcto.');
    });

    test('should warn for very old emission dates', () => {
      // Arrange
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago
      
      const ingresoWithOldDate: Partial<Ingreso> = {
        proveedor_contraparte: 'Old Provider',
        fecha_emision: oldDate.toISOString().split('T')[0],
        fecha_prevista_cobro: oldDate.toISOString().split('T')[0],
        importe: 1000,
        origen: 'doc_id',
        origen_id: 123,
        destino: 'personal'
      };

      // Act
      const result = validateIngreso(ingresoWithOldDate);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('La fecha de emisión es muy antigua (más de 1 año)');
    });
  });

  describe('QA2: Expense (Gasto) Validation Rules', () => {
    test('should validate complete and correct expense record', () => {
      // Arrange
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const validGasto: Partial<Gasto> = {
        proveedor_nombre: 'Electric Company',
        fecha_emision: today,
        fecha_pago_prevista: futureDateStr,
        total: 150,
        base: 124,
        iva: 26,
        categoria_AEAT: 'suministros',
        destino: 'inmueble_id',
        destino_id: 123,
        estado: 'completo'
      };

      // Act
      const result = validateGasto(validGasto);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should reject expense with missing required fields', () => {
      // Arrange
      const incompleteGasto: Partial<Gasto> = {
        // Missing most required fields
        total: 100
      };

      // Act
      const result = validateGasto(incompleteGasto);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El nombre del proveedor es obligatorio');
      expect(result.errors).toContain('La fecha de emisión es obligatoria');
      expect(result.errors).toContain('La fecha de pago prevista es obligatoria');
      expect(result.errors).toContain('La categoría AEAT es obligatoria');
      expect(result.errors).toContain('El destino del gasto es obligatorio');
    });

    test('should validate IVA calculation (Base + IVA = Total)', () => {
      // Arrange
      const gastoWithIncorrectIVA: Partial<Gasto> = {
        proveedor_nombre: 'Test Provider',
        fecha_emision: '2024-01-15',
        fecha_pago_prevista: '2024-01-30',
        total: 150,
        base: 100, // Base + IVA should equal total
        iva: 40,   // 100 + 40 = 140, but total is 150
        categoria_AEAT: 'reparacion-conservacion',
        destino: 'personal'
      };

      // Act
      const result = validateGasto(gastoWithIncorrectIVA);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El total (150€) no coincide con base + IVA (140€)');
    });

    test('should allow small rounding differences in IVA calculation', () => {
      // Arrange
      const gastoWithRoundingDifference: Partial<Gasto> = {
        proveedor_nombre: 'Test Provider',
        fecha_emision: '2024-01-15',
        fecha_pago_prevista: '2024-01-30',
        total: 150.01, // 1 cent difference due to rounding
        base: 124.19,
        iva: 25.81, // 124.19 + 25.81 = 150.00, but total is 150.01
        categoria_AEAT: 'suministros',
        destino: 'personal'
      };

      // Act
      const result = validateGasto(gastoWithRoundingDifference);

      // Assert
      expect(result.isValid).toBe(true); // Should allow 1-2 cent difference
      expect(result.errors).toHaveLength(0);
    });

    test('should validate payment date after emission date', () => {
      // Arrange
      const gastoWithInvalidDates: Partial<Gasto> = {
        proveedor_nombre: 'Provider',
        fecha_emision: '2024-01-20',
        fecha_pago_prevista: '2024-01-15', // Before emission
        total: 100,
        categoria_AEAT: 'reparacion-conservacion',
        destino: 'personal'
      };

      // Act
      const result = validateGasto(gastoWithInvalidDates);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La fecha de pago prevista no puede ser anterior a la fecha de emisión');
    });

    test('should warn for CAPEX categories in expenses', () => {
      // Arrange
      const gastoWithCapexCategory: Partial<Gasto> = {
        proveedor_nombre: 'Construction Co',
        fecha_emision: '2024-01-15',
        fecha_pago_prevista: '2024-01-30',
        total: 5000,
        categoria_AEAT: 'capex-mejora-ampliacion', // CAPEX category
        destino: 'inmueble_id',
        destino_id: 123
      };

      // Act
      const result = validateGasto(gastoWithCapexCategory);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Esta categoría AEAT debería usarse para CAPEX, no gastos regulares');
    });

    test('should warn for very high expense amounts', () => {
      // Arrange
      const gastoWithHighAmount: Partial<Gasto> = {
        proveedor_nombre: 'Expensive Service',
        fecha_emision: '2024-01-15',
        fecha_pago_prevista: '2024-01-30',
        total: 75000, // Very high amount
        categoria_AEAT: 'reparacion-conservacion',
        destino: 'personal'
      };

      // Act
      const result = validateGasto(gastoWithHighAmount);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('El importe es muy alto (más de 50.000€). Verifique que sea correcto.');
    });
  });

  describe('QA3: CAPEX Validation Rules', () => {
    test('should validate complete and correct CAPEX record', () => {
      // Arrange
      const today = new Date().toISOString().split('T')[0];
      const validCapex: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Construction Company',
        fecha_emision: today,
        total: 15000,
        tipo: 'mejora',
        anos_amortizacion: 20,
        estado: 'completo'
      };

      // Act
      const result = validateCAPEX(validCapex);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should reject CAPEX with missing required fields', () => {
      // Arrange
      const incompleteCAPEX: Partial<CAPEX> = {
        // Missing most required fields
        total: 10000
      };

      // Act
      const result = validateCAPEX(incompleteCAPEX);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El inmueble es obligatorio');
      expect(result.errors).toContain('El proveedor es obligatorio');
      expect(result.errors).toContain('La fecha de emisión es obligatoria');
      expect(result.errors).toContain('El tipo de CAPEX es obligatorio');
      expect(result.errors).toContain('Los años de amortización deben ser mayor que 0');
    });

    test('should validate amortization periods for furniture', () => {
      // Arrange
      const capexFurnitureWithWrongAmortization: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Furniture Store',
        fecha_emision: '2024-01-15',
        total: 5000,
        tipo: 'mobiliario',
        anos_amortizacion: 20 // Should be 10 for furniture
      };

      // Act
      const result = validateCAPEX(capexFurnitureWithWrongAmortization);

      // Assert
      expect(result.isValid).toBe(true); // Valid but with warning
      expect(result.warnings).toContain('El mobiliario típicamente se amortiza en 10 años según normativa AEAT');
    });

    test('should validate amortization periods for improvements', () => {
      // Arrange
      const capexMejoraWithWrongAmortization: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Construction Co',
        fecha_emision: '2024-01-15',
        total: 25000,
        tipo: 'mejora',
        anos_amortizacion: 5 // Too short for improvements
      };

      // Act
      const result = validateCAPEX(capexMejoraWithWrongAmortization);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Las mejoras típicamente se amortizan entre 10 y 50 años');
    });

    test('should validate amortization periods for expansions', () => {
      // Arrange
      const capexAmpliacionWithWrongAmortization: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Construction Co',
        fecha_emision: '2024-01-15',
        total: 50000,
        tipo: 'ampliacion',
        anos_amortizacion: 60 // Too long for expansions
      };

      // Act
      const result = validateCAPEX(capexAmpliacionWithWrongAmortization);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Las ampliaciones típicamente se amortizan entre 15 y 50 años');
    });

    test('should reject future emission dates (too far)', () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2); // 2 years in future
      
      const capexWithFutureDate: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Future Co',
        fecha_emision: futureDate.toISOString().split('T')[0],
        total: 10000,
        tipo: 'mejora',
        anos_amortizacion: 20
      };

      // Act
      const result = validateCAPEX(capexWithFutureDate);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('La fecha de emisión no puede ser en el futuro (más de 1 año)');
    });

    test('should warn for very low CAPEX amounts', () => {
      // Arrange
      const capexWithLowAmount: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Small Service',
        fecha_emision: '2024-01-15',
        total: 50, // Very low for CAPEX
        tipo: 'mejora',
        anos_amortizacion: 10
      };

      // Act
      const result = validateCAPEX(capexWithLowAmount);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('El importe es muy bajo para ser considerado CAPEX (menos de 100€)');
    });

    test('should warn for very high CAPEX amounts', () => {
      // Arrange
      const capexWithHighAmount: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Major Construction',
        fecha_emision: '2024-01-15',
        total: 250000, // Very high amount
        tipo: 'ampliacion',
        anos_amortizacion: 25
      };

      // Act
      const result = validateCAPEX(capexWithHighAmount);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('El importe es muy alto (más de 200.000€). Verifique que sea correcto.');
    });
  });

  describe('QA4: Batch Validation', () => {
    test('should validate multiple records of different types', () => {
      // Arrange
      const validIngreso: Partial<Ingreso> = {
        proveedor_contraparte: 'Tenant',
        fecha_emision: '2024-01-15',
        fecha_prevista_cobro: '2024-01-15',
        importe: 1200,
        origen: 'contrato_id',
        origen_id: 123,
        destino: 'inmueble_id',
        destino_id: 456
      };

      const invalidGasto: Partial<Gasto> = {
        // Missing required fields
        total: 100
      };

      const validCapex: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Construction Co',
        fecha_emision: '2024-01-15',
        total: 15000,
        tipo: 'mejora',
        anos_amortizacion: 20
      };

      const records = {
        ingresos: [validIngreso],
        gastos: [invalidGasto],
        capex: [validCapex]
      };

      // Act
      const result = validateTreasuryBatch(records);

      // Assert
      expect(result.summary.totalRecords).toBe(3);
      expect(result.summary.validRecords).toBe(2); // ingreso and capex are valid
      expect(result.summary.invalidRecords).toBe(1); // gasto is invalid
      expect(result.ingresos[0].isValid).toBe(true);
      expect(result.gastos[0].isValid).toBe(false);
      expect(result.capex[0].isValid).toBe(true);
    });

    test('should handle empty batch validation', () => {
      // Arrange
      const emptyRecords = {
        ingresos: [],
        gastos: [],
        capex: []
      };

      // Act
      const result = validateTreasuryBatch(emptyRecords);

      // Assert
      expect(result.summary.totalRecords).toBe(0);
      expect(result.summary.validRecords).toBe(0);
      expect(result.summary.invalidRecords).toBe(0);
      expect(result.summary.recordsWithWarnings).toBe(0);
    });

    test('should count records with warnings correctly', () => {
      // Arrange
      const ingresoWithWarning: Partial<Ingreso> = {
        proveedor_contraparte: 'Big Client',
        fecha_emision: '2024-01-15',
        fecha_prevista_cobro: '2024-01-15',
        importe: 150000, // High amount - will generate warning
        origen: 'contrato_id',
        origen_id: 123,
        destino: 'inmueble_id',
        destino_id: 456
      };

      const records = {
        ingresos: [ingresoWithWarning]
      };

      // Act
      const result = validateTreasuryBatch(records);

      // Assert
      expect(result.summary.totalRecords).toBe(1);
      expect(result.summary.validRecords).toBe(1);
      expect(result.summary.recordsWithWarnings).toBe(1);
    });
  });

  describe('QA5: Validation Helper Functions', () => {
    test('should format validation errors correctly', () => {
      // Arrange
      const validationResult: ValidationResult = {
        isValid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1']
      };

      // Act
      const formatted = formatValidationErrors(validationResult);

      // Assert
      expect(formatted).toBe('Errores: Error 1, Error 2 | Advertencias: Warning 1');
    });

    test('should format validation warnings only', () => {
      // Arrange
      const validationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['Warning only']
      };

      // Act
      const formatted = formatValidationErrors(validationResult);

      // Assert
      expect(formatted).toBe('Advertencias: Warning only');
    });

    test('should return appropriate validation icons', () => {
      // Arrange & Act & Assert
      const errorResult: ValidationResult = { isValid: false, errors: ['Error'], warnings: [] };
      expect(getValidationIcon(errorResult)).toBe('error');

      const warningResult: ValidationResult = { isValid: true, errors: [], warnings: ['Warning'] };
      expect(getValidationIcon(warningResult)).toBe('warning');

      const successResult: ValidationResult = { isValid: true, errors: [], warnings: [] };
      expect(getValidationIcon(successResult)).toBe('success');
    });
  });

  describe('QA6: Edge Cases and Business Logic', () => {
    test('should handle very edge case amounts (boundary testing)', () => {
      // Test zero amounts
      const ingresoZeroAmount: Partial<Ingreso> = {
        proveedor_contraparte: 'Test',
        fecha_emision: '2024-01-15',
        fecha_prevista_cobro: '2024-01-15',
        importe: 0,
        origen: 'doc_id',
        origen_id: 123,
        destino: 'personal'
      };

      const result = validateIngreso(ingresoZeroAmount);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El importe debe ser mayor que 0');
    });

    test('should handle extreme amortization periods', () => {
      // Test zero amortization
      const capexZeroAmortization: Partial<CAPEX> = {
        inmueble_id: 123,
        proveedor: 'Test',
        fecha_emision: '2024-01-15',
        total: 10000,
        tipo: 'mejora',
        anos_amortizacion: 0
      };

      const result = validateCAPEX(capexZeroAmortization);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Los años de amortización deben ser mayor que 0');
    });

    test('should validate exact 2-cent IVA difference boundary', () => {
      // Test exactly at the boundary (should pass)
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const gastoExactBoundary: Partial<Gasto> = {
        proveedor_nombre: 'Test Provider',
        fecha_emision: today,
        fecha_pago_prevista: futureDateStr,
        total: 150.02,
        base: 124,
        iva: 26, // 124 + 26 = 150, difference is 0.02 (exactly at boundary)
        categoria_AEAT: 'suministros',
        destino: 'personal'
      };

      const result = validateGasto(gastoExactBoundary);
      expect(result.isValid).toBe(true);

      // Test just over the boundary (should fail)
      const gastoOverBoundary: Partial<Gasto> = {
        ...gastoExactBoundary,
        total: 150.03 // 0.03 difference, over the 0.02 limit
      };

      const result2 = validateGasto(gastoOverBoundary);
      expect(result2.isValid).toBe(false);
    });

    test('should handle same-day emission and payment dates', () => {
      // Same day should be valid
      const gastoSameDay: Partial<Gasto> = {
        proveedor_nombre: 'Immediate Payment',
        fecha_emision: '2024-01-15',
        fecha_pago_prevista: '2024-01-15', // Same day
        total: 100,
        categoria_AEAT: 'reparacion-conservacion',
        destino: 'personal'
      };

      const result = validateGasto(gastoSameDay);
      expect(result.isValid).toBe(true);
    });

    test('should validate whitespace-only provider names', () => {
      const ingresoWhitespace: Partial<Ingreso> = {
        proveedor_contraparte: '   ', // Only whitespace
        fecha_emision: '2024-01-15',
        fecha_prevista_cobro: '2024-01-15',
        importe: 1000,
        origen: 'doc_id',
        origen_id: 123,
        destino: 'personal'
      };

      const result = validateIngreso(ingresoWhitespace);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El proveedor/contraparte es obligatorio');
    });
  });
});