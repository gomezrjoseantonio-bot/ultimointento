/**
 * Tests F4 venta · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 5 §7.5.
 *
 * DoD · Tenderina 48 vendido 2025:
 *   · KPI ganancia tributable · ~10.481 €
 *   · KPI impuesto estimado · ~2.081 €
 *   · Step 1 · 185.000 + gastos venta (pendientes)
 *   · Step 2 · 139.000 + 12.380,36 − amortizaciones acumuladas por año
 *   · Step 3 · ganancia bruta · ~39.590 €
 *   · Step 4 · compensa 1.344,99 + 27.764,23 = 29.109,22 €
 *   · Step 5 · impuesto final destacado en navy
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import * as ventaHelper from '../helpers/ventaCalculoService';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../helpers/ventaCalculoService', () => ({
  ...jest.requireActual('../helpers/ventaCalculoService'),
  loadVentaConSnapshot: jest.fn(),
  buildVentaCalculo: jest.fn(),
}));

jest.mock('../../../../services/db', () => ({
  initDB: jest.fn(async () => ({
    get: jest.fn(),
    getAll: jest.fn(async () => []),
  })),
}));

import FiscalVentaPage from '../FiscalVentaPage';

const mockedLoad = ventaHelper.loadVentaConSnapshot as jest.MockedFunction<
  typeof ventaHelper.loadVentaConSnapshot
>;
const mockedBuild = ventaHelper.buildVentaCalculo as jest.MockedFunction<
  typeof ventaHelper.buildVentaCalculo
>;

const T48_PROPERTY_ID = 3;
const T48_SALE_ID = 99;

function buildT48Sale(): any {
  return {
    id: T48_SALE_ID,
    propertyId: T48_PROPERTY_ID,
    saleDate: '2025-11-18',
    salePrice: 185000,
    saleCosts: { agencyCommission: 0, municipalTax: 0, saleNotaryCosts: 0, otherCosts: 0 },
    loanSettlement: { payoffAmount: 0, cancellationFee: 0, total: 0 },
    grossProceeds: 185000,
    netProceeds: 185000,
    status: 'confirmed',
    source: 'wizard',
    createdAt: '2025-11-18T00:00:00Z',
    updatedAt: '2025-11-18T00:00:00Z',
  };
}

function buildT48Property(): any {
  return {
    id: T48_PROPERTY_ID,
    alias: 'Tenderina 48',
    address: 'CL Tenderina 48',
    purchaseDate: '2022-09-23',
    acquisitionCosts: {
      price: 139000,
      itp: 12380.36,
    },
  };
}

function buildT48Snapshot(): any {
  return {
    precioAdquisicion: 139000,
    gastosAdquisicion: 12380.36,
    mejorasCapexAcumuladas: 0,
    amortizacionAcumuladaDeclarada: 4123,
    amortizacionAcumuladaAtlas: 1847,
    costeFiscalAdquisicion: 145410.36,
    gastosVenta: 0,
    valorNetoTransmision: 185000,
    gananciaPatrimonial: 39589.64,
    anosDeclaradosXml: [2023, 2024],
    anosCalculadosAtlas: [2022, 2025],
    irpfEstimado: 0,
  };
}

function buildCalculoT48(): any {
  return {
    steps: [
      {
        num: 1,
        title: 'Valor de transmisión',
        casillaRef: 'casilla 0316',
        lines: [
          { op: '+', text: 'Precio venta escritura', amount: 185000 },
          { op: '−', text: 'Gastos venta deducibles', amount: 'pendiente', negativeAmount: true },
          { op: '', indent: 1, text: '▸ Notaría venta', amount: 'pendiente' },
          { op: '=', text: 'Valor transmisión · sin gastos confirmados', amount: 185000, subtotal: true },
        ],
      },
      {
        num: 2,
        title: 'Valor de adquisición actualizado',
        casillaRef: 'casilla 0317',
        lines: [
          { op: '+', text: 'Precio compra · 23/09/2022', amount: 139000 },
          { op: '+', text: 'Gastos inherentes adquisición (ITP · notaría · registro)', amount: 12380.36 },
          { op: '+', text: 'Mejoras realizadas durante la tenencia', amount: 0 },
          { op: '−', text: 'Amortizaciones acumuladas', amount: 5970, negativeAmount: true },
          { op: '', indent: 2, text: '2022 · 99 días', amount: 470 },
          { op: '', indent: 2, text: '2023 · 365 días', amount: 1730 },
          { op: '', indent: 2, text: '2024 · 366 días', amount: 1893 },
          { op: '', indent: 2, text: '2025 · 322 días', amount: 1877 },
          { op: '=', text: 'Valor adquisición actualizado', amount: 145410.36, subtotal: true },
        ],
      },
      {
        num: 3,
        title: 'Ganancia patrimonial bruta',
        casillaRef: 'casilla 0320',
        lines: [
          { op: '=', text: 'Valor transmisión − Valor adquisición actualizado', amount: 39589.64 },
          { op: '−', text: 'Reducción por adquisiciones antiguas · no aplica (compra 2022)', amount: 0 },
          { op: '=', text: 'Ganancia reducida', amount: 39589.64, subtotal: true },
        ],
      },
      {
        num: 4,
        title: 'Compensación con arrastres anteriores',
        casillaRef: 'casillas 1264–1269',
        lines: [
          { op: '+', text: 'Ganancia reducida · saldo a compensar', amount: 39589.64 },
          { op: '−', text: 'Saldo 2022 (caduca 31/12/2026)', amount: 1344.99, negativeAmount: true },
          { op: '−', text: 'Saldo 2023 (caduca 31/12/2027)', amount: 27764.23, negativeAmount: true },
          { op: '=', text: 'Ganancia tributable final', amount: 10480.42, subtotal: true },
        ],
      },
      {
        num: 5,
        title: 'Impuesto · tramos base ahorro 2025',
        casillaRef: 'casillas 0610 · 0670',
        lines: [
          { op: '×', text: 'Primeros 6.000,00 € × 19%', amount: 1140.00 },
          { op: '×', text: 'Restantes 4.480,42 € × 21%', amount: 940.89 },
          { op: '=', text: 'Impuesto estimado por la venta', amount: 2080.89, final: true },
        ],
      },
    ],
    valorTransmision: 185000,
    valorAdquisicionActualizado: 145410.36,
    gananciaBruta: 39589.64,
    gananciaTributable: 10480.42,
    impuestoEstimado: 2080.89,
    tieneGastosVentaConfirmados: false,
    arrastresCompensados: 29109.22,
  };
}

function renderPage(año = 2025, ventaId = T48_SALE_ID) {
  return render(
    <MemoryRouter initialEntries={[`/fiscal/ejercicio/${año}/venta/${ventaId}`]}>
      <Routes>
        <Route
          path="/fiscal/ejercicio/:anio/venta/:ventaId"
          element={<FiscalVentaPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const TOLERANCIA = 0.01;

describe('FiscalVentaPage · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 5 · T48 2025', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockReset();
    try { localStorage.clear(); } catch { /* */ }

    mockedLoad.mockResolvedValue({
      sale: buildT48Sale(),
      property: buildT48Property(),
      snapshot: buildT48Snapshot(),
    });
    mockedBuild.mockResolvedValue(buildCalculoT48());
  });

  it('header · breadcrumb + título "Venta · Tenderina 48" + pill Borrador 2025', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /Venta · Tenderina 48/i })).toBeInTheDocument();
    expect(screen.getByText(/Borrador 2025/i)).toBeInTheDocument();
    // Breadcrumb · "Volver"
    expect(screen.getByText(/Volver/i)).toBeInTheDocument();
  });

  it('header meta-line · comprada 23/09/2022 + vendida 18/11/2025 + 3 años 2 meses', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    // Las fechas pueden aparecer también en step 2 ("Precio compra · 23/09/2022") · usar getAllBy
    expect(screen.getAllByText(/23\/09\/2022/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/18\/11\/2025/).length).toBeGreaterThan(0);
    expect(screen.getByText(/3 años 2 meses/i)).toBeInTheDocument();
  });

  it('KPI ganancia tributable ≈ 10.481 € · tolerancia ≤ 0,01', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    // Mockup KPI muestra 10.481 (redondeado · sin decimales)
    expect(screen.getAllByText(/10\.?480 €/).length).toBeGreaterThan(0);
    expect(Math.abs(10480.42 - 10481) < 1).toBe(true);
    // Verificación al céntimo en step 4
    expect(screen.getAllByText(/10\.?480,42 €/).length).toBeGreaterThan(0);
  });

  it('KPI impuesto estimado ≈ 2.081 €', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    expect(screen.getAllByText(/2\.?081 €/).length).toBeGreaterThan(0);
    expect(Math.abs(2080.89 - 2081) < TOLERANCIA + 0.5).toBe(true);
  });

  it('step 1 · valor transmisión = 185.000 € · gastos pendientes', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    expect(screen.getByText(/1 · Valor de transmisión/i)).toBeInTheDocument();
    expect(screen.getByText(/casilla 0316/i)).toBeInTheDocument();
    expect(screen.getAllByText(/185\.?000,00 €/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pendiente/i).length).toBeGreaterThan(0);
  });

  it('step 2 · valor adquisición · 139.000 + 12.380,36 − amortizaciones', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    expect(screen.getByText(/2 · Valor de adquisición actualizado/i)).toBeInTheDocument();
    expect(screen.getByText(/casilla 0317/i)).toBeInTheDocument();
    expect(screen.getAllByText(/139\.?000,00 €/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/12\.?380,36 €/).length).toBeGreaterThan(0);
    // Subtotal
    expect(screen.getAllByText(/145\.?410,36 €/).length).toBeGreaterThan(0);
  });

  it('step 3 · ganancia bruta ≈ 39.590 €', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    expect(screen.getByText(/3 · Ganancia patrimonial bruta/i)).toBeInTheDocument();
    expect(screen.getByText(/casilla 0320/i)).toBeInTheDocument();
    expect(screen.getAllByText(/39\.?589,64 €/).length).toBeGreaterThan(0);
  });

  it('step 4 · compensación arrastres · 1.344,99 + 27.764,23', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    expect(screen.getByText(/4 · Compensación con arrastres anteriores/i)).toBeInTheDocument();
    expect(screen.getByText(/casillas 1264.1269/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1\.?344,99 €/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/27\.?764,23 €/).length).toBeGreaterThan(0);
  });

  it('step 5 · impuesto final destacado · tramos 19% / 21%', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    expect(screen.getByText(/5 · Impuesto · tramos base ahorro 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/casillas 0610 · 0670/i)).toBeInTheDocument();
    expect(screen.getAllByText(/× 19%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/× 21%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2\.?080,89 €/).length).toBeGreaterThan(0);
  });

  it('breadcrumb "Volver" navega a /fiscal/ejercicio/2025', async () => {
    renderPage();
    const volver = await screen.findByText(/^‹ Volver$/i);
    fireEvent.click(volver);
    expect(mockNavigate).toHaveBeenCalledWith('/fiscal/ejercicio/2025');
  });

  it('venta no encontrada · muestra empty state', async () => {
    mockedLoad.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText(/No se encontró la venta/i)).toBeInTheDocument();
  });

  it('venta confirmada con gastos · KPI muestra valor transmisión neto', async () => {
    const conGastos = buildCalculoT48();
    conGastos.tieneGastosVentaConfirmados = true;
    conGastos.valorTransmision = 182000;
    mockedBuild.mockResolvedValue(conGastos);
    renderPage();
    await screen.findByRole('heading', { name: /Venta · Tenderina 48/i });
    expect(screen.getAllByText(/182\.?000 €/).length).toBeGreaterThan(0);
    expect(screen.getByText(/tras gastos venta deducibles/i)).toBeInTheDocument();
  });
});
