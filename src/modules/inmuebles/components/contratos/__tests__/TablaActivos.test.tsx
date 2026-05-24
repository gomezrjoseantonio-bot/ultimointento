import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TablaActivos from '../TablaActivos';
import type { Contract } from '../../../../../services/db';

const make = (id: number, overrides: Partial<Contract> = {}): Contract & { id: number } =>
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
      email: 'juan@example.com',
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
  }) as Contract & { id: number };

const aliasMap = new Map<number, string>([[1, 'Casa A']]);

describe('TablaActivos', () => {
  test('render con N contratos · pinta filas con nombre y alias', () => {
    render(
      <TablaActivos
        contratos={[make(1), make(2)]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getAllByText('Juan Calvo').length).toBe(2);
    expect(screen.getAllByText('Casa A').length).toBe(2);
  });

  test('click en fila invoca onAbrirFicha con el contrato', () => {
    const onAbrir = jest.fn();
    render(
      <TablaActivos
        contratos={[make(42)]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={onAbrir}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Abrir ficha de Juan Calvo/));
    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(onAbrir.mock.calls[0][0].id).toBe(42);
  });

  test('fecha indefinida (2099-12-31) renderiza "Indefinido"', () => {
    render(
      <TablaActivos
        contratos={[make(1, { fechaFin: '2099-12-31' })]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getByText('Indefinido')).toBeInTheDocument();
    // columna Días muestra "—" cuando es indefinido
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  test('contrato sin firmar marca pill brand "Sin firmar"', () => {
    render(
      <TablaActivos
        contratos={[make(1, { firma: undefined, fechaFirmaContrato: undefined })]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getByText('Sin firmar')).toBeInTheDocument();
  });

  test('iniciales del inquilino renderizadas en avatar', () => {
    render(
      <TablaActivos
        contratos={[make(1)]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getByText('JC')).toBeInTheDocument();
  });

  test('columna Habitación · "Piso completo" para unidad vivienda', () => {
    render(
      <TablaActivos
        contratos={[make(1)]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getByText('Piso completo')).toBeInTheDocument();
  });

  test('columna Habitación · "Hab N" para contrato por habitación', () => {
    render(
      <TablaActivos
        contratos={[make(1, { unidadTipo: 'habitacion', habitacionId: 'hab-3' })]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getByText('Hab 3')).toBeInTheDocument();
  });

  test('navegación con Enter activa la fila', () => {
    const onAbrir = jest.fn();
    render(
      <TablaActivos
        contratos={[make(1)]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={onAbrir}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText(/Abrir ficha de Juan Calvo/), { key: 'Enter' });
    expect(onAbrir).toHaveBeenCalled();
  });
});
