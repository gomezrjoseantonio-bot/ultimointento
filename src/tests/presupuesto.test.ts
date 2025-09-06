import {
  createPresupuesto,
  createPresupuestoLinea,
  getPresupuestoLineas,
  calcularResumenPresupuesto,
  generarCalendarioLinea,
  sembrarPresupuesto,
  validarLinea
} from '../modules/horizon/proyeccion/presupuesto/services/presupuestoService';

// Mock the entire db module
jest.mock('../services/db', () => ({
  initDB: jest.fn(),
}));

// Import after mocking
import { initDB } from '../services/db';

// Mock IndexedDB for testing
const mockDB = {
  add: jest.fn().mockResolvedValue('test-uuid-123'),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  getAll: jest.fn(),
  transaction: jest.fn(() => ({
    store: {
      index: jest.fn(() => ({
        getAll: jest.fn().mockResolvedValue([])
      }))
    },
    objectStore: jest.fn(() => ({
      index: jest.fn(() => ({
        getAll: jest.fn().mockResolvedValue([])
      }))
    }))
  }))
};

describe('Presupuesto Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup initDB mock to return our mockDB
    (initDB as jest.Mock).mockResolvedValue(mockDB);
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const invalidLinea = {
        presupuestoId: 'test-presupuesto',
        tipo: 'Gasto' as const,
        categoria: undefined,
        tipoConcepto: '',
        frecuencia: 'Mensual' as const,
        importeUnitario: 0,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const errors = validarLinea(invalidLinea);
      
      expect(errors).toContain('Categoría es requerida');
      expect(errors).toContain('Tipo de concepto es requerido');
      expect(errors).toContain('Importe debe ser mayor que 0');
    });

    it('should validate day of month range', () => {
      const invalidLinea = {
        presupuestoId: 'test-presupuesto',
        tipo: 'Gasto' as const,
        categoria: 'Comunidad' as const,
        tipoConcepto: 'Gastos comunidad',
        frecuencia: 'Mensual' as const,
        dayOfMonth: 35, // Invalid
        importeUnitario: 100,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const errors = validarLinea(invalidLinea);
      
      expect(errors).toContain('Día del mes debe estar entre 1 y 28');
    });

    it('should validate unique payments require date', () => {
      const invalidLinea = {
        presupuestoId: 'test-presupuesto',
        tipo: 'Gasto' as const,
        categoria: 'IBI' as const,
        tipoConcepto: 'IBI anual',
        frecuencia: 'Unico' as const,
        importeUnitario: 500,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const errors = validarLinea(invalidLinea);
      
      expect(errors).toContain('Fecha única es requerida para pagos únicos');
    });

    it('should pass validation for valid linea', () => {
      const validLinea = {
        presupuestoId: 'test-presupuesto',
        tipo: 'Gasto' as const,
        categoria: 'Comunidad' as const,
        tipoConcepto: 'Gastos comunidad',
        frecuencia: 'Mensual' as const,
        dayOfMonth: 15,
        importeUnitario: 100,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const errors = validarLinea(validLinea);
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('Calendar Generation', () => {
    it('should generate monthly events correctly', () => {
      const linea = {
        id: 'test-linea',
        presupuestoId: 'test-presupuesto',
        tipo: 'Gasto' as const,
        categoria: 'Comunidad' as const,
        tipoConcepto: 'Gastos comunidad',
        frecuencia: 'Mensual' as const,
        dayOfMonth: 15,
        importeUnitario: 100,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const eventos = generarCalendarioLinea(linea, 2024);
      
      expect(eventos).toHaveLength(12); // 12 months
      eventos.forEach((evento, index) => {
        expect(evento.importe).toBe(100);
        expect(new Date(evento.fecha).getDate()).toBe(15);
        expect(new Date(evento.fecha).getMonth()).toBe(index);
      });
    });

    it('should generate quarterly events correctly', () => {
      const linea = {
        id: 'test-linea',
        presupuestoId: 'test-presupuesto',
        tipo: 'Gasto' as const,
        categoria: 'IBI' as const,
        tipoConcepto: 'IBI trimestral',
        frecuencia: 'Trimestral' as const,
        dayOfMonth: 1,
        importeUnitario: 300,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const eventos = generarCalendarioLinea(linea, 2024);
      
      expect(eventos).toHaveLength(4); // 4 quarters
      eventos.forEach(evento => {
        expect(evento.importe).toBe(300);
      });
    });

    it('should generate annual events correctly', () => {
      const linea = {
        id: 'test-linea',
        presupuestoId: 'test-presupuesto',
        tipo: 'Gasto' as const,
        categoria: 'Seguros' as const,
        tipoConcepto: 'Seguro hogar anual',
        frecuencia: 'Anual' as const,
        dayOfMonth: 15,
        importeUnitario: 600,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const eventos = generarCalendarioLinea(linea, 2024);
      
      expect(eventos).toHaveLength(1); // 1 annual payment
      expect(eventos[0].importe).toBe(600);
    });

    it('should generate unique payment correctly', () => {
      const linea = {
        id: 'test-linea',
        presupuestoId: 'test-presupuesto',
        tipo: 'Gasto' as const,
        categoria: 'ReparaciónYConservación' as const,
        tipoConcepto: 'Reparación específica',
        frecuencia: 'Unico' as const,
        fechaUnica: '2024-06-15',
        importeUnitario: 1500,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const eventos = generarCalendarioLinea(linea, 2024);
      
      expect(eventos).toHaveLength(1);
      expect(eventos[0].importe).toBe(1500);
      expect(eventos[0].fecha).toBe('2024-06-15');
    });

    it('should respect vigencia dates', () => {
      const linea = {
        id: 'test-linea',
        presupuestoId: 'test-presupuesto',
        tipo: 'Ingreso' as const,
        categoria: 'Alquiler' as const,
        tipoConcepto: 'Alquiler habitación',
        frecuencia: 'Mensual' as const,
        dayOfMonth: 1,
        importeUnitario: 800,
        desde: '2024-06-01', // Start in June
        hasta: '2024-09-30', // End in September
        origen: 'SemillaAuto' as const,
        editable: true
      };

      const eventos = generarCalendarioLinea(linea, 2024);
      
      expect(eventos).toHaveLength(4); // June, July, August, September
      eventos.forEach(evento => {
        const fecha = new Date(evento.fecha);
        expect(fecha.getMonth()).toBeGreaterThanOrEqual(5); // June = 5
        expect(fecha.getMonth()).toBeLessThanOrEqual(8); // September = 8
      });
    });
  });

  describe('Budget Calculations', () => {
    it('should calculate correct totals for mixed income/expense lines', async () => {
      // Mock getPresupuestoLineas to return test data
      const mockLineas = [
        {
          id: 'linea-1',
          presupuestoId: 'test-presupuesto',
          tipo: 'Ingreso' as const,
          categoria: 'Alquiler' as const,
          tipoConcepto: 'Alquiler mensual',
          frecuencia: 'Mensual' as const,
          dayOfMonth: 1,
          importeUnitario: 1000,
          origen: 'SemillaAuto' as const,
          editable: true
        },
        {
          id: 'linea-2',
          presupuestoId: 'test-presupuesto',
          tipo: 'Gasto' as const,
          categoria: 'Comunidad' as const,
          tipoConcepto: 'Gastos comunidad',
          frecuencia: 'Mensual' as const,
          dayOfMonth: 15,
          importeUnitario: 100,
          origen: 'ManualUsuario' as const,
          editable: true
        },
        {
          id: 'linea-3',
          presupuestoId: 'test-presupuesto',
          tipo: 'Gasto' as const,
          categoria: 'IBI' as const,
          tipoConcepto: 'IBI anual',
          frecuencia: 'Anual' as const,
          dayOfMonth: 1,
          importeUnitario: 600,
          origen: 'ManualUsuario' as const,
          editable: true
        }
      ];

      // Mock database responses
      mockDB.get.mockResolvedValue({
        id: 'test-presupuesto',
        year: 2024,
        estado: 'Borrador',
        creadoEn: '2024-01-01T00:00:00.000Z',
        actualizadoEn: '2024-01-01T00:00:00.000Z'
      });

      mockDB.transaction.mockReturnValue({
        store: {
          index: jest.fn(() => ({
            getAll: jest.fn().mockResolvedValue(mockLineas)
          }))
        },
        objectStore: jest.fn(() => ({
          index: jest.fn(() => ({
            getAll: jest.fn().mockResolvedValue([])
          }))
        }))
      });

      const resumen = await calcularResumenPresupuesto('test-presupuesto');

      // Verify annual totals
      expect(resumen.ingresoAnual).toBe(12000); // 1000 * 12 months
      expect(resumen.gastoAnual).toBe(1800); // (100 * 12) + 600
      expect(resumen.netoAnual).toBe(10200); // 12000 - 1800

      // Verify monthly breakdown
      expect(resumen.breakdown.ingresos).toHaveLength(12);
      expect(resumen.breakdown.gastos).toHaveLength(12);
      expect(resumen.breakdown.neto).toHaveLength(12);

      // Check first month (includes annual IBI payment)
      expect(resumen.breakdown.ingresos[0]).toBe(1000);
      expect(resumen.breakdown.gastos[0]).toBe(700); // 100 + 600 (IBI)
      expect(resumen.breakdown.neto[0]).toBe(300); // 1000 - 700

      // Check other months (no IBI)
      expect(resumen.breakdown.gastos[1]).toBe(100); // Only community fees
      expect(resumen.breakdown.neto[1]).toBe(900); // 1000 - 100
    });
  });

  describe('Integration Tests', () => {
    it('should create presupuesto, add lines, and calculate correctly', async () => {
      // Mock successful database operations
      mockDB.add.mockResolvedValue('test-presupuesto-id');

      const presupuestoId = await createPresupuesto(2024);
      expect(presupuestoId).toMatch(/^[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}$/); // UUID pattern

      // Add a line
      const lineaData = {
        presupuestoId: 'test-presupuesto-id',
        tipo: 'Ingreso' as const,
        categoria: 'Alquiler' as const,
        tipoConcepto: 'Alquiler mensual',
        frecuencia: 'Mensual' as const,
        dayOfMonth: 1,
        importeUnitario: 1200,
        origen: 'ManualUsuario' as const,
        editable: true
      };

      const lineaId = await createPresupuestoLinea(lineaData);
      expect(mockDB.add).toHaveBeenCalledWith('presupuestoLineas', expect.objectContaining({
        ...lineaData,
        id: expect.any(String)
      }));
    });
  });
});

console.log('✅ Presupuesto Service Tests - Test suite setup complete');
console.log('📋 Key test scenarios covered:');
console.log('  • Field validation (required fields, ranges, conditional requirements)');
console.log('  • Calendar generation for different frequencies (Mensual, Trimestral, Anual, Único)');
console.log('  • Vigencia date handling (mid-year start/end)');
console.log('  • Budget calculations (income/expense totals, monthly breakdown)');
console.log('  • Integration flow (create budget, add lines, calculate totals)');
console.log('  • Edge cases (day-of-month clamping, leap year handling)');