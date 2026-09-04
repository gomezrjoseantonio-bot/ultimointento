// E1.5-anclaje-saldo · lo que la pantalla le dice al usuario del cuadre con el
// banco, y que anclar es SU decisión (§9): una casilla, sin marcar por defecto.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CuadreConElBanco from '../conciliar/CuadreConElBanco';
import type { PropuestaDeAnclaje } from '../../../../services/anclajeSaldoExtracto';

const base: PropuestaDeAnclaje = {
  fecha: '2026-09-02',
  saldoBanco: 2635.4,
  saldoAtlas: -1961.7,
  descuadre: 4597.1,
  cuadra: false,
  aperturaPropuesta: 2648.67,
  aperturaActual: { saldo: 0, fecha: '2026-08-31' },
  aplicable: true,
};

describe('el cuadre con el banco', () => {
  it('no cuadra · dice lo que dice el banco, lo que calcula ATLAS y propone la apertura · sin marcar', () => {
    const onAnclar = jest.fn();
    render(<CuadreConElBanco propuesta={base} anclar={false} onAnclar={onAnclar} />);
    const bloque = screen.getByTestId('cuadre-banco');
    expect(bloque.getAttribute('data-estado')).toBe('descuadre');
    expect(bloque.textContent).toMatch(/El banco dice que a .*2 sep 2026 tenías 2\.635,40 €/);
    expect(bloque.textContent).toMatch(/ATLAS calcula −1\.961,70 €/);
    expect(bloque.textContent).toMatch(/Fijar mi saldo de apertura en 2\.648,67 €/);
    const casilla = screen.getByRole('checkbox') as HTMLInputElement;
    expect(casilla.checked).toBe(false);
    fireEvent.click(casilla);
    expect(onAnclar).toHaveBeenCalledWith(true);
  });

  it('la cuenta ya tenía apertura · se enseña, no se pisa en silencio', () => {
    render(
      <CuadreConElBanco
        propuesta={{ ...base, aperturaActual: { saldo: 1000, fecha: '2026-08-31' }, saldoAtlas: -961.7 }}
        anclar={false}
        onAnclar={() => undefined}
      />
    );
    expect(screen.getByTestId('cuadre-banco').textContent).toMatch(/tu apertura actual es 1\.000 €/);
  });

  it('cuadra · lo dice y no propone nada', () => {
    render(<CuadreConElBanco propuesta={{ ...base, cuadra: true, descuadre: 0, saldoAtlas: 2635.4 }} anclar={false} onAnclar={() => undefined} />);
    expect(screen.getByTestId('cuadre-banco').getAttribute('data-estado')).toBe('cuadra');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByTestId('cuadre-banco').textContent).toMatch(/ATLAS calcula lo mismo/);
  });

  it('extracto anterior a la apertura · avisa y no ofrece anclar', () => {
    render(
      <CuadreConElBanco
        propuesta={{ ...base, aplicable: false, aperturaActual: { saldo: 500, fecha: '2026-09-04' } }}
        anclar={false}
        onAnclar={() => undefined}
      />
    );
    expect(screen.getByTestId('cuadre-banco').getAttribute('data-estado')).toBe('anterior');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByTestId('cuadre-banco').textContent).toMatch(/anterior a la apertura/);
  });

  it('mientras se guarda, la casilla no se puede cambiar', () => {
    render(<CuadreConElBanco propuesta={base} anclar={true} onAnclar={() => undefined} desactivado />);
    const casilla = screen.getByRole('checkbox') as HTMLInputElement;
    expect(casilla.disabled).toBe(true);
    expect(casilla.checked).toBe(true);
  });
});
