// AltaPrestamoModal · alta + edición de préstamo
// Cobertura · tercera modalidad "A familiares" · fecha de inicio de intereses ·
// modo edición precargado.

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AltaPrestamoModal from '../AltaPrestamoModal';
import type { PosicionInversion } from '../../../../../types/inversiones';

jest.mock('../../../../../services/cuentasService', () => ({
  __esModule: true,
  cuentasService: {
    list: () =>
      Promise.resolve([
        { id: 1, alias: 'Cuenta principal', iban: 'ES1234', tipo: 'CORRIENTE' },
        { id: 2, alias: 'Cuenta ahorro', iban: 'ES5678', tipo: 'AHORRO' },
      ]),
  },
}));

jest.mock('../../../../../design-system/v5', () => {
  const actual = jest.requireActual('../../../../../design-system/v5');
  return { ...actual, showToastV5: jest.fn() };
});

const rellenarAlta = async () => {
  fireEvent.change(screen.getByPlaceholderText(/SmartFlip · 10% TIN/), {
    target: { value: 'Préstamo a mi hermano' },
  });
  fireEvent.change(screen.getByLabelText(/Plataforma|Empresa deudora|Familiar deudor/), {
    target: { value: 'Hermano' },
  });
  fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: '20000' } });
  fireEvent.change(screen.getByPlaceholderText('10.00'), { target: { value: '5' } });
  fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '24' } });
  // Dos CuentaSelect (cargo y cobro) · esperamos a que ambos carguen.
  await waitFor(() => {
    expect(screen.getAllByRole('option', { name: 'Cuenta principal' })).toHaveLength(2);
  });
  fireEvent.change(screen.getByLabelText(/Cuenta de cargo/) as HTMLSelectElement, {
    target: { value: '1' },
  });
};

describe('AltaPrestamoModal · alta', () => {
  it('ofrece las tres modalidades · P2P, empresa y familiares', () => {
    render(<AltaPrestamoModal onSave={() => undefined} onClose={() => undefined} />);

    expect(screen.getByText('Nuevo préstamo')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /P2P/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /A empresa/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /A familiares/ })).toBeInTheDocument();
  });

  it('pone la retención a 0 al elegir "A familiares" y renombra la contraparte', () => {
    render(<AltaPrestamoModal onSave={() => undefined} onClose={() => undefined} />);

    const retencion = screen.getByLabelText(/Retención/) as HTMLInputElement;
    expect(retencion.value).toBe('19');

    fireEvent.click(screen.getByRole('radio', { name: /A familiares/ }));

    expect((screen.getByLabelText(/Retención/) as HTMLInputElement).value).toBe('0');
    expect(screen.getByText(/Familiar deudor/)).toBeInTheDocument();
    expect(
      screen.getByText(/no practica retención · el cobro llega íntegro/),
    ).toBeInTheDocument();
  });

  it('propone "Intereses desde" un periodo después de la firma y lo guarda', async () => {
    const onSave = jest.fn();
    render(<AltaPrestamoModal onSave={onSave} onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('radio', { name: /A familiares/ }));
    fireEvent.change(screen.getByLabelText(/Fecha firma/), {
      target: { value: '2026-01-15' },
    });

    const intereses = screen.getByLabelText(/Intereses desde/) as HTMLInputElement;
    await waitFor(() => expect(intereses.value).toBe('2026-02-15'));

    await rellenarAlta();
    fireEvent.click(screen.getByRole('button', { name: /Crear préstamo/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const arg = onSave.mock.calls[0][0];
    expect(arg.tipo).toBe('prestamo_p2p');
    expect(arg.subtipo_prestamo).toBe('familiar');
    expect(arg.duracion_meses).toBe(24);
    expect(arg.retencion_fiscal).toBe(0);
    expect(arg.rendimiento.fecha_primer_cobro).toBe('2026-02-15T12:00:00.000Z');
    // El generador emite el primer pago un periodo después del devengo.
    expect(arg.rendimiento.fecha_inicio_rendimiento).toBe('2026-01-15T12:00:00.000Z');
    expect(arg.rendimiento.fecha_fin_rendimiento).toBe('2028-01-15T12:00:00.000Z');
    expect(arg.rendimiento.dia_cobro).toBe(15);
    expect(arg.rendimiento.meses_cobro).toHaveLength(12);
  });

  it('respeta una fecha de intereses elegida a mano · frecuencia trimestral', async () => {
    const onSave = jest.fn();
    render(<AltaPrestamoModal onSave={onSave} onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText(/Fecha firma/), {
      target: { value: '2026-01-15' },
    });
    fireEvent.change(screen.getByLabelText(/Frecuencia cobro/), {
      target: { value: 'trimestral' },
    });
    fireEvent.change(screen.getByLabelText(/Intereses desde/), {
      target: { value: '2026-07-10' },
    });

    await rellenarAlta();
    fireEvent.click(screen.getByRole('button', { name: /Crear préstamo/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const rendimiento = onSave.mock.calls[0][0].rendimiento;
    expect(rendimiento.fecha_primer_cobro).toBe('2026-07-10T12:00:00.000Z');
    expect(rendimiento.fecha_inicio_rendimiento).toBe('2026-04-10T12:00:00.000Z');
    expect(rendimiento.meses_cobro).toEqual([1, 4, 7, 10]);
    expect(rendimiento.dia_cobro).toBe(10);
  });
});

describe('AltaPrestamoModal · edición', () => {
  const posicion = {
    id: 7,
    nombre: 'Préstamo a mis padres',
    tipo: 'prestamo_p2p',
    entidad: 'Padres',
    valor_actual: 30000,
    fecha_valoracion: '2026-01-15T12:00:00.000Z',
    aportaciones: [
      {
        id: 1,
        fecha: '2026-01-15T12:00:00.000Z',
        importe: 30000,
        tipo: 'aportacion' as const,
        notas: 'Aportación inicial',
      },
    ],
    total_aportado: 30000,
    rentabilidad_euros: 0,
    rentabilidad_porcentaje: 0,
    fecha_compra: '2026-01-15T12:00:00.000Z',
    cuenta_cargo_id: 1,
    cuenta_cobro_id: 2,
    duracion_meses: 36,
    subtipo_prestamo: 'familiar' as const,
    modalidad_devolucion: 'solo_intereses' as const,
    frecuencia_cobro: 'trimestral' as const,
    retencion_fiscal: 0,
    rendimiento: {
      tipo_rendimiento: 'interes_fijo',
      tasa_interes_anual: 4,
      frecuencia_pago: 'trimestral',
      fecha_inicio_rendimiento: '2026-01-15T12:00:00.000Z',
      fecha_primer_cobro: '2026-04-15T12:00:00.000Z',
      reinvertir: false,
      pagos_generados: [{ id: 99 }],
    },
    activo: true,
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-01-15T12:00:00.000Z',
  } as unknown as PosicionInversion;

  it('precarga las condiciones existentes', async () => {
    render(
      <AltaPrestamoModal posicion={posicion} onSave={() => undefined} onClose={() => undefined} />,
    );

    expect(screen.getByText('Editar préstamo')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /A familiares/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect((screen.getByPlaceholderText(/SmartFlip · 10% TIN/) as HTMLInputElement).value).toBe(
      'Préstamo a mis padres',
    );
    expect((screen.getByPlaceholderText('10000') as HTMLInputElement).value).toBe('30000');
    expect((screen.getByPlaceholderText('10.00') as HTMLInputElement).value).toBe('4');
    expect((screen.getByPlaceholderText('60') as HTMLInputElement).value).toBe('36');
    expect((screen.getByLabelText(/Fecha firma/) as HTMLInputElement).value).toBe('2026-01-15');
    expect((screen.getByLabelText(/Intereses desde/) as HTMLInputElement).value).toBe(
      '2026-04-15',
    );
    await waitFor(() => {
      expect((screen.getByLabelText(/Cuenta de cargo/) as HTMLSelectElement).value).toBe('1');
    });
  });

  it('guarda los cambios conservando los cobros ya generados', async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(<AltaPrestamoModal posicion={posicion} onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/Intereses desde/), {
      target: { value: '2026-05-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const arg = onSave.mock.calls[0][0];
    expect(arg.rendimiento.fecha_primer_cobro).toBe('2026-05-15T12:00:00.000Z');
    expect(arg.rendimiento.pagos_generados).toHaveLength(1);
    // Sin cambio de capital no se tocan aportaciones ni valoración.
    expect(arg.aportaciones).toBeUndefined();
    expect(arg.valor_actual).toBeUndefined();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ajusta capital, aportación inicial y valor vivo al cambiar el capital', async () => {
    const onSave = jest.fn();
    render(<AltaPrestamoModal posicion={posicion} onSave={onSave} onClose={() => undefined} />);

    fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: '35000' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const arg = onSave.mock.calls[0][0];
    expect(arg.total_aportado).toBe(35000);
    expect(arg.valor_actual).toBe(35000);
    expect(arg.aportaciones[0].importe).toBe(35000);
  });

  it('muestra la zona peligrosa solo con onDelete', () => {
    const onDelete = jest.fn();
    const { rerender } = render(
      <AltaPrestamoModal posicion={posicion} onSave={() => undefined} onClose={() => undefined} />,
    );
    expect(screen.queryByRole('button', { name: /Eliminar préstamo/ })).not.toBeInTheDocument();

    rerender(
      <AltaPrestamoModal
        posicion={posicion}
        onSave={() => undefined}
        onDelete={onDelete}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Eliminar préstamo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar eliminación/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
