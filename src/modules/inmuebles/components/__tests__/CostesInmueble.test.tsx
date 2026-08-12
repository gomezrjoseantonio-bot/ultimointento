import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CostesInmueble from '../CostesInmueble';

describe('CostesInmueble', () => {
  it('muestra la cabecera, las 4 cards de grupo y el toggle Previsto/Real', () => {
    render(<CostesInmueble inmuebleId={1} />);
    expect(screen.getByText('Coste de propiedad')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento')).toBeInTheDocument();
    expect(screen.getByText('Explotación')).toBeInTheDocument();
    expect(screen.getByText('Mejoras')).toBeInTheDocument();
    expect(screen.getByText('Mobiliario')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Previsto$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Real$/ })).toBeInTheDocument();
  });

  it('cambia a la vista Real al pulsar el toggle', () => {
    render(<CostesInmueble inmuebleId={1} />);
    fireEvent.click(screen.getByRole('button', { name: /^Real$/ }));
    expect(screen.getByText(/agrupados por concepto/i)).toBeInTheDocument();
  });

  it('filtra por grupo al pulsar una card y permite quitar el filtro', () => {
    render(<CostesInmueble inmuebleId={1} />);
    fireEvent.click(screen.getByText('Explotación'));
    expect(screen.getByText(/Grupo · Explotación/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quitar filtro/i }));
    expect(screen.getByText('Todos los grupos')).toBeInTheDocument();
  });

  it('invoca nuevo recurrente', () => {
    const onNuevo = jest.fn();
    render(<CostesInmueble inmuebleId={1} onNuevoRecurrente={onNuevo} />);
    fireEvent.click(screen.getByRole('button', { name: /Nuevo recurrente/i }));
    expect(onNuevo).toHaveBeenCalled();
  });
});
