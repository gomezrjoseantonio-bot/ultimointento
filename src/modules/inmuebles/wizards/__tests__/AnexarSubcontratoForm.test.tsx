import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import AnexarSubcontratoForm from '../AnexarSubcontratoForm';
import type { InmueblesOutletContext } from '../../InmueblesContext';
import type { Contract, Property } from '../../../../services/db';

const mockSaveContract = jest.fn();
const mockGetContract = jest.fn();
jest.mock('../../../../services/contractService', () => ({
  saveContract: (...a: unknown[]) => mockSaveContract(...a),
  getContract: (...a: unknown[]) => mockGetContract(...a),
}));
jest.mock('../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../design-system/v5');
  return { ...actual, showToastV5: jest.fn() };
});

const property = (over: Partial<Property>): Property =>
  ({ id: 9, alias: 'FA32', bedrooms: 1, modoExplotacion: 'piso_completo', documents: [], ...over }) as Property;

const ctx: InmueblesOutletContext = {
  properties: [property({})],
  contracts: [],
  reload: jest.fn(),
};

const padre = { id: 1, inmuebleId: 9, diaPago: 5, gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] } } as unknown as Contract;

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={['/contratos/gestion/anexar?padre=1']}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/contratos/gestion/anexar" element={<AnexarSubcontratoForm />} />
        </Route>
        <Route path="/contratos" element={<div data-testid="lista">listado</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockSaveContract.mockReset();
  mockGetContract.mockReset();
  mockGetContract.mockResolvedValue(padre);
});

test('validación · sin nombre no guarda', async () => {
  renderForm();
  await waitFor(() => expect(screen.getByRole("button", { name: /Anexar contrato/i })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /Anexar contrato/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/nombre/i);
  expect(mockSaveContract).not.toHaveBeenCalled();
});

test('happy path · crea el subcontrato anexado al padre y navega', async () => {
  mockSaveContract.mockResolvedValueOnce(55);
  const { container } = renderForm();
  await waitFor(() => expect(screen.getByRole("button", { name: /Anexar contrato/i })).toBeEnabled());

  const textboxes = screen.getAllByRole('textbox'); // [nombre, apellidos]
  fireEvent.change(textboxes[0], { target: { value: 'Ana' } });
  fireEvent.change(textboxes[1], { target: { value: 'García' } });

  const fechas = container.querySelectorAll('input[type="date"]'); // [inicio, fin]
  fireEvent.change(fechas[0], { target: { value: '2026-01-01' } });
  fireEvent.change(fechas[1], { target: { value: '2026-12-31' } });

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '600' } }); // renta

  fireEvent.click(screen.getByRole('button', { name: /Anexar contrato/i }));

  await waitFor(() => expect(mockSaveContract).toHaveBeenCalledTimes(1));
  const payload = mockSaveContract.mock.calls[0][0];
  expect(payload).toMatchObject({
    inmuebleId: 9,
    gestionPadreId: 1,
    rentaMensual: 600,
    fianzaImporte: 0,
    cuentaCobroId: 0,
    inquilino: { nombre: 'Ana', apellidos: 'García', dni: '' },
  });
  expect(await screen.findByTestId('lista')).toBeInTheDocument();
});
