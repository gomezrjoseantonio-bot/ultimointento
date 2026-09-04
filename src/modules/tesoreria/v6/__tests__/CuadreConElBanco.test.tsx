// §31 · lo que la pantalla le dice al usuario del cuadre con el banco y de la
// apertura DERIVADA, y que aplicarla es SU decisión (§9): una casilla, sin
// marcar por defecto.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CuadreConElBanco from '../conciliar/CuadreConElBanco';
import type { PropuestaDeApertura } from '../../../../services/aperturaDerivada';

const extremos = {
  masReciente: { fecha: '2026-09-02', saldoBanco: 2635.4 },
  masAntigua: { fecha: '2026-08-26', saldoBanco: 4597.1, importe: 3943.31 },
};

/** Extracto ANTIGUO sobre una cuenta abierta el 31 de agosto · la apertura retrocede. */
const retroceso: PropuestaDeApertura = {
  extremos,
  fecha: '2026-09-02',
  saldoBanco: 2635.4,
  saldoAtlas: -1961.7,
  descuadre: 4597.1,
  cuadra: false,
  modo: 'retroceso',
  apertura: { fecha: '2026-08-26', saldo: 653.79 },
  aperturaActual: { saldo: 0, fecha: '2026-08-31' },
  proponer: true,
  saldoAtlasTrasAplicar: 2635.4,
  cuadraTrasAplicar: true,
};

/** Extracto que cae dentro de lo que ATLAS ya cubría · se ajusta el importe. */
const ajuste: PropuestaDeApertura = {
  ...retroceso,
  saldoAtlas: 1981.61,
  descuadre: 653.79,
  modo: 'ajuste',
  apertura: { fecha: '2026-08-01', saldo: 653.79 },
  aperturaActual: { saldo: 0, fecha: '2026-08-01' },
};

describe('el extracto es más antiguo que la apertura · retroceso', () => {
  it('cuenta que el fichero empieza antes y ofrece llevar la apertura allí · sin marcar', () => {
    const onAplicar = jest.fn();
    render(<CuadreConElBanco propuesta={retroceso} aplicar={false} onAplicar={onAplicar} />);
    const bloque = screen.getByTestId('cuadre-banco');
    expect(bloque.getAttribute('data-modo')).toBe('retroceso');
    expect(bloque.textContent).toMatch(/El banco dice que a .*2 sep 2026 tenías 2\.635,40 €/);
    expect(bloque.textContent).toMatch(/ATLAS calcula −1\.961,70 €/);
    expect(bloque.textContent).toMatch(/empieza el .*26 ago 2026.*antes.* de la apertura/);
    expect(bloque.textContent).toMatch(/Llevar mi apertura al .*26 ago 2026 con 653,79 €/);
    const casilla = screen.getByRole('checkbox') as HTMLInputElement;
    expect(casilla.checked).toBe(false);
    fireEvent.click(casilla);
    expect(onAplicar).toHaveBeenCalledWith(true);
  });

  it('aunque el saldo de hoy ya cuadre, la apertura puede retroceder · ATLAS gana historial', () => {
    render(
      <CuadreConElBanco
        propuesta={{ ...retroceso, cuadra: true, descuadre: 0, saldoAtlas: 2635.4 }}
        aplicar={false}
        onAplicar={() => undefined}
      />
    );
    const bloque = screen.getByTestId('cuadre-banco');
    expect(bloque.getAttribute('data-estado')).toBe('cuadra');
    expect(bloque.textContent).toMatch(/ATLAS calcula lo mismo/);
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('si tras aplicarla seguiría sin cuadrar, se dice · falta algo por registrar', () => {
    render(
      <CuadreConElBanco
        propuesta={{ ...retroceso, cuadraTrasAplicar: false, saldoAtlasTrasAplicar: 2600 }}
        aplicar={false}
        onAplicar={() => undefined}
      />
    );
    expect(screen.getByTestId('cuadre-banco').textContent).toMatch(/Aun así quedarían 35,40 €/);
  });
});

describe('el extracto cae dentro de lo que ATLAS ya cubría · ajuste', () => {
  it('propone fijar el saldo de apertura sin mover su fecha', () => {
    render(<CuadreConElBanco propuesta={ajuste} aplicar={false} onAplicar={() => undefined} />);
    const bloque = screen.getByTestId('cuadre-banco');
    expect(bloque.getAttribute('data-modo')).toBe('ajuste');
    expect(bloque.textContent).toMatch(/Fijar mi saldo de apertura en 653,79 € a .*1 ago 2026/);
    expect(bloque.textContent).not.toMatch(/empieza el/);
  });

  it('la apertura actual se enseña · no se pisa en silencio', () => {
    render(
      <CuadreConElBanco
        propuesta={{ ...ajuste, aperturaActual: { saldo: 1000, fecha: '2026-08-01' } }}
        aplicar={false}
        onAplicar={() => undefined}
      />
    );
    expect(screen.getByTestId('cuadre-banco').textContent).toMatch(/tu apertura actual es 1\.000 €/);
  });

  it('sin fecha de apertura no hay apertura previa que enseñar', () => {
    render(
      <CuadreConElBanco
        propuesta={{ ...ajuste, aperturaActual: { saldo: 0, fecha: null } }}
        aplicar={false}
        onAplicar={() => undefined}
      />
    );
    expect(screen.getByTestId('cuadre-banco').textContent).not.toMatch(/tu apertura actual/);
  });
});

describe('cuando no hay nada que proponer', () => {
  it('cuadra y la apertura ya está donde tiene que estar · lo dice y no ofrece nada', () => {
    render(
      <CuadreConElBanco
        propuesta={{ ...retroceso, cuadra: true, descuadre: 0, saldoAtlas: 2635.4, proponer: false }}
        aplicar={false}
        onAplicar={() => undefined}
      />
    );
    expect(screen.getByTestId('cuadre-banco').getAttribute('data-estado')).toBe('cuadra');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByTestId('cuadre-banco').textContent).toMatch(/ATLAS calcula lo mismo/);
  });

  it('no cuadra pero la apertura ya es la buena · se avisa y se manda a mirar los movimientos', () => {
    render(<CuadreConElBanco propuesta={{ ...retroceso, proponer: false }} aplicar={false} onAplicar={() => undefined} />);
    const bloque = screen.getByTestId('cuadre-banco');
    expect(bloque.getAttribute('data-estado')).toBe('descuadre');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(bloque.textContent).toMatch(/4\.597,10 € de diferencia/);
    expect(bloque.textContent).toMatch(/La apertura ya está donde tiene que estar/);
  });
});

describe('mientras se guarda', () => {
  it('la casilla no se puede cambiar', () => {
    render(<CuadreConElBanco propuesta={retroceso} aplicar={true} onAplicar={() => undefined} desactivado />);
    const casilla = screen.getByRole('checkbox') as HTMLInputElement;
    expect(casilla.disabled).toBe(true);
    expect(casilla.checked).toBe(true);
  });
});
