// FichaRendimientoPeriodico · ficha detalle de préstamos y depósitos.
// Cobertura · barra de acciones (registrar cobro + editar) y calendario que
// respeta la fecha a partir de la cual se reciben los intereses.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
  const onRegistrarCobro = jest.fn();
  render(
    <FichaRendimientoPeriodico
      posicion={posicion}
      onBack={() => undefined}
      onEditar={onEditar}
      onRegistrarCobro={onRegistrarCobro}
    />,
  );
  return { onEditar, onRegistrarCobro };
};

/** Devuelve el importe pintado en la celda del mes (ENE, FEB…). */
const importeMes = (mes: string): string => {
  const celda = screen.getByText(mes).closest('div')?.parentElement;
  return within(celda as HTMLElement).getAllByText(/./)[1]?.textContent ?? '';
};

describe('FichaRendimientoPeriodico', () => {
  it('expone las acciones de registrar cobro y editar préstamo', () => {
    const { onEditar, onRegistrarCobro } = renderFicha();

    fireEvent.click(screen.getByRole('button', { name: /Registrar cobro/ }));
    expect(onRegistrarCobro).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Editar préstamo/ }));
    expect(onEditar).toHaveBeenCalledTimes(1);
  });

  it('etiqueta el préstamo por su subtipo', () => {
    renderFicha();
    expect(screen.getByText(/Préstamo a familiar/)).toBeInTheDocument();
  });

  it('resume el calendario con la fecha desde la que se cobran intereses', () => {
    renderFicha();
    expect(screen.getByText(/3 cuotas de/)).toBeInTheDocument();
    expect(screen.getByText(/intereses desde/)).toBeInTheDocument();
  });

  it('no pinta cuota en los meses sin cobro ni antes del primer cobro', () => {
    renderFicha();
    // Enero/febrero/marzo caen antes del primer cobro (abril) → sin importe.
    expect(importeMes('ENE')).toBe('—');
    expect(importeMes('MAR')).toBe('—');
    // Mayo no está en la frecuencia trimestral [4, 7, 10] → sin importe.
    expect(importeMes('MAY')).toBe('—');
    // Abril, julio y octubre sí tienen cuota.
    expect(importeMes('ABR')).not.toBe('—');
    expect(importeMes('JUL')).not.toBe('—');
    expect(importeMes('OCT')).not.toBe('—');
  });

  it('explica que un particular no practica retención cuando es 0', () => {
    renderFicha();
    expect(screen.getByText(/no practica retención/)).toBeInTheDocument();
  });

  it('mantiene el aviso de retención estándar en préstamos con retención', () => {
    renderFicha({
      ...basePosicion,
      subtipo_prestamo: 'p2p',
      retencion_fiscal: 19,
    } as PosicionInversion);
    expect(screen.getByText(/tributan con retención del/)).toBeInTheDocument();
  });
});
