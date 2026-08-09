import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import RentabilidadInmueble from '../RentabilidadInmueble';

describe('RentabilidadInmueble', () => {
  it('muestra la rentabilidad bruta cuando hay datos disponibles', () => {
    render(
      <RentabilidadInmueble
        rentaMensual={1000}
        valorAdquisicion={200000}
      />,
    );
    expect(screen.getByText(/Rentabilidad bruta/i)).toBeInTheDocument();
    expect(screen.getByText(/6.00 %/i)).toBeInTheDocument();
  });

  it('marca como no disponible cuando falta valor de adquisición', () => {
    render(
      <RentabilidadInmueble
        rentaMensual={1000}
        valorAdquisicion={0}
      />,
    );
    expect(screen.getAllByText(/No disponible/i).length).toBeGreaterThan(0);
  });

  it('muestra gastos previstos con badge estimado', () => {
    render(
      <RentabilidadInmueble
        rentaMensual={1000}
        valorAdquisicion={200000}
        gastosPrevistos={3600}
      />,
    );
    expect(screen.getByText(/≈ Previstos/i)).toBeInTheDocument();
  });

  it('muestra "Sin contrato activo" cuando renta mensual es 0', () => {
    render(
      <RentabilidadInmueble
        rentaMensual={0}
        valorAdquisicion={200000}
      />,
    );
    expect(screen.getByText(/Sin contrato activo/i)).toBeInTheDocument();
  });
});
