import '@testing-library/jest-dom';
import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { Contract, Property } from '../../../../services/db';
import { listarCompromisos } from '../../../../services/personal/compromisosRecurrentesService';
import { gastosInmuebleService } from '../../../../services/gastosInmuebleService';
import { mejorasInmuebleService } from '../../../../services/mejorasInmuebleService';
import { mueblesInmuebleService } from '../../../../services/mueblesInmuebleService';
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

jest.mock('../../components/GastosResumenInmueble', () => ({
  __esModule: true,
  default: () => <div>Resumen gastos mock</div>,
}));

jest.mock('../../components/GastosRegistradosInmueble', () => ({
  __esModule: true,
  default: () => <div>Registrados gastos mock</div>,
}));

jest.mock('../../components/RentabilidadInmueble', () => ({
  __esModule: true,
  default: () => <div>Rentabilidad mock</div>,
}));

jest.mock('../../../shared/components/ListadoGastos', () => ({
  ListadoGastosRecurrentes: () => <div>Listado recurrentes mock</div>,
}));

beforeEach(() => {
  jest.mocked(listarCompromisos).mockResolvedValue([]);
  jest.mocked(gastosInmuebleService.getByInmueble).mockResolvedValue([]);
  jest.mocked(mejorasInmuebleService.getPorInmueble).mockResolvedValue([]);
  jest.mocked(mueblesInmuebleService.getPorInmueble).mockResolvedValue([]);
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
      expect(screen.getByRole('tab', { name: /Patrimonio/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/Situación de explotación/i)).toBeInTheDocument();
    },
  );

  it('muestra las 5 tabs nuevas y elimina contratos/cobros', async () => {
    await renderPage();

    expect(screen.getByRole('tablist', { name: /Navegación ficha inmueble/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Patrimonio/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Gastos/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Rentabilidad/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fiscalidad/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Documentos/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Contratos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Cobros/i })).not.toBeInTheDocument();
  });

  it('mueve Nuevo contrato al contenido de Patrimonio y activa Rentabilidad al pulsar la tab', async () => {
    await renderPage();

    expect(screen.getByRole('button', { name: /Nuevo contrato/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Rentabilidad/i }));
    expect(screen.getByRole('tab', { name: /Rentabilidad/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Rentabilidad mock')).toBeInTheDocument();
  });

  it('muestra el placeholder de Documentos con la nueva etiqueta', async () => {
    await renderPage('/inmuebles/1?tab=documentos');

    expect(screen.getByRole('tab', { name: /Documentos/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByText('Documentos').length).toBeGreaterThan(0);
    expect(screen.getByText(/Pestaña en migración a UI v5/i)).toBeInTheDocument();
  });
});
