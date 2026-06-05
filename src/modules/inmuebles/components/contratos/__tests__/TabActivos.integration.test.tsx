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
    documentoFirmado: true,
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract;

const cs = [
  make(1, { inmuebleId: 1, inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '1', telefono: '', email: 'a@b.c' } }),
  make(2, { inmuebleId: 2, inquilino: { nombre: 'María', apellidos: 'Gómez', dni: '2', telefono: '', email: 'm@b.c' } }),
  make(3, { inmuebleId: 1, inquilino: { nombre: 'Laura', apellidos: 'Sanz', dni: '3', telefono: '', email: 'l@b.c' } }),
];

const aliasMap = new Map<number, string>([
  [1, 'Casa A'],
  [2, 'Casa B'],
]);

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

  test('toolbar único · sin chips TIPO/ESTADO · sin botones Exportar/Imprimir/Columnas', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    expect(screen.queryByText('Larga')).toBeNull();
    expect(screen.queryByText('Corta')).toBeNull();
    expect(screen.queryByText('Más filtros')).toBeNull();
    expect(screen.queryByText('Exportar Excel')).toBeNull();
    expect(screen.queryByText('Imprimir')).toBeNull();
    expect(screen.queryByText('Columnas')).toBeNull();
  });

  test('búsqueda por nombre filtra a 1 resultado', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    const input = screen.getByPlaceholderText(/Buscar inquilino/);
    fireEvent.change(input, { target: { value: 'Calvo' } });
    act(() => {
      jest.advanceTimersByTime(220);
    });
    expect(screen.getByText('Juan Calvo')).toBeInTheDocument();
    expect(screen.queryByText('María Gómez')).toBeNull();
    expect(screen.queryByText('Laura Sanz')).toBeNull();
  });

  test('selector de inmueble filtra por inmueble', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    fireEvent.change(screen.getByLabelText('Filtrar por inmueble'), { target: { value: '2' } });
    expect(screen.getByText('María Gómez')).toBeInTheDocument();
    expect(screen.queryByText('Juan Calvo')).toBeNull();
    expect(screen.queryByText('Laura Sanz')).toBeNull();
  });

  test('búsqueda sin resultados · empty state con limpiar filtros', () => {
    render(wrap(<TabActivos contratos={cs} inmuebleAliasById={aliasMap} onNuevoContrato={() => {}} />));
    fireEvent.change(screen.getByPlaceholderText(/Buscar inquilino/), {
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

  test('persistencia · búsqueda se restaura desde sessionStorage', () => {
    sessionStorage.setItem(
      'atlas-contratos-filtros-activos',
      JSON.stringify({ busqueda: 'Gómez', inmueble: 'todos', tipo: 'todos', estado: 'todos' }),
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
