// Candado de los cálculos de la pantalla de Tesorería V6.
//
// Lo que más protege: que un evento DESCARTADO (v84) no toque ningún número, y
// que un evento ya EJECUTADO no se cuente dos veces (una como pendiente y otra
// como movimiento real), que es el error que inflaría el Cierre en silencio.

import {
  calcularKpisHero,
  estadoDeCuenta,
  proyectarMeses,
  calcularRealidad,
  importeConSigno,
  esPendiente,
  rangoDelMes,
} from '../tesoreriaV6Metrics';
import type { Account, Movement, TreasuryEvent } from '../db';

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent => ({
  type: 'expense',
  amount: 100,
  predictedDate: '2026-07-10',
  description: 'x',
  sourceType: 'manual',
  status: 'predicted',
  createdAt: '',
  updatedAt: '',
  ...over,
});

const mov = (over: Partial<Movement> = {}): Movement => ({
  accountId: 1,
  date: '2026-07-10',
  amount: -100,
  description: 'x',
  status: 'pendiente',
  unifiedStatus: 'conciliado',
  source: 'import',
  category: { tipo: 'Gastos' },
  type: 'Gasto',
  origin: 'CSV',
  movementState: 'Confirmado',
  ambito: 'PERSONAL',
  statusConciliacion: 'sin_match',
  createdAt: '',
  updatedAt: '',
  ...over,
});

const cuenta = (id: number): Account => ({
  id,
  iban: `ES00${id}`,
  status: 'ACTIVE',
  activa: true,
  createdAt: '',
  updatedAt: '',
});

describe('convenciones de signo y pendiente', () => {
  it('la dirección la marca `type`, no el signo de `amount`', () => {
    // treasurySyncService guarda gastos en positivo y otros en negativo; sin
    // Math.abs, un gasto de -100 se contaría como ingreso de +100.
    expect(importeConSigno({ amount: 100, type: 'expense' })).toBe(-100);
    expect(importeConSigno({ amount: -100, type: 'expense' })).toBe(-100);
    expect(importeConSigno({ amount: -650, type: 'income' })).toBe(650);
  });

  it('un descartado no es pendiente, y un ejecutado tampoco', () => {
    expect(esPendiente(ev({ status: 'predicted' }))).toBe(true);
    expect(esPendiente(ev({ status: 'confirmed' }))).toBe(true);
    expect(esPendiente(ev({ status: 'predicted', descartado: true }))).toBe(false);
    // Ya tiene su Movement · contarlo otra vez duplicaría el importe.
    expect(esPendiente(ev({ status: 'executed' }))).toBe(false);
  });

  it('rangoDelMes acierta con los meses de 30, 31 y con febrero bisiesto', () => {
    expect(rangoDelMes(2026, 6)).toMatchObject({ desde: '2026-07-01', hasta: '2026-07-31', ultimoDia: 31 });
    expect(rangoDelMes(2026, 8)).toMatchObject({ hasta: '2026-09-30', ultimoDia: 30 });
    expect(rangoDelMes(2028, 1)).toMatchObject({ hasta: '2028-02-29', ultimoDia: 29 });
  });
});

describe('§4.1 · KPIs del hero', () => {
  const saldos = new Map([[1, 1000], [2, 500]]);

  it('suma saldos, separa entrar/salir y proyecta el cierre', () => {
    const k = calcularKpisHero({
      cuentas: [cuenta(1), cuenta(2)],
      saldoPorCuenta: saldos,
      eventos: [
        ev({ type: 'income', amount: 650, predictedDate: '2026-07-20' }),
        ev({ type: 'expense', amount: 74.09, predictedDate: '2026-07-25' }),
        ev({ type: 'expense', amount: 999, predictedDate: '2026-08-01' }), // otro mes
      ],
      year: 2026,
      month0: 6,
    });

    expect(k.saldo).toBe(1500);
    expect(k.numCuentas).toBe(2);
    expect(k.pendienteEntrar).toBe(650);
    expect(k.movimientosEntrar).toBe(1);
    expect(k.pendienteSalir).toBe(-74.09);
    expect(k.movimientosSalir).toBe(1);
    expect(k.cierre).toBe(2075.91);
    expect(k.ultimoDia).toBe(31);
  });

  it('el descartado no mueve ni el pendiente ni el cierre', () => {
    const conDescarte = calcularKpisHero({
      cuentas: [cuenta(1)],
      saldoPorCuenta: saldos,
      eventos: [ev({ type: 'expense', amount: 500, predictedDate: '2026-07-20', descartado: true })],
      year: 2026,
      month0: 6,
    });
    expect(conDescarte.pendienteSalir).toBe(0);
    expect(conDescarte.movimientosSalir).toBe(0);
    expect(conDescarte.cierre).toBe(1000);
  });

  it('no cuenta las cuentas borradas', () => {
    const k = calcularKpisHero({
      cuentas: [cuenta(1), { ...cuenta(2), status: 'DELETED' }],
      saldoPorCuenta: saldos,
      eventos: [],
      year: 2026,
      month0: 6,
    });
    expect(k.numCuentas).toBe(1);
    expect(k.saldo).toBe(1000);
  });
});

describe('§4.2 · estado de la tarjeta', () => {
  const comun = { year: 2026, month0: 6, hoy: '2026-07-15' };

  it('al día si no queda nada pendiente', () => {
    expect(estadoDeCuenta({ saldoHoy: 1000, eventos: [], ...comun })).toEqual({ tipo: 'al-dia' });
  });

  /**
   * "N por confirmar" es el MISMO N que la bandeja de §4.4: lo que ya venció y
   * sigue sin confirmar.
   *
   * Contaba lo contrario —lo que quedaba por venir— mientras la bandeja listaba
   * lo vencido. Dos conjuntos casi disjuntos: la tarjeta decía 9, se pulsaba, y
   * la pestaña de dentro decía 3.
   */
  it('cuenta lo VENCIDO sin confirmar, que es lo que hay que hacer', () => {
    const e = estadoDeCuenta({
      saldoHoy: 1000,
      eventos: [
        ev({ amount: 10, predictedDate: '2026-07-01' }), // venció
        // La FRONTERA · el de hoy cuenta, porque la bandeja usa `f <= hoy`.
        // Estaba fechado el 10 con `hoy` el 15, así que decía "hoy" en el
        // comentario y probaba otra cosa: el caso límite quedaba sin cubrir.
        ev({ amount: 10, predictedDate: comun.hoy }),
        ev({ amount: 10, predictedDate: '2026-07-25' }), // aún no toca
      ],
      ...comun,
    });
    expect(e).toEqual({ tipo: 'por-confirmar', n: 2 });
  });

  it('la frontera del otro lado · el de mañana NO cuenta', () => {
    // Derivada de `hoy`, no escrita a mano: con una fecha fija, cambiar `hoy`
    // dejaría el test en verde probando otra cosa — que es exactamente el
    // fallo que este par de casos viene a cerrar.
    //
    // En UTC explícito · sin la `Z`, el cálculo depende de la zona horaria de
    // quien ejecute, y en este repo hay tests que fuerzan `process.env.TZ`.
    const manana = (() => {
      const d = new Date(`${comun.hoy}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();

    const e = estadoDeCuenta({
      saldoHoy: 1000,
      eventos: [ev({ amount: 10, predictedDate: manana })],
      ...comun,
    });
    expect(e).toEqual({ tipo: 'al-dia' });
  });

  it('lo que aún no ha llegado no es una tarea · eso lo dice el hero', () => {
    const e = estadoDeCuenta({
      saldoHoy: 1000,
      eventos: [ev({ amount: 10, predictedDate: '2026-07-25' })],
      ...comun,
    });
    expect(e).toEqual({ tipo: 'al-dia' });
  });

  it('un vencido de un mes anterior sigue siendo trabajo de hoy', () => {
    const e = estadoDeCuenta({
      saldoHoy: 1000,
      eventos: [ev({ amount: 10, predictedDate: '2026-05-14' })],
      ...comun,
    });
    expect(e).toEqual({ tipo: 'por-confirmar', n: 1 });
  });

  it('un evento sin fecha no se cuela · la bandeja tampoco lo lista', () => {
    const e = estadoDeCuenta({
      saldoHoy: 1000,
      eventos: [ev({ amount: 10, predictedDate: '' })],
      ...comun,
    });
    expect(e).toEqual({ tipo: 'al-dia' });
  });

  it('avisa de que se queda corta, con el día y el mínimo', () => {
    const e = estadoDeCuenta({
      saldoHoy: 100,
      eventos: [
        ev({ amount: 60, predictedDate: '2026-07-20' }),
        ev({ amount: 80, predictedDate: '2026-07-22' }), // aquí baja de 0
      ],
      ...comun,
    });
    expect(e).toEqual({ tipo: 'se-queda-corta', minimo: -40, dia: '2026-07-22' });
  });

  it('"se queda corta" gana a "por confirmar": es lo único que pide actuar', () => {
    const e = estadoDeCuenta({
      saldoHoy: 10,
      eventos: [ev({ amount: 50, predictedDate: '2026-07-20' })],
      ...comun,
    });
    expect(e.tipo).toBe('se-queda-corta');
  });

  it('un descartado no puede dejar la cuenta corta', () => {
    const e = estadoDeCuenta({
      saldoHoy: 10,
      eventos: [ev({ amount: 5000, predictedDate: '2026-07-20', descartado: true })],
      ...comun,
    });
    expect(e).toEqual({ tipo: 'al-dia' });
  });
});

describe('§4.3 · rejilla de 6 meses', () => {
  it('encadena: el cierre de un mes es el saldo de partida del siguiente', () => {
    const meses = proyectarMeses({
      saldoHoy: 1000,
      eventos: [
        ev({ type: 'income', amount: 500, predictedDate: '2026-07-20' }),
        ev({ type: 'expense', amount: 200, predictedDate: '2026-08-10' }),
      ],
      year: 2026,
      month0: 6,
      hoy: '2026-07-15',
      meses: 3,
    });

    expect(meses).toHaveLength(3);
    expect(meses[0]).toMatchObject({ month0: 6, entra: 500, sale: 0, cierre: 1500, enCurso: true });
    expect(meses[1]).toMatchObject({ month0: 7, entra: 0, sale: -200, cierre: 1300 });
    expect(meses[2]).toMatchObject({ month0: 8, cierre: 1300 });
  });

  it('el mes en curso cuenta el mes ENTERO · un vencido sin confirmar sigue faltando', () => {
    // Recortaba por `hoy`, y eso dejaba fuera los previstos vencidos: una renta
    // del día 2 que todavía no ha entrado sigue siendo dinero que falta por
    // entrar. El hero sí los contaba, así que la misma cifra salía distinta en
    // dos sitios de la misma pantalla.
    const meses = proyectarMeses({
      saldoHoy: 1000,
      eventos: [
        ev({ type: 'income', amount: 300, predictedDate: '2026-07-02' }),
        ev({ type: 'income', amount: 500, predictedDate: '2026-07-20' }),
      ],
      year: 2026,
      month0: 6,
      hoy: '2026-07-15',
      meses: 1,
    });
    expect(meses[0].entra).toBe(800);
  });

  it('la tarjeta del mes en curso cuadra con el hero · era la queja de Jose', () => {
    const eventos = [
      ev({ type: 'income', amount: 395, predictedDate: '2026-07-01' }),
      ev({ type: 'income', amount: 330, predictedDate: '2026-07-01' }),
      ev({ type: 'expense', amount: 200, predictedDate: '2026-07-25' }),
    ];
    const kpis = calcularKpisHero({
      cuentas: [{ id: 1, status: 'ACTIVE' } as never],
      saldoPorCuenta: new Map([[1, 1000]]),
      eventos,
      year: 2026,
      month0: 6,
    });
    const meses = proyectarMeses({
      saldoHoy: 1000,
      eventos,
      year: 2026,
      month0: 6,
      hoy: '2026-07-15',
      meses: 1,
    });

    expect(meses[0].entra).toBe(kpis.pendienteEntrar);
    expect(meses[0].cierre).toBe(kpis.cierre);
  });

  it('cruza el fin de año sin perderse', () => {
    const meses = proyectarMeses({
      saldoHoy: 0,
      eventos: [ev({ type: 'income', amount: 100, predictedDate: '2027-01-10' })],
      year: 2026,
      month0: 10,
      hoy: '2026-11-01',
      meses: 4,
    });
    expect(meses[2]).toMatchObject({ year: 2027, month0: 0, entra: 100 });
  });
});

describe('§4.10 · cómo va el mes', () => {
  it('escala cada línea contra SU propio previsto', () => {
    const r = calcularRealidad({
      eventos: [
        ev({ type: 'income', amount: 1000, predictedDate: '2026-07-05' }),
        ev({ type: 'expense', amount: 200, predictedDate: '2026-07-06' }),
      ],
      movimientos: [mov({ amount: 500 }), mov({ amount: -100 })],
      year: 2026,
      month0: 6,
    });

    expect(r.lineas[0]).toMatchObject({ clave: 'Ingresos', real: 500, previsto: 1000, porcentaje: 50 });
    expect(r.lineas[1]).toMatchObject({ clave: 'Gastos', real: 100, previsto: 200, porcentaje: 50 });
    // §3.4 · con ambos en positivo el Neto SÍ lleva porcentaje: 400 de 800.
    expect(r.lineas[2]).toMatchObject({ clave: 'Neto', real: 400, previsto: 800, porcentaje: 50 });
  });

  it('el Neto NEGATIVO se queda sin porcentaje · ahí el avance engaña', () => {
    // −1.048 sobre −821 daría "128 % lleno", que se lee como mejor cuando
    // significa haber gastado de más.
    const r = calcularRealidad({
      eventos: [ev({ type: 'expense', amount: 821, predictedDate: '2026-07-06' })],
      movimientos: [mov({ amount: -1048 })],
      year: 2026,
      month0: 6,
    });
    const neto = r.lineas.find((l) => l.clave === 'Neto')!;
    expect(neto.real).toBeLessThan(0);
    expect(neto.porcentaje).toBeNull();
  });

  it('la desviación NO cuenta lo que aún no ha pasado', () => {
    const r = calcularRealidad({
      eventos: [
        // Ejecutado con coste real distinto del previsto · sí desvía.
        // `executedMovementId` es lo que escribe `confirmTreasuryEvent`: sin él
        // el mismo pago se contaría dos veces, una por la previsión que cumplió
        // y otra como gasto no planificado.
        ev({ type: 'expense', amount: 1838.42, actualAmount: 1473.42, predictedDate: '2026-07-05', status: 'executed', executedMovementId: 7 }),
        // Aún no ha ocurrido: no entra, o la desviación saldría falsa.
        ev({ type: 'expense', amount: 5000, predictedDate: '2026-07-28' }),
      ],
      movimientos: [mov({ id: 7, amount: -1473.42 })],
      year: 2026,
      month0: 6,
    });

    expect(r.previstoDeLoConfirmado).toBe(1838.42);
    expect(r.pagadoReal).toBe(1473.42);
    expect(r.desviacion).toBe(365);
  });

  // Lo que sale SIN estar previsto es desviación, y de la peor: la pantalla
  // decía "acabarás igual que lo previsto" con 86 € fuera de plan ya salidos.
  it('un pago que nadie previó cuenta entero como desviación', () => {
    const r = calcularRealidad({
      eventos: [
        ev({ type: 'expense', amount: 100, actualAmount: 100, predictedDate: '2026-07-05', status: 'executed', executedMovementId: 1 }),
      ],
      movimientos: [
        mov({ id: 1, amount: -100, date: '2026-07-05' }),
        // Anotado a mano · no responde a ninguna previsión.
        mov({ id: 2, amount: -86, date: '2026-07-06', source: 'manual' }),
      ],
      year: 2026,
      month0: 6,
    });

    expect(r.previstoDeLoConfirmado).toBe(100);
    expect(r.pagadoReal).toBe(186);
    expect(r.desviacion).toBe(-86);
  });

  // Un traspaso interno no es gasto ni ingreso: el dinero cambia de cuenta.
  // Contando sus patas, sacar 20 € al cajero salía a la vez como 20 € gastados
  // y 20 € ingresados.
  it('un traspaso interno no ensucia ni gastos ni ingresos', () => {
    const r = calcularRealidad({
      eventos: [],
      movimientos: [
        mov({ id: 1, amount: -20, categoryKey: 'traspaso_salida' }),
        mov({ id: 2, amount: 20, categoryKey: 'traspaso_entrada' }),
      ],
      year: 2026,
      month0: 6,
    });

    expect(r.lineas[0]).toMatchObject({ clave: 'Ingresos', real: 0 });
    expect(r.lineas[1]).toMatchObject({ clave: 'Gastos', real: 0 });
    expect(r.desviacion).toBe(0);
  });

  // Datos viejos: previsiones ejecutadas que no guardaron a qué movimiento
  // dieron lugar. Se casan por fecha e importe · contar de más aquí diría que
  // te has gastado el doble.
  it('una previsión vieja sin vínculo no duplica su pago', () => {
    const r = calcularRealidad({
      eventos: [
        // Con cuenta · un ejecutado SIEMPRE la tiene (`confirmTreasuryEvent`
        // la exige). Lo que le falta a este es a qué movimiento dio lugar.
        ev({ type: 'expense', amount: 120, actualAmount: 96, predictedDate: '2026-07-05', status: 'executed', accountId: 1 }),
      ],
      movimientos: [mov({ id: 9, accountId: 1, amount: -96, date: '2026-07-05' })],
      year: 2026,
      month0: 6,
    });

    expect(r.pagadoReal).toBe(96);
    expect(r.desviacion).toBe(24);
  });

  it('ignora el movimiento de saldo inicial', () => {
    const r = calcularRealidad({
      eventos: [],
      movimientos: [mov({ amount: 9999, isOpeningBalance: true }), mov({ amount: 50 })],
      year: 2026,
      month0: 6,
    });
    expect(r.lineas[0].real).toBe(50);
  });

  it('sin previsto, el porcentaje es 0 y no NaN ni Infinity (Neto aparte)', () => {
    const r = calcularRealidad({
      eventos: [],
      movimientos: [mov({ amount: 50 })],
      year: 2026,
      month0: 6,
    });
    expect(r.lineas[0].porcentaje).toBe(0);
    // El Neto no lleva porcentaje (A3), así que aquí lo que se comprueba es que
    // dividir entre cero no se cuela en las dos líneas que SÍ lo llevan.
    expect(r.lineas[1].porcentaje).toBe(0);
    expect(r.lineas[2].porcentaje).toBeNull();
  });

  it('el descartado no cuenta como previsto', () => {
    const r = calcularRealidad({
      eventos: [ev({ type: 'expense', amount: 500, predictedDate: '2026-07-05', descartado: true })],
      movimientos: [],
      year: 2026,
      month0: 6,
    });
    expect(r.lineas[1].previsto).toBe(0);
  });
});
