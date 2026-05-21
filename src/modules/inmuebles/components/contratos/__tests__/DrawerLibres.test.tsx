import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DrawerLibres from '../DrawerLibres';
import type { ResultadoLibresAhora } from '../../../utils/calcularLibresAhora';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const wrap = (ui: React.ReactElement) => (
  <MemoryRouter>{ui}</MemoryRouter>
);

const baseData = (): ResultadoLibresAhora => ({
  total: 2,
  diasTotalesAcumulados: 35,
  rentaPerdidaAcumulada: 800,
  unidades: [
    {
      inmuebleId: 1,
      inmuebleAlias: 'Casa A',
      diasLibre: 20,
      rentaPotencial: 600,
      rentaPerdidaAcumulada: 400,
      unidadLabel: 'Unidad libre 1',
    },
    {
      inmuebleId: 2,
      inmuebleAlias: 'Casa B',
      diasLibre: 15,
      rentaPotencial: 700,
      rentaPerdidaAcumulada: 400,
      unidadLabel: 'Unidad libre 2',
    },
  ],
});

describe('DrawerLibres', () => {
  beforeEach(() => mockNavigate.mockReset());

  test('renderiza filas de unidades libres con alias', () => {
    render(wrap(<DrawerLibres open onClose={() => {}} data={baseData()} />));
    expect(screen.getByText(/Libres ahora · 2 unidades/)).toBeInTheDocument();
    expect(screen.getByText(/Unidad libre 1 · Casa A/)).toBeInTheDocument();
    expect(screen.getByText(/Unidad libre 2 · Casa B/)).toBeInTheDocument();
  });

  test('empty state cuando total = 0', () => {
    render(
      wrap(
        <DrawerLibres
          open
          onClose={() => {}}
          data={{ total: 0, unidades: [], diasTotalesAcumulados: 0, rentaPerdidaAcumulada: 0 }}
        />,
      ),
    );
    expect(screen.getByText('Todo ocupado')).toBeInTheDocument();
  });

  test('botón Nuevo contrato en fila navega con inmuebleId', () => {
    render(wrap(<DrawerLibres open onClose={() => {}} data={baseData()} />));
    const botonesNuevo = screen.getAllByRole('button', { name: '+ Nuevo contrato' });
    fireEvent.click(botonesNuevo[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/contratos/nuevo?inmueble=1');
  });

  test('botón footer Nuevo contrato navega sin inmuebleId', () => {
    render(wrap(<DrawerLibres open onClose={() => {}} data={baseData()} />));
    // El footer es el último botón "Nuevo contrato" del documento
    const todos = screen.getAllByRole('button', { name: /Nuevo contrato/ });
    fireEvent.click(todos[todos.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith('/contratos/nuevo');
  });
});
