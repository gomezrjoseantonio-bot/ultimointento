import { getImputacionFactor, interesesDeduciblesInmueble } from '../financiacionImputacionService';
import type { Prestamo } from '../../types/prestamos';

// Helper para construir préstamos de prueba con los campos mínimos necesarios
type TestPrestamo = Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble' | 'destinos' | 'principalInicial'>;

// ─── getImputacionFactor ───

describe('getImputacionFactor', () => {
  describe('legacy: solo inmuebleId', () => {
    it('devuelve 1 para el inmueble coincidente', () => {
      const p: TestPrestamo = { inmuebleId: 'T64-4D', afectacionesInmueble: undefined, destinos: undefined, principalInicial: 98000 };
      expect(getImputacionFactor(p, 'T64-4D')).toBe(1);
    });

    it('devuelve 0 para un inmueble diferente', () => {
      const p: TestPrestamo = { inmuebleId: 'T64-4D', afectacionesInmueble: undefined, destinos: undefined, principalInicial: 98000 };
      expect(getImputacionFactor(p, 'Buigas')).toBe(0);
    });

    it('devuelve 0 si no tiene inmuebleId ni destinos', () => {
      const p: TestPrestamo = { inmuebleId: undefined, afectacionesInmueble: undefined, destinos: undefined, principalInicial: 50000 };
      expect(getImputacionFactor(p, 'cualquier-id')).toBe(0);
    });
  });

  describe('legacy: afectacionesInmueble', () => {
    it('devuelve porcentaje/100 para cada inmueble', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        destinos: undefined,
        principalInicial: 98000,
        afectacionesInmueble: [
          { inmuebleId: 'T64-4D', porcentaje: 50 },
          { inmuebleId: 'T64-4IZ', porcentaje: 50 },
        ],
      };
      expect(getImputacionFactor(p, 'T64-4D')).toBe(0.5);
      expect(getImputacionFactor(p, 'T64-4IZ')).toBe(0.5);
    });

    it('devuelve 0 si el inmueble no está en afectaciones', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        destinos: undefined,
        principalInicial: 100000,
        afectacionesInmueble: [{ inmuebleId: 'T64-4D', porcentaje: 100 }],
      };
      expect(getImputacionFactor(p, 'otro')).toBe(0);
    });

    it('maneja porcentajes desiguales (70/30)', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        destinos: undefined,
        principalInicial: 100000,
        afectacionesInmueble: [
          { inmuebleId: 'A', porcentaje: 70 },
          { inmuebleId: 'B', porcentaje: 30 },
        ],
      };
      expect(getImputacionFactor(p, 'A')).toBe(0.7);
      expect(getImputacionFactor(p, 'B')).toBe(0.3);
    });
  });

  describe('modelo v2: destinos', () => {
    it('calcula factor proporcional por importe destinado (50/50)', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 98000,
        destinos: [
          { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'T64-4D', importe: 49000 },
          { id: 'd2', tipo: 'ADQUISICION', inmuebleId: 'T64-4IZ', importe: 49000 },
        ],
      };
      expect(getImputacionFactor(p, 'T64-4D')).toBeCloseTo(0.5, 10);
      expect(getImputacionFactor(p, 'T64-4IZ')).toBeCloseTo(0.5, 10);
    });

    it('caso ING: 75% compra T48, 25% cancelar deuda (no inmueble)', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 100000,
        destinos: [
          { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'T48', importe: 75000 },
          { id: 'd2', tipo: 'CANCELACION_DEUDA', importe: 25000 },
        ],
      };
      expect(getImputacionFactor(p, 'T48')).toBeCloseTo(0.75, 10);
      expect(getImputacionFactor(p, 'otro')).toBe(0);
    });

    it('devuelve 0 si ningún destino apunta al inmueble', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 50000,
        destinos: [
          { id: 'd1', tipo: 'PERSONAL', importe: 50000 },
        ],
      };
      expect(getImputacionFactor(p, 'cualquier-inmueble')).toBe(0);
    });

    it('limita factor a 1 aunque la suma supere principalInicial', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 50000,
        destinos: [
          { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'X', importe: 60000 },
        ],
      };
      expect(getImputacionFactor(p, 'X')).toBe(1);
    });

    it('devuelve 0 si principalInicial es 0', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 0,
        destinos: [
          { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'X', importe: 0 },
        ],
      };
      expect(getImputacionFactor(p, 'X')).toBe(0);
    });
  });

  describe('modelo v2: array destinos vacío', () => {
    it('destinos vacío → factor 0 (no usa legacy)', () => {
      // Si el array existe pero está vacío, el préstamo fue migrado y no tiene destinos reales
      const p: TestPrestamo = {
        inmuebleId: 'X',
        afectacionesInmueble: undefined,
        principalInicial: 50000,
        destinos: [],
      };
      // Array vacío → sum=0, factor=0 (correcto: préstamo sin destinos activos)
      expect(getImputacionFactor(p, 'X')).toBe(0);
    });
  });
});

// ─── interesesDeduciblesInmueble ───

describe('interesesDeduciblesInmueble', () => {
  it('intereses = 0 → devuelve 0', () => {
    const p: TestPrestamo = { inmuebleId: 'X', afectacionesInmueble: undefined, destinos: undefined, principalInicial: 50000 };
    expect(interesesDeduciblesInmueble(p, 'X', 0)).toBe(0);
  });

  describe('legacy fallback (sin destinos)', () => {
    it('100% deducible para inmueble coincidente', () => {
      const p: TestPrestamo = { inmuebleId: 'T64-4D', afectacionesInmueble: undefined, destinos: undefined, principalInicial: 98000 };
      expect(interesesDeduciblesInmueble(p, 'T64-4D', 1200)).toBe(1200);
    });

    it('50% deducible para préstamo 50/50 afectaciones', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        destinos: undefined,
        principalInicial: 98000,
        afectacionesInmueble: [
          { inmuebleId: 'T64-4D', porcentaje: 50 },
          { inmuebleId: 'T64-4IZ', porcentaje: 50 },
        ],
      };
      expect(interesesDeduciblesInmueble(p, 'T64-4D', 2000)).toBe(1000);
    });
  });

  describe('modelo v2 con destinos', () => {
    it('solo ADQUISICION y REFORMA son deducibles, no CANCELACION_DEUDA', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 100000,
        destinos: [
          { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'T48', importe: 75000 },
          { id: 'd2', tipo: 'CANCELACION_DEUDA', importe: 25000 },
        ],
      };
      // Solo 75% deducible (destino ADQUISICION T48)
      expect(interesesDeduciblesInmueble(p, 'T48', 2000)).toBe(1500);
    });

    it('REFORMA también es deducible', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 50000,
        destinos: [
          { id: 'd1', tipo: 'REFORMA', inmuebleId: 'Cangas', importe: 30000 },
          { id: 'd2', tipo: 'PERSONAL', importe: 20000 },
        ],
      };
      // 60% deducible
      expect(interesesDeduciblesInmueble(p, 'Cangas', 1000)).toBe(600);
    });

    it('PERSONAL no es deducible', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 50000,
        destinos: [
          { id: 'd1', tipo: 'PERSONAL', importe: 50000 },
        ],
      };
      expect(interesesDeduciblesInmueble(p, 'cualquiera', 1000)).toBe(0);
    });

    it('caso Unicaja: 50/50 T64-4D + T64-4IZ → 50% deducible por inmueble', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 98000,
        destinos: [
          { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'T64-4D', importe: 49000 },
          { id: 'd2', tipo: 'ADQUISICION', inmuebleId: 'T64-4IZ', importe: 49000 },
        ],
      };
      const interesesTotales = 3600;
      expect(interesesDeduciblesInmueble(p, 'T64-4D', interesesTotales)).toBe(1800);
      expect(interesesDeduciblesInmueble(p, 'T64-4IZ', interesesTotales)).toBe(1800);
    });

    it('redondea a centimos', () => {
      const p: TestPrestamo = {
        inmuebleId: undefined,
        afectacionesInmueble: undefined,
        principalInicial: 3,
        destinos: [
          { id: 'd1', tipo: 'ADQUISICION', inmuebleId: 'X', importe: 1 },
          { id: 'd2', tipo: 'ADQUISICION', inmuebleId: 'Y', importe: 2 },
        ],
      };
      // factor = 1/3 → 100 * (1/3) = 33.33...
      expect(interesesDeduciblesInmueble(p, 'X', 100)).toBe(33.33);
    });
  });
});
