import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ResumenCockpitInmueble from '../ResumenCockpitInmueble';
import type { PatrimonioInmuebleResumen } from '../../adapters/patrimonioInmuebleAdapter';

const baseResumen = (over: Partial<PatrimonioInmuebleResumen> = {}): PatrimonioInmuebleResumen => ({
  costeAdquisicion: 75000,
  valorActual: 250000,
  fechaValorActual: '2026-06',
  deudaPendiente: 48000,
  tieneFinanciacion: true,
  patrimonioNeto: 202000,
  patrimonioNetoEsEstimado: false,
  revalorizacion: 175000,
  revalorizacionPct: 233,
  mejorasAcumuladas: 5000,
  mobiliarioAcumulado: 1200,
  ltv: 19,
  financiacion: [
    {
      id: 'prestamo_1',
      nombre: 'Hipoteca Unicaja',
      deudaPendiente: 48000,
      principalInicial: 60000,
      cuotaMensual: 455,
      porcentajeAfectacion: 100,
    },
  ],
  historicoValoraciones: [
    { fecha: '2022-01', valor: 75000 },
    { fecha: '2026-06', valor: 250000 },
  ],
  ...over,
});

describe('ResumenCockpitInmueble', () => {
  it('muestra el valor de hoy, el patrimonio neto y su composición', () => {
    render(
      <ResumenCockpitInmueble
        resumen={baseResumen()}
        gananciaAcumulada={{ rentasAcumuladas: 25000, desdeAnio: 2022 }}
        costePropiedad={{ hipoteca: 455, mantenimiento: 154, explotacion: 54 }}
      />,
    );
    expect(screen.getByText(/Valor hoy/)).toBeInTheDocument();
    // El patrimonio neto se anuncia en la barra apilada del feature.
    expect(screen.getByText(/Patrimonio neto ·/)).toBeInTheDocument();
    // La leyenda de composición cita sus cuatro orígenes.
    expect(screen.getByText('Cash aportado')).toBeInTheDocument();
    expect(screen.getAllByText('Revalorización').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra los tres KPIs patrimoniales con sus cifras', () => {
    render(
      <ResumenCockpitInmueble
        resumen={baseResumen()}
        gananciaAcumulada={{ rentasAcumuladas: 25000, desdeAnio: 2022 }}
        costePropiedad={{ hipoteca: 455, mantenimiento: 154, explotacion: 54 }}
      />,
    );
    expect(screen.getByText('Ganancia acumulada')).toBeInTheDocument();
    expect(screen.getByText('Coste de propiedad')).toBeInTheDocument();
    expect(screen.getByText('Financiación')).toBeInTheDocument();
    expect(screen.getByText('Hipoteca Unicaja')).toBeInTheDocument();
    expect(screen.getByText(/LTV 19 %/)).toBeInTheDocument();
    expect(screen.getByText(/\/mes/)).toBeInTheDocument();
  });

  it('invoca ver préstamo desde el KPI de financiación', () => {
    const onVerFinanciacion = jest.fn();
    render(
      <ResumenCockpitInmueble
        resumen={baseResumen()}
        onVerFinanciacion={onVerFinanciacion}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /ver préstamo/i }));
    expect(onVerFinanciacion).toHaveBeenCalledWith('prestamo_1');
  });

  it('sin valoración muestra el estado vacío del valor y del chart', () => {
    render(
      <ResumenCockpitInmueble
        resumen={baseResumen({
          valorActual: null,
          fechaValorActual: null,
          revalorizacion: null,
          revalorizacionPct: null,
          historicoValoraciones: [],
        })}
        onImportarValoraciones={jest.fn()}
      />,
    );
    expect(screen.getByText(/Sin valoración registrada/i)).toBeInTheDocument();
    expect(screen.getByText(/Aún no hay valoraciones registradas/i)).toBeInTheDocument();
  });

  it('sin financiación indica 100 % en propiedad', () => {
    render(
      <ResumenCockpitInmueble
        resumen={baseResumen({ tieneFinanciacion: false, deudaPendiente: 0, financiacion: [], ltv: 0 })}
      />,
    );
    expect(screen.getByText(/100 % en propiedad/i)).toBeInTheDocument();
  });
});
