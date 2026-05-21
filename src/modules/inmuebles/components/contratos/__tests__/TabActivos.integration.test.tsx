import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TabActivos from '../TabActivos';
import type { Contract } from '../../../../../services/db';

const make = (id: number, overrides: Partial<Contract> = {}): Contract =>
  ({
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: {
      nombre: 'Juan',
      apellidos: 'Calvo',
      dni: '12345678A',
      telefono: '',
      email: 'juan@gmail.com',
    },
    fechaInicio: '2024-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 800,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 800,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract;

const cs = [
  make(1, { inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '1', telefono: '', email: 'a@b.c' } }),
  make(2, { inquilino: { nombre: 'María', apellidos: 'Gómez', dni: '2', telefono: '', email: 'm@b.c' }, modalidad: 'temporada' }),
  make(3, { inquilino: { nombre: 'Laura', apellidos: 'Sanz', dni: '3', telefono: '', email: 'l@b.c' } }),
];

const aliasMap = new Map<number, string>([[1, 'Casa A']]);

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe('TabActivos · integración', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  test('render inicial · todos los contratos visibles', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    expect(screen.getByText('Juan Calvo')).toBeInTheDocument();
    expect(screen.getByText('María Gómez')).toBeInTheDocument();
    expect(screen.getByText('Laura Sanz')).toBeInTheDocument();
  });

  test('búsqueda por nombre filtra a 1 resultado', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    const input = screen.getByPlaceholderText(/Buscar por inquilino/);
    fireEvent.change(input, { target: { value: 'Calvo' } });
    act(() => {
      jest.advanceTimersByTime(220);
    });
    expect(screen.getByText('Juan Calvo')).toBeInTheDocument();
    expect(screen.queryByText('María Gómez')).toBeNull();
    expect(screen.queryByText('Laura Sanz')).toBeNull();
  });

  test('chip Tipo "Corta" reduce a contratos de temporada/vacacional', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    fireEvent.click(screen.getByText('Corta'));
    expect(screen.getByText('María Gómez')).toBeInTheDocument();
    expect(screen.queryByText('Juan Calvo')).toBeNull();
  });

  test('combinación búsqueda + chip · AND', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    fireEvent.click(screen.getByText('Larga'));
    fireEvent.change(screen.getByPlaceholderText(/Buscar por inquilino/), {
      target: { value: 'María' },
    });
    act(() => {
      jest.advanceTimersByTime(220);
    });
    // María es temporada · al combinar Larga + María no debe haber resultados
    expect(screen.getByText(/No hay contratos con esos filtros/)).toBeInTheDocument();
  });

  test('botón "Limpiar filtros" en empty state restaura todo', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    fireEvent.change(screen.getByPlaceholderText(/Buscar por inquilino/), {
      target: { value: 'zzz-no-existe' },
    });
    act(() => {
      jest.advanceTimersByTime(220);
    });
    fireEvent.click(screen.getByText('Limpiar filtros'));
    act(() => {
      jest.advanceTimersByTime(220);
    });
    expect(screen.getByText('Juan Calvo')).toBeInTheDocument();
  });

  test('persistencia · filtros se restauran desde sessionStorage', () => {
    sessionStorage.setItem(
      'atlas-contratos-filtros-activos',
      JSON.stringify({ busqueda: 'Gómez', tipo: 'todos', estado: 'todos' }),
    );
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    expect(screen.getByText('María Gómez')).toBeInTheDocument();
    expect(screen.queryByText('Juan Calvo')).toBeNull();
  });

  test('contratos = 0 · render empty state global con CTA nuevo contrato', () => {
    const onNuevo = jest.fn();
    render(wrap(<TabActivos contratos={[]} inmuebleAliasById={aliasMap} onNuevoContrato={onNuevo} />));
    expect(screen.getByText('Sin contratos activos')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ nuevo contrato'));
    expect(onNuevo).toHaveBeenCalled();
  });
});
