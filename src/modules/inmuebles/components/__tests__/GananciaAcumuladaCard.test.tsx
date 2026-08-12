import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import GananciaAcumuladaCard from '../GananciaAcumuladaCard';

describe('GananciaAcumuladaCard', () => {
  it('suma revalorización y rentas declaradas, con año de arranque', () => {
    render(
      <GananciaAcumuladaCard
        revalorizacion={175000}
        rentasAcumuladas={25000}
        costeBase={75000}
        desdeAnio={2022}
      />,
    );
    expect(screen.getByText('Ganancia acumulada')).toBeInTheDocument();
    expect(screen.getByText('reval.')).toBeInTheDocument();
    expect(screen.getByText('rentas')).toBeInTheDocument();
    expect(screen.getByText(/de coste/i)).toBeInTheDocument();
    expect(screen.getByText(/desde 2022/)).toBeInTheDocument();
  });

  it('sin valoración omite la revalorización y muestra solo rentas', () => {
    render(
      <GananciaAcumuladaCard revalorizacion={null} rentasAcumuladas={4200} costeBase={90000} />,
    );
    expect(screen.queryByText('reval.')).not.toBeInTheDocument();
    expect(screen.getByText('rentas')).toBeInTheDocument();
    // sin desdeAnio no se muestra el sufijo
    expect(screen.queryByText(/desde/)).not.toBeInTheDocument();
  });

  it('sin rentas declaradas muestra solo la revalorización', () => {
    render(
      <GananciaAcumuladaCard revalorizacion={30000} rentasAcumuladas={0} costeBase={100000} />,
    );
    expect(screen.getByText('reval.')).toBeInTheDocument();
    expect(screen.queryByText('rentas')).not.toBeInTheDocument();
  });
});
