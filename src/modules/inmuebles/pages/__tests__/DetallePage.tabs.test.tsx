import '@testing-library/jest-dom';
import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Contract, Property } from '../../../../services/db';
import { listarCompromisos } from '../../../../services/personal/compromisosRecurrentesService';
import { gastosInmuebleService } from '../../../../services/gastosInmuebleService';
import { mejorasInmuebleService } from '../../../../services/mejorasInmuebleService';
import { mueblesInmuebleService } from '../../../../services/mueblesInmuebleService';
import { valoracionesService } from '../../../../services/valoracionesService';
import { ejercicioFiscalService } from '../../../../services/ejercicioFiscalService';
import { prestamosService } from '../../../../services/prestamosService';
import { cargarIngresosCobradosAnual } from '../../utils/cargarIngresosCobrados';
import type { InmueblesOutletContext } from '../../InmueblesContext';
import DetallePage from '../DetallePage';

jest.mock('../../../../services/personal/compromisosRecurrentesService', () => ({
  listarCompromisos: jest.fn().mockResolvedValue([]),
  eliminarCompromiso: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../services/treasuryBootstrapService', () => ({
  regenerateForecastsForward: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../../services/gastosInmuebleService', () => ({
  gastosInmuebleService: {
    getByInmueble: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../../../services/mejorasInmuebleService', () => ({
  mejorasInmuebleService: {
    getPorInmueble: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../../../services/mueblesInmuebleService', () => ({
  mueblesInmuebleService: {
    getPorInmueble: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../../../services/valoracionesService', () => ({
  valoracionesService: {
    getEvolucionActivo: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../../../services/ejercicioFiscalService', () => ({
  ejercicioFiscalService: {
    getAllEjercicios: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../utils/cargarIngresosCobrados', () => ({
  cargarIngresosCobradosAnual: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../../services/prestamosService', () => ({
  prestamosService: {
    getAllPrestamos: jest.fn().mockResolvedValue([]),
    getPaymentPlan: jest.fn().mockResolvedValue(null),
  },
  getAllocationFactor: jest.fn().mockReturnValue(0),
}));

jest.mock('../../../../services/inmuebleDeleteService', () => ({
  previewDeleteInmuebleCascade: jest.fn().mockResolvedValue(null),
  deleteInmuebleWithCascade: jest.fn().mockResolvedValue(null),
  summarizeCascadeReport: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../../components/common/ConfirmationModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../../components/valoraciones/ImportValoracionesWizard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/SeccionHistoricoFiscal', () => ({
  __esModule: true,
  default: () => <div>Histórico fiscal mock</div>,
}));

jest.mock('../../components/FiscalidadInmueble', () => ({
  __esModule: true,
  default: () => <div>Fiscalidad IRPF mock</div>,
}));

jest.mock('../../components/CostesInmueble', () => ({
  __esModule: true,
  default: () => <div>Costes mock</div>,
}));

jest.mock('../../components/DocumentosInmueble', () => ({
  __esModule: true,
  default: () => <div>Documentos mock</div>,
}));



jest.mock('../../components/ResumenCockpitInmueble', () => ({
  __esModule: true,
  default: () => <div>Cockpit resumen mock</div>,
}));

jest.mock('../../../shared/components/ListadoGastos', () => ({
  ListadoGastosRecurrentes: () => <div>Listado recurrentes mock</div>,
}));

beforeEach(() => {
  jest.mocked(listarCompromisos).mockResolvedValue([]);
  jest.mocked(gastosInmuebleService.getByInmueble).mockResolvedValue([]);
  jest.mocked(mejorasInmuebleService.getPorInmueble).mockResolvedValue([]);
  jest.mocked(mueblesInmuebleService.getPorInmueble).mockResolvedValue([]);
  jest.mocked(valoracionesService.getEvolucionActivo).mockResolvedValue([]);
  jest.mocked(ejercicioFiscalService.getAllEjercicios).mockResolvedValue([]);
  jest.mocked(prestamosService.getAllPrestamos).mockResolvedValue([]);
  jest.mocked(prestamosService.getPaymentPlan).mockResolvedValue(null);
  jest.mocked(cargarIngresosCobradosAnual).mockResolvedValue(0);
});

const crearProperty = (overrides: Partial<Property> = {}): Property => ({
  id: 1,
  alias: 'FA32',
  address: 'Calle Mayor 1',
  postalCode: '28001',
  province: 'Madrid',
  municipality: 'Madrid',
  ccaa: 'Madrid',
  purchaseDate: '2022-01-01',
  squareMeters: 82,
  bedrooms: 3,
  bathrooms: 2,
  transmissionRegime: 'usada',
  state: 'activo',
  acquisitionCosts: { price: 200000 },
  documents: [101, 102],
  modoExplotacion: 'piso_completo',
  ...overrides,
});

const crearContrato = (overrides: Partial<Contract> = {}): Contract => ({
  id: 11,
  inmuebleId: 1,
  unidadTipo: 'vivienda',
  modalidad: 'habitual',
  inquilino: {
    nombre: 'Lucía',
    apellidos: 'Pérez',
    dni: '12345678A',
    telefono: '600000000',
    email: 'lucia@example.com',
  },
  fechaInicio: '2025-01-01',
  fechaFin: '2099-12-31',
  rentaMensual: 1000,
  diaPago: 5,
  margenGraciaDias: 5,
  indexacion: 'none',
  historicoIndexaciones: [],
  fianzaMeses: 1,
  fianzaImporte: 1000,
  fianzaEstado: 'retenida',
  cuentaCobroId: 1,
  estadoContrato: 'activo',
  firma: { metodo: 'digital', estado: 'firmado' },
  ...overrides,
});

const renderPage = async (initialEntry = '/inmuebles/1'): Promise<void> => {
  const ctx: InmueblesOutletContext = {
    properties: [crearProperty()],
    contracts: [crearContrato()],
    reload: jest.fn(),
  };

  // El wrapper `act` es intencional: fuerza el flush de los efectos async de
  // la ficha (cargas de patrimonio, gastos, rentas declaradas) antes de asertar.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    render(
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route element={<Outlet context={ctx} />}>
            <Route path="/inmuebles/:id" element={<DetallePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });
};

describe('DetallePage · tabs fase 4', () => {
  it.each(['/inmuebles/1?tab=resumen', '/inmuebles/1?tab=contratos', '/inmuebles/1?tab=cobros'])(
    'redirige alias legacy %s a patrimonio',
    async (entry) => {
      await renderPage(entry);
      expect(screen.getByRole('tab', { name: /Resumen/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Cockpit resumen mock')).toBeInTheDocument();
    },
  );

  it('muestra las 4 tabs del mockup y elimina contratos/cobros/rentabilidad', async () => {
    await renderPage();

    expect(screen.getByRole('tablist', { name: /Navegación ficha inmueble/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Resumen/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Costes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fiscalidad/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Documentos/i })).toBeInTheDocument();
    // El mockup consolida a 4 pestañas · Rentabilidad se pliega en el toggle del chart.
    expect(screen.queryByRole('tab', { name: /Rentabilidad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Contratos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Cobros/i })).not.toBeInTheDocument();
  });

  it('Resumen muestra el cockpit y al pulsar Fiscalidad se activa esa tab', async () => {
    await renderPage();

    expect(screen.getByText('Cockpit resumen mock')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuevo contrato/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Fiscalidad/i }));
    expect(screen.getByRole('tab', { name: /Fiscalidad/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Fiscalidad IRPF mock')).toBeInTheDocument();
  });

  it('muestra la pestaña Documentos con las carpetas por categoría', async () => {
    await renderPage('/inmuebles/1?tab=documentos');

    expect(screen.getByRole('tab', { name: /Documentos/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Documentos mock')).toBeInTheDocument();
  });
});
