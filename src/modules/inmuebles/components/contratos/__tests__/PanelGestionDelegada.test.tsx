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
        <Route path="/contratos/gestion/anexar" element={<LocationProbe />} />
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
  // Facturación = (600+550)×12 = 13800 € · aparece en facturación y neto (comisión 0).
  expect(screen.getAllByText(/13\.800/).length).toBeGreaterThanOrEqual(1);
});

test('el selector de ejercicio recalcula la facturación por año', async () => {
  mockGetAllContracts.mockResolvedValue([
    padre,
    // 2025 completo · 1500/mes → 18.000 · 2026 completo · 900/mes → 10.800
    c({ id: 2, gestionPadreId: 1, rentaMensual: 1500, fechaInicio: '2025-01-01', fechaFin: '2025-12-31' }),
    c({ id: 3, gestionPadreId: 1, rentaMensual: 900, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }),
  ]);
  renderPanel(); // año actual = 2026

  const sel = await screen.findByRole('combobox', { name: /Ejercicio/i });
  // Opciones = años con actividad, desc: 2026 y 2025.
  expect([...sel.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['2026', '2025']);
  expect((sel as HTMLSelectElement).value).toBe('2026');
  expect(screen.getAllByText(/10\.800/).length).toBeGreaterThanOrEqual(1); // facturación 2026

  fireEvent.change(sel, { target: { value: '2025' } });
  expect(screen.getAllByText(/18\.000/).length).toBeGreaterThanOrEqual(1); // facturación 2025
});

test('el botón "Anexar" navega al wizard con gestionPadre + inmueble', async () => {
  mockGetAllContracts.mockResolvedValue([padre]);
  renderPanel();
  await waitFor(() => expect(mockGetAllContracts).toHaveBeenCalled());

  fireEvent.click(screen.getByRole('button', { name: /Anexar contrato de inquilino/i }));
  expect(screen.getByTestId('loc')).toHaveTextContent('/contratos/gestion/anexar?padre=1');
});
