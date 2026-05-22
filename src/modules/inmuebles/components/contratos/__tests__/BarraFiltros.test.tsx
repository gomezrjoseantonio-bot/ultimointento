import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BarraFiltros from '../BarraFiltros';
import type { FiltrosActivos, CountsChips } from '../../../utils/filtrosActivos';

const counts: CountsChips = {
  tipo: { todos: 6, larga: 4, corta: 2 },
  estado: { todos: 6, 'al-dia': 5, 'vence-30d': 1, impago: 0, 'sin-firmar': 0 },
};

const filtros: FiltrosActivos = { busqueda: '', tipo: 'todos', estado: 'todos' };

describe('BarraFiltros', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('renderiza input búsqueda, chips Tipo y Estado, y botón Más filtros', () => {
    render(<BarraFiltros filtros={filtros} onChange={() => {}} counts={counts} />);
    expect(screen.getByPlaceholderText(/Buscar por inquilino/)).toBeInTheDocument();
    // Hay dos chips "Todos" · uno en Tipo y otro en Estado
    expect(screen.getAllByRole('radio', { name: /Todos/i }).length).toBe(2);
    expect(screen.getByText('Larga')).toBeInTheDocument();
    expect(screen.getByText('Al día')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Más filtros/i })).toBeInTheDocument();
  });

  test('click en chip tipo Larga invoca onChange con tipo=larga', () => {
    const onChange = jest.fn();
    render(<BarraFiltros filtros={filtros} onChange={onChange} counts={counts} />);
    fireEvent.click(screen.getByText('Larga'));
    expect(onChange).toHaveBeenCalledWith({ ...filtros, tipo: 'larga' });
  });

  test('chips con count = 0 están deshabilitados', () => {
    render(<BarraFiltros filtros={filtros} onChange={() => {}} counts={counts} />);
    const impago = screen.getByRole('radio', { name: /Impago/ });
    expect(impago).toBeDisabled();
  });

  test('debounce búsqueda · onChange se llama tras 200ms', () => {
    const onChange = jest.fn();
    render(<BarraFiltros filtros={filtros} onChange={onChange} counts={counts} />);
    const input = screen.getByPlaceholderText(/Buscar por inquilino/);

    fireEvent.change(input, { target: { value: 'Calvo' } });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(220);
    });
    expect(onChange).toHaveBeenCalledWith({ ...filtros, busqueda: 'Calvo' });
  });

  test('botón limpiar búsqueda vacía el input', () => {
    const onChange = jest.fn();
    render(
      <BarraFiltros
        filtros={{ ...filtros, busqueda: 'Calvo' }}
        onChange={onChange}
        counts={counts}
      />,
    );
    fireEvent.click(screen.getByLabelText('Limpiar búsqueda'));
    act(() => {
      jest.advanceTimersByTime(220);
    });
    expect(onChange).toHaveBeenCalledWith({ busqueda: '', tipo: 'todos', estado: 'todos' });
  });
});
