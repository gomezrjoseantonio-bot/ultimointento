import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PatrimonioResumenInmueble from '../PatrimonioResumenInmueble';
import type { PatrimonioInmuebleResumen } from '../../adapters/patrimonioInmuebleAdapter';

const baseResumen = (over: Partial<PatrimonioInmuebleResumen> = {}): PatrimonioInmuebleResumen => ({
  costeAdquisicion: 212000,
  valorActual: 240000,
  fechaValorActual: '2024-06',
  deudaPendiente: 120000,
  tieneFinanciacion: true,
  patrimonioNeto: 120000,
  patrimonioNetoEsEstimado: false,
  revalorizacion: 28000,
  revalorizacionPct: 13.2,
  mejorasAcumuladas: 5000,
  mobiliarioAcumulado: 1200,
  ltv: 50,
  financiacion: [
    {
      id: 'prestamo_1',
      nombre: 'Hipoteca BBVA',
      deudaPendiente: 120000,
      principalInicial: 160000,
      cuotaMensual: 650,
      porcentajeAfectacion: 100,
    },
  ],
  historicoValoraciones: [
    { fecha: '2024-06', valor: 240000 },
    { fecha: '2022-01', valor: 205000 },
  ],
  ...over,
});

describe('PatrimonioResumenInmueble', () => {
  it('muestra las magnitudes patrimoniales principales', () => {
    render(<PatrimonioResumenInmueble resumen={baseResumen()} />);
    // Coincidencia exacta · evita chocar con los subtítulos que citan las mismas palabras.
    expect(screen.getByText('Patrimonio neto')).toBeInTheDocument();
    expect(screen.getByText('Valor actual')).toBeInTheDocument();
    // «Deuda pendiente» y «Revalorización» también aparecen en la leyenda del
    // desglose de composición · basta con que estén presentes.
    expect(screen.getAllByText('Deuda pendiente').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Revalorización').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('LTV 50 %')).toBeInTheDocument();
  });

  it('lista la financiación vinculada', () => {
    render(<PatrimonioResumenInmueble resumen={baseResumen()} />);
    expect(screen.getByText('Hipoteca BBVA')).toBeInTheDocument();
  });

  it('marca el neto como estimado y oculta revalorización sin valoración', () => {
    render(
      <PatrimonioResumenInmueble
        resumen={baseResumen({
          valorActual: null,
          fechaValorActual: null,
          revalorizacion: null,
          revalorizacionPct: null,
          ltv: null,
          patrimonioNetoEsEstimado: true,
          historicoValoraciones: [],
        })}
      />,
    );
    expect(screen.getByText(/≈ Sobre coste/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin valoración registrada/i)).toBeInTheDocument();
    expect(screen.getByText(/Requiere una valoración/i)).toBeInTheDocument();
    expect(screen.getByText(/Aún no hay valoraciones registradas/i)).toBeInTheDocument();
  });

  it('invoca los callbacks de importar y ver financiación', () => {
    const onImportar = jest.fn();
    const onVerFinanciacion = jest.fn();
    render(
      <PatrimonioResumenInmueble
        resumen={baseResumen()}
        onImportarValoraciones={onImportar}
        onVerFinanciacion={onVerFinanciacion}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gestionar financiación/i }));
    expect(onVerFinanciacion).toHaveBeenCalledWith();

    fireEvent.click(screen.getByRole('button', { name: /Ver préstamo/i }));
    expect(onVerFinanciacion).toHaveBeenCalledWith('prestamo_1');

    fireEvent.click(screen.getByRole('button', { name: /Importar histórico/i }));
    expect(onImportar).toHaveBeenCalled();
  });

  it('muestra estado vacío cuando no hay financiación', () => {
    render(
      <PatrimonioResumenInmueble
        resumen={baseResumen({ tieneFinanciacion: false, deudaPendiente: 0, financiacion: [], ltv: 0 })}
      />,
    );
    expect(screen.getByText(/Sin financiación vinculada a este inmueble/i)).toBeInTheDocument();
  });
});
