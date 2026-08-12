import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import CosteDePropiedadCard from '../CosteDePropiedadCard';

describe('CosteDePropiedadCard', () => {
  it('desglosa hipoteca + mantenimiento + explotación y anualiza', () => {
    render(<CosteDePropiedadCard hipoteca={455} mantenimiento={154} explotacion={54} />);
    expect(screen.getByText('Coste de propiedad')).toBeInTheDocument();
    expect(screen.getByText('/mes')).toBeInTheDocument();
    expect(screen.getByText('hipoteca')).toBeInTheDocument();
    expect(screen.getByText('manten.')).toBeInTheDocument();
    expect(screen.getByText('explot.')).toBeInTheDocument();
    expect(screen.getByText(/\/año/)).toBeInTheDocument();
  });

  it('omite los componentes a cero', () => {
    render(<CosteDePropiedadCard hipoteca={600} mantenimiento={0} explotacion={0} />);
    expect(screen.getByText('hipoteca')).toBeInTheDocument();
    expect(screen.queryByText('manten.')).not.toBeInTheDocument();
    expect(screen.queryByText('explot.')).not.toBeInTheDocument();
  });
});
