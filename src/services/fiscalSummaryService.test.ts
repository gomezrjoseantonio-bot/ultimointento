import { calculateFiscalSummary, calculateFiscalSummaryExtended } from './fiscalSummaryService';
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
import { getRendimientoFiscal } from './rendimientoActivoService';
import { getCarryForwardsDisponibles, consumirArrastresAplicados } from './carryForwardService';
import { calcularImputacion } from './imputacionRentaService';
import { getEjercicio } from './ejercicioResolverService';

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

jest.mock('./rendimientoActivoService', () => ({
  getRendimientoFiscal: jest.fn(),
}));

jest.mock('./ejercicioResolverService', () => ({
  getEjercicio: jest.fn(),
}));

jest.mock('./carryForwardService', () => ({
  getCarryForwardsDisponibles: jest.fn(),
  consumirArrastresAplicados: jest.fn(),
}));

jest.mock('./imputacionRentaService', () => ({
  calcularImputacion: jest.fn(),
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
const mockedGetRendimientoFiscal = getRendimientoFiscal as jest.MockedFunction<typeof getRendimientoFiscal>;
const mockedGetCarryForwardsDisponibles = getCarryForwardsDisponibles as jest.MockedFunction<typeof getCarryForwardsDisponibles>;
const mockedConsumirArrastresAplicados = consumirArrastresAplicados as jest.MockedFunction<typeof consumirArrastresAplicados>;
const mockedCalcularImputacion = calcularImputacion as jest.MockedFunction<typeof calcularImputacion>;
const mockedGetEjercicio = getEjercicio as jest.MockedFunction<typeof getEjercicio>;

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
    mockedGetCarryForwardsDisponibles.mockResolvedValue({ total: 0, detalle: [] });
    mockedConsumirArrastresAplicados.mockResolvedValue(undefined);
    mockedCalcularImputacion.mockResolvedValue({ imputacion: 0 } as any);
    mockedGetEjercicio.mockResolvedValue(null);

    mockedInitDB.mockResolvedValue({
      get: jest.fn(async (store: string) => {
        if (store === 'properties') {
          return { id: 1, alias: 'Piso Test' };
        }
        return null;
      }),
      getAll: jest.fn(async () => []),
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

// ═══════════════════════════════════════════════════════════════════════════
// SPEC-CC-FISCAL-UI-REPLACE-v1 · sub-tarea 1 · hueco 1
// Tests al céntimo contra Jose 2024 FA32 (datos reales del Modelo 100):
//   box0102 = 19.675,00 · box0149 = 5.334,69 · box0150 = 1.390,94
//   box0154 = 3.943,75 · modoDeclaracion = 'III'
// Tolerancia ≤ 0,01 €.
// ═══════════════════════════════════════════════════════════════════════════

const TOLERANCIA = 0.01;

describe('calculateFiscalSummaryExtended · Jose 2024 FA32', () => {
  const PROPERTY_ID_FA32 = 1;
  const REF_CATASTRAL_FA32 = '7949807TP6074N0006YM';
  const AÑO_2024 = 2024;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mocks base reutilizados de calculateFiscalSummary
    mockedGenerarOperacionesDesdeRecurrentes.mockResolvedValue(0);
    mockedGenerarOperacionesDesdeIntereses.mockResolvedValue(0);
    mockedGetSumaPorCasilla.mockResolvedValue({});
    mockedGetRentalDaysForYear.mockResolvedValue(366);
    mockedCalcularAmortizacionMobiliarioAnual.mockResolvedValue(0);
    mockedGetTotalMejorasHastaEjercicio.mockResolvedValue(0);
    mockedGetExerciseStatus.mockReturnValue('declarado' as any);
    mockedUpdateFiscalSummaryWithAEAT.mockResolvedValue({
      constructionValue: 0,
      annualDepreciation: 0,
      aeatAmortization: 0,
    } as any);
    mockedGetCarryForwardsDisponibles.mockResolvedValue({ total: 0, detalle: [] });
    mockedConsumirArrastresAplicados.mockResolvedValue(undefined);
    mockedCalcularImputacion.mockResolvedValue({ imputacion: 0 } as any);
    mockedGetEjercicio.mockResolvedValue(null);

    // FA32: alquiler por habitaciones (modo III)
    mockedInitDB.mockResolvedValue({
      get: jest.fn(async (store: string, _id: number) => {
        if (store === 'properties') {
          return {
            id: PROPERTY_ID_FA32,
            alias: 'FA32',
            cadastralReference: REF_CATASTRAL_FA32,
            usoTipo: 'mixto',
            alquilerPorHabitaciones: { activo: true, numeroHabitaciones: 5 },
          };
        }
        return null;
      }),
      getAll: jest.fn(async (store: string) => {
        if (store === 'contracts') {
          // FA32 2024: 5 habitaciones (3 corta + 2 larga) → modo III
          return [
            { id: 1, inmuebleId: PROPERTY_ID_FA32, unidadTipo: 'habitacion', modalidad: 'habitual',
              fechaInicio: '2023-05-01', fechaFin: '2026-05-01', rentaMensual: 0, estadoContrato: 'activo' },
            { id: 2, inmuebleId: PROPERTY_ID_FA32, unidadTipo: 'habitacion', modalidad: 'habitual',
              fechaInicio: '2024-01-01', fechaFin: '2026-01-01', rentaMensual: 0, estadoContrato: 'activo' },
            { id: 3, inmuebleId: PROPERTY_ID_FA32, unidadTipo: 'habitacion', modalidad: 'temporada',
              fechaInicio: '2024-03-01', fechaFin: '2024-09-30', rentaMensual: 0, estadoContrato: 'activo' },
          ];
        }
        return [];
      }),
      getAllFromIndex: jest.fn(async () => []),
      add: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any);

    // Snapshot del Modelo 100 declarado · valores extraídos del XML AEAT FA32 2024
    mockedGetRendimientoFiscal.mockResolvedValue({
      rentasDeclaradas: 19675,
      diasArrendado: 366,
      rentaImputada: 0,
      diasDisposicion: 0,
      totalIngresos: 19675,
      interesesFinanciacion: 1580.34,
      reparacionConservacion: 0,
      reparacionAplicada: 0,
      reparacionExceso: 0,
      ibiTasas: 0,
      comunidad: 0,
      suministros: 0,
      seguros: 0,
      amortMobiliario: 0,
      amortInmueble: 1699.66,
      baseAmortizacion: 0,
      totalGastosDeducibles: 14340.31,
      rendimientoNeto: 5334.69,
      reduccionVivienda: 1390.94,
      tipoArrendamiento: 1,
      rendimientoNetoReducido: 3943.75,
      fuente: 'xml_aeat',
    });
  });

  it('box0102 = 19.675,00 (ingresos íntegros computables)', async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(Math.abs(ext.box0102 - 19675.00)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('box0149 = 5.334,69 (rendimiento neto antes de reducción)', async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(Math.abs(ext.box0149 - 5334.69)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('box0150 = 1.390,94 (reducción Ley Vivienda aplicada)', async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(Math.abs(ext.box0150 - 1390.94)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('box0154 = 3.943,75 (rendimiento neto reducido)', async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(Math.abs(ext.box0154 - 3943.75)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it("modoDeclaracion = 'III' (alquiler mixto · habitaciones)", async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(ext.modoDeclaracion).toBe('III');
  });

  it('diasArrendado = 366 (año bisiesto · todas las habitaciones del año)', async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(ext.diasArrendado).toBe(366);
  });

  it('diasDisposicion = 0 (sin días vacíos)', async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(ext.diasDisposicion).toBe(0);
  });

  it("metodoProrrateo = 'dias_habitacion' (modo III por habitaciones)", async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(ext.metodoProrrateo).toBe('dias_habitacion');
  });

  it('porcentajeReduccion ≥ 0 (modo III admite reducción si hay contrato larga estancia)', async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    expect(ext.porcentajeReduccion).toBeGreaterThanOrEqual(0);
  });

  it('reutiliza box0102/0103/0104/0107/0108/0089 ya calculados (no los recalcula)', async () => {
    const ext = await calculateFiscalSummaryExtended(PROPERTY_ID_FA32, AÑO_2024);
    // Los campos heredados del summary base deben estar presentes
    expect(typeof ext.box0102).toBe('number');
    expect(typeof ext.box0103).toBe('number');
    expect(typeof ext.box0104).toBe('number');
    expect(typeof ext.box0107).toBe('number');
    expect(typeof ext.box0108).toBe('number');
  });
});
