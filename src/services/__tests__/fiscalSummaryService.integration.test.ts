// S-FISCAL-FIXES · Test integración · combina Fix 1 (tope) + Fix 3 (imputación) en
// calculateFiscalSummary y valida que box0089, box0103-0108 se calculan al céntimo.
//
// Nota · el §7 del spec pide validar 6 inmuebles reales (FA32, Buigas, T48, T64 4D,
// T64 4Iz, SantJoan) contra la declaración 2024. Esa validación requiere fixtures
// reales del IDB (gastos, contratos, VC, propertyDays, mejoras) que no están en el
// repo. Aquí validamos el cableado al céntimo con datos derivados del T64 4D 2024.

import { calculateFiscalSummary } from '../fiscalSummaryService';
import { initDB } from '../db';
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

jest.mock('../db', () => ({ initDB: jest.fn() }));
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
jest.mock('../imputacionRentaService', () => ({
  calcularImputacion: jest.fn(),
}));

import { calcularImputacion } from '../imputacionRentaService';

const PROP_ID = 4001;

function buildMockDB(property: any) {
  return {
    get: jest.fn(async (store: string, id: number) =>
      store === 'properties' && id === PROP_ID ? property : null,
    ),
    getAll: jest.fn(async (store: string) => {
      if (store === 'contracts') {
        return [
          {
            id: 1,
            propertyId: PROP_ID,
            rentaMensual: 7160 / 6, // 6 meses · ingresos 7160
            fechaInicio: '2024-01-01',
            fechaFin: '2024-06-30',
          },
        ];
      }
      return [];
    }),
    getAllFromIndex: jest.fn(async () => []),
    add: jest.fn(async () => 1),
    put: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };
}

describe('Integración · T64 4D 2024 · Fix 1 + Fix 3 al céntimo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (generarOperacionesDesdeRecurrentes as jest.Mock).mockResolvedValue(0);
    (generarOperacionesDesdeIntereses as jest.Mock).mockResolvedValue(0);
    (getRentalDaysForYear as jest.Mock).mockResolvedValue(184);
    (calcularAmortizacionMobiliarioAnual as jest.Mock).mockResolvedValue(0);
    (getTotalMejorasHastaEjercicio as jest.Mock).mockResolvedValue(3545.3);
    (getExerciseStatus as jest.Mock).mockReturnValue('Vivo');
    (updateFiscalSummaryWithAEAT as jest.Mock).mockResolvedValue({
      constructionValue: 24070.4,
      annualDepreciation: 363.04,
      aeatAmortization: undefined,
    });
    (gastosInmuebleService.getSumaPorCasilla as jest.Mock).mockResolvedValue({
      '0105': 531.74,
      '0106': 32367.5,
    });
    (getCarryForwardsDisponibles as jest.Mock).mockResolvedValue({
      total: 2500,
      detalle: [
        {
          id: 99,
          propertyId: PROP_ID,
          taxYear: 2023,
          totalIncome: 0,
          financingAndRepair: 2500,
          limitApplied: 0,
          excessAmount: 2500,
          expirationYear: 2027,
          remainingAmount: 2500,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    (consumirArrastresAplicados as jest.Mock).mockResolvedValue(undefined);
    (calcularImputacion as jest.Mock).mockResolvedValue({
      imputacion: 260.68,
      desglose: {
        valorCatastral: 47656.37,
        valorCatastralRevisado: true,
        tipoAplicable: 1.1,
        diasDisposicion: 182,
        diasAnio: 366,
        formula: '47656.37 × 1.1% × 182/366',
      },
      alertas: [],
    });
    (initDB as jest.Mock).mockResolvedValue(
      buildMockDB({ id: PROP_ID, alias: 'T64 4D', fiscalData: { cadastralValue: 47656.37 } }),
    );
  });

  it('T64 4D 2024 · box0089 (imputación) + box0104/0107/0108 (tope) al céntimo', async () => {
    const summary = await calculateFiscalSummary(PROP_ID, 2024);

    // Fix 3 · imputación renta a disposición
    expect(summary.box0089).toBeCloseTo(260.68, 2);

    // Fix 1 · tope con arrastres entrantes
    expect(summary.box0102).toBeCloseTo(7160, 2);
    expect(summary.box0103).toBeCloseTo(2500, 2);
    expect(summary.box0104).toBeCloseTo(2500, 2);
    expect(summary.box0107).toBeCloseTo(4660, 2);
    expect(summary.box0108).toBeCloseTo(28239.24, 2);

    // box0105 + box0106 quedan informativos (totales sin tope) · suma 32.899,24
    expect((summary.box0105 || 0) + (summary.box0106 || 0)).toBeCloseTo(32899.24, 2);
  });
});
