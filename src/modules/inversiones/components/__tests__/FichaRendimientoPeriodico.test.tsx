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
  render(
    <FichaRendimientoPeriodico
      posicion={posicion}
      onBack={() => undefined}
      onEditar={onEditar}
    />,
  );
  return { onEditar };
};

/** Devuelve el importe pintado en la celda del mes (ENE, FEB…). */
const importeMes = (mes: string): string => {
  const celda = screen.getByText(mes).closest('div')?.parentElement;
  return within(celda as HTMLElement).getAllByText(/./)[1]?.textContent ?? '';
};

describe('FichaRendimientoPeriodico', () => {
  it('deja editar el préstamo pero no registrar cobros a mano', () => {
    const { onEditar } = renderFicha();

    // Los cobros se prevén en Tesorería y se dan por cobrados al puntearlos.
    expect(screen.queryByRole('button', { name: /Registrar cobro/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Editar préstamo/ }));
    expect(onEditar).toHaveBeenCalledTimes(1);
  });

  it('muestra el cuadro de cuotas con su estado en vez de un histórico vacío', () => {
    renderFicha();
    expect(screen.getByText('Cuadro de cuotas')).toBeInTheDocument();
    expect(screen.getByText(/aquí no se registran cobros a mano/)).toBeInTheDocument();
    // Cuotas ya vencidas y cuotas por venir, ambas visibles.
    expect(screen.getAllByText('Vencida · por puntear').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prevista').length).toBeGreaterThan(0);
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

describe('FichaRendimientoPeriodico · cuota francesa', () => {
  // Firmado hace 2 años · 30.000 € al 3,25% a 60 meses · cuota mensual.
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

  it('muestra el capital pendiente, no el prestado', () => {
    renderFicha(amortizando);

    const capital = screen.getByText('Capital pendiente').parentElement as HTMLElement;
    const pendiente = capital.textContent ?? '';
    expect(pendiente).not.toContain('30.000');

    // Y el prestado sigue visible en el resumen de la operación.
    const prestado = screen.getByText('Capital prestado').parentElement as HTMLElement;
    expect(prestado.textContent).toContain('30.000');
  });

  it('desglosa capital amortizado y pendiente hoy', () => {
    renderFicha(amortizando);
    expect(screen.getByText(/Capital amortizado ·/)).toBeInTheDocument();
    expect(screen.getByText('Capital pendiente hoy')).toBeInTheDocument();
    expect(screen.getByText('Intereses cobrados hasta hoy')).toBeInTheDocument();
  });

  it('la cuota incluye capital + intereses y el capital vuelve a caja', () => {
    renderFicha(amortizando);
    expect(screen.getByText(/capital \+ intereses · pendiente/)).toBeInTheDocument();
    expect(screen.getByText(/vuelve a caja en cada cuota/)).toBeInTheDocument();
  });

  it('un préstamo solo-intereses conserva el capital íntegro', () => {
    renderFicha();
    expect(screen.queryByText('Capital pendiente')).not.toBeInTheDocument();
    // 'Capital' también es una columna del cuadro · acotamos al stat del hero.
    const heroLabel = screen
      .getAllByText('Capital')
      .find((el) => el.className.includes('detailHeroStatLab'));
    expect(heroLabel?.parentElement?.textContent).toContain('30.000');
  });
});
