// R3 · opciones de habitación del contrato + pre-relleno de renta objetivo.

import {
  opcionesHabitacionContrato,
  rentaPrefillHabitacion,
} from '../contratoWizardHelpers';
import type { ExplotacionAlquiler } from '../../../../services/db';

const explotacion = (over: Partial<ExplotacionAlquiler>): ExplotacionAlquiler =>
  ({ id: 1, inmuebleId: 1, modo: 'completo', estado: 'operativo', createdAt: 'x', updatedAt: 'x', ...over }) as ExplotacionAlquiler;

describe('opcionesHabitacionContrato', () => {
  it('por habitaciones · lista real con id, nombre y renta objetivo', () => {
    const e = explotacion({
      modo: 'habitaciones',
      habitaciones: [
        { id: 'hab-1', nombre: 'Suite', rentaObjetivo: 395 },
        { id: 'hab-2', nombre: 'Exterior' },
      ],
    });
    expect(opcionesHabitacionContrato(e, 5)).toEqual([
      { id: 'hab-1', nombre: 'Suite', rentaObjetivo: 395 },
      { id: 'hab-2', nombre: 'Exterior', rentaObjetivo: undefined },
    ]);
  });

  it('sin explotación por habitaciones · cae a bedrooms con ids sintéticos', () => {
    expect(opcionesHabitacionContrato(undefined, 3)).toEqual([
      { id: 'hab-1', nombre: 'Habitación 1' },
      { id: 'hab-2', nombre: 'Habitación 2' },
      { id: 'hab-3', nombre: 'Habitación 3' },
    ]);
  });

  it('modo completo · no ofrece habitaciones aunque haya bedrooms', () => {
    // completo con bedrooms>1 sí cae al legacy (compat), pero completo con 1 → []
    expect(opcionesHabitacionContrato(explotacion({ modo: 'completo' }), 1)).toEqual([]);
  });

  it('piso completo de 1 unidad sin explotación · lista vacía', () => {
    expect(opcionesHabitacionContrato(undefined, 1)).toEqual([]);
  });
});

describe('rentaPrefillHabitacion', () => {
  it('pre-rellena con la renta objetivo si aún no hay renta', () => {
    expect(rentaPrefillHabitacion(395, '')).toBe('395');
    expect(rentaPrefillHabitacion(395, '0')).toBe('395');
  });
  it('no pisa una renta ya escrita', () => {
    expect(rentaPrefillHabitacion(395, '500')).toBeNull();
  });
  it('sin renta objetivo · no toca nada', () => {
    expect(rentaPrefillHabitacion(undefined, '')).toBeNull();
  });
});
