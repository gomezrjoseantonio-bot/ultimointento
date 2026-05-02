import { derivarCachePrestamo } from '../prestamosService';
import type { PlanPagos } from '../../types/prestamos';

function makePlan(periodos: Array<{ periodo: number; fechaCargo: string; pagado: boolean; principalFinal: number }>): PlanPagos {
  return {
    prestamoId: 'test-id',
    periodos: periodos.map((p) => ({
      periodo: p.periodo,
      fechaCargo: p.fechaCargo,
      pagado: p.pagado,
      principalFinal: p.principalFinal,
      cuota: 1000,
      interes: 100,
      principal: 900,
      saldoInicial: p.principalFinal + 900,
    })),
  };
}

describe('derivarCachePrestamo', () => {
  it('bug escenario: flags ya en true pero caché a cero · debe devolver conteo correcto', () => {
    // Simula el escenario del bug: createPrestamo marcó todos los periodos
    // pagado=true pero autoMarcarCuotasPagadas salió antes del bloque cache.
    const plan = makePlan([
      { periodo: 1, fechaCargo: '2024-01-01', pagado: true, principalFinal: 99000 },
      { periodo: 2, fechaCargo: '2024-02-01', pagado: true, principalFinal: 98100 },
      { periodo: 3, fechaCargo: '2024-03-01', pagado: true, principalFinal: 97200 },
    ]);

    const result = derivarCachePrestamo(plan, 100000);

    expect(result.cuotasPagadas).toBe(3);
    expect(result.principalVivo).toBe(97200);
    expect(result.fechaUltimaCuotaPagada).toBe('2024-03-01');
  });

  it('escenario normal: mezcla de pagados y pendientes', () => {
    const plan = makePlan([
      { periodo: 1, fechaCargo: '2024-01-01', pagado: true, principalFinal: 99000 },
      { periodo: 2, fechaCargo: '2024-02-01', pagado: true, principalFinal: 98100 },
      { periodo: 3, fechaCargo: '2024-03-01', pagado: false, principalFinal: 97200 },
    ]);

    const result = derivarCachePrestamo(plan, 100000);

    expect(result.cuotasPagadas).toBe(2);
    expect(result.principalVivo).toBe(98100);
    expect(result.fechaUltimaCuotaPagada).toBe('2024-02-01');
  });

  it('préstamo sin ninguna cuota pagada · principalVivo debe ser principalInicial', () => {
    const plan = makePlan([
      { periodo: 1, fechaCargo: '2025-01-01', pagado: false, principalFinal: 99000 },
      { periodo: 2, fechaCargo: '2025-02-01', pagado: false, principalFinal: 98100 },
    ]);

    const result = derivarCachePrestamo(plan, 100000);

    expect(result.cuotasPagadas).toBe(0);
    expect(result.principalVivo).toBe(100000);
    expect(result.fechaUltimaCuotaPagada).toBeUndefined();
  });

  it('todas las cuotas pagadas · principalVivo es el saldo final del último periodo', () => {
    const plan = makePlan([
      { periodo: 1, fechaCargo: '2024-01-01', pagado: true, principalFinal: 50000 },
      { periodo: 2, fechaCargo: '2024-02-01', pagado: true, principalFinal: 0 },
    ]);

    const result = derivarCachePrestamo(plan, 100000);

    expect(result.cuotasPagadas).toBe(2);
    expect(result.principalVivo).toBe(0);
    expect(result.fechaUltimaCuotaPagada).toBe('2024-02-01');
  });
});
