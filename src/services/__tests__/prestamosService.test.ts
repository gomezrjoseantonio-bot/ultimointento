import { getAllocationFactor, prestamoAfectaInmueble, deudaVivaPorGarantia } from '../prestamosService';
import type { Prestamo } from '../../types/prestamos';

describe('prestamoAfectaInmueble · gate de getPrestamosByProperty', () => {
  it('reconoce un préstamo por destinos[] (modelo actual del asistente)', () => {
    // El asistente ya NO guarda inmuebleId de nivel superior · solo destinos.
    const loan = {
      destinos: [{ tipo: 'ADQUISICION', inmuebleId: '3', importe: 100000, porcentaje: 100 }],
    } as unknown as Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble' | 'destinos'>;

    expect(prestamoAfectaInmueble(loan, '3')).toBe(true);
    expect(prestamoAfectaInmueble(loan, '9')).toBe(false);
  });

  it('sigue reconociendo los legacy (inmuebleId simple y afectaciones)', () => {
    const legacySimple = { inmuebleId: '3' } as Pick<
      Prestamo,
      'inmuebleId' | 'afectacionesInmueble' | 'destinos'
    >;
    const legacyAfect = {
      afectacionesInmueble: [{ inmuebleId: '3', porcentaje: 50 }],
    } as unknown as Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble' | 'destinos'>;

    expect(prestamoAfectaInmueble(legacySimple, '3')).toBe(true);
    expect(prestamoAfectaInmueble(legacyAfect, '3')).toBe(true);
  });

  it('un préstamo personal (destino sin inmuebleId) no afecta a ningún inmueble', () => {
    const personal = {
      destinos: [{ tipo: 'PERSONAL', importe: 20000, porcentaje: 100 }],
    } as unknown as Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble' | 'destinos'>;

    expect(prestamoAfectaInmueble(personal, '3')).toBe(false);
  });
});

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

describe('deudaVivaPorGarantia · deuda por colateral (LTV)', () => {
  it('reparte una hipoteca de dos pisos por el importe de su destino (Tenderina)', () => {
    const prestamo = {
      principalVivo: 90000,
      garantias: [
        { tipo: 'HIPOTECARIA', inmuebleId: '2' },
        { tipo: 'HIPOTECARIA', inmuebleId: '3' },
      ],
      destinos: [
        { tipo: 'ADQUISICION', inmuebleId: '2', importe: 60000, porcentaje: 60 },
        { tipo: 'ADQUISICION', inmuebleId: '3', importe: 40000, porcentaje: 40 },
      ],
    } as unknown as Prestamo;

    const m = deudaVivaPorGarantia(prestamo);
    expect(m.get('2')).toBeCloseTo(54000); // 90.000 × 60%
    expect(m.get('3')).toBeCloseTo(36000); // 90.000 × 40%
  });

  it('sin destinos por inmueble, reparte a partes iguales entre las garantías', () => {
    const prestamo = {
      principalVivo: 100000,
      garantias: [
        { tipo: 'HIPOTECARIA', inmuebleId: '2' },
        { tipo: 'HIPOTECARIA', inmuebleId: '3' },
      ],
      destinos: [],
    } as unknown as Prestamo;

    const m = deudaVivaPorGarantia(prestamo);
    expect(m.get('2')).toBeCloseTo(50000);
    expect(m.get('3')).toBeCloseTo(50000);
  });

  it('un préstamo personal (sin garantía hipotecaria) no carga ningún inmueble', () => {
    const prestamo = {
      principalVivo: 20000,
      garantias: [{ tipo: 'PERSONAL' }],
      destinos: [{ tipo: 'ADQUISICION', inmuebleId: '2', importe: 20000, porcentaje: 100 }],
    } as unknown as Prestamo;

    expect(deudaVivaPorGarantia(prestamo).size).toBe(0);
  });
});
