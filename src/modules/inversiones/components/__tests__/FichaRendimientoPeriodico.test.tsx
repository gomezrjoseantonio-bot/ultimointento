// INVERSIONES V1 · Fase 3 · FichaRendimientoPeriodico · ficha detalle V5
// (préstamos / depósitos). Smoke del layout v10: hero + card "Renta" +
// card "La ficha" con calendario de cobros. Los cobros son SOLO LECTURA:
// no hay botón de "registrar cobro"; sí Editar y Eliminar.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import FichaRendimientoPeriodico from '../FichaRendimientoPeriodico';
import type { PosicionInversion } from '../../../../types/inversiones';

const ANIO = new Date().getFullYear();

const basePosicion = {
  id: 3,
  nombre: 'Préstamo a mis padres',
  tipo: 'prestamo_p2p',
  entidad: 'Padres',
  valor_actual: 30000,
  fecha_valoracion: `${ANIO}-01-15T12:00:00.000Z`,
  aportaciones: [],
  total_aportado: 30000,
  rentabilidad_euros: 0,
  rentabilidad_porcentaje: 0,
  fecha_compra: `${ANIO}-01-15T12:00:00.000Z`,
  duracion_meses: 36,
  subtipo_prestamo: 'familiar' as const,
  modalidad_devolucion: 'solo_intereses' as const,
  frecuencia_cobro: 'trimestral' as const,
  retencion_fiscal: 0,
  rendimiento: {
    tipo_rendimiento: 'interes_fijo',
    tasa_interes_anual: 4,
    frecuencia_pago: 'trimestral',
    meses_cobro: [4, 7, 10],
    dia_cobro: 15,
    fecha_inicio_rendimiento: `${ANIO}-01-15T12:00:00.000Z`,
    fecha_primer_cobro: `${ANIO}-04-15T12:00:00.000Z`,
    fecha_fin_rendimiento: `${ANIO + 3}-01-15T12:00:00.000Z`,
    reinvertir: false,
    pagos_generados: [],
  },
  activo: true,
  created_at: `${ANIO}-01-15T12:00:00.000Z`,
  updated_at: `${ANIO}-01-15T12:00:00.000Z`,
} as unknown as PosicionInversion;

const renderFicha = (posicion = basePosicion) => {
  const onEditar = jest.fn();
  const onEliminar = jest.fn();
  render(
    <FichaRendimientoPeriodico
      posicion={posicion}
      onBack={() => undefined}
      onEditar={onEditar}
      onEliminar={onEliminar}
    />,
  );
  return { onEditar, onEliminar };
};

describe('FichaRendimientoPeriodico · v10', () => {
  it('pinta el hero de detalle con nombre y card "La ficha"', () => {
    renderFicha();
    expect(screen.getByText(/Préstamo a mis padres/)).toBeInTheDocument();
    expect(screen.getByText('La ficha')).toBeInTheDocument();
    expect(screen.getByText(`Cobros de ${ANIO}`)).toBeInTheDocument();
  });

  it('deja editar y eliminar, pero no registrar cobros a mano', () => {
    const { onEditar, onEliminar } = renderFicha();

    // Cobros SOLO LECTURA: se prevén en Tesorería y se puntean allí.
    expect(screen.queryByRole('button', { name: /Registrar cobro/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onEditar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Eliminar/ }));
    expect(onEliminar).toHaveBeenCalledTimes(1);
  });

  it('etiqueta el préstamo por su subtipo en el eyebrow', () => {
    renderFicha();
    expect(screen.getByText(/Préstamo a familiar/)).toBeInTheDocument();
  });

  it('muestra "Capital prestado" en un préstamo solo-intereses', () => {
    renderFicha();
    expect(screen.getByText('Capital prestado')).toBeInTheDocument();
    expect(screen.getAllByText(/30\.000/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Capital pendiente')).not.toBeInTheDocument();
  });
});

describe('FichaRendimientoPeriodico · v10 · cuota francesa', () => {
  const amortizando = {
    ...basePosicion,
    modalidad_devolucion: 'capital_e_intereses' as const,
    frecuencia_cobro: 'mensual' as const,
    fecha_compra: `${ANIO - 2}-01-15T12:00:00.000Z`,
    rendimiento: {
      ...(basePosicion as unknown as { rendimiento: Record<string, unknown> }).rendimiento,
      frecuencia_pago: 'mensual',
      meses_cobro: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      fecha_primer_cobro: `${ANIO - 2}-02-15T12:00:00.000Z`,
      fecha_inicio_rendimiento: `${ANIO - 2}-01-15T12:00:00.000Z`,
    },
    duracion_meses: 60,
  } as unknown as PosicionInversion;

  it('muestra el capital pendiente (no el prestado) cuando amortiza', () => {
    renderFicha(amortizando);
    // Cuando amortiza, el hero conmuta a "Capital pendiente" y desaparece
    // "Capital prestado".
    expect(screen.getAllByText('Capital pendiente').length).toBeGreaterThan(0);
    expect(screen.queryByText('Capital prestado')).not.toBeInTheDocument();
  });
});
