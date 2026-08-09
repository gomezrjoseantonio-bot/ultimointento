import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import RentabilidadInmueble from '../RentabilidadInmueble';
import type { RentabilidadInmuebleResumen } from '../../adapters/rentabilidadInmuebleAdapter';

const base = (over: Partial<RentabilidadInmuebleResumen> = {}): RentabilidadInmuebleResumen => ({
  ejercicio: 2026,
  ingresosPrevistos: 12000,
  ingresosCobrados: 9000,
  gastosPrevistos: 3000,
  gastosPagados: 2500,
  resultadoOperativoEstimado: 9000,
  resultadoOperativoReal: 6500,
  rentabilidadBruta: { valor: 4.5, etiqueta: 'real' },
  rentabilidadNeta: { valor: 3.25, etiqueta: 'real' },
  cuotaPrestamoAnual: 7800,
  cashflowEstimado: 1200,
  cashflowReal: -1300,
  ...over,
});

describe('RentabilidadInmueble', () => {
  it('muestra el ejercicio y las secciones de ingresos, gastos, resultado, rentabilidad y cashflow', () => {
    render(<RentabilidadInmueble resumen={base()} />);
    expect(screen.getByText(/Rentabilidad del activo · 2026/i)).toBeInTheDocument();
    expect(screen.getByText('Ingresos (anuales)')).toBeInTheDocument();
    expect(screen.getByText('Gastos de explotación (anuales)')).toBeInTheDocument();
    expect(screen.getByText('Resultado operativo (anual)')).toBeInTheDocument();
    expect(screen.getByText('Rentabilidad')).toBeInTheDocument();
    expect(screen.getByText(/Cashflow/i)).toBeInTheDocument();
  });

  it('etiqueta cobrados/pagados como Real y previstos con ≈ Previsto', () => {
    render(<RentabilidadInmueble resumen={base()} />);
    expect(screen.getAllByText('Real').length).toBeGreaterThan(0);
    expect(screen.getAllByText('≈ Previsto').length).toBeGreaterThan(0);
    expect(screen.getByText('4.50 %')).toBeInTheDocument();
    expect(screen.getByText('3.25 %')).toBeInTheDocument();
  });

  it('marca No disponible cuando faltan datos reales', () => {
    render(
      <RentabilidadInmueble
        resumen={base({
          ingresosCobrados: undefined,
          gastosPagados: undefined,
          resultadoOperativoReal: undefined,
          cashflowReal: undefined,
          rentabilidadBruta: { valor: 6, etiqueta: 'previsto' },
          rentabilidadNeta: { valor: 4.5, etiqueta: 'estimado' },
        })}
      />,
    );
    expect(screen.getByText('Sin cobros en Tesorería')).toBeInTheDocument();
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);
    expect(screen.getAllByText('≈ Estimado').length).toBeGreaterThan(0);
  });
});
