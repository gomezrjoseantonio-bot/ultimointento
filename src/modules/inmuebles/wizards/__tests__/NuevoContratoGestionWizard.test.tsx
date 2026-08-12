import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import NuevoContratoGestionWizard from '../NuevoContratoGestionWizard';
import type { InmueblesOutletContext } from '../../InmueblesContext';
import type { Property } from '../../../../services/db';

const mockSaveContract = jest.fn();
const mockGetContract = jest.fn();
const mockGuardarAgencia = jest.fn();
const mockGetAccounts = jest.fn();

jest.mock('../../../../services/contractService', () => ({
  saveContract: (...a: unknown[]) => mockSaveContract(...a),
  getContract: (...a: unknown[]) => mockGetContract(...a),
}));
jest.mock('../agenciaGestionService', () => ({
  guardarAgencia: (...a: unknown[]) => mockGuardarAgencia(...a),
}));
jest.mock('../../../../services/treasuryApiService', () => ({
  treasuryAPI: { accounts: { getAccounts: (...a: unknown[]) => mockGetAccounts(...a) } },
}));
jest.mock('../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../design-system/v5');
  return { ...actual, showToastV5: jest.fn() };
});

const property = (id: number, alias: string): Property =>
  ({ id, alias, address: '', documents: [] }) as Property;

const ctx: InmueblesOutletContext = {
  properties: [property(1, 'Fuertes Acevedo 32')],
  contracts: [],
  reload: jest.fn(),
};

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={['/contratos/nuevo']}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/contratos/nuevo" element={<NuevoContratoGestionWizard />} />
        </Route>
        <Route path="/contratos" element={<div data-testid="lista">listado</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockSaveContract.mockReset();
  mockGetContract.mockReset();
  mockGuardarAgencia.mockReset();
  mockGetAccounts.mockReset();
  mockGetAccounts.mockResolvedValue([{ id: 7, alias: 'Cuenta principal' }]);
});

test('validación · submit incompleto muestra error y no guarda', async () => {
  renderForm();
  fireEvent.click(screen.getByRole('button', { name: /Crear contrato de gestión/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/inmueble/i);
  expect(mockSaveContract).not.toHaveBeenCalled();
});

test('happy path · guarda agencia + contrato con bloque gestion y navega', async () => {
  mockGuardarAgencia.mockResolvedValueOnce('B12345678');
  mockSaveContract.mockResolvedValueOnce(42);
  mockGetContract.mockResolvedValueOnce({ id: 42 });

  const { container } = renderForm();
  await screen.findByRole('option', { name: /Cuenta principal/i });

  const combos = screen.getAllByRole('combobox'); // [inmueble, indexación, cuenta]
  fireEvent.change(combos[0], { target: { value: '1' } });

  const textboxes = screen.getAllByRole('textbox'); // [agencia nombre, NIF]
  fireEvent.change(textboxes[0], { target: { value: 'Agencia XYZ' } });
  fireEvent.change(textboxes[1], { target: { value: 'B12345678' } });

  const spins = screen.getAllByRole('spinbutton'); // [renta garantizada, día]
  fireEvent.change(spins[0], { target: { value: '1350' } });

  const fechas = container.querySelectorAll('input[type="date"]'); // [inicio, fin]
  fireEvent.change(fechas[0], { target: { value: '2026-01-01' } });
  fireEvent.change(fechas[1], { target: { value: '2029-01-01' } });

  fireEvent.change(combos[combos.length - 1], { target: { value: '7' } }); // cuenta

  fireEvent.click(screen.getByRole('button', { name: /Crear contrato de gestión/i }));

  await waitFor(() => expect(mockSaveContract).toHaveBeenCalledTimes(1));
  expect(mockGuardarAgencia).toHaveBeenCalledWith('B12345678', 'Agencia XYZ');

  const payload = mockSaveContract.mock.calls[0][0];
  expect(payload).toMatchObject({
    inmuebleId: 1,
    rentaMensual: 1350,
    fechaFin: '2029-01-01', // NO-LAU · plazo pactado, sin +5
    estadoContrato: 'activo',
    gestion: { agenciaNif: 'B12345678', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] },
  });

  expect(await screen.findByTestId('lista')).toBeInTheDocument();
});
