import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ComposicionPatrimonioNeto, {
  derivarComposicion,
} from '../ComposicionPatrimonioNeto';

const importe = (m: ReturnType<typeof derivarComposicion>, key: string): number =>
  m.segmentos.find((s) => s.key === key)?.amount ?? NaN;

describe('derivarComposicion', () => {
  it('cumple la identidad cash + amortizada + revalorización = patrimonio neto', () => {
    const modelo = derivarComposicion({
      costeAdquisicion: 200000,
      valorActual: 250000,
      deudaPendiente: 148000,
      patrimonioNeto: 102000,
      revalorizacion: 50000,
      principalInicialTotal: 160000,
    });

    expect(importe(modelo, 'cash')).toBe(40000);
    expect(importe(modelo, 'amortizada')).toBe(12000);
    expect(importe(modelo, 'revalorizacion')).toBe(50000);
    expect(importe(modelo, 'deudaPendiente')).toBe(148000);

    const suma =
      importe(modelo, 'cash') + importe(modelo, 'amortizada') + importe(modelo, 'revalorizacion');
    expect(suma).toBe(modelo.patrimonioNeto);
    expect(modelo.valorTotal).toBe(250000);
    expect(modelo.netoPct).toBe(41); // round(102000 / 250000 * 100)
    expect(modelo.sinValoracion).toBe(false);
    expect(modelo.hayMinusvalia).toBe(false);
  });

  it('sin valoración · revalorización desconocida (0) y neto sobre coste', () => {
    const modelo = derivarComposicion({
      costeAdquisicion: 200000,
      valorActual: null,
      deudaPendiente: 148000,
      patrimonioNeto: 52000,
      revalorizacion: null,
      principalInicialTotal: 160000,
    });

    expect(modelo.sinValoracion).toBe(true);
    expect(importe(modelo, 'revalorizacion')).toBe(0);
    expect(importe(modelo, 'cash') + importe(modelo, 'amortizada')).toBe(modelo.patrimonioNeto);
  });

  it('detecta minusvalía cuando el valor cae por debajo del coste', () => {
    const modelo = derivarComposicion({
      costeAdquisicion: 200000,
      valorActual: 180000,
      deudaPendiente: 0,
      patrimonioNeto: 180000,
      revalorizacion: -20000,
      principalInicialTotal: 0,
    });

    expect(modelo.hayMinusvalia).toBe(true);
    expect(importe(modelo, 'revalorizacion')).toBe(-20000);
  });
});

describe('ComposicionPatrimonioNeto', () => {
  it('renderiza la barra, la cabecera del neto y la leyenda completa', () => {
    render(
      <ComposicionPatrimonioNeto
        costeAdquisicion={200000}
        valorActual={250000}
        deudaPendiente={148000}
        patrimonioNeto={102000}
        revalorizacion={50000}
        principalInicialTotal={160000}
      />,
    );

    expect(
      screen.getByRole('img', { name: /composición del patrimonio neto/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/de qué se compone/i)).toBeInTheDocument();
    expect(screen.getByText(/41 %/)).toBeInTheDocument();
    // los cuatro orígenes aparecen en la leyenda
    expect(screen.getAllByText('Cash aportado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Deuda amortizada')).toBeInTheDocument();
    expect(screen.getAllByText('Revalorización').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Deuda pendiente').length).toBeGreaterThanOrEqual(1);
  });

  it('sin financiación oculta deuda amortizada y pendiente', () => {
    render(
      <ComposicionPatrimonioNeto
        costeAdquisicion={200000}
        valorActual={250000}
        deudaPendiente={0}
        patrimonioNeto={250000}
        revalorizacion={50000}
        principalInicialTotal={0}
      />,
    );

    expect(screen.getAllByText('Cash aportado').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Deuda amortizada')).not.toBeInTheDocument();
    expect(screen.queryByText('Deuda pendiente')).not.toBeInTheDocument();
  });
});
