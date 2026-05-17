// Smoke test · VenderModal · PR 4 T-INVERSIONES-V5
// Cobertura mínima (spec §11.1 PR 4) · preview FIFO con datos mock.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import VenderModal from '../VenderModal';
import type { PosicionInversion } from '../../../../../types/inversiones';

jest.mock('../../../../../services/cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: jest.fn() };
});

// Posición con una aportación inicial conocida · FIFO sobre ella.
const mockPosicion: PosicionInversion = {
  id: 1,
  nombre: 'iShares Core S&P',
  tipo: 'etf',
  entidad: 'DEGIRO',
  valor_actual: 12_000,
  fecha_valoracion: '2026-01-01T12:00:00.000Z',
  fecha_compra: '2024-01-15T12:00:00.000Z',
  total_aportado: 10_000,
  rentabilidad_euros: 2_000,
  rentabilidad_porcentaje: 20,
  numero_participaciones: 100,
  precio_medio_compra: 100,
  aportaciones: [
    {
      id: 100,
      fecha: '2024-01-15T12:00:00.000Z',
      tipo: 'aportacion',
      importe: 10_000,
      unidades: 100,
      precioUnitario: 100,
    },
  ],
  activo: true,
  created_at: '2024-01-15T12:00:00.000Z',
  updated_at: '2024-01-15T12:00:00.000Z',
};

describe('VenderModal · preview FIFO', () => {
  it('renderiza header · form de venta · preview FIFO con valores iniciales 0', () => {
    render(<VenderModal posicion={mockPosicion} onSave={() => undefined} onClose={() => undefined} />);

    expect(screen.getByText('Venta / rescate')).toBeInTheDocument();
    expect(screen.getByText(/iShares Core S&P · DEGIRO/)).toBeInTheDocument();
    // Preview header
    expect(screen.getByText(/Cálculo FIFO/i)).toBeInTheDocument();
    // Sin importe · valores 0
    expect(screen.getAllByText(/0\s*€/).length).toBeGreaterThan(0);
  });

  it('calcula FIFO en vivo · vender 50 unidades por 6.000 € → ganancia 1.000 €', () => {
    render(<VenderModal posicion={mockPosicion} onSave={() => undefined} onClose={() => undefined} />);

    // Importe a recibir · 6000 €
    fireEvent.change(screen.getByLabelText(/Importe a recibir/), {
      target: { value: '6000' },
    });
    // Unidades vendidas · 50 de las 100 (precio medio 100 €)
    fireEvent.change(screen.getByLabelText(/Unidades vendidas/), {
      target: { value: '50' },
    });

    // Coste FIFO = 50 × 100 = 5.000 €
    expect(screen.getAllByText(/5\.?000\s*€/).length).toBeGreaterThan(0);
    // Ganancia = 6000 - 5000 = 1.000 €
    expect(screen.getAllByText(/1\.?000\s*€/).length).toBeGreaterThan(0);
    // Retención 19% sobre ganancia 1000 = 190 €
    expect(screen.getAllByText(/190\s*€/).length).toBeGreaterThan(0);
    // Neto = 6000 - 190 = 5.810 €
    expect(screen.getAllByText(/5\.?810\s*€/).length).toBeGreaterThan(0);
  });

  it('cancelar dispara onClose', () => {
    const onClose = jest.fn();
    render(<VenderModal posicion={mockPosicion} onSave={() => undefined} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama onSave con tipo=reembolso al rellenar campos requeridos', async () => {
    const onSave = jest.fn();
    render(<VenderModal posicion={mockPosicion} onSave={onSave} onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/Importe a recibir/), {
      target: { value: '6000' },
    });
    fireEvent.change(screen.getByLabelText(/Unidades vendidas/), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Registrar venta/ }));

    await new Promise((r) => setTimeout(r, 50));
    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.tipo).toBe('reembolso');
    expect(arg.importe).toBe(6000);
    expect(arg.unidades_vendidas).toBe(50);
  });
});
