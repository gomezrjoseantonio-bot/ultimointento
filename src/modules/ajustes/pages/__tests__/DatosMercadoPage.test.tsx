// Smoke test · DatosMercadoPage (PR 2 · spec §11 fila 4).
// Render tabla · click expande edición · save persiste vía service.

import '@testing-library/jest-dom';

const mockState: { items: any[]; vacios: boolean } = { items: [], vacios: true };

const mockRunMigration = jest.fn();
const mockListBenchmarks = jest.fn();
const mockTodosVacios = jest.fn();
const mockUpdateBenchmark = jest.fn();
const mockSetValorAnual = jest.fn();
const mockDeleteValorAnual = jest.fn();
const mockCreateBenchmark = jest.fn();
const mockRestaurarSeed = jest.fn();

jest.mock('../../../../services/benchmarksReferenciaService', () => ({
  runMigration_v72: (...args: any[]) => mockRunMigration(...args),
  listBenchmarks: (...args: any[]) => mockListBenchmarks(...args),
  todosVacios: (...args: any[]) => mockTodosVacios(...args),
  updateBenchmark: (...args: any[]) => mockUpdateBenchmark(...args),
  setValorAnual: (...args: any[]) => mockSetValorAnual(...args),
  deleteValorAnual: (...args: any[]) => mockDeleteValorAnual(...args),
  createBenchmark: (...args: any[]) => mockCreateBenchmark(...args),
  restaurarSeedV72: (...args: any[]) => mockRestaurarSeed(...args),
}));

jest.mock('../../../../design-system/v5', () => ({
  Icons: new Proxy(
    {},
    {
      get: () => () => null,
    },
  ),
  showToastV5: jest.fn(),
}));

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DatosMercadoPage from '../DatosMercadoPage';
import type { BenchmarkReferencia } from '../../../../types/benchmarksReferencia';

const seed: BenchmarkReferencia = {
  id: 'b-1',
  codigo: 'MSCI_WORLD_EUR',
  nombre: 'MSCI World EUR',
  tipo: 'indice_equity',
  divisa: 'EUR',
  descripcion: 'mock',
  valoresAnuales: {},
  fuenteUrl: 'https://msci.com',
  ultimaActualizacion: null,
  fechaCreacion: '2024-01-01T00:00:00.000Z',
  fechaModificacion: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockState.items = [seed];
  mockState.vacios = true;
  mockRunMigration.mockResolvedValue({ ejecutada: false, insertados: 0 });
  mockListBenchmarks.mockImplementation(() => Promise.resolve(mockState.items));
  mockTodosVacios.mockImplementation(() => Promise.resolve(mockState.vacios));
  mockRestaurarSeed.mockResolvedValue(6);
});

describe('DatosMercadoPage · smoke PR 2', () => {
  test('renderiza tabla con el benchmark del store + banner de vacíos', async () => {
    render(<DatosMercadoPage />);
    expect(await screen.findByText('Datos de mercado')).toBeInTheDocument();
    expect(await screen.findByText('MSCI World EUR')).toBeInTheDocument();
    expect(screen.getByText('MSCI_WORLD_EUR')).toBeInTheDocument();
    expect(screen.getByText(/Datos pendientes/)).toBeInTheDocument();
    expect(mockRunMigration).toHaveBeenCalledTimes(1);
  });

  test('click en fila expande panel de edición · botón cambia a "Cerrar"', async () => {
    render(<DatosMercadoPage />);
    const fila = await screen.findByText('MSCI World EUR');
    fireEvent.click(fila.closest('tr')!);
    expect(await screen.findByText('Valores anuales (%)')).toBeInTheDocument();
    expect(screen.getByText('Cerrar')).toBeInTheDocument();
  });

  test('guardar metadata · llama updateBenchmark con el nuevo nombre y recarga', async () => {
    render(<DatosMercadoPage />);
    const fila = await screen.findByText('MSCI World EUR');
    fireEvent.click(fila.closest('tr')!);
    await screen.findByText('Valores anuales (%)');

    const nombreInput = screen.getAllByDisplayValue('MSCI World EUR')[0] as HTMLInputElement;
    fireEvent.change(nombreInput, { target: { value: 'MSCI World hedged EUR' } });

    mockUpdateBenchmark.mockResolvedValueOnce({ ...seed, nombre: 'MSCI World hedged EUR' });

    const btnGuardar = screen.getByRole('button', { name: /Guardar metadata/ });
    await act(async () => {
      fireEvent.click(btnGuardar);
    });

    expect(mockUpdateBenchmark).toHaveBeenCalledWith(
      'b-1',
      expect.objectContaining({ nombre: 'MSCI World hedged EUR' }),
    );
    // recarga: listBenchmarks llamado más de una vez (mount + post-save)
    await waitFor(() => expect(mockListBenchmarks.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  test('añadir valor anual · llama setValorAnual', async () => {
    render(<DatosMercadoPage />);
    const fila = await screen.findByText('MSCI World EUR');
    fireEvent.click(fila.closest('tr')!);
    await screen.findByText('Valores anuales (%)');

    fireEvent.change(screen.getByLabelText('Año a añadir'), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText('Porcentaje a añadir'), { target: { value: '18.7' } });

    mockSetValorAnual.mockResolvedValueOnce({
      ...seed,
      valoresAnuales: { 2024: 18.7 },
      ultimaActualizacion: '2026-05-17',
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Añadir año/ }));
    });

    expect(mockSetValorAnual).toHaveBeenCalledWith('b-1', 2024, 18.7);
  });

  test('sin benchmarks · mensaje vacío con instrucción de restaurar', async () => {
    mockState.items = [];
    mockState.vacios = true;
    render(<DatosMercadoPage />);
    expect(await screen.findByText(/No hay benchmarks/)).toBeInTheDocument();
  });
});
