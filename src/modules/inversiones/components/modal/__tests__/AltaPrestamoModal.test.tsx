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

describe('AltaPrestamoModal · cuotas ya vencidas', () => {
  // Préstamo firmado hace 2 años · al darlo de alta arrastra cuotas cobradas.
  const rellenarPrestamoPasado = async () => {
    fireEvent.change(screen.getByPlaceholderText(/SmartFlip · 10% TIN/), {
      target: { value: 'Préstamo socio' },
    });
    fireEvent.change(screen.getByLabelText(/Plataforma|Empresa deudora|Familiar deudor/), {
      target: { value: 'Unihouser' },
    });
    fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: '30000' } });
    fireEvent.change(screen.getByPlaceholderText('10.00'), { target: { value: '3.25' } });
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Modalidad/) as HTMLSelectElement, {
      target: { value: 'capital_e_intereses' },
    });
    const hace2 = new Date();
    hace2.setFullYear(hace2.getFullYear() - 2);
    fireEvent.change(screen.getByLabelText(/Fecha firma/), {
      target: { value: hace2.toISOString().slice(0, 10) },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: 'Cuenta principal' })).toHaveLength(2);
    });
    fireEvent.change(screen.getByLabelText(/Cuenta de cargo/) as HTMLSelectElement, {
      target: { value: '1' },
    });
  };

  it('avisa de cuántas cuotas arrastra y por cuánto', async () => {
    render(<AltaPrestamoModal onSave={() => undefined} onClose={() => undefined} />);
    await rellenarPrestamoPasado();

    expect(screen.getByText('Cuotas ya vencidas')).toBeInTheDocument();
    expect(screen.getByText(/cuotas ya\s+vencidas/)).toBeInTheDocument();
    // Y explica por qué no se tocan los movimientos del banco.
    expect(screen.getByText(/ya está\s+en el saldo de tu banco/)).toBeInTheDocument();
  });

  it('las da por cobradas por defecto · sin crear movimientos', async () => {
    const onSave = jest.fn();
    render(<AltaPrestamoModal onSave={onSave} onClose={() => undefined} />);
    await rellenarPrestamoPasado();

    fireEvent.click(screen.getByRole('button', { name: /Crear préstamo|Guardar/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    const guardado = onSave.mock.calls[0][0];
    const pagos = guardado.rendimiento.pagos_generados;
    expect(pagos.length).toBeGreaterThan(20);
    expect(pagos.every((p: { estado: string }) => p.estado === 'pagado')).toBe(true);
    // Cuota completa: intereses netos + capital devuelto (~527 €), no solo intereses.
    expect(pagos[0].importe_neto).toBeGreaterThan(500);
    // Y la cuenta de cobro viaja en el rendimiento para que la prevea Tesorería.
    expect(guardado.rendimiento.cuenta_destino_id).toBe(1);
  });

  it('respeta que el usuario prefiera puntearlas una a una', async () => {
    const onSave = jest.fn();
    render(<AltaPrestamoModal onSave={onSave} onClose={() => undefined} />);
    await rellenarPrestamoPasado();

    fireEvent.click(screen.getByRole('checkbox', { name: /Darlas por cobradas/ }));
    fireEvent.click(screen.getByRole('button', { name: /Crear préstamo|Guardar/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    expect(onSave.mock.calls[0][0].rendimiento.pagos_generados).toEqual([]);
  });

  it('no pregunta nada si el préstamo empieza hoy', async () => {
    render(<AltaPrestamoModal onSave={() => undefined} onClose={() => undefined} />);
    await rellenarAlta();
    expect(screen.queryByText('Cuotas ya vencidas')).not.toBeInTheDocument();
  });
});

describe('AltaPrestamoModal · el préstamo de la captura (con carencia)', () => {
  // Firmado 01/03/2024 · primer cobro 01/03/2025 (un año de carencia) ·
  // 30.000 € al 3,25% a 60 cuotas mensuales con retención del 19%.
  const rellenar = async () => {
    fireEvent.change(screen.getByPlaceholderText(/SmartFlip · 10% TIN/), {
      target: { value: 'Prestamo Creación' },
    });
    fireEvent.change(screen.getByLabelText(/Plataforma|Empresa deudora|Familiar deudor/), {
      target: { value: 'Unihouser' },
    });
    fireEvent.change(screen.getByPlaceholderText('10000'), { target: { value: '30000' } });
    fireEvent.change(screen.getByPlaceholderText('10.00'), { target: { value: '3.25' } });
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Modalidad/) as HTMLSelectElement, {
      target: { value: 'capital_e_intereses' },
    });
    fireEvent.change(screen.getByLabelText(/Fecha firma/), {
      target: { value: '2024-03-01' },
    });
    fireEvent.change(screen.getByLabelText(/Intereses desde/), {
      target: { value: '2025-03-01' },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: 'Cuenta principal' })).toHaveLength(2);
    });
    fireEvent.change(screen.getByLabelText(/Cuenta de cargo/) as HTMLSelectElement, {
      target: { value: '1' },
    });
  };

  it('anuncia el total que se cobra, capital incluido · no solo los intereses', async () => {
    render(<AltaPrestamoModal onSave={() => undefined} onClose={() => undefined} />);
    await rellenar();

    // Entran 30.000 de capital + 2.544 de intereses − 483 de retención.
    expect(screen.getByText('Total a cobrar')).toBeInTheDocument();
    expect(screen.getByText(/32\.06[01]/)).toBeInTheDocument();
    const card = screen.getByText('Total a cobrar').parentElement as HTMLElement;
    expect(card.textContent).toMatch(/32\.06[01]/);
    expect(card.textContent).toMatch(/capital 30\.000/);
    expect(card.textContent).toMatch(/intereses netos 2\.?06[01]/);
    // Y el desglose sigue visible, sin hacerlo pasar por el total.
    expect(screen.getByText('Intereses netos')).toBeInTheDocument();
    expect(screen.getByText('Capital devuelto')).toBeInTheDocument();
  });

  it('vence en la última cuota, no en firma + duración', async () => {
    render(<AltaPrestamoModal onSave={() => undefined} onClose={() => undefined} />);
    await rellenar();

    // Con un año de carencia las 60 cuotas acaban en feb-2030, no en mar-2029.
    const fila = screen.getByText('Vencimiento').parentElement as HTMLElement;
    expect(fila.textContent).toMatch(/2030/);
    expect(fila.textContent).not.toMatch(/2029/);
  });

  it('guarda ese mismo vencimiento como fin del rendimiento', async () => {
    const onSave = jest.fn();
    render(<AltaPrestamoModal onSave={onSave} onClose={() => undefined} />);
    await rellenar();

    fireEvent.click(screen.getByRole('button', { name: /Crear préstamo|Guardar/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    expect(onSave.mock.calls[0][0].rendimiento.fecha_fin_rendimiento).toContain('2030-02-01');
  });
});
