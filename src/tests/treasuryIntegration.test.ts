import {
  generateIncomeFromContract,
  generateIncomeFromPayroll,
  routeOCRDocumentToTreasury,
  reconcileTreasuryRecord,
  findReconciliationMatches
} from '../services/treasuryCreationService';
import {
  validateIngreso,
  validateGasto,
  validateCAPEX,
  validateTreasuryBatch
} from '../services/treasuryValidationService';
import { initDB, Contract, Document, Ingreso, Gasto, CAPEX, Movement, Property } from '../services/db';

// Mock external dependencies
jest.mock('../services/db', () => ({
  initDB: jest.fn(),
  Contract: {},
  Document: {},
  Ingreso: {},
  Gasto: {},
  CAPEX: {},
  Movement: {},
  Property: {}
}));

jest.mock('../services/aeatClassificationService', () => ({
  isCapexType: jest.fn(),
  formatEuro: (amount: number) => `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

describe('Treasury Integration Tests - End-to-End Scenarios', () => {
  let mockDB: any;

  beforeEach(() => {
    mockDB = {
      add: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      getAll: jest.fn()
    };
    (initDB as jest.Mock).mockResolvedValue(mockDB);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('E2E Scenario 1: Complete Rental Contract Workflow', () => {
    test('should create contract, generate income, validate, and reconcile with bank movement', async () => {
      // Step 1: Setup rental contract
      const rentalContract: Contract = {
        id: 1,
        propertyId: 101,
        tenant: { name: 'María García', email: 'maria@example.com' },
        monthlyRent: 1200,
        paymentDay: 5,
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const property: Property = { 
        id: 101, 
        name: 'Apartamento Centro',
        address: 'Calle Mayor 123',
        type: 'apartment',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockDB.get.mockResolvedValue(property);
      mockDB.add.mockResolvedValue(2001);

      // Step 2: Generate income records from contract
      const incomeIds = await generateIncomeFromContract(rentalContract);

      // Verify income generation
      expect(incomeIds.length).toBeGreaterThan(0);
      expect(mockDB.add).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        origen: 'contrato_id',
        origen_id: 1,
        proveedor_contraparte: 'María García',
        importe: 1200,
        destino: 'inmueble_id',
        destino_id: 101,
        estado: 'previsto'
      }));

      // Step 3: Validate generated income record
      const generatedIngreso: Partial<Ingreso> = {
        proveedor_contraparte: 'María García',
        fecha_emision: '2024-02-05',
        fecha_prevista_cobro: '2024-02-05',
        importe: 1200,
        origen: 'contrato_id',
        origen_id: 1,
        destino: 'inmueble_id',
        destino_id: 101,
        estado: 'previsto',
        moneda: 'EUR'
      };

      const validationResult = validateIngreso(generatedIngreso);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      // Step 4: Simulate bank movement arrival
      const bankMovement: Movement = {
        id: 3001,
        date: '2024-02-05',
        amount: 1200,
        description: 'Transferencia María García',
        balance: 15200,
        account: 'ES12 1234 5678 9012 3456 7890',
        estado_conciliacion: 'pendiente',
        createdAt: '2024-02-05T00:00:00Z',
        updatedAt: '2024-02-05T00:00:00Z'
      };

      // Step 5: Auto-reconciliation should find match
      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') return [bankMovement];
        if (store === 'ingresos') return [{ ...generatedIngreso, id: 2001 }];
        if (store === 'gastos') return [];
        if (store === 'capex') return [];
        return [];
      });

      const reconciliationMatches = await findReconciliationMatches();

      expect(reconciliationMatches).toHaveLength(1);
      expect(reconciliationMatches[0].movementId).toBe(3001);
      expect(reconciliationMatches[0].potentialMatches[0]).toEqual(expect.objectContaining({
        type: 'ingreso',
        id: 2001,
        confidence: expect.any(Number)
      }));

      // Step 6: Manual confirmation of reconciliation
      const mockIngresoRecord = { ...generatedIngreso, id: 2001 };
      const mockMovementRecord = { ...bankMovement };

      mockDB.get.mockImplementation((store, id) => {
        if (store === 'ingresos' && id === 2001) return mockIngresoRecord;
        if (store === 'movements' && id === 3001) return mockMovementRecord;
        return null;
      });

      await reconcileTreasuryRecord('ingreso', 2001, 3001);

      // Verify reconciliation updates
      expect(mockDB.put).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        id: 2001,
        movement_id: 3001,
        estado: 'cobrado'
      }));

      expect(mockDB.put).toHaveBeenCalledWith('movements', expect.objectContaining({
        id: 3001,
        estado_conciliacion: 'conciliado',
        linked_registro: {
          type: 'ingreso',
          id: 2001
        }
      }));
    });
  });

  describe('E2E Scenario 2: OCR Document Processing to CAPEX Workflow', () => {
    test('should process renovation invoice OCR, route to CAPEX, validate, and track amortization', async () => {
      // Step 1: Simulate OCR document arrival
      const renovationInvoice: Document = {
        id: 4001,
        filename: 'renovacion-cocina-2024.pdf',
        metadata: {
          tipo: 'CAPEX',
          financialData: {
            amount: 18500,
            base: 15289.26,
            iva: 3210.74,
            issueDate: '2024-01-15'
          },
          aeatClassification: {
            fiscalType: 'capex-mejora-ampliacion'
          },
          proveedor: 'Reformas Integrales SL',
          entityType: 'property',
          entityId: 102
        },
        status: 'completed',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z'
      };

      mockDB.add.mockResolvedValue(5001);

      // Step 2: Route OCR document to Treasury
      const routingResult = await routeOCRDocumentToTreasury(renovationInvoice);

      expect(routingResult.type).toBe('capex');
      expect(routingResult.recordId).toBe(5001);
      expect(routingResult.reason).toContain('CAPEX');

      // Verify CAPEX record creation
      expect(mockDB.add).toHaveBeenCalledWith('capex', expect.objectContaining({
        inmueble_id: 102,
        proveedor: 'Reformas Integrales SL',
        fecha_emision: '2024-01-15',
        total: 18500,
        tipo: 'ampliacion',
        anos_amortizacion: 15,
        estado: 'completo',
        source_doc_id: 4001
      }));

      // Step 3: Validate created CAPEX record
      const createdCapex: Partial<CAPEX> = {
        inmueble_id: 102,
        proveedor: 'Reformas Integrales SL',
        fecha_emision: '2024-01-15',
        total: 18500,
        tipo: 'ampliacion',
        anos_amortizacion: 15,
        estado: 'completo'
      };

      const capexValidation = validateCAPEX(createdCapex);
      expect(capexValidation.isValid).toBe(true);
      expect(capexValidation.errors).toHaveLength(0);

      // Step 4: Simulate bank payment
      const paymentMovement: Movement = {
        id: 6001,
        date: '2024-01-30',
        amount: -18500,
        description: 'REFORMA COCINA REFORMAS INTEGRALES',
        balance: 45000,
        account: 'ES12 1234 5678 9012 3456 7890',
        estado_conciliacion: 'pendiente',
        createdAt: '2024-01-30T00:00:00Z',
        updatedAt: '2024-01-30T00:00:00Z'
      };

      // Step 5: Auto-reconciliation for CAPEX payment
      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') return [paymentMovement];
        if (store === 'capex') return [{ ...createdCapex, id: 5001 }];
        if (store === 'ingresos') return [];
        if (store === 'gastos') return [];
        return [];
      });

      const capexMatches = await findReconciliationMatches();

      expect(capexMatches).toHaveLength(1);
      expect(capexMatches[0].potentialMatches[0].type).toBe('capex');

      // Step 6: Reconcile CAPEX with payment
      const mockCapexRecord = { ...createdCapex, id: 5001 };
      const mockPaymentRecord = { ...paymentMovement };

      mockDB.get.mockImplementation((store, id) => {
        if (store === 'capex' && id === 5001) return mockCapexRecord;
        if (store === 'movements' && id === 6001) return mockPaymentRecord;
        return null;
      });

      await reconcileTreasuryRecord('capex', 5001, 6001);

      expect(mockDB.put).toHaveBeenCalledWith('capex', expect.objectContaining({
        id: 5001,
        movement_id: 6001,
        estado: 'pagado'
      }));
    });
  });

  describe('E2E Scenario 3: Mixed Treasury Records Batch Validation', () => {
    test('should validate batch of different treasury record types with mixed results', async () => {
      // Setup mixed batch of records
      const mixedRecords = {
        ingresos: [
          // Valid income
          {
            proveedor_contraparte: 'Tenant A',
            fecha_emision: '2024-01-15',
            fecha_prevista_cobro: '2024-01-15',
            importe: 1200,
            origen: 'contrato_id',
            origen_id: 1,
            destino: 'inmueble_id',
            destino_id: 101
          },
          // Invalid income (missing fields)
          {
            proveedor_contraparte: 'Incomplete Tenant',
            importe: 800
          },
          // Valid but with warnings (high amount)
          {
            proveedor_contraparte: 'Big Client',
            fecha_emision: '2024-01-15',
            fecha_prevista_cobro: '2024-01-15',
            importe: 120000, // High amount
            origen: 'contrato_id',
            origen_id: 2,
            destino: 'inmueble_id',
            destino_id: 102
          }
        ],
        gastos: [
          // Valid expense
          {
            proveedor_nombre: 'Electric Company',
            fecha_emision: '2024-01-10',
            fecha_pago_prevista: '2024-01-25',
            total: 150,
            base: 124,
            iva: 26,
            categoria_AEAT: 'suministros',
            destino: 'inmueble_id',
            destino_id: 101
          },
          // Invalid expense (IVA mismatch)
          {
            proveedor_nombre: 'Bad Math Company',
            fecha_emision: '2024-01-10',
            fecha_pago_prevista: '2024-01-25',
            total: 150,
            base: 100,
            iva: 40, // 100 + 40 = 140, but total is 150
            categoria_AEAT: 'reparacion-conservacion',
            destino: 'personal'
          }
        ],
        capex: [
          // Valid CAPEX
          {
            inmueble_id: 101,
            proveedor: 'Construction Co',
            fecha_emision: '2024-01-05',
            total: 25000,
            tipo: 'mejora',
            anos_amortizacion: 20
          },
          // CAPEX with warnings (wrong amortization for furniture)
          {
            inmueble_id: 102,
            proveedor: 'Furniture Store',
            fecha_emision: '2024-01-08',
            total: 5000,
            tipo: 'mobiliario',
            anos_amortizacion: 25 // Should be 10
          }
        ]
      };

      // Execute batch validation
      const batchResult = validateTreasuryBatch(mixedRecords);

      // Verify summary statistics
      expect(batchResult.summary.totalRecords).toBe(7);
      expect(batchResult.summary.validRecords).toBe(5); // 3 valid ingresos, 1 valid gasto, 2 valid capex
      expect(batchResult.summary.invalidRecords).toBe(2); // 1 invalid ingreso, 1 invalid gasto
      expect(batchResult.summary.recordsWithWarnings).toBe(2); // High amount ingreso, wrong amortization capex

      // Verify individual validations
      expect(batchResult.ingresos[0].isValid).toBe(true);
      expect(batchResult.ingresos[1].isValid).toBe(false);
      expect(batchResult.ingresos[2].isValid).toBe(true);
      expect(batchResult.ingresos[2].warnings.length).toBeGreaterThan(0);

      expect(batchResult.gastos[0].isValid).toBe(true);
      expect(batchResult.gastos[1].isValid).toBe(false);

      expect(batchResult.capex[0].isValid).toBe(true);
      expect(batchResult.capex[1].isValid).toBe(true);
      expect(batchResult.capex[1].warnings.length).toBeGreaterThan(0);
    });
  });

  describe('E2E Scenario 4: Auto-Reconciliation Complex Matching', () => {
    test('should handle complex reconciliation scenarios with confidence scoring', async () => {
      // Setup multiple movements and treasury records
      const movements = [
        {
          id: 7001,
          amount: 1200,
          date: '2024-01-15',
          description: 'RENT PAYMENT MARIA GARCIA',
          estado_conciliacion: 'pendiente'
        },
        {
          id: 7002,
          amount: -850,
          date: '2024-01-18',
          description: 'ELECTRIC BILL IBERDROLA',
          estado_conciliacion: 'pendiente'
        },
        {
          id: 7003,
          amount: 1200,
          date: '2024-01-17',
          description: 'UNKNOWN TRANSFER',
          estado_conciliacion: 'pendiente'
        }
      ];

      const ingresos = [
        {
          id: 8001,
          importe: 1200,
          fecha_prevista_cobro: '2024-01-15',
          proveedor_contraparte: 'María García'
        },
        {
          id: 8002,
          importe: 1200,
          fecha_prevista_cobro: '2024-01-20',
          proveedor_contraparte: 'Juan Pérez'
        }
      ];

      const gastos = [
        {
          id: 9001,
          total: 850,
          fecha_pago_prevista: '2024-01-18',
          proveedor_nombre: 'Iberdrola'
        },
        {
          id: 9002,
          total: 800,
          fecha_pago_prevista: '2024-01-18',
          proveedor_nombre: 'Gas Natural'
        }
      ];

      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') return movements;
        if (store === 'ingresos') return ingresos;
        if (store === 'gastos') return gastos;
        if (store === 'capex') return [];
        return [];
      });

      const matches = await findReconciliationMatches();

      // Should find matches for all movements
      expect(matches).toHaveLength(3);

      // Movement 7001 should match strongly with ingreso 8001 (exact amount, date, name match)
      const movement1Matches = matches.find(m => m.movementId === 7001);
      expect(movement1Matches?.potentialMatches[0]).toEqual(expect.objectContaining({
        type: 'ingreso',
        id: 8001,
        confidence: expect.any(Number)
      }));
      expect(movement1Matches?.potentialMatches[0].confidence).toBeGreaterThan(0.8);

      // Movement 7002 should match with gasto 9001 (exact amount, date, provider match)
      const movement2Matches = matches.find(m => m.movementId === 7002);
      expect(movement2Matches?.potentialMatches[0]).toEqual(expect.objectContaining({
        type: 'gasto',
        id: 9001
      }));

      // Movement 7003 should have lower confidence matches (amount match but different dates/names)
      const movement3Matches = matches.find(m => m.movementId === 7003);
      expect(movement3Matches?.potentialMatches.length).toBeGreaterThan(0);
      expect(movement3Matches?.potentialMatches[0].confidence).toBeLessThan(0.8);
    });
  });

  describe('E2E Scenario 5: Error Recovery and Data Integrity', () => {
    test('should maintain data integrity during partial failures', async () => {
      // Simulate scenario where some operations fail
      const contract: Contract = {
        id: 10,
        propertyId: 999, // Non-existent property
        tenant: { name: 'Test Tenant', email: 'test@example.com' },
        monthlyRent: 1000,
        paymentDay: 15,
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      // Property doesn't exist - should fail
      mockDB.get.mockResolvedValue(null);

      await expect(generateIncomeFromContract(contract)).rejects.toThrow('Property 999 not found');

      // Verify no income records were created
      expect(mockDB.add).not.toHaveBeenCalledWith('ingresos', expect.anything());

      // Test partial reconciliation failure
      const validIngreso = { id: 11001, estado: 'previsto' };
      mockDB.get.mockImplementation((store, id) => {
        if (store === 'ingresos' && id === 11001) return validIngreso;
        if (store === 'movements' && id === 12001) {
          throw new Error('Movement not accessible');
        }
        return null;
      });

      // Should still update the ingreso record even if movement update fails
      await reconcileTreasuryRecord('ingreso', 11001, 12001);

      expect(mockDB.put).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        id: 11001,
        movement_id: 12001,
        estado: 'cobrado'
      }));
    });
  });

  describe('E2E Scenario 6: Performance and Scale Testing', () => {
    test('should handle large batch operations efficiently', async () => {
      // Create large batch of records for validation
      const largeBatch = {
        ingresos: Array.from({ length: 100 }, (_, i) => ({
          proveedor_contraparte: `Tenant ${i + 1}`,
          fecha_emision: '2024-01-15',
          fecha_prevista_cobro: '2024-01-15',
          importe: 1000 + i,
          origen: 'contrato_id',
          origen_id: i + 1,
          destino: 'inmueble_id',
          destino_id: 101
        })),
        gastos: Array.from({ length: 50 }, (_, i) => ({
          proveedor_nombre: `Provider ${i + 1}`,
          fecha_emision: '2024-01-15',
          fecha_pago_prevista: '2024-01-30',
          total: 500 + i,
          categoria_AEAT: 'reparacion-conservacion',
          destino: 'personal'
        })),
        capex: Array.from({ length: 20 }, (_, i) => ({
          inmueble_id: 101,
          proveedor: `Constructor ${i + 1}`,
          fecha_emision: '2024-01-15',
          total: 10000 + i * 1000,
          tipo: 'mejora',
          anos_amortizacion: 20
        }))
      };

      const startTime = Date.now();
      const result = validateTreasuryBatch(largeBatch);
      const endTime = Date.now();

      // Should complete validation quickly
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second

      // Should validate all records
      expect(result.summary.totalRecords).toBe(170);
      expect(result.summary.validRecords).toBe(170); // All should be valid
      expect(result.summary.invalidRecords).toBe(0);
    });

    test('should handle large reconciliation search efficiently', async () => {
      // Create large dataset for reconciliation matching
      const manyMovements = Array.from({ length: 200 }, (_, i) => ({
        id: 20000 + i,
        amount: Math.random() > 0.5 ? 1000 + i : -(500 + i),
        date: '2024-01-15',
        description: `Transaction ${i}`,
        estado_conciliacion: 'pendiente'
      }));

      const manyRecords = Array.from({ length: 150 }, (_, i) => ({
        id: 30000 + i,
        importe: 1000 + i,
        fecha_prevista_cobro: '2024-01-15',
        proveedor_contraparte: `Provider ${i}`
      }));

      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') return manyMovements;
        if (store === 'ingresos') return manyRecords;
        if (store === 'gastos') return [];
        if (store === 'capex') return [];
        return [];
      });

      const startTime = Date.now();
      const matches = await findReconciliationMatches();
      const endTime = Date.now();

      // Should complete search efficiently
      expect(endTime - startTime).toBeLessThan(2000); // Less than 2 seconds
      expect(Array.isArray(matches)).toBe(true);
    });
  });
});