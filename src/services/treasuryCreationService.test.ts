import { 
  generateIncomeFromContract,
  generateIncomeFromPayroll,
  routeOCRDocumentToTreasury,
  reconcileTreasuryRecord,
  findReconciliationMatches
} from './treasuryCreationService';
import { initDB, Contract, Document, Ingreso, Gasto, CAPEX, Movement } from './db';

// Mock initDB and IndexedDB operations
jest.mock('./db', () => ({
  initDB: jest.fn(),
  Contract: {},
  Document: {},
  Ingreso: {},
  Gasto: {},
  CAPEX: {},
  Movement: {}
}));

jest.mock('./aeatClassificationService', () => ({
  isCapexType: jest.fn()
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

describe('Treasury Creation Service QA Tests', () => {
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

  describe('QA1: Contract to Income Generation', () => {
    test('should generate monthly income records for active rental contract', async () => {
      // Arrange
      const today = new Date();
      const nextYear = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      const mockProperty = { id: 1, name: 'Test Property' };
      const mockContract: Contract = {
        id: 1,
        propertyId: 1,
        scope: 'full-property',
        type: 'vivienda',
        tenant: { name: 'John Doe', email: 'john@example.com' },
        monthlyRent: 1200,
        paymentDay: 15,
        periodicity: 'monthly',
        isIndefinite: false,
        rentUpdate: { type: 'none' },
        deposit: { months: 1, amount: 1200 },
        includedServices: {},
        documents: [],
        status: 'active',
        startDate: today.toISOString().split('T')[0],
        endDate: nextYear.toISOString().split('T')[0],
        createdAt: today.toISOString(),
        updatedAt: today.toISOString()
      };

      mockDB.get.mockResolvedValue(mockProperty);
      mockDB.add.mockResolvedValue(101); // Mock ingreso ID

      // Act
      const result = await generateIncomeFromContract(mockContract);

      // Assert
      expect(result).toEqual(expect.arrayContaining([expect.any(Number)]));
      expect(result.length).toBeGreaterThan(0);
      expect(mockDB.add).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        origen: 'contrato_id',
        origen_id: 1,
        proveedor_contraparte: 'John Doe',
        importe: 1200,
        moneda: 'EUR',
        destino: 'inmueble_id',
        destino_id: 1,
        estado: 'previsto',
        from_doc: false
      }));
    });

    test('should generate income for correct payment dates', async () => {
      // Arrange
      const mockProperty = { id: 1, name: 'Test Property' };
      const mockContract: Contract = {
        id: 1,
        propertyId: 1,
        scope: 'full-property',
        type: 'vivienda',
        tenant: { name: 'Jane Smith', email: 'jane@example.com' },
        monthlyRent: 800,
        paymentDay: 1, // First day of month
        periodicity: 'monthly',
        isIndefinite: false,
        rentUpdate: { type: 'none' },
        deposit: { months: 1, amount: 800 },
        includedServices: {},
        documents: [],
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-03-31', // 3-month contract
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockDB.get.mockResolvedValue(mockProperty);
      mockDB.add.mockResolvedValue(102);

      // Act
      const result = await generateIncomeFromContract(mockContract);

      // Assert - Should generate records for remaining months
      expect(result.length).toBeGreaterThanOrEqual(1);
      
      // Verify that income records have correct payment dates
      const addCalls = mockDB.add.mock.calls.filter(call => call[0] === 'ingresos');
      addCalls.forEach(call => {
        const ingresoData = call[1];
        expect(ingresoData.fecha_emision).toMatch(/^\d{4}-\d{2}-01$/); // Should be 1st of month
        expect(ingresoData.fecha_prevista_cobro).toMatch(/^\d{4}-\d{2}-01$/);
      });
    });

    test('should not generate income for inactive contracts', async () => {
      // Arrange
      const mockProperty = { id: 1, name: 'Test Property' };
      const mockContract: Contract = {
        id: 1,
        propertyId: 1,
        scope: 'full-property',
        type: 'vivienda',
        tenant: { name: 'Inactive Tenant', email: 'inactive@example.com' },
        monthlyRent: 1000,
        paymentDay: 15,
        periodicity: 'monthly',
        isIndefinite: false,
        rentUpdate: { type: 'none' },
        deposit: { months: 1, amount: 1000 },
        includedServices: {},
        documents: [],
        status: 'terminated',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockDB.get.mockResolvedValue(mockProperty);

      // Act
      const result = await generateIncomeFromContract(mockContract);

      // Assert
      expect(result).toEqual([]);
      expect(mockDB.add).not.toHaveBeenCalled();
    });

    test('should handle error when property not found', async () => {
      // Arrange
      const mockContract: Contract = {
        id: 1,
        propertyId: 999, // Non-existent property
        scope: 'full-property',
        type: 'vivienda',
        tenant: { name: 'Test Tenant', email: 'test@example.com' },
        monthlyRent: 1000,
        paymentDay: 15,
        periodicity: 'monthly',
        isIndefinite: false,
        rentUpdate: { type: 'none' },
        deposit: { months: 1, amount: 1000 },
        includedServices: {},
        documents: [],
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockDB.get.mockResolvedValue(null); // Property not found

      // Act & Assert
      await expect(generateIncomeFromContract(mockContract)).rejects.toThrow('Property 999 not found');
    });
  });

  describe('QA2: Payroll to Income Generation', () => {
    test('should create income record from payroll data', async () => {
      // Arrange
      mockDB.add.mockResolvedValue(201);

      // Act
      const result = await generateIncomeFromPayroll(
        'Acme Corp',
        3000, // Gross amount
        2400, // Net amount
        '2024-01-31',
        123 // Payroll document ID
      );

      // Assert
      expect(result).toBe(201);
      expect(mockDB.add).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        origen: 'nomina_id',
        origen_id: 123,
        proveedor_contraparte: 'Acme Corp',
        fecha_emision: '2024-01-31',
        fecha_prevista_cobro: '2024-01-31',
        importe: 2400, // Should use net amount, not gross
        moneda: 'EUR',
        destino: 'personal',
        destino_id: undefined,
        estado: 'previsto',
        from_doc: true
      }));
    });

    test('should handle payroll without document ID', async () => {
      // Arrange
      mockDB.add.mockResolvedValue(202);

      // Act
      const result = await generateIncomeFromPayroll(
        'Small Company',
        2500,
        2000,
        '2024-02-29'
        // No document ID provided
      );

      // Assert
      expect(result).toBe(202);
      expect(mockDB.add).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        origen: 'nomina_id',
        origen_id: undefined,
        from_doc: false
      }));
    });
  });

  describe('QA3: OCR Document Routing to Treasury', () => {
    test('should route CAPEX document to CAPEX container', async () => {
      // Arrange
      const mockDocument: Document = {
        id: 301,
        filename: 'renovation-invoice.pdf',
        metadata: {
          tipo: 'CAPEX',
          financialData: { amount: 5000 },
          aeatClassification: { fiscalType: 'capex-mejora-ampliacion' },
          proveedor: 'Construction Co',
          entityType: 'property',
          entityId: 1
        },
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockDB.add.mockResolvedValue(301);

      // Act
      const result = await routeOCRDocumentToTreasury(mockDocument);

      // Assert
      expect(result.type).toBe('capex');
      expect(result.recordId).toBe(301);
      expect(result.reason).toContain('CAPEX');
      expect(mockDB.add).toHaveBeenCalledWith('capex', expect.objectContaining({
        inmueble_id: 1,
        proveedor: 'Construction Co',
        total: 5000,
        tipo: 'ampliacion', // Based on AEAT classification
        source_doc_id: 301
      }));
    });

    test('should route income document to Income container', async () => {
      // Arrange
      const mockDocument: Document = {
        id: 302,
        filename: 'rental-receipt.pdf',
        metadata: {
          financialData: { amount: 1200 },
          proveedor: 'Inquilino Juan',
          entityType: 'property',
          entityId: 2
        },
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockDB.add.mockResolvedValue(302);

      // Act
      const result = await routeOCRDocumentToTreasury(mockDocument);

      // Assert
      expect(result.type).toBe('ingreso');
      expect(result.recordId).toBe(302);
      expect(result.reason).toContain('income');
      expect(mockDB.add).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        origen: 'doc_id',
        origen_id: 302,
        proveedor_contraparte: 'Inquilino Juan',
        importe: 1200,
        destino: 'inmueble_id',
        destino_id: 2
      }));
    });

    test('should route regular expense to Expenses container', async () => {
      // Arrange
      const mockDocument: Document = {
        id: 303,
        filename: 'utility-bill.pdf',
        metadata: {
          financialData: { 
            amount: 150,
            base: 124,
            iva: 26
          },
          aeatClassification: { fiscalType: 'suministros' },
          proveedor: 'Electric Company',
          entityType: 'property',
          entityId: 1
        },
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockDB.add.mockResolvedValue(303);

      // Act
      const result = await routeOCRDocumentToTreasury(mockDocument);

      // Assert
      expect(result.type).toBe('gasto');
      expect(result.recordId).toBe(303);
      expect(result.reason).toContain('expenses');
      expect(mockDB.add).toHaveBeenCalledWith('gastos', expect.objectContaining({
        proveedor_nombre: 'Electric Company',
        total: 150,
        base: 124,
        iva: 26,
        categoria_AEAT: 'suministros',
        destino: 'inmueble_id',
        destino_id: 1,
        source_doc_id: 303
      }));
    });

    test('should handle document without financial data', async () => {
      // Arrange
      const mockDocument: Document = {
        id: 304,
        filename: 'contract.pdf',
        metadata: {
          // No financialData or amount = 0
          proveedor: 'Legal Firm'
        },
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      // Act
      const result = await routeOCRDocumentToTreasury(mockDocument);

      // Assert
      expect(result.type).toBe('none');
      expect(result.recordId).toBeUndefined();
      expect(result.reason).toContain('No financial amount detected');
      expect(mockDB.add).not.toHaveBeenCalled();
    });
  });

  describe('QA4: Treasury Record Reconciliation', () => {
    test('should reconcile income record with bank movement', async () => {
      // Arrange
      const mockIngreso = { id: 401, estado: 'previsto' };
      const mockMovement = { id: 501, amount: 1200 };

      mockDB.get.mockImplementation((store, id) => {
        if (store === 'ingresos' && id === 401) return mockIngreso;
        if (store === 'movements' && id === 501) return mockMovement;
        return null;
      });

      // Act
      await reconcileTreasuryRecord('ingreso', 401, 501);

      // Assert
      expect(mockDB.put).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        id: 401,
        movement_id: 501,
        estado: 'cobrado'
      }));
      expect(mockDB.put).toHaveBeenCalledWith('movements', expect.objectContaining({
        id: 501,
        estado_conciliacion: 'conciliado',
        linked_registro: {
          type: 'ingreso',
          id: 401
        }
      }));
    });

    test('should reconcile expense record with bank movement', async () => {
      // Arrange
      const mockGasto = { id: 402, estado: 'completo' };
      const mockMovement = { id: 502, amount: -850 };

      mockDB.get.mockImplementation((store, id) => {
        if (store === 'gastos' && id === 402) return mockGasto;
        if (store === 'movements' && id === 502) return mockMovement;
        return null;
      });

      // Act
      await reconcileTreasuryRecord('gasto', 402, 502);

      // Assert
      expect(mockDB.put).toHaveBeenCalledWith('gastos', expect.objectContaining({
        id: 402,
        movement_id: 502,
        estado: 'pagado'
      }));
      expect(mockDB.put).toHaveBeenCalledWith('movements', expect.objectContaining({
        id: 502,
        estado_conciliacion: 'conciliado',
        linked_registro: {
          type: 'gasto',
          id: 402
        }
      }));
    });

    test('should reconcile CAPEX record with bank movement', async () => {
      // Arrange
      const mockCapex = { id: 403, estado: 'completo' };
      const mockMovement = { id: 503, amount: -15000 };

      mockDB.get.mockImplementation((store, id) => {
        if (store === 'capex' && id === 403) return mockCapex;
        if (store === 'movements' && id === 503) return mockMovement;
        return null;
      });

      // Act
      await reconcileTreasuryRecord('capex', 403, 503);

      // Assert
      expect(mockDB.put).toHaveBeenCalledWith('capex', expect.objectContaining({
        id: 403,
        movement_id: 503,
        estado: 'pagado'
      }));
      expect(mockDB.put).toHaveBeenCalledWith('movements', expect.objectContaining({
        id: 503,
        estado_conciliacion: 'conciliado',
        linked_registro: {
          type: 'capex',
          id: 403
        }
      }));
    });
  });

  describe('QA5: Auto-Reconciliation Matching Algorithm', () => {
    test('should find high-confidence matches based on exact amount and date', async () => {
      // Arrange
      const mockMovements = [
        { 
          id: 601, 
          amount: 1200, 
          date: '2024-01-15',
          description: 'Rent payment John Doe',
          estado_conciliacion: 'pendiente'
        }
      ];

      const mockIngresos = [
        {
          id: 701,
          importe: 1200,
          fecha_prevista_cobro: '2024-01-15',
          proveedor_contraparte: 'John Doe'
        }
      ];

      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') return mockMovements;
        if (store === 'ingresos') return mockIngresos;
        if (store === 'gastos') return [];
        if (store === 'capex') return [];
        return [];
      });

      // Act
      const result = await findReconciliationMatches();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].movementId).toBe(601);
      expect(result[0].potentialMatches).toHaveLength(1);
      expect(result[0].potentialMatches[0]).toEqual(expect.objectContaining({
        type: 'ingreso',
        id: 701,
        confidence: expect.any(Number),
        reason: expect.stringContaining('Importe exacto')
      }));
      expect(result[0].potentialMatches[0].confidence).toBeGreaterThan(0.8); // High confidence
    });

    test('should find matches for negative amounts with expenses', async () => {
      // Arrange
      const mockMovements = [
        { 
          id: 602, 
          amount: -850, 
          date: '2024-01-10',
          description: 'Electric Company payment',
          estado_conciliacion: 'pendiente'
        }
      ];

      const mockGastos = [
        {
          id: 801,
          total: 850,
          fecha_pago_prevista: '2024-01-12',
          proveedor_nombre: 'Electric Company'
        }
      ];

      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') return mockMovements;
        if (store === 'gastos') return mockGastos;
        if (store === 'ingresos') return [];
        if (store === 'capex') return [];
        return [];
      });

      // Act
      const result = await findReconciliationMatches();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].potentialMatches[0].type).toBe('gasto');
      expect(result[0].potentialMatches[0].confidence).toBeGreaterThan(0.5);
      expect(result[0].potentialMatches[0].reason).toContain('Importe exacto');
    });

    test('should not match already reconciled movements', async () => {
      // Arrange
      const mockMovements = [
        { 
          id: 603, 
          amount: 1000, 
          date: '2024-01-15',
          description: 'Already reconciled',
          estado_conciliacion: 'conciliado' // Already reconciled
        }
      ];

      const mockIngresos = [
        {
          id: 901,
          importe: 1000,
          fecha_prevista_cobro: '2024-01-15',
          proveedor_contraparte: 'Test Provider'
        }
      ];

      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') return mockMovements;
        if (store === 'ingresos') return mockIngresos;
        if (store === 'gastos') return [];
        if (store === 'capex') return [];
        return [];
      });

      // Act
      const result = await findReconciliationMatches();

      // Assert
      expect(result).toHaveLength(0); // No matches because movement is already reconciled
    });

    test('should prioritize matches by confidence score', async () => {
      // Arrange
      const mockMovements = [
        { 
          id: 604, 
          amount: 1200, 
          date: '2024-01-15',
          description: 'Rent payment',
          estado_conciliacion: 'pendiente'
        }
      ];

      const mockIngresos = [
        {
          id: 1001, // Exact match
          importe: 1200,
          fecha_prevista_cobro: '2024-01-15',
          proveedor_contraparte: 'Perfect Match'
        },
        {
          id: 1002, // Close match
          importe: 1180,
          fecha_prevista_cobro: '2024-01-17',
          proveedor_contraparte: 'Close Match'
        }
      ];

      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') return mockMovements;
        if (store === 'ingresos') return mockIngresos;
        if (store === 'gastos') return [];
        if (store === 'capex') return [];
        return [];
      });

      // Act
      const result = await findReconciliationMatches();

      // Assert
      expect(result[0].potentialMatches).toHaveLength(2);
      // Matches should be sorted by confidence (highest first)
      expect(result[0].potentialMatches[0].confidence).toBeGreaterThan(
        result[0].potentialMatches[1].confidence
      );
      expect(result[0].potentialMatches[0].id).toBe(1001); // Exact match should be first
    });
  });

  describe('QA6: Error Handling and Edge Cases', () => {
    test('should handle database errors gracefully in contract generation', async () => {
      // Arrange
      const mockContract: Contract = {
        id: 1,
        propertyId: 1,
        scope: 'full-property',
        type: 'vivienda',
        tenant: { name: 'Test Tenant', email: 'test@example.com' },
        monthlyRent: 1000,
        paymentDay: 15,
        periodicity: 'monthly',
        isIndefinite: false,
        rentUpdate: { type: 'none' },
        deposit: { months: 1, amount: 1000 },
        includedServices: {},
        documents: [],
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockDB.get.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(generateIncomeFromContract(mockContract)).rejects.toThrow('Database connection failed');
    });

    test('should handle missing movement during reconciliation', async () => {
      // Arrange
      const mockIngreso = { id: 1001, estado: 'previsto' };
      mockDB.get.mockImplementation((store, id) => {
        if (store === 'ingresos' && id === 1001) return mockIngreso;
        if (store === 'movements' && id === 999) return null; // Movement not found
        return null;
      });

      // Act
      await reconcileTreasuryRecord('ingreso', 1001, 999);

      // Assert - Should still update the ingreso even if movement is not found
      expect(mockDB.put).toHaveBeenCalledWith('ingresos', expect.objectContaining({
        id: 1001,
        movement_id: 999,
        estado: 'cobrado'
      }));
    });

    test('should handle empty reconciliation search results', async () => {
      // Arrange
      mockDB.getAll.mockImplementation(() => []); // No records found

      // Act
      const result = await findReconciliationMatches();

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});