// INVERSIONES V1 · Fase 3 · FichaDividendos · ficha detalle V5 (acción/ETF/REIT).
// Smoke del layout v10: hero + card "Cotización" + card "La ficha".
// Los dividendos son SOLO LECTURA; las acciones son Vender / Editar / Eliminar.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import FichaDividendos from '../FichaDividendos';
import type { PosicionInversion } from '../../../../types/inversiones';

const ANIO = new Date().getFullYear();

const basePosicion = {
  id: 7,
  nombre: 'Orange',
  tipo: 'accion',
  entidad: 'BNP Paribas',
  ticker: 'ORA',
  isin: 'FR0000133308',
  valor_actual: 17500,
  fecha_valoracion: `${ANIO}-01-15T12:00:00.000Z`,
  numero_participaciones: 100,
  precio_medio_compra: 150,
  total_aportado: 15000,
  rentabilidad_euros: 2500,
  rentabilidad_porcentaje: 16.7,
  fecha_compra: `${ANIO - 3}-01-15T12:00:00.000Z`,
  aportaciones: [
    { id: 1, fecha: `${ANIO - 3}-01-15T12:00:00.000Z`, importe: 15000, tipo: 'aportacion', unidades: 100 },
    { id: 2, fecha: `${ANIO - 2}-06-10T12:00:00.000Z`, importe: 300, tipo: 'dividendo' },
    { id: 3, fecha: `${ANIO - 1}-06-10T12:00:00.000Z`, importe: 320, tipo: 'dividendo' },
  ],
  activo: true,
  created_at: `${ANIO - 3}-01-15T12:00:00.000Z`,
  updated_at: `${ANIO}-01-15T12:00:00.000Z`,
} as unknown as PosicionInversion;

const renderFicha = (posicion = basePosicion) => {
  const onVender = jest.fn();
  const onEditar = jest.fn();
  const onEliminar = jest.fn();
  render(
    <FichaDividendos
      posicion={posicion}
      onBack={() => undefined}
      onVender={onVender}
      onEditar={onEditar}
      onEliminar={onEliminar}
    />,
  );
  return { onVender, onEditar, onEliminar };
};

describe('FichaDividendos · v10', () => {
  it('pinta el hero de detalle y las 2 cards', () => {
    renderFicha();
    expect(screen.getByText(/Orange/)).toBeInTheDocument();
    expect(screen.getByText('Cotización · frente a tu precio medio')).toBeInTheDocument();
    expect(screen.getByText('La ficha')).toBeInTheDocument();
    // "Plusvalía latente" aparece en la caja y en la fila de "La ficha".
    expect(screen.getAllByText('Plusvalía latente').length).toBeGreaterThan(0);
  });

  it('cablea Vender, Editar y Eliminar', () => {
    const { onVender, onEditar, onEliminar } = renderFicha();
    fireEvent.click(screen.getByRole('button', { name: 'Vender' }));
    expect(onVender).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onEditar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Eliminar/ }));
    expect(onEliminar).toHaveBeenCalledTimes(1);
  });

  it('muestra los dividendos por año agregados', () => {
    renderFicha();
    expect(screen.getByText('Dividendos por año')).toBeInTheDocument();
  });
});
