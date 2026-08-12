import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import HistoricoValoracionesChart from '../HistoricoValoracionesChart';

describe('HistoricoValoracionesChart', () => {
  it('no renderiza nada sin puntos válidos', () => {
    const { container } = render(<HistoricoValoracionesChart puntos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('dibuja la gráfica con la parte real y la proyección etiquetada como supuesto', () => {
    render(
      <HistoricoValoracionesChart
        puntos={[
          { fecha: '2022-01', valor: 200000 },
          { fecha: '2024-06', valor: 250000 },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: /evolución del valor/i })).toBeInTheDocument();
    expect(screen.getByText('realidad')).toBeInTheDocument();
    // proyección aparece en leyenda y en el pie
    expect(screen.getByText(/proyección a 5 años/i)).toBeInTheDocument();
    expect(screen.getByText(/supuesto de revalorización/i)).toBeInTheDocument();
    expect(screen.getByText(/hoy/i)).toBeInTheDocument();
  });

  it('omite la proyección cuando aniosProyeccion es 0', () => {
    render(
      <HistoricoValoracionesChart
        puntos={[{ fecha: '2023-01', valor: 100000 }]}
        aniosProyeccion={0}
      />,
    );
    expect(screen.getByRole('img', { name: /evolución del valor/i })).toBeInTheDocument();
    expect(screen.queryByText(/supuesto de revalorización/i)).not.toBeInTheDocument();
  });
});
