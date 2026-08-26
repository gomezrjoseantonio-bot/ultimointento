// El rótulo de reducción · uno solo, y lo consumen las cinco pantallas.
//
// Antes cada pantalla lo escribía a mano: `Reducción 26%` en supervisión,
// `Reducción del 60% Ley Vivienda` en la ficha del inmueble, `reducción 26,07%`
// en la fiscalidad del inmueble. Cinco textos, tres números distintos para el
// mismo contrato y ninguno que se pudiera buscar en la ley.
//
// Aquí solo hay uno, y dice lo mismo venga de un XML o del motor.

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import RotuloReduccion from '../RotuloReduccion';
import { desgloseDeclarado, desgloseEnCurso, desgloseAusente } from '../../../services/desgloseReduccion';

/** El ICU del jsdom de CI no pone el punto de los miles: se normaliza. */
const texto = (): string => (document.body.textContent ?? '').replace(/\s/g, ' ').replace(/\./g, '');

const mixtoDeclarado = () =>
  desgloseDeclarado({
    arrendamientos: [
      { tipo: 'larga_estancia', conReduccion: true },
      { tipo: 'otro', conReduccion: false },
    ],
    reduccion: 1390.94,
    rendimientoAntes: 5334.69,
  });

describe('rótulo de reducción', () => {
  it('un chip por tramo, con su nominal', () => {
    render(<RotuloReduccion desglose={desgloseEnCurso(
      [
        { tipo: 'larga_estancia', pct: 60, ingresos: 6000 },
        { tipo: 'temporada', pct: 0, ingresos: 4000 },
      ],
      5000,
    )} />);

    expect(screen.getByText('60% larga estancia')).toBeInTheDocument();
    expect(screen.getByText('0% temporada')).toBeInTheDocument();
  });

  it('el importe es el dato principal y va con signo de resta', () => {
    render(<RotuloReduccion desglose={mixtoDeclarado()} />);
    expect(texto()).toContain('−1390,94 €');
  });

  it('el «26 %» no aparece por ningún lado', () => {
    render(<RotuloReduccion desglose={mixtoDeclarado()} />);
    expect(texto()).not.toContain('26%');
    expect(texto()).not.toContain('26,07');
  });

  it('un tramo sin nominal derivable se rotula por su nombre, sin cifra', () => {
    render(<RotuloReduccion desglose={mixtoDeclarado()} />);
    expect(screen.getByText('larga estancia')).toBeInTheDocument();
  });

  it('dato ausente · lo dice, no enseña 0 €', () => {
    render(<RotuloReduccion desglose={desgloseAusente()} />);
    expect(texto()).toContain('Sin datos de reducción');
    expect(texto()).not.toContain('0 €');
  });

  it('sin reducción · el 0 € sí se enseña, porque es un dato', () => {
    render(<RotuloReduccion desglose={desgloseEnCurso(
      [{ tipo: 'temporada', pct: 0, ingresos: 4000 }],
      5000,
    )} />);
    expect(screen.getByText('0% temporada')).toBeInTheDocument();
  });

  it('se puede pedir sin el importe, para las líneas que ya lo llevan al lado', () => {
    render(<RotuloReduccion desglose={mixtoDeclarado()} conImporte={false} />);
    expect(texto()).not.toContain('1390,94');
    expect(screen.getByText('larga estancia')).toBeInTheDocument();
  });

  it('un desglose que no llega · se comporta como dato ausente, no revienta', () => {
    // La política es carga limpia, pero una declaración cacheada de antes de
    // este cambio no trae el campo. Que la pantalla se caiga por eso sería
    // peor que decir que no hay dato.
    render(<RotuloReduccion desglose={undefined as never} />);
    expect(texto()).toContain('Sin datos de reducción');
  });

  it('lleva la etiqueta «Reducción» cuando se le pide', () => {
    render(<RotuloReduccion desglose={mixtoDeclarado()} etiqueta />);
    expect(screen.getByText('Reducción')).toBeInTheDocument();
  });
});
