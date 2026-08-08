// El resumen del modal de amortizar · «antes → después».
//
// Las dos mitades de la flecha salían de sitios distintos: el «antes» contaba
// los recibos por FECHA y el «después» por PUNTEO (`!pagado`). De ahí los dos
// números que no se sostienen *(Jose · 8 ago 2026, sobre la pantalla)*:
//
//   · «Plazo 205 → 206 meses» después de meter 1.000 € — el plazo SUBÍA.
//   · «Cuota 454,57 € → 454,57 €» habiendo elegido REDUCIR CUOTA.
//
// Y el ahorro de intereses lo calculaba encima un tercer motor, así que podía
// anunciar 444 € de ahorro al lado de «tu cuota no baja y el plazo sube».

import { initDB } from '../db';
import { prestamosService } from '../prestamosService';
import { prepareLoanSettlement, simulateLoanSettlement } from '../loanSettlementService';
import type { Prestamo } from '../../types/prestamos';

const hipoteca: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
  ambito: 'INMUEBLE',
  inmuebleId: 'inm-1',
  nombre: 'Hipoteca del resumen',
  principalInicial: 120000,
  principalVivo: 120000,
  fechaFirma: '2025-01-01',
  fechaPrimerCargo: '2025-02-01',
  plazoMesesTotal: 240,
  diaCargoMes: 1,
  esquemaPrimerRecibo: 'NORMAL',
  carencia: 'NINGUNA',
  sistema: 'FRANCES',
  cuotasPagadas: 0,
  origenCreacion: 'MANUAL',
  activo: true,
  tipo: 'FIJO',
  tipoNominalAnualFijo: 3.2,
  cuentaCargoId: 'cuenta-1',
  comisionAmortizacionAnticipada: 0.005,
  comisionCancelacionTotal: 0.01,
  gastosFijosOperacion: 25,
} as unknown as Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'>;

const DIA = '2025-06-15';

const nuevaHipoteca = async () => {
  const db = await initDB();
  await Promise.all([db.clear('prestamos'), db.clear('keyval')]);
  prestamosService.clearCache();
  return prestamosService.createPrestamo(hipoteca);
};

const simular = (loanId: string, modo: 'REDUCIR_CUOTA' | 'REDUCIR_PLAZO', importe = 10000) =>
  simulateLoanSettlement({
    loanId,
    operationType: 'PARTIAL',
    operationDate: DIA,
    partialMode: modo,
    principalAmount: importe,
    feeAmount: 0,
    fixedCosts: 0,
  });

describe('cada modo hace lo que su nombre dice', () => {
  it('reducir cuota baja el recibo y NO mueve el plazo', async () => {
    const loan = await nuevaHipoteca();
    const s = await simular(loan.id, 'REDUCIR_CUOTA');

    expect(s.monthlyPaymentAfter!).toBeLessThan(s.monthlyPaymentBefore!);
    expect(s.termMonthsAfter).toBe(s.termMonthsBefore);
  });

  it('reducir plazo mantiene el recibo y acorta', async () => {
    const loan = await nuevaHipoteca();
    const s = await simular(loan.id, 'REDUCIR_PLAZO');

    expect(s.monthlyPaymentAfter).toBeCloseTo(s.monthlyPaymentBefore!, 2);
    expect(s.termMonthsAfter!).toBeLessThan(s.termMonthsBefore!);
  });

  // Meter dinero no puede alargar un préstamo en ninguno de los dos modos.
  it.each(['REDUCIR_CUOTA', 'REDUCIR_PLAZO'] as const)('y con %s el plazo nunca sube', async (modo) => {
    const loan = await nuevaHipoteca();
    const s = await simular(loan.id, modo);

    expect(s.termMonthsAfter!).toBeLessThanOrEqual(s.termMonthsBefore!);
  });
});

// El caso de la pantalla · un préstamo de verdad tiene recibos viejos que nadie
// ha punteado contra su movimiento. `!pagado` los contaba como futuros, así que
// el plazo «después» salía inflado y la cuota «después» era la de uno de ellos.
describe('un recibo pasado sin puntear no es futuro', () => {
  const desmarcarElPrimero = async (loanId: string) => {
    const plan = (await prestamosService.getPaymentPlan(loanId))!;
    await prestamosService.savePaymentPlan(loanId, {
      ...plan,
      periodos: plan.periodos.map((p, i) =>
        i === 0 ? { ...p, pagado: false, fechaPagoReal: undefined } : p
      ),
    });
    prestamosService.clearCache();
  };

  it('ni infla el plazo', async () => {
    const loan = await nuevaHipoteca();
    const limpio = await simular(loan.id, 'REDUCIR_CUOTA');

    await desmarcarElPrimero(loan.id);
    const conHueco = await simular(loan.id, 'REDUCIR_CUOTA');

    expect(conHueco.termMonthsAfter).toBe(limpio.termMonthsAfter);
    expect(conHueco.termMonthsAfter).toBe(conHueco.termMonthsBefore);
  });

  it('ni se lleva por delante la rebaja de la cuota', async () => {
    const loan = await nuevaHipoteca();
    await desmarcarElPrimero(loan.id);
    const s = await simular(loan.id, 'REDUCIR_CUOTA');

    expect(s.monthlyPaymentAfter!).toBeLessThan(s.monthlyPaymentBefore!);
  });
});

// Hay planes viejos con `devengoDesde` en `2025/09/28`. Se descartaban por no
// ser ISO y se caía en `fechaCargo`, y eso no es neutral: afirma que el devengo
// empieza el día del recibo cuando en un préstamo mensual empieza un mes antes.
// El periodo a caballo de la operación se conservaba o se rehacía según el
// FORMATO de su fecha, que es lo mismo que decir que el resultado dependía de
// por qué importador entró el préstamo.
describe('un plan viejo con las fechas en otro formato da lo mismo', () => {
  const conBarras = async (loanId: string) => {
    const plan = (await prestamosService.getPaymentPlan(loanId))!;
    await prestamosService.savePaymentPlan(loanId, {
      ...plan,
      periodos: plan.periodos.map((p) => ({
        ...p,
        devengoDesde: (p.devengoDesde || p.fechaCargo).replace(/-/g, '/'),
      })),
    });
    prestamosService.clearCache();
  };

  it('el resumen sale igual que con las fechas en ISO', async () => {
    const loan = await nuevaHipoteca();
    const enIso = await simular(loan.id, 'REDUCIR_CUOTA');

    await conBarras(loan.id);
    const conOtroFormato = await simular(loan.id, 'REDUCIR_CUOTA');

    expect(conOtroFormato.termMonthsBefore).toBe(enIso.termMonthsBefore);
    expect(conOtroFormato.termMonthsAfter).toBe(enIso.termMonthsAfter);
    expect(conOtroFormato.monthlyPaymentAfter).toBeCloseTo(enIso.monthlyPaymentAfter!, 2);
    expect(conOtroFormato.interestSavings).toBeCloseTo(enIso.interestSavings!, 2);
  });
});

describe('el ahorro sale de los mismos dos cuadros que la cuota y el plazo', () => {
  it('adelantar capital ahorra intereses', async () => {
    const loan = await nuevaHipoteca();
    const s = await simular(loan.id, 'REDUCIR_CUOTA');

    expect(s.interestSavings!).toBeGreaterThan(0);
  });

  // Reducir plazo ahorra más que reducir cuota con el mismo dinero · es la
  // razón por la que existen los dos botones. Si el ahorro viniera de otra
  // cuenta, esto podría salir al revés sin que nada chirriara.
  it('y reducir plazo ahorra más que reducir cuota', async () => {
    const loan = await nuevaHipoteca();
    const porCuota = await simular(loan.id, 'REDUCIR_CUOTA');
    const porPlazo = await simular(loan.id, 'REDUCIR_PLAZO');

    expect(porPlazo.interestSavings!).toBeGreaterThan(porCuota.interestSavings!);
  });

  it('y no se anuncia un ahorro sin tocar nada', async () => {
    const loan = await nuevaHipoteca();
    const prep = await prepareLoanSettlement(loan.id, DIA);

    expect(prep.plazoRestanteEstimado).toBeGreaterThan(0);
    expect(prep.cuotaActualEstimada).toBeGreaterThan(0);
  });
});

// El plazo de la tarjeta y el del «antes» sí son la misma pregunta · salían de
// dos funciones distintas y podían diferir en un mes.
describe('el modal no se contradice consigo mismo', () => {
  it('el plazo de la tarjeta es el del «antes»', async () => {
    const loan = await nuevaHipoteca();
    const prep = await prepareLoanSettlement(loan.id, DIA);
    const s = await simular(loan.id, 'REDUCIR_CUOTA');

    expect(s.termMonthsBefore).toBe(prep.plazoRestanteEstimado);
  });

  // En un fijo las dos cuotas coinciden, y de ahí venía el error: se dio por
  // hecho que eran la misma pregunta.
  it('y en un fijo la cuota también coincide', async () => {
    const loan = await nuevaHipoteca();
    const prep = await prepareLoanSettlement(loan.id, DIA);
    const s = await simular(loan.id, 'REDUCIR_CUOTA');

    expect(s.monthlyPaymentBefore).toBeCloseTo(prep.cuotaActualEstimada, 2);
  });
});

// «CUOTA ACTUAL» es lo que se paga AHORA, y la del «antes → después» es la del
// primer recibo que la operación puede mover. Con un cambio de tramo en medio
// no son la misma cifra, y darlas por iguales puso «CUOTA ACTUAL 518,10 €» un
// 8 de agosto en una mixta que ese mes paga 455 € *(Jose · 8 ago 2026)*.
describe('la cuota de ahora y la que mueve la operación son dos preguntas', () => {
  // Mixta como la de la pantalla: 36 meses al 2,60 % desde el 25/08/2023, o sea
  // tramo fijo hasta el 25/08/2026. Operando el 8 de agosto, el recibo del 25
  // todavía es del tramo fijo y el siguiente ya no.
  const mixta = async () => {
    const db = await initDB();
    await Promise.all([db.clear('prestamos'), db.clear('keyval')]);
    prestamosService.clearCache();
    return prestamosService.createPrestamo({
      ...hipoteca,
      nombre: 'Mixta como la de Unicaja',
      principalInicial: 85000,
      principalVivo: 85000,
      fechaFirma: '2023-08-25',
      fechaPrimerCargo: '2023-09-25',
      diaCargoMes: 25,
      tipo: 'MIXTO',
      tipoNominalAnualMixtoFijo: 2.6,
      tramoFijoMeses: 36,
      indice: 'EURIBOR',
      valorIndiceActual: 4,
      diferencial: 1.75,
    } as unknown as Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'>);
  };

  it('la tarjeta enseña el recibo que se cobra este mes, no el del tramo siguiente', async () => {
    const loan = await mixta();
    const prep = await prepareLoanSettlement(loan.id, '2026-08-08');
    const plan = (await prestamosService.getPaymentPlan(loan.id))!;
    const proximo = plan.periodos.find((p) => p.fechaCargo > '2026-08-08')!;

    expect(prep.cuotaActualEstimada).toBeCloseTo(proximo.cuota, 2);
    expect(proximo.fechaCargo.slice(0, 7)).toBe('2026-08');
  });

  // Y la comparación de la operación sí mira el recibo de después, con su
  // fecha dicha · si no, la pantalla enseña dos cuotas sueltas sin explicar
  // por qué no coinciden, que es exactamente lo que se preguntó.
  it('y el «antes → después» dice de qué recibo habla', async () => {
    const loan = await mixta();
    const s = await simulateLoanSettlement({
      loanId: loan.id,
      operationType: 'PARTIAL',
      operationDate: '2026-08-08',
      partialMode: 'REDUCIR_CUOTA',
      principalAmount: 1000,
      feeAmount: 0,
      fixedCosts: 0,
    });

    expect(s.monthlyPaymentFrom).toBeTruthy();
    expect(s.monthlyPaymentFrom! > '2026-08-08').toBe(true);
    expect(s.monthlyPaymentAfter!).toBeLessThan(s.monthlyPaymentBefore!);
  });
});
