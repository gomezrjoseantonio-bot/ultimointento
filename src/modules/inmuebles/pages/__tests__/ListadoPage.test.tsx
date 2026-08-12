import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import type { Contract, Property } from '../../../../services/db';
import type { InmueblesOutletContext } from '../../InmueblesContext';
import { valoracionesService } from '../../../../services/valoracionesService';
import { subscribeFinancialValuesUpdated } from '../../../../services/financialValuesService';
import { gastosInmuebleService } from '../../../../services/gastosInmuebleService';
import { mejorasInmuebleService } from '../../../../services/mejorasInmuebleService';
import { prestamosService, getAllocationFactor } from '../../../../services/prestamosService';
import { getLatestConfirmedSaleForProperty } from '../../../../services/propertySaleService';
import { initDB } from '../../../../services/db';
import ListadoPage from '../ListadoPage';

const HOY = new Date('2026-08-12T10:00:00Z');
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(HOY);
});
afterAll(() => jest.useRealTimers());

// ── Mocks de servicios async ────────────────────────────────────────────────
// CRA resetea los mocks entre tests · las implementaciones se fijan en beforeEach.
jest.mock('../../../../services/valoracionesService', () => ({
  valoracionesService: { getMapValoracionesMasRecientesConMatchingPorNombre: jest.fn() },
}));
jest.mock('../../../../services/financialValuesService', () => ({
  subscribeFinancialValuesUpdated: jest.fn(),
}));
jest.mock('../../../../services/gastosInmuebleService', () => ({
  gastosInmuebleService: { getByInmuebleYEjercicio: jest.fn() },
}));
jest.mock('../../../../services/mejorasInmuebleService', () => ({
  mejorasInmuebleService: { getPorInmueble: jest.fn() },
}));
jest.mock('../../../../services/prestamosService', () => ({
  prestamosService: { getPrestamosByProperty: jest.fn() },
  getAllocationFactor: jest.fn(),
}));
jest.mock('../../../../services/propertySaleService', () => ({
  getLatestConfirmedSaleForProperty: jest.fn(),
}));
jest.mock('../../../../services/db', () => ({
  initDB: jest.fn(),
}));

beforeEach(() => {
  jest
    .mocked(valoracionesService.getMapValoracionesMasRecientesConMatchingPorNombre)
    .mockResolvedValue({
      getByIdOrNombre: (id: number | string) =>
        id === 1 ? { valor: 250000, fecha_valoracion: '2026-01' } : undefined,
    } as unknown as Awaited<
      ReturnType<typeof valoracionesService.getMapValoracionesMasRecientesConMatchingPorNombre>
    >);
  jest.mocked(subscribeFinancialValuesUpdated).mockReturnValue(() => {});
  jest.mocked(gastosInmuebleService.getByInmuebleYEjercicio).mockResolvedValue([]);
  jest.mocked(mejorasInmuebleService.getPorInmueble).mockResolvedValue([]);
  jest.mocked(prestamosService.getPrestamosByProperty).mockResolvedValue([]);
  jest.mocked(getAllocationFactor).mockReturnValue(1);
  jest.mocked(getLatestConfirmedSaleForProperty).mockResolvedValue(null);
  jest
    .mocked(initDB)
    .mockResolvedValue({ getAll: jest.fn().mockResolvedValue([]) } as unknown as Awaited<
      ReturnType<typeof initDB>
    >);
});

const property = (over: Partial<Property>): Property =>
  ({
    id: 1,
    alias: 'Fuertes Acevedo 32',
    address: 'Calle Fuertes Acevedo 32',
    municipality: 'Oviedo',
    province: 'Asturias',
    ccaa: 'Asturias',
    tipoActivo: 'piso',
    squareMeters: 100,
    bedrooms: 5,
    bathrooms: 2,
    state: 'activo',
    acquisitionCosts: { price: 62000 },
    anexos: { tieneParking: true, tieneTrastero: false },
    ...over,
  }) as Property;

const contrato = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    rentaMensual: 1350,
    fechaInicio: '2025-01-01',
    fechaFin: '2027-01-01',
    inquilino: { nombre: 'Ivan', apellidos: 'V', dni: '', telefono: '', email: '' },
    ...over,
  }) as Contract;

const renderPage = (properties: Property[], contracts: Contract[] = []): void => {
  const ctx: InmueblesOutletContext = { properties, contracts, reload: () => {} };
  render(
    <MemoryRouter initialEntries={['/inmuebles']}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/inmuebles" element={<ListadoPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

describe('ListadoPage', () => {
  it('renderiza cabecera, hero y la card del inmueble con su valoración', async () => {
    renderPage(
      [property({}), property({ id: 2, alias: 'Garaje 12', tipoActivo: 'parking', bedrooms: 0 })],
      [contrato({})],
    );

    expect(screen.getByRole('heading', { name: 'Inmuebles' })).toBeInTheDocument();
    expect(screen.getByText('Mi cartera inmobiliaria')).toBeInTheDocument();
    expect(screen.getByText('Fuertes Acevedo 32')).toBeInTheDocument();

    // La valoración llega en un efecto async → el valor aparece tras resolver.
    expect((await screen.findAllByText(/250\.000/)).length).toBeGreaterThan(0);
  });

  it('filtra por segmento y por búsqueda', async () => {
    renderPage(
      [property({}), property({ id: 2, alias: 'Garaje 12', tipoActivo: 'parking', bedrooms: 0 })],
      [contrato({})],
    );
    await screen.findByText('Fuertes Acevedo 32');

    // Segmento "Pisos" oculta el parking
    fireEvent.click(screen.getByRole('tab', { name: /Pisos/ }));
    expect(screen.queryByText('Garaje 12')).not.toBeInTheDocument();
    expect(screen.getByText('Fuertes Acevedo 32')).toBeInTheDocument();

    // Búsqueda
    fireEvent.click(screen.getByRole('tab', { name: /Todos/ }));
    fireEvent.change(screen.getByLabelText('Buscar inmuebles'), { target: { value: 'garaje' } });
    await waitFor(() => expect(screen.queryByText('Fuertes Acevedo 32')).not.toBeInTheDocument());
    expect(screen.getByText('Garaje 12')).toBeInTheDocument();
  });

  it('cambia a la vista de icono (tabla)', async () => {
    renderPage([property({})], [contrato({})]);
    await screen.findByText('Fuertes Acevedo 32');
    fireEvent.click(screen.getByRole('tab', { name: 'Icono' }));
    expect(screen.getByText('Propiedad')).toBeInTheDocument();
    expect(screen.getByText('Valor hoy')).toBeInTheDocument();
  });

  it('muestra el estado vacío sin inmuebles', () => {
    renderPage([], []);
    expect(screen.getByText('Sin inmuebles aún')).toBeInTheDocument();
  });
});
