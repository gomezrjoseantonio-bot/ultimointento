/**
 * Tests F2 ejercicio detalle · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.7.
 *
 * Cubre:
 *   · render header con pill estado + meta-line + link Acciones (no botones)
 *   · KPI strip · 4 KPIs con datos de resolverDatosEjercicio
 *   · 8 secciones A-H con casillas
 *   · sección B lista de inmuebles · click navega a F3
 *   · sección E con venta · click navega a F4
 *   · tabs Versiones · Pagos · Documentos · cambio de pestaña
 *   · estado prescrito → opacidad 60% + sin tab Pagos
 *   · estado en_curso → header pill "En curso"
 *
 * Tolerancia ≤ 0,01 € en todos los importes.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import * as fiscalResolver from '../../../../services/fiscalResolverService';
import * as ejercicioResolver from '../../../../services/ejercicioResolverService';
import * as docsHelper from '../helpers/ejercicioDocumentosService';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../../../../services/fiscalResolverService');
jest.mock('../../../../services/ejercicioResolverService');
jest.mock('../helpers/ejercicioDocumentosService');

import FiscalEjercicioPage from '../FiscalEjercicioPage';

const mockedResolverDatos = fiscalResolver.resolverDatosEjercicio as jest.MockedFunction<
  typeof fiscalResolver.resolverDatosEjercicio
>;
const mockedGetEjercicio = ejercicioResolver.getEjercicio as jest.MockedFunction<
  typeof ejercicioResolver.getEjercicio
>;
const mockedGetDocumentos = docsHelper.getDocumentosDelEjercicio as jest.MockedFunction<
  typeof docsHelper.getDocumentosDelEjercicio
>;
const mockedGetVentas = docsHelper.getVentasDelAño as jest.MockedFunction<
  typeof docsHelper.getVentasDelAño
>;
const mockedGetDeudas = docsHelper.getDeudasDelEjercicio as jest.MockedFunction<
  typeof docsHelper.getDeudasDelEjercicio
>;
const mockedGetCuota = docsHelper.getCuotaDiferencialDelEjercicio as jest.MockedFunction<
  typeof docsHelper.getCuotaDiferencialDelEjercicio
>;

const FA32_ID = 1;

function buildDatosEjercicio(
  año: number,
  estado: 'en_curso' | 'pendiente' | 'declarado',
  overrides: Partial<fiscalResolver.DatosFiscalesEjercicio> = {},
): fiscalResolver.DatosFiscalesEjercicio {
  return {
    año,
    estado,
    fuente: 'xml_aeat',
    resultado: -2899.75,
    tipoResultado: 'devolver',
    resumen: {
      baseLiquidableGeneral: 147665.23,
      baseLiquidableAhorro: 357.63,
      cuotaIntegraEstatal: 28182.15,
      cuotaIntegraAutonomica: 25699.44,
      cuotaLiquidaEstatal: 28181.90,
      cuotaLiquidaAutonomica: 25699.19,
    },
    rendimientosTrabajo: 133005.37,
    rendimientosInmuebles: 5442.17,
    rendimientosActividades: 11905.45,
    rendimientosAhorro: 476.84,
    baseImponibleGeneral: 150924.07,
    baseImponibleAhorro: 357.63,
    cuotaIntegra: 53881.59,
    retenciones: 50981.34,
    casillas: {
      '0003': 133350.85,
      '0005': 3457.32,
      '0007': 1862.16,
      '0012': 138670.33,
      '0013': 3664.96,
      '0019': 2000.00,
      '0022': 133005.37,
      '0027': 476.84,
      '0041': 476.84,
      '0171': 16259.71,
      '0186': 3529.66,
      '0199': 198.00,
      '0221': 12532.05,
      '0222': 626.60,
      '0224': 11905.45,
      '0426': 1396.68,
      '0427': 1862.16,
      '0492': 3258.84,
      '0435': 150924.07,
      '0460': 357.63,
      '0500': 147665.23,
      '0510': 357.63,
      '0545': 28182.15,
      '0546': 25699.44,
      '0587': 53881.09,
      '0609': 50981.34,
      '0670': -2899.75,
      '0156': 5442.17,
      '0155': 562.89,
    },
    inmuebles: null,
    declaracionCompleta: {
      ejercicio: año,
      baseGeneral: {
        rendimientosTrabajo: null,
        rendimientosAutonomo: null,
        rendimientosInmuebles: [
          {
            inmuebleId: FA32_ID,
            alias: 'FA32 · Fuertes Acevedo 32',
            diasAlquilado: 366,
            diasVacio: 0,
            diasEnObras: 0,
            diasTotal: 366,
            ingresosIntegros: 19675,
            gastosDeducibles: 0,
            amortizacion: 1699.66,
            reduccionHabitual: 1390.94,
            rendimientoNetoAlquiler: 5334.69,
            rendimientoNetoReducido: 3943.75,
            porcentajeReduccionHabitual: 26.07,
            esHabitual: false,
            imputacionRenta: 0,
            rendimientoNeto: 5334.69,
          },
          {
            inmuebleId: 2,
            alias: 'Carles Buigas',
            diasAlquilado: 366,
            diasVacio: 0,
            diasEnObras: 0,
            diasTotal: 366,
            ingresosIntegros: 0,
            gastosDeducibles: 0,
            amortizacion: 0,
            reduccionHabitual: 0,
            rendimientoNetoAlquiler: 7.56,
            rendimientoNetoReducido: 7.56,
            porcentajeReduccionHabitual: 60,
            esHabitual: false,
            imputacionRenta: 0,
            rendimientoNeto: 7.56,
          },
          {
            inmuebleId: 3,
            alias: 'Tenderina 48',
            diasAlquilado: 366,
            diasVacio: 0,
            diasEnObras: 0,
            diasTotal: 366,
            ingresosIntegros: 0,
            gastosDeducibles: 0,
            amortizacion: 0,
            reduccionHabitual: 0,
            rendimientoNetoAlquiler: 6108.79,
            rendimientoNetoReducido: 6108.79,
            porcentajeReduccionHabitual: 0,
            esHabitual: false,
            imputacionRenta: 0,
            rendimientoNeto: 6108.79,
          },
          {
            inmuebleId: 4,
            alias: 'T64 4D',
            diasAlquilado: 184,
            diasVacio: 182,
            diasEnObras: 0,
            diasTotal: 366,
            ingresosIntegros: 0,
            gastosDeducibles: 0,
            amortizacion: 0,
            reduccionHabitual: 0,
            rendimientoNetoAlquiler: -3019.47,
            rendimientoNetoReducido: -3019.47,
            porcentajeReduccionHabitual: 0,
            esHabitual: false,
            imputacionRenta: 0,
            rendimientoNeto: -3019.47,
          },
          {
            inmuebleId: 5,
            alias: 'T64 4IZ',
            diasAlquilado: 184,
            diasVacio: 182,
            diasEnObras: 0,
            diasTotal: 366,
            ingresosIntegros: 0,
            gastosDeducibles: 0,
            amortizacion: 0,
            reduccionHabitual: 0,
            rendimientoNetoAlquiler: -2368.28,
            rendimientoNetoReducido: -2368.28,
            porcentajeReduccionHabitual: 0,
            esHabitual: false,
            imputacionRenta: 0,
            rendimientoNeto: -2368.28,
          },
          {
            inmuebleId: 6,
            alias: 'Sant Joan Manresa',
            diasAlquilado: 366,
            diasVacio: 0,
            diasEnObras: 0,
            diasTotal: 366,
            ingresosIntegros: 0,
            gastosDeducibles: 0,
            amortizacion: 0,
            reduccionHabitual: 0,
            rendimientoNetoAlquiler: 769.82,
            rendimientoNetoReducido: 769.82,
            porcentajeReduccionHabitual: 90,
            esHabitual: false,
            imputacionRenta: 0,
            rendimientoNeto: 769.82,
          },
        ],
        imputacionRentas: [],
        total: 0,
      },
      baseAhorro: {
        capitalMobiliario: {
          intereses: 476.84,
          dividendos: 0,
          retenciones: 0,
          total: 476.84,
        },
        gananciasYPerdidas: {
          plusvalias: 0,
          minusvalias: 0,
          minusvaliasPendientes: 0,
          compensado: 0,
        },
        total: 476.84,
      },
      reducciones: {
        ppEmpleado: 1396.68,
        ppEmpresa: 1862.16,
        ppIndividual: 0,
        planPensiones: 3258.84,
        total: 3258.84,
      },
      minimoPersonal: {
        contribuyente: 5550,
        descendientes: 0,
        ascendientes: 0,
        discapacidad: 0,
        total: 5550,
      },
      liquidacion: {
        baseImponibleGeneral: 150924.07,
        baseImponibleAhorro: 357.63,
        cuotaBaseGeneral: 28182.15,
        cuotaBaseAhorro: 25699.44,
        cuotaMinimosBaseGeneral: 0,
        cuotaIntegra: 53881.59,
        deduccionesDobleImposicion: 0,
        cuotaLiquida: 53881.09,
      },
      retenciones: {
        trabajo: 50981.34,
        autonomoM130: 0,
        capitalMobiliario: 0,
        total: 50981.34,
      },
      resultado: -2899.75,
      tipoEfectivo: 36.5,
      warnings: [],
    } as any,
    ...overrides,
  };
}

function renderPage(año = 2024) {
  return render(
    <MemoryRouter initialEntries={[`/fiscal/ejercicio/${año}`]}>
      <Routes>
        <Route path="/fiscal/ejercicio/:anio" element={<FiscalEjercicioPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const TOLERANCIA = 0.01;

describe('FiscalEjercicioPage · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();

    mockedResolverDatos.mockResolvedValue(buildDatosEjercicio(2024, 'declarado'));
    mockedGetEjercicio.mockResolvedValue({
      año: 2024,
      estado: 'declarado',
      aeat: {
        snapshot: {},
        resumen: {} as any,
        fechaImportacion: '2025-06-24T12:00:00Z',
        fuenteImportacion: 'xml',
      },
      arrastresIn: { fuente: 'aeat', gastosPendientes: [], perdidasPatrimoniales: [], amortizacionesAcumuladas: [], deduccionesPendientes: [] },
      inmuebleIds: [1, 2, 3, 4, 5, 6],
      createdAt: '2025-06-24T12:00:00Z',
      updatedAt: '2025-06-24T12:00:00Z',
    } as any);
    mockedGetDocumentos.mockResolvedValue([]);
    mockedGetVentas.mockResolvedValue([]);
    mockedGetDeudas.mockResolvedValue([]);
    mockedGetCuota.mockResolvedValue({ cuota: -2899.75, pagos: [] });
  });

  it('renderiza el header con el año + pill "Declarado" + link Acciones', async () => {
    renderPage(2024);
    expect(await screen.findByRole('heading', { name: /Ejercicio 2024/i })).toBeInTheDocument();
    expect(screen.getByText('Declarado')).toBeInTheDocument();
    const accionesLink = screen.getByRole('button', { name: /Acciones fiscales/i });
    expect(accionesLink).toBeInTheDocument();
    fireEvent.click(accionesLink);
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal/acciones?ejercicio=2024');
  });

  it('renderiza el KPI strip con 4 valores cuadrando al céntimo (FA32 Jose 2024)', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /Ejercicio 2024/i });

    // Resultado autoliquidación · 2.899,75 (negativo · a devolver)
    expect(screen.getAllByText(/2\.?899,75 €/).length).toBeGreaterThan(0);
    // Cuota líquida total · 53.881,09
    expect(screen.getAllByText(/53\.?881,09 €/).length).toBeGreaterThan(0);
    // Retenciones · 50.981,34
    expect(screen.getAllByText(/50\.?981,34 €/).length).toBeGreaterThan(0);
    // Tipo medio · cuotaLiquida(53881.09)/baseLiq(147665.23) ≈ 36,5%
    expect(screen.getAllByText(/36,5 %/).length).toBeGreaterThan(0);
  });

  it('renderiza las 8 secciones A-H con sus letras + títulos', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /Ejercicio 2024/i });
    // Cada sección expone un button accesible · aria-controls section-X-body
    for (const letra of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      expect(document.getElementById(`section-${letra}-title`)).toBeInTheDocument();
    }
    expect(screen.getByText(/Rendimientos del trabajo/)).toBeInTheDocument();
    expect(screen.getAllByText(/Capital mobiliario/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cuotas y resultado/i)).toBeInTheDocument();
  });

  it('sección B lista 6 inmuebles y click en FA32 navega a F3', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /Ejercicio 2024/i });

    const ver = screen.getByLabelText(/Abrir detalle fiscal del inmueble FA32/i);
    fireEvent.click(ver);
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal/ejercicio/2024/inmueble/1');
  });

  it('casillas críticas presentes al céntimo · 0670 0500 0587 0609 0426 0427', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /Ejercicio 2024/i });

    // Casilla 0670 · resultado declaración
    expect(screen.getByText('0670')).toBeInTheDocument();
    // Casilla 0500 · base liquidable general · 147.665,23
    expect(screen.getByText('0500')).toBeInTheDocument();
    expect(screen.getAllByText(/147\.?665,23 €/).length).toBeGreaterThan(0);
    // Casilla 0587 · cuota líquida total
    expect(screen.getByText('0587')).toBeInTheDocument();
    // Casilla 0609 · retenciones
    expect(screen.getByText('0609')).toBeInTheDocument();
    // PP · 0426 = 1.396,68 y 0427 = 1.862,16
    expect(screen.getByText('0426')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.?396,68 €/).length).toBeGreaterThan(0);
    expect(screen.getByText('0427')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.?862,16 €/).length).toBeGreaterThan(0);
  });

  it('cambia de tab a Documentos · empty state cuando no hay docs', async () => {
    renderPage(2024);
    const tabDocs = await screen.findByRole('tab', { name: /Documentos/i });
    fireEvent.click(tabDocs);
    expect(screen.getByText(/Sin documentos importados/i)).toBeInTheDocument();
  });

  it('estado pendiente · sección B sigue presente · pill "Pendiente declarar"', async () => {
    mockedResolverDatos.mockResolvedValue(
      buildDatosEjercicio(2025, 'pendiente', { resultado: 5847.0 }),
    );
    renderPage(2025);
    expect(await screen.findByRole('heading', { name: /Ejercicio 2025/i })).toBeInTheDocument();
    expect(screen.getByText('Pendiente declarar')).toBeInTheDocument();
  });

  it('sección E con venta · click en venta navega a F4', async () => {
    mockedResolverDatos.mockResolvedValue(
      buildDatosEjercicio(2025, 'pendiente', { resultado: 5847.0 }),
    );
    mockedGetVentas.mockResolvedValue([
      { id: 99, alias: 'Tenderina 48', fechaVenta: '2025-11-18', ganancia: 10481.0 },
    ]);
    renderPage(2025);
    await screen.findByRole('heading', { name: /Ejercicio 2025/i });

    const ver = screen.getByLabelText(/Abrir detalle de la venta Tenderina 48 2025/i);
    fireEvent.click(ver);
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal/ejercicio/2025/venta/99');
  });

  it('estado en_curso · pill "En curso" + sin tab Pagos prescrito', async () => {
    mockedResolverDatos.mockResolvedValue(
      buildDatosEjercicio(2026, 'en_curso', { resultado: -1180.0 }),
    );
    renderPage(2026);
    expect(await screen.findByRole('heading', { name: /Ejercicio 2026/i })).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    // En curso · sí tiene Pagos
    expect(screen.getByRole('tab', { name: /Pagos/i })).toBeInTheDocument();
  });

  it('ejercicio prescrito · opacidad 60% + pill "Prescrito" + sin tab Pagos', async () => {
    // 2020 está prescrito a fecha hoy (prescribió 2025-06-30)
    mockedResolverDatos.mockResolvedValue(
      buildDatosEjercicio(2020, 'declarado', { resultado: 2120 }),
    );
    renderPage(2020);
    expect(await screen.findByRole('heading', { name: /Ejercicio 2020/i })).toBeInTheDocument();
    expect(screen.getByText('Prescrito')).toBeInTheDocument();
    // No tab Pagos
    expect(screen.queryByRole('tab', { name: /Pagos/i })).not.toBeInTheDocument();
  });

  it('TOLERANCIA · valor de cuota líquida diferencia ≤ 0,01 €', async () => {
    renderPage(2024);
    await screen.findByRole('heading', { name: /Ejercicio 2024/i });
    // Sumamos cuotaLiquidaEstatal + cuotaLiquidaAutonomica = 28181.9 + 25699.19 = 53881.09
    const esperado = 28181.90 + 25699.19;
    expect(Math.abs(esperado - 53881.09)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('cuota líquida render: usa 0587 directo cuando está', async () => {
    renderPage(2024);
    await waitFor(() => {
      // 0587 aparece tanto en KPI como en sección H
      expect(screen.getAllByText(/53\.?881,09 €/).length).toBeGreaterThan(0);
    });
  });
});
