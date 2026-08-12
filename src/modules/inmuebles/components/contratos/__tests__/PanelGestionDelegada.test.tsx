import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import PanelGestionDelegada from '../PanelGestionDelegada';
import type { Contract } from '../../../../../services/db';

const mockGetAllContracts = jest.fn();
jest.mock('../../../../../services/contractService', () => ({
  getAllContracts: (...a: unknown[]) => mockGetAllContracts(...a),
}));

const c = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'A', apellidos: 'B', dni: 'X', telefono: '', email: '' },
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    rentaMensual: 500,
    diaPago: 1,
    estadoContrato: 'activo',
    fianzaImporte: 0,
    ...over,
  }) as Contract;

const padre = c({
  id: 1,
  inmuebleId: 9,
  rentaMensual: 1350,
  inquilino: { nombre: 'Agencia XYZ', apellidos: '', dni: 'B1', telefono: '', email: '' },
  fechaInicio: '2026-01-01',
  fechaFin: '2029-01-01',
  gestion: { agenciaNif: 'B1', modeloIngreso: 'garantizada', rentaGarantizada: 1350, honorarios: [] },
}) as Contract & { id: number };

const LocationProbe = () => <div data-testid="loc">{useLocation().pathname + useLocation().search}</div>;

const renderPanel = () =>
  render(
    <MemoryRouter initialEntries={['/contratos']}>
      <Routes>
        <Route path="/contratos" element={<><PanelGestionDelegada contrato={padre} año={2026} /><LocationProbe /></>} />
        <Route path="/contratos/nuevo" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => mockGetAllContracts.mockReset());

test('muestra agencia, renta garantizada y facturación = Σ subcontratos anexados', async () => {
  mockGetAllContracts.mockResolvedValue([
    padre,
    c({ id: 2, gestionPadreId: 1, rentaMensual: 600 }),
    c({ id: 3, gestionPadreId: 1, rentaMensual: 550 }),
  ]);
  renderPanel();

  expect(screen.getByText('Agencia XYZ')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument()); // nSubcontratos
  // Facturación = (600+550)×12 = 13800 €
  expect(screen.getByText(/13\.800/)).toBeInTheDocument();
});

test('el botón "Anexar" navega al wizard con gestionPadre + inmueble', async () => {
  mockGetAllContracts.mockResolvedValue([padre]);
  renderPanel();
  await waitFor(() => expect(mockGetAllContracts).toHaveBeenCalled());

  fireEvent.click(screen.getByRole('button', { name: /Anexar contrato de inquilino/i }));
  expect(screen.getByTestId('loc')).toHaveTextContent('/contratos/nuevo?gestionPadre=1&inmueble=9');
});
