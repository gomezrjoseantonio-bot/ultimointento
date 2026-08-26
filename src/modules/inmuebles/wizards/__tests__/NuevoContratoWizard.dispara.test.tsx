// El alta dispara: guardar un contrato regenera las previsiones en el acto.
//
// Sin esto, el contrato se escribía y la tesorería seguía sin enterarse hasta el
// siguiente bootstrap: el usuario daba de alta a un inquilino y su renta no
// aparecía por ninguna parte.
//
// Los cuatro caminos de guardado tienen que dispararlo, no solo el principal:
// alta completa, edición, borrador nuevo y borrador de una edición. Un contrato
// guardado como borrador también genera previsiones —el generador solo excluye
// los `rescindido` y `finalizado`—, así que dejar fuera ese camino sería que la
// tesorería dependiera de POR QUÉ botón se guardó.

import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import NuevoContratoWizard from '../NuevoContratoWizard';
import type { InmueblesOutletContext } from '../../InmueblesContext';
import type { Property } from '../../../../services/db';

const mockSaveContract = jest.fn();
const mockGetContract = jest.fn();
const mockUpdateContract = jest.fn();
const mockRegenerar = jest.fn();

jest.mock('../../../../services/contractService', () => ({
  ...jest.requireActual('../../../../services/contractService'),
  saveContract: (...args: unknown[]) => mockSaveContract(...args),
  getContract: (...args: unknown[]) => mockGetContract(...args),
  updateContract: (...args: unknown[]) => mockUpdateContract(...args),
}));
jest.mock('../../../../services/treasuryBootstrapService', () => ({
  regenerateForecastsForward: (...args: unknown[]) => mockRegenerar(...args),
}));
jest.mock('../../../../services/treasuryApiService', () => ({
  treasuryAPI: { accounts: { getAccounts: () => Promise.resolve([{ id: 7 }]) } },
}));
jest.mock('../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../design-system/v5');
  return { ...actual, showToastV5: jest.fn() };
});

const property = (id: number, alias: string): Property =>
  ({
    id, alias, address: '', postalCode: '', province: '', municipality: '', ccaa: '',
    purchaseDate: '2020-01-01', squareMeters: 50, bedrooms: 1, transmissionRegime: 'usada',
    state: 'activo', acquisitionCosts: { price: 100000 }, documents: [],
  }) as Property;

const ctx: InmueblesOutletContext = {
  properties: [property(1, 'Fuertes Acevedo 32')],
  contracts: [],
  reload: jest.fn(),
};

const OutletWrapper: React.FC = () => <Outlet context={ctx} />;

const renderWizard = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<OutletWrapper />}>
          <Route path="/contratos/nuevo" element={<NuevoContratoWizard />} />
        </Route>
        <Route path="/contratos" element={<div>listado</div>} />
        <Route path="/empezar/contratos" element={<div>empezar</div>} />
      </Routes>
    </MemoryRouter>,
  );

const siguiente = (): void => {
  const botones = screen.getAllByRole('button', { name: /Siguiente/i });
  fireEvent.click(botones[botones.length - 1]);
};

const llenarHastaElFinal = async (): Promise<void> => {
  siguiente();
  await waitFor(() => expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(5));
  const inputs = screen.getAllByRole('textbox');
  fireEvent.change(inputs[0], { target: { value: 'PRUEBA' } });
  fireEvent.change(inputs[1], { target: { value: 'PRUEBA' } });
  fireEvent.change(inputs[2], { target: { value: '53069494F' } });
  fireEvent.change(inputs[3], { target: { value: '600123123' } });
  fireEvent.change(inputs[4], { target: { value: 'prueba@example.com' } });
  siguiente();

  await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(1));
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '1350' } });
  siguiente();

  await screen.findByText(/^4 · Documentos$/);
  siguiente();
  await screen.findByRole('button', { name: /Crear contrato/i });
};

/** Al menos un nombre en el primer paso, que es el mínimo del borrador. */
const llenarMinimoBorrador = async (): Promise<void> => {
  siguiente();
  await waitFor(() => expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(5));
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'PRUEBA' } });
};

// Que los bloques del paso Económico estén REALMENTE en pantalla, no solo
// importados. Un import sin usar compila, pasa el typecheck, y deja al usuario
// sin el bloque: los tests de cada componente aislado no lo ven.
describe('el paso Económico monta sus bloques', () => {
  beforeEach(() => {
    mockSaveContract.mockReset().mockResolvedValue(42);
    mockGetContract.mockReset().mockResolvedValue({ id: 42 });
    mockRegenerar.mockReset().mockResolvedValue({ eventosCreados: 0, errores: [] });
  });

  it('el selector de primer cobro y el bloque fiscal se ven en el paso 3', async () => {
    renderWizard('/contratos/nuevo?inmueble=1');
    siguiente();
    await waitFor(() => expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(5));
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'PRUEBA' } });
    fireEvent.change(inputs[1], { target: { value: 'PRUEBA' } });
    fireEvent.change(inputs[2], { target: { value: '53069494F' } });
    fireEvent.change(inputs[3], { target: { value: '600123123' } });
    fireEvent.change(inputs[4], { target: { value: 'prueba@example.com' } });
    siguiente();

    await screen.findByText(/¿Cómo cobras el primer mes\?/);
    await screen.findByText(/Régimen del alquiler/);
    await screen.findByText(/Reducción que ATLAS propone/);
  });
});

describe('guardar en el alta regenera las previsiones', () => {
  beforeEach(() => {
    mockSaveContract.mockReset().mockResolvedValue(42);
    mockGetContract.mockReset().mockResolvedValue({ id: 42 });
    mockUpdateContract.mockReset().mockResolvedValue(undefined);
    mockRegenerar.mockReset().mockResolvedValue({ eventosCreados: 0, errores: [] });
  });

  it('alta completa · tras crear el contrato', async () => {
    renderWizard('/contratos/nuevo?inmueble=1');
    await llenarHastaElFinal();

    fireEvent.click(screen.getByRole('button', { name: /Crear contrato/i }));

    await waitFor(() => expect(mockSaveContract).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRegenerar).toHaveBeenCalledTimes(1));
  });

  it('borrador · también, porque también genera previsiones', async () => {
    renderWizard('/contratos/nuevo?inmueble=1');
    await llenarMinimoBorrador();

    fireEvent.click(screen.getByRole('button', { name: /Guardar borrador/i }));

    await waitFor(() => expect(mockSaveContract).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRegenerar).toHaveBeenCalledTimes(1));
  });

  it('edición · guardar los cambios también regenera', async () => {
    // Editar la renta o las fechas cambia lo que hay que cobrar cada mes: si no
    // se regenerase, la tesorería seguiría pidiendo el importe viejo.
    mockGetContract.mockResolvedValue({
      id: 7,
      inmuebleId: 1,
      unidadTipo: 'vivienda',
      modalidad: 'larga_estancia',
      inquilino: {
        nombre: 'PRUEBA', apellidos: 'PRUEBA', dni: '53069494F',
        telefono: '600123123', email: 'prueba@example.com',
      },
      fechaInicio: '2026-01-01',
      fechaFin: '2031-01-01',
      rentaMensual: 900,
      diaPago: 1,
      fianzaMeses: 1,
      indexacion: 'none',
      cuentaCobroId: 7,
      estadoContrato: 'activo',
    });

    renderWizard('/contratos/nuevo?edit=7');

    // El wizard carga el contrato de forma asíncrona; hasta que llega, el paso 1
    // no valida y «Siguiente» no avanza. Se espera al dato, no a que el botón
    // exista (existe desde el primer render).
    await waitFor(() => expect(mockGetContract).toHaveBeenCalledWith(7));
    await waitFor(() => {
      siguiente();
      expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(5);
    });

    siguiente();
    await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(1));
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '1000' } });
    siguiente();
    await screen.findByText(/^4 · Documentos$/);
    siguiente();

    const guardar = await screen.findByRole('button', { name: /Guardar cambios|Crear contrato/i });
    fireEvent.click(guardar);

    await waitFor(() => expect(mockUpdateContract).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRegenerar).toHaveBeenCalledTimes(1));
  });

  it('regenera DESPUÉS de escribir el contrato, no antes', async () => {
    // Si se regenerase primero, la pasada no vería el contrato nuevo y las
    // previsiones seguirían sin aparecer hasta el siguiente arranque.
    const orden: string[] = [];
    mockSaveContract.mockImplementation(() => {
      orden.push('guardar');
      return Promise.resolve(42);
    });
    mockRegenerar.mockImplementation(() => {
      orden.push('regenerar');
      return Promise.resolve({ eventosCreados: 0, errores: [] });
    });

    renderWizard('/contratos/nuevo?inmueble=1');
    await llenarHastaElFinal();
    fireEvent.click(screen.getByRole('button', { name: /Crear contrato/i }));

    await waitFor(() => expect(orden).toEqual(['guardar', 'regenerar']));
  });

  it('si la regeneración falla, el contrato queda guardado igual', async () => {
    // El contrato ya está en la base: tumbar el alta por no poder repintar una
    // previsión sería perder el dato bueno por culpa del derivado.
    mockRegenerar.mockRejectedValue(new Error('IndexedDB se cayó'));

    renderWizard('/contratos/nuevo?inmueble=1');
    await llenarHastaElFinal();
    fireEvent.click(screen.getByRole('button', { name: /Crear contrato/i }));

    await waitFor(() => expect(mockSaveContract).toHaveBeenCalledTimes(1));
    // Y se navega igual, sin dejar al usuario atrapado en el wizard.
    expect(await screen.findByText('listado')).toBeInTheDocument();
  });
});
