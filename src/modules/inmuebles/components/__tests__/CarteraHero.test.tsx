import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CarteraHero, { CarteraAgregados } from '../CarteraHero';

const base: CarteraAgregados = {
  valorTotal: 838000,
  baseCoste: 233000,
  revalorizacion: 605000,
  revalorizacionPct: 260,
  deuda: 150679,
  patrimonioNeto: 687321,
  ltv: 18,
  rentaMensualTotal: 2865,
  enAlquiler: 3,
};

describe('CarteraHero', () => {
  it('pinta el valor total, la base y los sub-KPIs agregados', () => {
    render(<CarteraHero agregados={base} />);
    expect(screen.getByText('Mi cartera inmobiliaria')).toBeInTheDocument();
    // Valor total (bignum) y base coste
    expect(screen.getAllByText(/838\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/233\.000/).length).toBeGreaterThan(0);
    // Sub-KPIs
    expect(screen.getByText(/687\.321/)).toBeInTheDocument(); // patrimonio neto
    expect(screen.getByText(/150\.679/)).toBeInTheDocument(); // deuda
    expect(screen.getByText(/LTV 18\s?%/)).toBeInTheDocument();
    expect(screen.getByText(/\+260\s?%/)).toBeInTheDocument(); // revalorización media
    // Proyección
    expect(screen.getByText(/Proyección del valor/)).toBeInTheDocument();
    expect(screen.getByText(/supuesto de/)).toBeInTheDocument();
  });

  it('degrada a un aviso cuando no hay valoraciones (valorTotal 0)', () => {
    render(
      <CarteraHero
        agregados={{
          ...base,
          valorTotal: 0,
          baseCoste: 0,
          revalorizacion: 0,
          revalorizacionPct: null,
          deuda: 0,
          patrimonioNeto: 0,
          ltv: null,
        }}
      />,
    );
    expect(screen.getByText(/añade una valoración/i)).toBeInTheDocument();
    // LTV sin valor → guion
    expect(screen.getByText(/LTV —/)).toBeInTheDocument();
  });
});
