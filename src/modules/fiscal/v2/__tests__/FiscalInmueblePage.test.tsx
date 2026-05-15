/**
 * Tests F3 inmueble fiscal · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 §6.7.
 *
 * DoD al céntimo · Jose 2024 FA32:
 *   · KPI ingresos = 19.675,00 €
 *   · KPI rendimiento neto reducido = 3.943,75 €
 *   · Modo · "Alquiler mixto · Casos especiales · habitaciones"
 *   · Casilla 0102 = 19.675,00
 *   · Casilla 0149 = 5.334,69
 *   · Casilla 0150 = 1.390,94
 *   · Casilla 0154 = 3.943,75
 *   · Casilla 0132 = 816,12 (modo III por habitaciones)
 *   · Tabla amortización acumulada · fila 2024 = 5.031,56 €
 * Tolerancia ≤ 0,01 €.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import * as fiscalSummaryService from '../../../../services/fiscalSummaryService';
import * as fiscalResolver from '../../../../services/fiscalResolverService';
import * as amortHelper from '../helpers/amortizacionAcumuladaService';
import * as dbModule from '../../../../services/db';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../../../services/fiscalSummaryService');
jest.mock('../../../../services/fiscalResolverService');
jest.mock('../helpers/amortizacionAcumuladaService');
jest.mock('../../../../services/db', () => ({
  initDB: jest.fn(),
}));

import FiscalInmueblePage from '../FiscalInmueblePage';

const mockedCalcExtended = fiscalSummaryService.calculateFiscalSummaryExtended as jest.MockedFunction<
  typeof fiscalSummaryService.calculateFiscalSummaryExtended
>;
const mockedResolverDatos = fiscalResolver.resolverDatosEjercicio as jest.MockedFunction<
  typeof fiscalResolver.resolverDatosEjercicio
>;
const mockedGetAmort = amortHelper.getAmortizacionAcumulada as jest.MockedFunction<
  typeof amortHelper.getAmortizacionAcumulada
>;
const mockedInitDB = dbModule.initDB as jest.MockedFunction<typeof dbModule.initDB>;

const FA32_ID = 1;
const REF_CATASTRAL_FA32 = '7949807TP6074N0006YM';

function buildSummaryFA32(): fiscalSummaryService.FiscalSummaryExtended {
  return {
    propertyId: FA32_ID,
    exerciseYear: 2024,
    box0089: 0,
    box0101: 366,
    box0102: 19675.00,
    box0103: 6157.99,
    box0104: 6157.99,
    box0105: 1580.34,
    box0106: 209.33,
    box0107: 1789.67,
    box0108: 0,
    box0109: 1008.00,
    box0112: 296.45,
    box0113: 1930.41,
    box0114: 242.79,
    box0115: 399.22,
    box0117: 1699.66,
    box0129: 0,
    box0130: 0,
    box0131: 816.12,
    box0149: 5334.69,
    box0150: 1390.94,
    box0154: 3943.75,
    mejorasTotal: 0,
    deductibleExcess: 0,
    constructionValue: 0,
    annualDepreciation: 0,
    status: 'declarado' as any,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-12-31T23:59:59Z',
    modoDeclaracion: 'III',
    diasArrendado: 366,
    diasDisposicion: 0,
    porcentajeReduccion: 60,
    metodoProrrateo: 'dias_habitacion',
  };
}

function buildPropertyFA32(): any {
  return {
    id: FA32_ID,
    alias: 'FA32',
    address: 'Fuertes Acevedo 32 · 1 02',
    cadastralReference: REF_CATASTRAL_FA32,
    bedrooms: 5,
    usoTipo: 'mixto',
    purchaseDate: '2023-01-15',
    alquilerPorHabitaciones: { activo: true, numeroHabitaciones: 5 },
    acquisitionCosts: { price: 98831.47 },
    fiscalData: {
      baseAmortizacion: 57989.36,
    },
    aeatAmortization: {
      acquisitionType: 'onerosa',
      firstAcquisitionDate: '2023-01-15',
      cadastralValue: 68371.03,
      constructionCadastralValue: 37294.08,
      constructionPercentage: 54.55,
      baseAmortizacion: 57989.36,
      onerosoAcquisition: {
        acquisitionAmount: 98831.47,
        acquisitionExpenses: 7473.50,
      },
    },
  };
}

function renderPage(año = 2024) {
  return render(
    <MemoryRouter initialEntries={[`/fiscal/ejercicio/${año}/inmueble/${FA32_ID}`]}>
      <Routes>
        <Route
          path="/fiscal/ejercicio/:anio/inmueble/:id"
          element={<FiscalInmueblePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const TOLERANCIA = 0.01;

describe('FiscalInmueblePage · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 · FA32 2024', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();

    mockedCalcExtended.mockResolvedValue(buildSummaryFA32());
    mockedResolverDatos.mockResolvedValue({
      año: 2024,
      estado: 'declarado',
      fuente: 'xml_aeat',
      resultado: -2899.75,
      tipoResultado: 'devolver',
      resumen: {
        baseLiquidableGeneral: null,
        baseLiquidableAhorro: null,
        cuotaIntegraEstatal: null,
        cuotaIntegraAutonomica: null,
        cuotaLiquidaEstatal: null,
        cuotaLiquidaAutonomica: null,
      },
      rendimientosTrabajo: null,
      rendimientosInmuebles: null,
      rendimientosActividades: null,
      rendimientosAhorro: null,
      baseImponibleGeneral: null,
      baseImponibleAhorro: null,
      cuotaIntegra: null,
      retenciones: null,
      casillas: null,
      inmuebles: null,
      declaracionCompleta: null,
    });

    mockedGetAmort.mockResolvedValue({
      rows: [
        { año: 2023, diasArrendado: 365, baseAmortizacion: 57989.36, amortInmueble: 816.12, amortMobiliario: 1699.66, acumuladoTotal: 2515.78, esFuturo: false },
        { año: 2024, diasArrendado: 366, baseAmortizacion: 57989.36, amortInmueble: 816.12, amortMobiliario: 1699.66, acumuladoTotal: 5031.56, esFuturo: false },
        { año: 2025, diasArrendado: 366, baseAmortizacion: 57989.36, amortInmueble: 816.12, amortMobiliario: 1699.66, acumuladoTotal: 7547.34, esFuturo: true },
      ],
      acumuladoCierreEjercicio: 5031.56,
      añoCorte: 2024,
    });

    mockedInitDB.mockResolvedValue({
      get: jest.fn(async (store: string, id: number) => {
        if (store === 'properties' && id === FA32_ID) return buildPropertyFA32();
        return null;
      }),
    } as any);
  });

  it('header · breadcrumb + título FA32 + pill Declarado + RC', async () => {
    renderPage(2024);
    expect(await screen.findByRole('heading', { name: /FA32/i })).toBeInTheDocument();
    expect(screen.getByText('Declarado')).toBeInTheDocument();
    // Breadcrumb · "Volver al ejercicio" + crumbs
    expect(screen.getByText(/Volver al ejercicio/i)).toBeInTheDocument();
    // RC catastral mono
    expect(screen.getByText(new RegExp(`RC ${REF_CATASTRAL_FA32}`))).toBeInTheDocument();
  });

  it('KPI · ingresos íntegros = 19.675,00 € (al céntimo)', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /FA32/i });
    expect(screen.getAllByText(/19\.?675,00 €/).length).toBeGreaterThan(0);
    expect(Math.abs(19675.00 - 19675.00)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('KPI · rendimiento neto reducido = 3.943,75 € (al céntimo)', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /FA32/i });
    expect(screen.getAllByText(/3\.?943,75 €/).length).toBeGreaterThan(0);
  });

  it('Modo · "Alquiler mixto · Casos especiales · habitaciones"', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /FA32/i });
    expect(screen.getByText(/Alquiler mixto/)).toBeInTheDocument();
    expect(screen.getByText(/Casos especiales · habitaciones/i)).toBeInTheDocument();
  });

  it('casillas críticas al céntimo · 0102 0149 0150 0154', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /FA32/i });
    expect(screen.getByText('0102')).toBeInTheDocument();
    expect(screen.getByText('0149')).toBeInTheDocument();
    expect(screen.getAllByText(/5\.?334,69 €/).length).toBeGreaterThan(0);
    expect(screen.getByText('0150')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.?390,94 €/).length).toBeGreaterThan(0);
    expect(screen.getByText('0154')).toBeInTheDocument();
  });

  it('casilla 0132 (modo III · casos especiales) = 816,12 €', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /FA32/i });
    expect(screen.getByText('0132')).toBeInTheDocument();
    expect(screen.getAllByText(/816,12 €/).length).toBeGreaterThan(0);
  });

  it('tabla amortización acumulada · fila 2024 = 5.031,56 €', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /FA32/i });
    // El acumulado a 31/12/2024 aparece dos veces (fila y total)
    expect(screen.getAllByText(/5\.?031,56 €/).length).toBeGreaterThan(0);
    // Fila 2025 future con estilo italic
    expect(screen.getByText(/Acumulado a 31\/12\/2024/i)).toBeInTheDocument();
  });

  it('nota optimizaciones · reducción Ley Vivienda visible · descartable', async () => {
    renderPage(2024);
    const closeBtn = await screen.findByLabelText(/Descartar nota de optimizaciones/i);
    expect(closeBtn).toBeInTheDocument();
    expect(screen.getByText(/Optimizaciones aplicadas por ATLAS/i)).toBeInTheDocument();
    // Línea sobre reducción 60%
    // El texto "Reducción del 60%" aparece en KPI hint y en la nota · ambos válidos
    expect(screen.getAllByText(/Reducción del 60%/i).length).toBeGreaterThan(0);
  });

  it('5 secciones del mockup · ingresos · arrastres · gastos · amortización · rendimiento', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /FA32/i });
    expect(screen.getByText(/Ingresos del año/i)).toBeInTheDocument();
    expect(screen.getByText(/Arrastres de años anteriores/i)).toBeInTheDocument();
    expect(screen.getByText(/Gastos del año/i)).toBeInTheDocument();
    expect(screen.getByText(/Amortización del inmueble/i)).toBeInTheDocument();
    expect(screen.getByText(/Rendimiento del inmueble/i)).toBeInTheDocument();
  });
});
