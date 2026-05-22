import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import NuevoContratoWizard from '../NuevoContratoWizard';
import type { InmueblesOutletContext } from '../../InmueblesContext';
import type { Property } from '../../../../services/db';
import { calculateHabitualEndDate } from '../../../../services/contractService';

const mockSaveContract = jest.fn();
const mockGetContract = jest.fn();
const mockGetAccounts = jest.fn();
jest.mock('../../../../services/contractService', () => ({
  ...jest.requireActual('../../../../services/contractService'),
  saveContract: (...args: unknown[]) => mockSaveContract(...args),
  getContract: (...args: unknown[]) => mockGetContract(...args),
}));
jest.mock('../../../../services/treasuryApiService', () => ({
  treasuryAPI: {
    accounts: {
      getAccounts: (...args: unknown[]) => mockGetAccounts(...args),
    },
  },
}));

const mockShowToast = jest.fn();
jest.mock('../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../design-system/v5');
  return { ...actual, showToastV5: (...args: unknown[]) => mockShowToast(...args) };
});

const property = (id: number, alias: string, bedrooms = 1): Property =>
  ({
    id,
    alias,
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '2020-01-01',
    squareMeters: 50,
    bedrooms,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 100000 },
    documents: [],
  }) as Property;

const OutletWrapper: React.FC<{ ctx: InmueblesOutletContext }> = ({ ctx }) => (
  <Outlet context={ctx} />
);

const renderWizard = (ctx: InmueblesOutletContext, initialPath = '/contratos/nuevo') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<OutletWrapper ctx={ctx} />}>
          <Route path="/contratos/nuevo" element={<NuevoContratoWizard />} />
        </Route>
        <Route path="/contratos" element={<div data-testid="contratos-list">listado</div>} />
      </Routes>
    </MemoryRouter>,
  );

const baseCtx: InmueblesOutletContext = {
  properties: [property(1, 'Fuertes Acevedo 32')],
  contracts: [],
  reload: jest.fn(),
};

const clickSiguiente = () => {
  // Hay dos botones · footer y header del wizard · usamos el último (footer)
  const botones = screen.getAllByRole('button', { name: /Siguiente/i });
  fireEvent.click(botones[botones.length - 1]);
};

const llenarPasos = async () => {
  // Paso 1 · Dónde · inmueble preseleccionado vía ?inmueble=1 · fechaInicio = hoy por defecto
  clickSiguiente();

  // Paso 2 · Inquilino · 5 textboxes en orden · Nombre, Apellidos, NIF, Teléfono, Email
  await waitFor(() => {
    const textboxes = screen.getAllByRole('textbox');
    // Aseguramos que estamos en el paso 2 con sus inputs presentes
    expect(textboxes.length).toBeGreaterThanOrEqual(5);
  });
  const inputs = screen.getAllByRole('textbox');
  fireEvent.change(inputs[0], { target: { value: 'PRUEBA' } });
  fireEvent.change(inputs[1], { target: { value: 'PRUEBA' } });
  fireEvent.change(inputs[2], { target: { value: '53069494F' } });
  fireEvent.change(inputs[3], { target: { value: '600123123' } });
  fireEvent.change(inputs[4], { target: { value: 'prueba@example.com' } });
  clickSiguiente();

  // Paso 3 · Económico · Renta mensual es el primer spinbutton · día pago el segundo · fianza el tercero
  await waitFor(() => {
    const spinbuttons = screen.getAllByRole('spinbutton');
    expect(spinbuttons.length).toBeGreaterThanOrEqual(1);
  });
  const rentaInput = screen.getAllByRole('spinbutton')[0];
  fireEvent.change(rentaInput, { target: { value: '1350' } });
  clickSiguiente();

  // Paso 4 · Documentos · usamos el título del paso "4 · Documentos"
  await waitFor(() => {
    expect(screen.getByText(/^4 · Documentos$/)).toBeInTheDocument();
  });
  clickSiguiente();

  // Paso 5 · ahora el botón es "Crear contrato"
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Crear contrato/i })).toBeInTheDocument();
  });
};

describe('NuevoContratoWizard · persistencia', () => {
  beforeEach(() => {
    mockSaveContract.mockReset();
    mockGetContract.mockReset();
    mockGetAccounts.mockReset();
    mockShowToast.mockReset();
    mockGetAccounts.mockResolvedValue([{ id: 7 }]);
  });

  test('click "Crear contrato" llama a saveContract con payload válido y navega', async () => {
    mockSaveContract.mockResolvedValueOnce(42);
    mockGetContract.mockResolvedValueOnce({ id: 42 });

    renderWizard(baseCtx, '/contratos/nuevo?inmueble=1');
    await llenarPasos();

    fireEvent.click(screen.getByRole('button', { name: /Crear contrato/i }));

    await waitFor(() => expect(mockSaveContract).toHaveBeenCalledTimes(1));

    const payload = mockSaveContract.mock.calls[0][0];
    expect(payload).toMatchObject({
      inmuebleId: 1,
      modalidad: 'habitual',
      fechaFin: calculateHabitualEndDate(payload.fechaInicio),
      rentaMensual: 1350,
      diaPago: 1,
      fianzaMeses: 2,
      fianzaImporte: 2700,
      cuentaCobroId: 7,
      estadoContrato: 'activo',
      indexacion: 'ipc',
      unidadTipo: 'vivienda',
    });
    expect(payload.inquilino).toEqual({
      nombre: 'PRUEBA',
      apellidos: 'PRUEBA',
      dni: '53069494F',
      telefono: '600123123',
      email: 'prueba@example.com',
    });

    await waitFor(() => expect(mockGetContract).toHaveBeenCalledWith(42));
    expect(await screen.findByTestId('contratos-list')).toBeInTheDocument();
  });

  test('si saveContract rechaza · NO navega · muestra error en pantalla', async () => {
    mockSaveContract.mockRejectedValueOnce(new Error('DB error'));

    renderWizard(baseCtx, '/contratos/nuevo?inmueble=1');
    await llenarPasos();

    fireEvent.click(screen.getByRole('button', { name: /Crear contrato/i }));

    await waitFor(() => expect(mockSaveContract).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo guardar/);
    expect(screen.queryByTestId('contratos-list')).toBeNull();
  });

  test('si getContract devuelve undefined · NO navega · trata como fallo', async () => {
    mockSaveContract.mockResolvedValueOnce(99);
    mockGetContract.mockResolvedValueOnce(undefined);

    renderWizard(baseCtx, '/contratos/nuevo?inmueble=1');
    await llenarPasos();

    fireEvent.click(screen.getByRole('button', { name: /Crear contrato/i }));

    await waitFor(() => expect(mockGetContract).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('contratos-list')).toBeNull();
  });

  test('botón "Crear contrato" se deshabilita mientras se guarda', async () => {
    let resolveCrear: (v: number) => void = () => {};
    mockSaveContract.mockReturnValueOnce(
      new Promise<number>((r) => {
        resolveCrear = r;
      }),
    );
    mockGetContract.mockResolvedValueOnce({ id: 99 });

    renderWizard(baseCtx, '/contratos/nuevo?inmueble=1');
    await llenarPasos();

    fireEvent.click(screen.getByRole('button', { name: /Crear contrato/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Creando/i })).toBeDisabled();
    });

    await act(async () => {
      resolveCrear(99);
    });
  });
});
