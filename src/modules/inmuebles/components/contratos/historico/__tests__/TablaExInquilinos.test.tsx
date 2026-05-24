import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Contract } from '../../../../../../services/db';
import TablaExInquilinos, { Estrellas } from '../TablaExInquilinos';

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{22EE}-\u{22EF}]/u;

const c = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 1,
    inmuebleId: 1,
    unidadTipo: 'habitacion',
    habitacionId: 'hab-2',
    modalidad: 'temporada',
    inquilino: { nombre: 'Ana', apellidos: 'García', dni: '12345678A', telefono: '600', email: 'a@b.c' },
    fechaInicio: '2023-01-01',
    fechaFin: '2023-12-01',
    fechaCierre: '2023-12-01',
    rentaMensual: 700,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 700,
    fianzaEstado: 'devuelta_total',
    cuentaCobroId: 0,
    estadoContrato: 'finalizado',
    motivoFin: 'fin_natural',
    valoracion: 4,
    ...overrides,
  }) as Contract;

const alias = new Map<number, string>([[1, 'FA32']]);

describe('TablaExInquilinos', () => {
  it('renderiza una fila por contrato', () => {
    render(
      <TablaExInquilinos
        contratos={[c({ id: 1 }), c({ id: 2 }), c({ id: 3 })]}
        inmuebleAliasById={alias}
        onAbrir={() => {}}
      />,
    );
    expect(screen.getAllByRole('button', { name: /Acciones/ })).toHaveLength(3);
  });

  it('click en fila ejecuta onAbrir con el contrato', () => {
    const onAbrir = jest.fn();
    render(
      <TablaExInquilinos contratos={[c({ id: 9 })]} inmuebleAliasById={alias} onAbrir={onAbrir} />,
    );
    fireEvent.click(screen.getByText('Ana García'));
    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(onAbrir.mock.calls[0][0].id).toBe(9);
  });

  it('color en el avatar + texto "Hab N" plano (una sola pieza de color)', () => {
    // jsdom no preserva valores var(--…) en style inline, así que validamos la
    // regla de diseño: las iniciales viven en el avatar y la habitación es texto plano.
    render(<TablaExInquilinos contratos={[c({ habitacionId: 'hab-2' })]} inmuebleAliasById={alias} onAbrir={() => {}} />);
    // generarIniciales('Ana García') === 'AG'
    expect(screen.getByText('AG')).toBeInTheDocument();
    expect(screen.getByText('Hab 2')).toBeInTheDocument();
  });

  it('piso completo no renderiza "Hab N"', () => {
    render(
      <TablaExInquilinos
        contratos={[c({ unidadTipo: 'vivienda' })]}
        inmuebleAliasById={alias}
        onAbrir={() => {}}
      />,
    );
    expect(screen.getByText('Piso completo')).toBeInTheDocument();
    expect(screen.queryByText(/^Hab /)).not.toBeInTheDocument();
  });

  it('no usa caracteres icon-like (cero emojis)', () => {
    const { container } = render(
      <TablaExInquilinos contratos={[c()]} inmuebleAliasById={alias} onAbrir={() => {}} />,
    );
    expect(container.textContent ?? '').not.toMatch(EMOJI_REGEX);
  });

  it('menú de acciones permite eliminar el contrato', () => {
    const onEliminar = jest.fn();
    render(
      <TablaExInquilinos
        contratos={[c({ id: 7 })]}
        inmuebleAliasById={alias}
        onAbrir={() => {}}
        onEliminar={onEliminar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Acciones del contrato/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Eliminar/ }));
    expect(onEliminar).toHaveBeenCalledTimes(1);
    expect(onEliminar.mock.calls[0][0].id).toBe(7);
  });

  it('sin onEliminar no muestra menú', () => {
    render(<TablaExInquilinos contratos={[c()]} inmuebleAliasById={alias} onAbrir={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Acciones del contrato/ }));
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});

describe('Estrellas', () => {
  it('n=null renderiza —', () => {
    render(<Estrellas n={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
  it('n=3 expone aria-label correcto', () => {
    render(<Estrellas n={3} />);
    expect(screen.getByLabelText('3 de 5 estrellas')).toBeInTheDocument();
  });
  it('no usa caracteres ★ ni ☆', () => {
    const { container } = render(<Estrellas n={5} />);
    expect(container.textContent ?? '').not.toMatch(/[★☆]/);
    expect(container.querySelectorAll('svg').length).toBe(5);
  });
});
