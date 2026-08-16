// Amortizar SIEMPRE, no una vez · VOCABULARIO §6 bis · quater.
//
// Lo que vigila esto es que un plan sea un calendario de verdad —cada adelanto
// sobre el capital que dejó el anterior— y que la comisión se cobre como la
// cobra el banco: solo por lo que excede del cupo anual pactado.

import {
  adelantosDeLaRegla,
  calendarioDeAdelantos,
  compararModos,
  simularPlanDeAdelantos,
  type ReglaDeAdelanto,
} from '../planDeAdelantos';
import { generarCuadro } from '../cuadro';
import type { Prestamo } from '../../../types/prestamos';

const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'u',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'FIJO',
    tipoNominalAnualFijo: 2.6,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

/** El cuadro tal como está hoy · con lo anterior YA PAGADO. */
const plan = (p: Prestamo, pagadoHasta = '2026-02-25') => {
  const original = generarCuadro(p).plan;
  return {
    ...original,
    periodos: original.periodos.map((x) =>
      x.fechaCargo < pagadoHasta ? { ...x, pagado: true, fechaPagoReal: x.fechaCargo } : x
    ),
  };
};

const regla = (over: Partial<ReglaDeAdelanto> = {}): ReglaDeAdelanto => ({
  id: 'r1',
  cadencia: 'MENSUAL',
  importe: 200,
  desde: '2026-03-25',
  ...over,
});

// ── Desplegar la regla en fechas ────────────────────────────────────────────

describe('una regla es un calendario', () => {
  it('mensual · una cita cada mes, conservando el día', () => {
    const citas = adelantosDeLaRegla(regla({ veces: 4 }), '2043-08-25');
    expect(citas.map((c) => c.fecha)).toEqual([
      '2026-03-25',
      '2026-04-25',
      '2026-05-25',
      '2026-06-25',
    ]);
  });

  it('anual en un mes concreto · «cada junio» empieza el junio que viene', () => {
    const citas = adelantosDeLaRegla(
      regla({ cadencia: 'ANUAL', mes: 6, importe: 3000, desde: '2026-09-10', veces: 3 }),
      '2043-08-25'
    );
    expect(citas.map((c) => c.fecha)).toEqual(['2027-06-10', '2028-06-10', '2029-06-10']);
  });

  it('cada N meses · trimestral es cada tres', () => {
    const citas = adelantosDeLaRegla(
      regla({ cadencia: 'CADA_N_MESES', cadaMeses: 3, veces: 3 }),
      '2043-08-25'
    );
    expect(citas.map((c) => c.fecha)).toEqual(['2026-03-25', '2026-06-25', '2026-09-25']);
  });

  it('el día 31 no se desborda al mes siguiente', () => {
    const citas = adelantosDeLaRegla(regla({ desde: '2026-01-31', veces: 3 }), '2043-08-25');
    expect(citas.map((c) => c.fecha)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('el horizonte es el último recibo · no se amortiza un préstamo ya pagado', () => {
    const citas = adelantosDeLaRegla(regla({}), '2026-06-25');
    expect(citas.at(-1)!.fecha).toBe('2026-06-25');
  });

  it('el importe puede crecer un % al año · por años completos desde el primero', () => {
    const citas = adelantosDeLaRegla(
      regla({ cadencia: 'ANUAL', crecimientoAnual: 10, importe: 1000, veces: 3 }),
      '2043-08-25'
    );
    expect(citas.map((c) => c.importe)).toEqual([1000, 1100, 1210]);
  });

  it('dos reglas el mismo día son UNA operación', () => {
    const calendario = calendarioDeAdelantos(
      [
        regla({ id: 'mensual', veces: 12 }),
        regla({ id: 'extra', cadencia: 'ANUAL', mes: 6, importe: 3000, desde: '2026-03-25' }),
      ],
      '2027-01-25'
    );
    const junio = calendario.find((c) => c.fecha === '2026-06-25')!;
    expect(junio.importe).toBe(3200);
    expect(junio.reglaIds.sort()).toEqual(['extra', 'mensual']);
  });
});

// ── Encadenar de verdad ─────────────────────────────────────────────────────

describe('cada adelanto trabaja sobre lo que dejó el anterior', () => {
  const p = unicaja();

  it('el capital vivo baja más que la suma de los adelantos', () => {
    const original = plan(p);
    const sim = simularPlanDeAdelantos(p, original, [regla({ veces: 12 })], {
      modo: 'REDUCIR_PLAZO',
    });

    // Doce adelantos de 200 € son 2.400 € de capital... pero el cuadro además
    // amortiza más en cada recibo, porque el interés que se come la cuota es
    // menor. Si el motor no encadenara, el vivo bajaría exactamente 2.400 €.
    expect(sim.adelantos).toHaveLength(12);
    expect(sim.totalAportado).toBe(2400);

    // Se mira DESPUÉS del último adelanto: el recibo del 25 de febrero se
    // conserva entero —paga un mes ya corrido— y el adelanto de ese día entra
    // por detrás.
    const vivoAntes = original.periodos.find((x) => x.fechaCargo === '2027-03-25')!.principalFinal;
    const vivoDespues = sim.plan!.periodos.find(
      (x) => x.fechaCargo === '2027-03-25' && !x.esAdelantoDeCapital
    )!.principalFinal;
    expect(vivoAntes - vivoDespues).toBeGreaterThan(2400);
  });

  // Reducir cuota TAMBIÉN acorta cuando el plan es recurrente, y esto está aquí
  // para que nadie lo «arregle»: cada mes se recalcula la cuota sobre lo que
  // queda, pero al mes siguiente vuelven a entrar los 200 € encima de una cuota
  // ya más pequeña. El préstamo se acaba antes de todos modos — menos que
  // reduciendo plazo, que es lo que la pantalla tiene que dejar comparar.
  it('los dos modos acortan, y reducir plazo acorta más', () => {
    const { reducirPlazo, reducirCuota } = compararModos(p, plan(p), [regla({})], {});

    expect(reducirPlazo.fechaFinDespues! < reducirPlazo.fechaFinAntes!).toBe(true);
    expect(reducirCuota.fechaFinDespues! < reducirCuota.fechaFinAntes!).toBe(true);
    expect(reducirPlazo.mesesGanados).toBeGreaterThan(reducirCuota.mesesGanados);
  });

  it('reducir cuota baja el recibo · reducir plazo lo mantiene', () => {
    const { reducirPlazo, reducirCuota } = compararModos(p, plan(p), [regla({})], {});

    expect(reducirPlazo.despues.cuota).toBe(reducirPlazo.antes.cuota);
    expect(reducirCuota.despues.cuota).toBeLessThan(reducirCuota.antes.cuota);

    // Y la rebaja de verdad no es la del primer recibo, es la pendiente: a un
    // año la cuota ha bajado mucho más que el primer día.
    const primerEscalon = reducirCuota.antes.cuota - reducirCuota.despues.cuota;
    const alAnio = reducirCuota.antes.cuota - reducirCuota.cuotaEnUnAnio;
    expect(alAnio).toBeGreaterThan(primerEscalon * 5);
  });

  it('los dos modos ahorran intereses, y reducir plazo ahorra más', () => {
    const { reducirPlazo, reducirCuota } = compararModos(p, plan(p), [regla({})], {});
    expect(reducirCuota.ahorroIntereses).toBeGreaterThan(0);
    expect(reducirPlazo.ahorroIntereses).toBeGreaterThan(reducirCuota.ahorroIntereses);
  });

  it('un plan que salda el préstamo deja de meter dinero y lo dice', () => {
    const sim = simularPlanDeAdelantos(p, plan(p), [regla({ importe: 20000 })], {
      modo: 'REDUCIR_PLAZO',
    });

    expect(sim.totalAportado).toBeLessThanOrEqual(85000);
    expect(sim.adelantos.length).toBeLessThan(sim.previstos);
    expect(sim.avisos.join(' ')).toMatch(/saldado/);

    // Con 20.000 € al mes desde marzo, el préstamo se acaba en junio: quedan
    // los tres recibos de en medio y ni uno más.
    expect(sim.fechaFinDespues).toBe('2026-06-25');
    expect(sim.despues.recibos).toBe(3);
    expect(sim.adelantos.at(-1)!.principalDespues).toBe(0);
  });

  it('un plan que arranca antes de lo ya pagado avisa de que es un «qué habría pasado»', () => {
    const sim = simularPlanDeAdelantos(p, plan(p), [regla({ desde: '2025-03-25' })], {
      modo: 'REDUCIR_PLAZO',
    });
    expect(sim.avisos.join(' ')).toMatch(/antes del último recibo pagado/);
  });

  it('lo pagado no se toca', () => {
    const original = plan(p);
    const sim = simularPlanDeAdelantos(p, original, [regla({ veces: 6 })], {
      modo: 'REDUCIR_CUOTA',
    });

    const pagados = original.periodos.filter((x) => x.fechaCargo < '2026-02-25');
    expect(sim.plan!.periodos.slice(0, pagados.length)).toEqual(pagados);
  });
});

// ── La comisión, como la cobra el banco ─────────────────────────────────────

describe('el cupo anual exento decide lo que cuesta el plan', () => {
  const conComision = unicaja({
    comisionReembolsoParcial: { tramos: [{ porcentaje: 0.25 }], origen: 'ESCRITURA' },
  } as Partial<Prestamo>);

  it('sin cupo, cada adelanto paga su comisión', () => {
    const sim = simularPlanDeAdelantos(conComision, plan(conComision), [regla({ veces: 12 })], {
      modo: 'REDUCIR_PLAZO',
    });
    // 12 × 200 € × 0,25 %
    expect(sim.totalComisiones).toBe(6);
  });

  it('con cupo de sobra, el plan entero sale gratis', () => {
    const sim = simularPlanDeAdelantos(conComision, plan(conComision), [regla({ veces: 12 })], {
      modo: 'REDUCIR_PLAZO',
      limiteAnualExento: { base: 'ANIO_NATURAL', porcentajeDelCapitalInicial: 20 },
    });
    expect(sim.totalComisiones).toBe(0);
  });

  it('solo cotiza lo que excede del cupo, y el cupo se renueva cada año', () => {
    const sim = simularPlanDeAdelantos(
      conComision,
      plan(conComision),
      [regla({ importe: 1000, veces: 24 })],
      {
        modo: 'REDUCIR_PLAZO',
        limiteAnualExento: { base: 'ANIO_NATURAL', importe: 3000 },
      }
    );

    // 2026: 10 adelantos (marzo→diciembre) = 10.000 €, exentos 3.000 → cotizan
    // 7.000. 2027: 12.000 €, exentos 3.000 → cotizan 9.000. 2028: 2.000, exentos
    // 2.000 → cotiza 0. Total 16.000 × 0,25 % = 40 €.
    expect(sim.totalAportado).toBe(24000);
    expect(sim.adelantos.reduce((s, a) => s + a.exento, 0)).toBe(8000);
    expect(sim.totalComisiones).toBe(40);
  });

  it('la anualidad del préstamo no es el año natural', () => {
    const base = { modo: 'REDUCIR_PLAZO' as const };
    const reglas = [regla({ importe: 2000, desde: '2026-06-25', veces: 6 })];

    // La firma es el 25 de agosto: la anualidad corta en agosto, el año natural
    // en enero. Con seis adelantos de junio a noviembre el reparto cambia.
    const natural = simularPlanDeAdelantos(conComision, plan(conComision), reglas, {
      ...base,
      limiteAnualExento: { base: 'ANIO_NATURAL', importe: 4000 },
    });
    const anualidad = simularPlanDeAdelantos(conComision, plan(conComision), reglas, {
      ...base,
      limiteAnualExento: { base: 'ANUALIDAD', importe: 4000 },
    });

    expect(natural.adelantos.reduce((s, a) => s + a.exento, 0)).toBe(4000);
    // Junio y julio caen en una anualidad; de agosto en adelante, en la
    // siguiente · dos cupos en vez de uno.
    expect(anualidad.adelantos.reduce((s, a) => s + a.exento, 0)).toBe(8000);
  });

  it('el ahorro que se enseña es NETO de comisiones y gastos', () => {
    const sim = simularPlanDeAdelantos(conComision, plan(conComision), [regla({ veces: 12 })], {
      modo: 'REDUCIR_PLAZO',
      gastosFijosPorOperacion: 30,
    });

    expect(sim.totalGastos).toBe(360);
    expect(sim.ahorroNeto).toBe(
      Math.round((sim.ahorroIntereses - sim.totalComisiones - sim.totalGastos) * 100) / 100
    );
    expect(sim.totalSalidaCaja).toBe(
      Math.round((sim.totalAportado + sim.totalComisiones + sim.totalGastos) * 100) / 100
    );
  });
});

// ── Que no invente nada cuando no hay nada ──────────────────────────────────

describe('sin reglas no hay plan', () => {
  const p = unicaja();

  it('un plan vacío devuelve el cuadro tal cual', () => {
    const original = plan(p);
    const sim = simularPlanDeAdelantos(p, original, [], { modo: 'REDUCIR_PLAZO' });
    expect(sim.plan).toBe(original);
    expect(sim.ahorroIntereses).toBe(0);
    expect(sim.adelantos).toHaveLength(0);
  });

  it('una regla sin importe no produce citas', () => {
    expect(adelantosDeLaRegla(regla({ importe: 0 }), '2043-08-25')).toHaveLength(0);
  });

  it('sin cuadro se dice, en vez de simular sobre la nada', () => {
    const sim = simularPlanDeAdelantos(p, null, [regla({})], { modo: 'REDUCIR_PLAZO' });
    expect(sim.avisos.join(' ')).toMatch(/no tiene cuadro/);
    expect(sim.adelantos).toHaveLength(0);
  });
});
