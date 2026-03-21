import { getAllocationFactor } from '../prestamosService';
import type { Prestamo } from '../../types/prestamos';

describe('getAllocationFactor', () => {
  it('devuelve 1 para préstamo legacy con inmuebleId coincidente', () => {
    const loan = {
      inmuebleId: '3',
      afectacionesInmueble: undefined,
    } as Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble'>;

    expect(getAllocationFactor(loan, '3')).toBe(1);
  });

  it('devuelve 0 para préstamo legacy con inmuebleId diferente', () => {
    const loan = {
      inmuebleId: '6',
      afectacionesInmueble: undefined,
    } as Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble'>;

    expect(getAllocationFactor(loan, '3')).toBe(0);
  });

  it('devuelve porcentaje dividido entre 100 para préstamo multi-inmueble', () => {
    const loan = {
      inmuebleId: undefined,
      afectacionesInmueble: [
        { inmuebleId: '6', porcentaje: 50 },
        { inmuebleId: '3', porcentaje: 50 },
      ],
    } as Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble'>;

    expect(getAllocationFactor(loan, '3')).toBe(0.5);
    expect(getAllocationFactor(loan, '6')).toBe(0.5);
  });

  it('devuelve 0 si el inmueble no está en afectaciones', () => {
    const loan = {
      inmuebleId: undefined,
      afectacionesInmueble: [
        { inmuebleId: '6', porcentaje: 100 },
      ],
    } as Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble'>;

    expect(getAllocationFactor(loan, '99')).toBe(0);
  });

  it('maneja porcentajes desiguales', () => {
    const loan = {
      afectacionesInmueble: [
        { inmuebleId: '1', porcentaje: 70 },
        { inmuebleId: '2', porcentaje: 30 },
      ],
    } as Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble'>;

    expect(getAllocationFactor(loan, '1')).toBe(0.7);
    expect(getAllocationFactor(loan, '2')).toBe(0.3);
  });
});
