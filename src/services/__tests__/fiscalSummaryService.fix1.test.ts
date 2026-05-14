// S-FISCAL-FIXES Fix 1 · N4 tope intereses+reparación
// Validación al céntimo contra T64 4D 2024 · spec docs/specs/S-FISCAL-FIXES-1-4.md §3

import { calculateFiscalSummary } from '../fiscalSummaryService';
import { initDB, AEATCarryForward } from '../db';
import {
  generarOperacionesDesdeIntereses,
  generarOperacionesDesdeRecurrentes,
} from '../operacionFiscalService';
import { gastosInmuebleService } from '../gastosInmuebleService';
import { getRentalDaysForYear, updateFiscalSummaryWithAEAT } from '../aeatAmortizationService';
import { calcularAmortizacionMobiliarioAnual } from '../mobiliarioActivoService';
import { getTotalMejorasHastaEjercicio } from '../mejoraActivoService';
import { getExerciseStatus } from '../aeatClassificationService';
import {
  getCarryForwardsDisponibles,
  consumirArrastresAplicados,
} from '../carryForwardService';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));
jest.mock('../operacionFiscalService', () => ({
  generarOperacionesDesdeIntereses: jest.fn(),
  generarOperacionesDesdeRecurrentes: jest.fn(),
}));
jest.mock('../gastosInmuebleService', () => ({
  gastosInmuebleService: { getSumaPorCasilla: jest.fn() },
}));
jest.mock('../aeatAmortizationService', () => ({
  getRentalDaysForYear: jest.fn(),
  updateFiscalSummaryWithAEAT: jest.fn(),
}));
jest.mock('../mobiliarioActivoService', () => ({
  calcularAmortizacionMobiliarioAnual: jest.fn(),
}));
jest.mock('../mejoraActivoService', () => ({
  getTotalMejorasHastaEjercicio: jest.fn(),
}));
jest.mock('../aeatClassificationService', () => ({
  getExerciseStatus: jest.fn(),
}));
jest.mock('../carryForwardService', () => ({
  getCarryForwardsDisponibles: jest.fn(),
  consumirArrastresAplicados: jest.fn(),
}));
jest.mock('../ejercicioResolverService', () => ({
  getEjercicio: jest.fn(async () => null),
}));

const T64_4D_ID = 4001;
const BUIGAS_ID = 4002;

interface MockedDB {
  get: jest.Mock;
  getAll: jest.Mock;
  getAllFromIndex: jest.Mock;
  add: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
}

function buildMockDB(): MockedDB {
  return {
    get: jest.fn(async (store: string, id: number) => {
      if (store === 'properties') return { id, alias: `prop ${id}` };
      return null;
    }),
    getAll: jest.fn(async (store: string) => {
      if (store === 'contracts') return [];
      return [];
    }),
    getAllFromIndex: jest.fn(async (store: string) => {
      if (store === 'contracts') return [];
      if (store === 'aeatCarryForwards') return [];
      return [];
    }),
    add: jest.fn(async () => 1),
    put: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };
}

describe('Fix 1 · N4 tope intereses+reparación', () => {
  let mockDB: MockedDB;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDB = buildMockDB();
    (initDB as jest.Mock).mockResolvedValue(mockDB);
    (generarOperacionesDesdeRecurrentes as jest.Mock).mockResolvedValue(0);
    (generarOperacionesDesdeIntereses as jest.Mock).mockResolvedValue(0);
    (getRentalDaysForYear as jest.Mock).mockResolvedValue(184);
    (calcularAmortizacionMobiliarioAnual as jest.Mock).mockResolvedValue(0);
    (getTotalMejorasHastaEjercicio as jest.Mock).mockResolvedValue(0);
    (getExerciseStatus as jest.Mock).mockReturnValue('Vivo');
    (updateFiscalSummaryWithAEAT as jest.Mock).mockResolvedValue({
      constructionValue: 0,
      annualDepreciation: 0,
      aeatAmortization: undefined,
    });
  });

  it('T64 4D 2024 · aplica arrastres entrantes primero y genera nuevo arrastre saliente', async () => {
    // gastos 0105=531.74, 0106=32367.50; ingresos íntegros 7160; arrastres entrantes 2500
    (gastosInmuebleService.getSumaPorCasilla as jest.Mock).mockResolvedValue({
      '0105': 531.74,
      '0106': 32367.5,
    });
    mockDB.getAll.mockImplementation(async (store: string) => {
      if (store === 'contracts') {
        return [
          {
            id: 1,
            propertyId: T64_4D_ID,
            rentaMensual: 7160 / 6, // 6 meses
            fechaInicio: '2024-01-01',
            fechaFin: '2024-06-30',
          },
        ];
      }
      return [];
    });
    const arrastreEntrante: AEATCarryForward = {
      id: 99,
      propertyId: T64_4D_ID,
      taxYear: 2023,
      totalIncome: 0,
      financingAndRepair: 2500,
      limitApplied: 0,
      excessAmount: 2500,
      expirationYear: 2027,
      remainingAmount: 2500,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    (getCarryForwardsDisponibles as jest.Mock).mockResolvedValue({
      total: 2500,
      detalle: [arrastreEntrante],
    });

    const summary = await calculateFiscalSummary(T64_4D_ID, 2024);

    expect(summary.box0102).toBeCloseTo(7160, 2);
    expect(summary.box0103).toBeCloseTo(2500, 2);
    expect(summary.box0104).toBeCloseTo(2500, 2);
    expect(summary.box0107).toBeCloseTo(4660, 2);
    expect(summary.box0108).toBeCloseTo(28239.24, 2);

    // Consumió los arrastres entrantes
    expect(consumirArrastresAplicados).toHaveBeenCalledWith([arrastreEntrante], 2500);

    // Persistió el nuevo arrastre saliente
    expect(mockDB.add).toHaveBeenCalledWith(
      'aeatCarryForwards',
      expect.objectContaining({
        propertyId: T64_4D_ID,
        taxYear: 2024,
        expirationYear: 2028,
        excessAmount: expect.closeTo(28239.24, 2),
        remainingAmount: expect.closeTo(28239.24, 2),
      }),
    );
  });

  it('Carles Buigas 2024 · sin intereses ni reparación · box0107 = 0 y sin nuevo arrastre', async () => {
    (gastosInmuebleService.getSumaPorCasilla as jest.Mock).mockResolvedValue({
      '0109': 1176,
      '0114': 250,
    });
    mockDB.getAll.mockImplementation(async (store: string) => {
      if (store === 'contracts') {
        return [
          {
            id: 2,
            propertyId: BUIGAS_ID,
            rentaMensual: 1200,
            fechaInicio: '2024-01-01',
            fechaFin: '2024-12-31',
          },
        ];
      }
      return [];
    });
    (getCarryForwardsDisponibles as jest.Mock).mockResolvedValue({
      total: 0,
      detalle: [],
    });

    const summary = await calculateFiscalSummary(BUIGAS_ID, 2024);

    expect(summary.box0105).toBe(0);
    expect(summary.box0106).toBe(0);
    expect(summary.box0107).toBe(0);
    expect(summary.box0108).toBe(0);
    expect(summary.box0104).toBe(0);
    // No se persistió ningún arrastre
    expect(mockDB.add).not.toHaveBeenCalledWith('aeatCarryForwards', expect.anything());
  });

  it('Caso intermedio · tope absorbe parte de los gastos · genera exceso parcial', async () => {
    // Ingresos 10.000, intereses+rep 8.000, arrastres entrantes 3.000
    // box0104 = min(3000, 10000) = 3000
    // tope efectivo = 7000
    // box0107 = min(8000, 7000) = 7000
    // box0108 = 1000
    (gastosInmuebleService.getSumaPorCasilla as jest.Mock).mockResolvedValue({
      '0105': 5000,
      '0106': 3000,
    });
    mockDB.getAll.mockImplementation(async (store: string) => {
      if (store === 'contracts') {
        return [
          {
            id: 3,
            propertyId: 99,
            rentaMensual: 10000 / 12,
            fechaInicio: '2024-01-01',
            fechaFin: '2024-12-31',
          },
        ];
      }
      return [];
    });
    (getCarryForwardsDisponibles as jest.Mock).mockResolvedValue({
      total: 3000,
      detalle: [
        {
          id: 1,
          propertyId: 99,
          taxYear: 2022,
          totalIncome: 0,
          financingAndRepair: 3000,
          limitApplied: 0,
          excessAmount: 3000,
          expirationYear: 2026,
          remainingAmount: 3000,
          createdAt: '',
          updatedAt: '',
        } as AEATCarryForward,
      ],
    });

    const summary = await calculateFiscalSummary(99, 2024);

    expect(summary.box0104).toBeCloseTo(3000, 2);
    expect(summary.box0107).toBeCloseTo(7000, 2);
    expect(summary.box0108).toBeCloseTo(1000, 2);
  });
});
