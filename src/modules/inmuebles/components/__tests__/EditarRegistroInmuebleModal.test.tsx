import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EditarRegistroInmuebleModal from '../EditarRegistroInmuebleModal';
import type { GastoInmueble, MejoraInmueble, MuebleInmueble } from '../../../../services/db';

const gasto = (over: Partial<GastoInmueble> = {}): GastoInmueble => ({
  id: 1,
  inmuebleId: 10,
  fecha: '2026-03-01',
  concepto: 'Agua',
  importe: 45,
  categoria: 'suministro',
  casillaAEAT: '0113',
  estado: 'confirmado',
  ejercicio: 2026,
  origen: 'manual',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...over,
});

const mueble = (over: Partial<MuebleInmueble> = {}): MuebleInmueble => ({
  id: 3,
  inmuebleId: 10,
  descripcion: 'Sofá',
  importe: 500,
  fechaAlta: '2026-05-01',
  activo: true,
  vidaUtil: 10,
  ejercicio: 2026,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('EditarRegistroInmuebleModal', () => {
  it('edita un gasto real: recalcula casillaAEAT al cambiar la categoría y ejercicio desde la fecha', () => {
    const onGuardar = jest.fn();
    render(
      <EditarRegistroInmuebleModal
        registro={{ tipo: 'real', registro: gasto() }}
        onCancel={jest.fn()}
        onGuardar={onGuardar}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Agua'), { target: { value: 'IBI 2026' } });
    // categoria suministro → ibi (casilla 0115)
    const select = screen.getByDisplayValue('Suministro');
    fireEvent.change(select, { target: { value: 'ibi' } });
    fireEvent.change(screen.getByDisplayValue('45'), { target: { value: '320' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    expect(onGuardar).toHaveBeenCalledWith({
      concepto: 'IBI 2026',
      categoria: 'ibi',
      casillaAEAT: '0115',
      fecha: '2026-03-01',
      importe: 320,
      ejercicio: 2026,
    });
  });

  it('edita mobiliario: emite descripcion, fechaAlta, importe y vidaUtil', () => {
    const onGuardar = jest.fn();
    render(
      <EditarRegistroInmuebleModal
        registro={{ tipo: 'mobiliario', registro: mueble() }}
        onCancel={jest.fn()}
        onGuardar={onGuardar}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '650' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    expect(onGuardar).toHaveBeenCalledWith({
      descripcion: 'Sofá',
      fechaAlta: '2026-05-01',
      importe: 650,
      vidaUtil: 10,
      ejercicio: 2026,
    });
  });

  it('deshabilita guardar con importe no válido', () => {
    render(
      <EditarRegistroInmuebleModal
        registro={{ tipo: 'real', registro: gasto() }}
        onCancel={jest.fn()}
        onGuardar={jest.fn()}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('45'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /Guardar cambios/i })).toBeDisabled();
  });

  it('cancela al pulsar Cancelar', () => {
    const onCancel = jest.fn();
    render(
      <EditarRegistroInmuebleModal
        registro={{ tipo: 'real', registro: gasto() }}
        onCancel={onCancel}
        onGuardar={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
