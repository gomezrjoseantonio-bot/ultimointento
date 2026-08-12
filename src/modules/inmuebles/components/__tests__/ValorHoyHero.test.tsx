import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ValorHoyHero, { calcularCambioAnual } from '../ValorHoyHero';

describe('calcularCambioAnual', () => {
  it('compara el valor más reciente con el último de un año anterior', () => {
    expect(
      calcularCambioAnual([
        { fecha: '2024-06', valor: 240000 },
        { fecha: '2026-06', valor: 250000 },
      ]),
    ).toBe(10000);
  });

  it('devuelve null con menos de dos valoraciones', () => {
    expect(calcularCambioAnual([{ fecha: '2026-06', valor: 250000 }])).toBeNull();
  });

  it('devuelve null si todas las valoraciones son del mismo año', () => {
    expect(
      calcularCambioAnual([
        { fecha: '2026-01', valor: 240000 },
        { fecha: '2026-06', valor: 250000 },
      ]),
    ).toBeNull();
  });
});

describe('ValorHoyHero', () => {
  it('muestra valor, variación del año y revalorización', () => {
    render(
      <ValorHoyHero
        valorActual={250000}
        fechaEtiqueta="jun 2026"
        revalorizacionPct={233}
        cambioAnual={10000}
      />,
    );
    expect(screen.getByText(/Valor hoy · jun 2026/)).toBeInTheDocument();
    expect(screen.getByText(/este año/)).toBeInTheDocument();
    expect(screen.getByText(/s\/ coste de compra/)).toBeInTheDocument();
    expect(screen.getByText(/233 %/)).toBeInTheDocument();
  });

  it('sin cambio anual solo muestra la revalorización', () => {
    render(
      <ValorHoyHero
        valorActual={250000}
        fechaEtiqueta="jun 2026"
        revalorizacionPct={12}
        cambioAnual={null}
      />,
    );
    expect(screen.queryByText(/este año/)).not.toBeInTheDocument();
    expect(screen.getByText(/s\/ coste de compra/)).toBeInTheDocument();
  });

  it('sin valoración muestra el estado vacío', () => {
    render(
      <ValorHoyHero
        valorActual={null}
        fechaEtiqueta={null}
        revalorizacionPct={null}
        cambioAnual={null}
      />,
    );
    expect(screen.getByText('Valor hoy')).toBeInTheDocument();
    expect(screen.getByText(/Sin valoración registrada/i)).toBeInTheDocument();
  });
});
