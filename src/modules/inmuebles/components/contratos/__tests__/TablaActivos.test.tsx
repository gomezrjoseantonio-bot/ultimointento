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
    documentoFirmado: true,
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

  test('7 columnas exactas · sin Estado · sin Último cobro · sin Habitación/Tipo/Días', () => {
    render(
      <TablaActivos contratos={[make(1)]} inmuebleAliasById={aliasMap} onAbrirFicha={() => {}} />,
    );
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'Inquilino',
      'Inmueble',
      'Inicio',
      'Fin',
      'Renta mensual',
      'Renta anual',
      '',
    ]);
    expect(screen.queryByText('Estado')).toBeNull();
    expect(screen.queryByText('Último cobro')).toBeNull();
  });

  test('sub-meta del inquilino muestra el DNI', () => {
    render(
      <TablaActivos contratos={[make(1)]} inmuebleAliasById={aliasMap} onAbrirFicha={() => {}} />,
    );
    expect(screen.getByText('DNI 12345678A')).toBeInTheDocument();
  });

  test('renta anual = renta mensual × 12', () => {
    render(
      <TablaActivos contratos={[make(1, { rentaMensual: 800 })]} inmuebleAliasById={aliasMap} onAbrirFicha={() => {}} />,
    );
    // 800 × 12 = 9.600 €
    expect(screen.getByText(/9\.600/)).toBeInTheDocument();
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

  test('sub-meta inmueble · "Piso completo" para unidad vivienda', () => {
    render(
      <TablaActivos
        contratos={[make(1)]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getByText('Piso completo')).toBeInTheDocument();
  });

  test('sub-meta inmueble · "Hab N" para contrato por habitación', () => {
    render(
      <TablaActivos
        contratos={[make(1, { unidadTipo: 'habitacion', habitacionId: 'hab-3' })]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getByText('Hab 3')).toBeInTheDocument();
  });

  test('contrato sin firmar · sub-meta "sin firmar" y avatar apagado', () => {
    const { container } = render(
      <TablaActivos
        contratos={[make(1, { documentoFirmado: false })]}
        inmuebleAliasById={aliasMap}
        onAbrirFicha={() => {}}
      />,
    );
    expect(screen.getByText(/sin firmar/)).toBeInTheDocument();
    // El avatar apagado no lleva background inline (paleta de color reservada a firmados).
    const avatar = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(avatar?.getAttribute('style') ?? '').not.toMatch(/background/);
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
