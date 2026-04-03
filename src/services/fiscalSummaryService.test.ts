import { calculateFiscalSummary } from './fiscalSummaryService';
import { initDB } from './db';
import {
  generarOperacionesDesdeIntereses,
  generarOperacionesDesdeRecurrentes,
} from './operacionFiscalService';
import { gastosInmuebleService } from './gastosInmuebleService';
import { getRentalDaysForYear, updateFiscalSummaryWithAEAT } from './aeatAmortizationService';
import { calcularAmortizacionMobiliarioAnual } from './mobiliarioActivoService';
import { getTotalMejorasHastaEjercicio } from './mejoraActivoService';
import { getExerciseStatus } from './aeatClassificationService';

jest.mock('./db', () => ({
  initDB: jest.fn(),
}));

jest.mock('./operacionFiscalService', () => ({
  generarOperacionesDesdeIntereses: jest.fn(),
  generarOperacionesDesdeRecurrentes: jest.fn(),
}));

jest.mock('./gastosInmuebleService', () => ({
  gastosInmuebleService: {
    getSumaPorCasilla: jest.fn(),
  },
}));

jest.mock('./aeatAmortizationService', () => ({
  getRentalDaysForYear: jest.fn(),
  updateFiscalSummaryWithAEAT: jest.fn(),
}));

jest.mock('./mobiliarioActivoService', () => ({
  calcularAmortizacionMobiliarioAnual: jest.fn(),
}));

jest.mock('./mejoraActivoService', () => ({
  getTotalMejorasHastaEjercicio: jest.fn(),
}));

jest.mock('./aeatClassificationService', () => ({
  getExerciseStatus: jest.fn(),
}));

const mockedInitDB = initDB as jest.MockedFunction<typeof initDB>;
const mockedGenerarOperacionesDesdeIntereses = generarOperacionesDesdeIntereses as jest.MockedFunction<typeof generarOperacionesDesdeIntereses>;
const mockedGenerarOperacionesDesdeRecurrentes = generarOperacionesDesdeRecurrentes as jest.MockedFunction<typeof generarOperacionesDesdeRecurrentes>;
const mockedGetSumaPorCasilla = gastosInmuebleService.getSumaPorCasilla as jest.MockedFunction<typeof gastosInmuebleService.getSumaPorCasilla>;
const mockedGetRentalDaysForYear = getRentalDaysForYear as jest.MockedFunction<typeof getRentalDaysForYear>;
const mockedUpdateFiscalSummaryWithAEAT = updateFiscalSummaryWithAEAT as jest.MockedFunction<typeof updateFiscalSummaryWithAEAT>;
const mockedCalcularAmortizacionMobiliarioAnual = calcularAmortizacionMobiliarioAnual as jest.MockedFunction<typeof calcularAmortizacionMobiliarioAnual>;
const mockedGetTotalMejorasHastaEjercicio = getTotalMejorasHastaEjercicio as jest.MockedFunction<typeof getTotalMejorasHastaEjercicio>;
const mockedGetExerciseStatus = getExerciseStatus as jest.MockedFunction<typeof getExerciseStatus>;

describe('fiscalSummaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGenerarOperacionesDesdeRecurrentes.mockResolvedValue(12);
    mockedGenerarOperacionesDesdeIntereses.mockResolvedValue(0);
    mockedGetSumaPorCasilla.mockResolvedValue({
      '0109': 1176,
      '0114': 250,
    });
    mockedGetRentalDaysForYear.mockResolvedValue(365);
    mockedCalcularAmortizacionMobiliarioAnual.mockResolvedValue(0);
    mockedGetTotalMejorasHastaEjercicio.mockResolvedValue(0);
    mockedGetExerciseStatus.mockReturnValue('abierto' as any);
    mockedUpdateFiscalSummaryWithAEAT.mockResolvedValue({
      constructionValue: 0,
      annualDepreciation: 0,
      aeatAmortization: 0,
    } as any);

    mockedInitDB.mockResolvedValue({
      get: jest.fn(async (store: string) => {
        if (store === 'properties') {
          return { id: 1, alias: 'Piso Test' };
        }
        return null;
      }),
      getAllFromIndex: jest.fn(async (store: string) => {
        if (store === 'contracts') return [];
        if (store === 'aeatCarryForwards') return [];
        if (store === 'fiscalSummaries') return [];
        return [];
      }),
      add: jest.fn(async (_store: string, value: any) => {
        if (_store === 'fiscalSummaries') return 99;
        return value?.id ?? 1;
      }),
      put: jest.fn(),
      delete: jest.fn(),
    } as any);
  });

  it('usa solo el resumen de operaciones fiscales para evitar duplicar OPEX recurrente', async () => {
    const summary = await calculateFiscalSummary(1, 2025);

    expect(mockedGenerarOperacionesDesdeRecurrentes).toHaveBeenCalledWith(1, 2025);
    expect(mockedGetSumaPorCasilla).toHaveBeenCalledWith(1, 2025);
    expect(summary.box0109).toBe(1176);
    expect(summary.box0114).toBe(250);
  });
});
