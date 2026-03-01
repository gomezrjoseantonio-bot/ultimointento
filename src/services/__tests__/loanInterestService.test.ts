// Loan Interest Service Tests

import { prestamosService } from '../prestamosService';
import { prestamosCalculationService } from '../prestamosCalculationService';
import { getInteresesHipotecaByPropertyAndYear } from '../loanInterestService';
import { Prestamo, PlanPagos } from '../../types/prestamos';

// Mock dependencies so no IndexedDB is needed
jest.mock('../prestamosService', () => ({
  prestamosService: {
    getPrestamosByProperty: jest.fn(),
    getPaymentPlan: jest.fn(),
  },
}));

jest.mock('../prestamosCalculationService', () => ({
  prestamosCalculationService: {
    generatePaymentSchedule: jest.fn(),
  },
}));

const mockPrestamosService = prestamosService as jest.Mocked<typeof prestamosService>;
const mockCalculationService = prestamosCalculationService as jest.Mocked<typeof prestamosCalculationService>;

function makePrestamo(id: string, inmuebleId: string, activo = true): Prestamo {
  return {
    id,
    inmuebleId,
    nome: `Préstamo ${id}`,
    ambito: 'INMUEBLE',
    principalInicial: 100000,
    principalVivo: 90000,
    fechaFirma: '2020-01-01',
    fechaPrimerCargo: '2020-02-01',
    plazoMesesTotal: 300,
    diaCargoMes: 1,
    esquemaPrimerRecibo: 'NORMAL',
    tipo: 'FIJO',
    tipoNominalAnualFijo: 3.0,
    carencia: 'NINGUNA',
    sistema: 'FRANCES',
    cuotasPagadas: 0,
    origenCreacion: 'MANUAL',
    cuentaCargoId: 'cuenta1',
    activo,
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
  } as unknown as Prestamo;
}

function makePlanPagos(prestamoId: string, year: number): PlanPagos {
  // 12 monthly periods all within `year`
  const periodos = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
      periodo: i + 1,
      devengoDesde: `${year}-${month}-01`,
      devengoHasta: `${year}-${month}-28`,
      fechaCargo: `${year}-${month}-01`,
      cuota: 500,
      interes: 100,
      amortizacion: 400,
      principalFinal: 90000 - (i + 1) * 400,
      pagado: false,
    };
  });

  return {
    prestamoId,
    fechaGeneracion: new Date().toISOString(),
    periodos,
    resumen: {
      totalIntereses: 1200,
      totalCuotas: 12,
      fechaFinalizacion: `${year}-12-01`,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getInteresesHipotecaByPropertyAndYear', () => {
  test('returns 0 when no loans are linked to the property', async () => {
    mockPrestamosService.getPrestamosByProperty.mockResolvedValue([]);

    const result = await getInteresesHipotecaByPropertyAndYear(42, 2024);

    expect(result).toBe(0);
    expect(mockPrestamosService.getPrestamosByProperty).toHaveBeenCalledWith('42');
  });

  test('sums interests from payment plan for the requested year', async () => {
    const prestamo = makePrestamo('p1', '5');
    mockPrestamosService.getPrestamosByProperty.mockResolvedValue([prestamo]);
    mockPrestamosService.getPaymentPlan.mockResolvedValue(makePlanPagos('p1', 2024));

    const result = await getInteresesHipotecaByPropertyAndYear(5, 2024);

    // 12 months × 100€ interest each = 1200€
    expect(result).toBe(1200);
  });

  test('excludes periods from other years', async () => {
    const prestamo = makePrestamo('p1', '5');
    const plan = makePlanPagos('p1', 2024);
    // Add a period from a different year that should NOT be counted
    plan.periodos.push({
      periodo: 13,
      devengoDesde: '2025-01-01',
      devengoHasta: '2025-01-31',
      fechaCargo: '2025-01-01',
      cuota: 500,
      interes: 150,
      amortizacion: 350,
      principalFinal: 85000,
      pagado: false,
    });

    mockPrestamosService.getPrestamosByProperty.mockResolvedValue([prestamo]);
    mockPrestamosService.getPaymentPlan.mockResolvedValue(plan);

    const result = await getInteresesHipotecaByPropertyAndYear(5, 2024);

    // Only 2024 periods counted: 12 × 100 = 1200
    expect(result).toBe(1200);
  });

  test('sums interests across multiple loans for the same property', async () => {
    const prestamo1 = makePrestamo('p1', '7');
    const prestamo2 = makePrestamo('p2', '7');

    mockPrestamosService.getPrestamosByProperty.mockResolvedValue([prestamo1, prestamo2]);
    mockPrestamosService.getPaymentPlan
      .mockResolvedValueOnce(makePlanPagos('p1', 2024))
      .mockResolvedValueOnce(makePlanPagos('p2', 2024));

    const result = await getInteresesHipotecaByPropertyAndYear(7, 2024);

    // 2 loans × 12 months × 100€ = 2400€
    expect(result).toBe(2400);
  });

  test('skips inactive loans', async () => {
    const active = makePrestamo('p1', '3');
    const inactive = makePrestamo('p2', '3', false);

    mockPrestamosService.getPrestamosByProperty.mockResolvedValue([active, inactive]);
    mockPrestamosService.getPaymentPlan.mockResolvedValue(makePlanPagos('p1', 2024));

    const result = await getInteresesHipotecaByPropertyAndYear(3, 2024);

    // Only the active loan is counted
    expect(mockPrestamosService.getPaymentPlan).toHaveBeenCalledTimes(1);
    expect(result).toBe(1200);
  });

  test('falls back to generatePaymentSchedule when getPaymentPlan returns null', async () => {
    const prestamo = makePrestamo('p1', '9');

    mockPrestamosService.getPrestamosByProperty.mockResolvedValue([prestamo]);
    mockPrestamosService.getPaymentPlan.mockResolvedValue(null);
    mockCalculationService.generatePaymentSchedule.mockReturnValue(makePlanPagos('p1', 2024));

    const result = await getInteresesHipotecaByPropertyAndYear(9, 2024);

    expect(mockCalculationService.generatePaymentSchedule).toHaveBeenCalledWith(prestamo);
    expect(result).toBe(1200);
  });

  test('result is rounded to 2 decimal places', async () => {
    const prestamo = makePrestamo('p1', '10');
    const plan: PlanPagos = {
      prestamoId: 'p1',
      fechaGeneracion: new Date().toISOString(),
      periodos: [
        {
          periodo: 1,
          devengoDesde: '2024-01-01',
          devengoHasta: '2024-01-31',
          fechaCargo: '2024-01-01',
          cuota: 500,
          interes: 100.005,
          amortizacion: 400,
          principalFinal: 90000,
          pagado: false,
        },
        {
          periodo: 2,
          devengoDesde: '2024-02-01',
          devengoHasta: '2024-02-28',
          fechaCargo: '2024-02-01',
          cuota: 500,
          interes: 100.005,
          amortizacion: 400,
          principalFinal: 89600,
          pagado: false,
        },
      ],
      resumen: { totalIntereses: 200.01, totalCuotas: 2, fechaFinalizacion: '2024-02-01' },
    };

    mockPrestamosService.getPrestamosByProperty.mockResolvedValue([prestamo]);
    mockPrestamosService.getPaymentPlan.mockResolvedValue(plan);

    const result = await getInteresesHipotecaByPropertyAndYear(10, 2024);

    expect(result).toBe(200.01);
    expect(result).toEqual(Math.round(result * 100) / 100);
  });
});
