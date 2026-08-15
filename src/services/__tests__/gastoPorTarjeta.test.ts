// Cuánto se ha gastado con una tarjeta en un periodo · VOCABULARIO §3.5.
//
// Es la cifra de la que salen las otras dos: el cargo previsto y la
// bonificación de la hipoteca. Si esta miente, mienten las dos — y una de ellas
// se presume ante el banco.

import {
  gastoDeLaTarjeta,
  gastoDeMovimientos,
  gastoDeMovimientosCredito,
  gastoPorTarjeta,
} from '../gastoPorTarjeta';
import type { Movement, TreasuryEvent } from '../db';
import type { Tarjeta } from '../../types/tarjetas';

const recibo = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    type: 'expense',
    // Los gastos se guardan en negativo.
    amount: -180,
    predictedDate: '2026-02-05',
    description: 'Recibo tarjeta Carrefour',
    sourceType: 'tarjeta_recibo',
    sourceId: 'tarjeta-11-2026-01-24',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

describe('de qué periodo es cada recibo', () => {
  it('la tarjeta y el corte salen de su clave', () => {
    const [p] = gastoPorTarjeta([recibo()]);

    expect(p).toMatchObject({
      tarjetaId: 11,
      fechaCorte: '2026-01-24',
      fechaCargo: '2026-02-05',
      importe: 180,
    });
  });

  // Lo que no es un recibo de tarjeta no dice nada del gasto con tarjeta.
  it('los demás eventos se ignoran', () => {
    const otro = recibo({ sourceType: 'gasto_recurrente', sourceId: 7 });

    expect(gastoPorTarjeta([otro])).toEqual([]);
  });

  it('del periodo más reciente al más antiguo', () => {
    const cortes = gastoPorTarjeta([
      recibo({ sourceId: 'tarjeta-11-2026-01-24' }),
      recibo({ sourceId: 'tarjeta-11-2026-03-24' }),
      recibo({ sourceId: 'tarjeta-11-2026-02-24' }),
    ]).map((p) => p.fechaCorte);

    expect(cortes).toEqual(['2026-03-24', '2026-02-24', '2026-01-24']);
  });
});

describe('cerrado o abierto', () => {
  // Una bonificación se demuestra con lo que YA se cobró, no con lo que
  // esperas gastar. Por eso el estado va en el dato.
  it('cobrado y cuadrado contra el extracto · cerrado', () => {
    expect(gastoPorTarjeta([recibo({ executedMovementId: 55 })])[0].estado).toBe('cerrado');
    expect(gastoPorTarjeta([recibo({ status: 'executed' })])[0].estado).toBe('cerrado');
  });

  // Los DOS enlaces a movimiento valen. `executedMovementId` lo escribe la
  // confirmación y `movementId` lo traen otros caminos; mirando solo uno,
  // algo ya conciliado quedaba por abierto — y de ahí sale un «no cumples» de
  // una bonificación que sí se cumple.
  it('el otro enlace al movimiento también cierra', () => {
    expect(gastoPorTarjeta([recibo({ movementId: 55 })])[0].estado).toBe('cerrado');
  });

  // El periodo en curso crece con cada compra · su cifra está viva.
  it('todavía previsto · abierto', () => {
    expect(gastoPorTarjeta([recibo()])[0].estado).toBe('abierto');
  });
});

describe('lo cobrado manda sobre lo previsto', () => {
  // Al confirmar un cargo se rellenan `actualAmount`/`actualDate` y `amount` se
  // queda como estaba. Contar el previsto sería presumir ante el banco una
  // cifra que nunca se pagó.
  it('un recibo cobrado por otro importe cuenta lo cobrado', () => {
    const cobrado = recibo({
      amount: -180,
      actualAmount: 187.4,
      executedMovementId: 55,
    });

    expect(gastoPorTarjeta([cobrado])[0].importe).toBe(187.4);
  });

  it('y el día que salió de verdad, no el previsto', () => {
    const cobrado = recibo({ actualDate: '2026-02-07', executedMovementId: 55 });

    expect(gastoPorTarjeta([cobrado])[0].fechaCargo).toBe('2026-02-07');
  });

  // Mientras no se cobra no hay cifra real · manda la previsión.
  it('sin cobrar sigue mandando lo previsto', () => {
    expect(gastoPorTarjeta([recibo()])[0].importe).toBe(180);
    expect(gastoPorTarjeta([recibo()])[0].fechaCargo).toBe('2026-02-05');
  });
});

describe('lo que no cuenta', () => {
  // El usuario dijo que ese cargo no ocurre: no es gasto ni previsto ni real.
  // Contarlo inflaría la bonificación, que se presume ante el banco.
  it('un recibo descartado no es gasto', () => {
    expect(gastoPorTarjeta([recibo({ descartado: true })])).toEqual([]);
  });
});

describe('sumar lo gastado', () => {
  const PERIODOS = gastoPorTarjeta([
    recibo({ sourceId: 'tarjeta-11-2026-01-24', amount: -100, executedMovementId: 1 }),
    recibo({ sourceId: 'tarjeta-11-2026-02-24', amount: -200, executedMovementId: 2 }),
    recibo({ sourceId: 'tarjeta-11-2026-03-24', amount: -50 }),
    recibo({ sourceId: 'tarjeta-12-2026-02-24', amount: -900, executedMovementId: 3 }),
  ]);

  it('solo la tarjeta que se pregunta', () => {
    expect(gastoDeLaTarjeta(PERIODOS, 11)).toBe(350);
  });

  it('entre dos cortes, ambos incluidos', () => {
    expect(
      gastoDeLaTarjeta(PERIODOS, 11, { desde: '2026-01-24', hasta: '2026-02-24' })
    ).toBe(300);
  });

  // Lo que se presume ante un banco es lo cobrado · el periodo abierto todavía
  // puede crecer o quedarse corto.
  it('solo lo cerrado cuando lo que se demuestra es real', () => {
    expect(gastoDeLaTarjeta(PERIODOS, 11, { soloCerrados: true })).toBe(300);
  });

  it('una tarjeta sin gasto suma cero', () => {
    expect(gastoDeLaTarjeta(PERIODOS, 99)).toBe(0);
  });
});

// §3.5 · el DÉBITO no tiene recibo del que deducir su gasto —cobra al momento—,
// así que sale de los movimientos que el usuario atribuyó a una tarjeta.
describe('el gasto con tarjeta de débito', () => {
  const TARJETAS = [
    { id: 11, modalidad: 'debito' as const },
    { id: 12, modalidad: 'credito' as const },
  ];

  const mov = (over: Partial<Movement> = {}): Movement =>
    ({
      id: 1,
      accountId: 3,
      date: '2026-03-14',
      amount: -42.5,
      description: 'Mercadona',
      tarjetaId: 11,
      ...over,
    }) as Movement;

  it('cuenta lo pagado con esa tarjeta', () => {
    expect(gastoDeMovimientos([mov()], TARJETAS)).toEqual([
      { tarjetaId: 11, fechaCorte: '2026-03-14', fechaCargo: '2026-03-14', importe: 42.5, estado: 'cerrado' },
    ]);
  });

  // Un movimiento marcado con una de CRÉDITO es su recibo, y ese gasto ya viene
  // por `gastoPorTarjeta`. Contarlo aquí también lo sumaría dos veces, y esta
  // cifra se presume ante un banco.
  it('el crédito no entra por aquí · ya viene por su recibo', () => {
    expect(gastoDeMovimientos([mov({ tarjetaId: 12 })], TARJETAS)).toEqual([]);
  });

  it('sin tarjeta atribuida no cuenta', () => {
    expect(gastoDeMovimientos([mov({ tarjetaId: undefined })], TARJETAS)).toEqual([]);
  });

  it('una tarjeta que ya no está no cuenta', () => {
    expect(gastoDeMovimientos([mov({ tarjetaId: 99 })], TARJETAS)).toEqual([]);
  });

  // Una devolución en la tarjeta no suma consumo.
  it('un ingreso no es gasto', () => {
    expect(gastoDeMovimientos([mov({ amount: 30 })], TARJETAS)).toEqual([]);
  });

  // El débito cobra al momento · su periodo dura un instante, y ese gasto ya
  // ocurrió: no hay nada que esperar.
  it('el movimiento del extracto ya ocurrió · cerrado', () => {
    const [p] = gastoDeMovimientos([mov()], TARJETAS);

    expect(p.estado).toBe('cerrado');
    expect(p.fechaCorte).toBe(p.fechaCargo);
  });

  it('se suma con lo del crédito sin mezclarse', () => {
    const periodos = gastoDeMovimientos(
      [mov({ id: 1, amount: -40 }), mov({ id: 2, amount: -60, date: '2026-03-20' })],
      TARJETAS
    );

    expect(gastoDeLaTarjeta(periodos, 11)).toBe(100);
    expect(gastoDeLaTarjeta(periodos, 12)).toBe(0);
  });
});

// §3.5 · una compra MANUAL en tarjeta de crédito no mueve la cuenta —sale en el
// recibo— pero engorda el periodo abierto de la tarjeta.
describe('el gasto manual con tarjeta de crédito', () => {
  const CREDITO: Tarjeta = {
    id: 12,
    alias: 'Carrefour',
    origen: 'banco',
    modalidad: 'credito',
    cuentaLiquidacionId: 9,
    ciclo: { periodicidad: 'mensual', corte: 20, diaCargo: 31, periodosHastaElCargo: 0 },
    activa: true,
    createdAt: '',
    updatedAt: '',
  } as Tarjeta;

  const compra = (over: Partial<Movement> = {}): Movement =>
    ({
      id: 1,
      accountId: 9,
      date: '2026-08-10',
      amount: -50,
      description: 'Toallas',
      tarjetaId: 12,
      gastoTarjetaCredito: true,
      ...over,
    }) as Movement;

  it('la compra aparece como periodo ABIERTO que crece', () => {
    const periodos = gastoDeMovimientosCredito([compra()], [CREDITO], '2026-08-15');
    expect(periodos).toHaveLength(1);
    expect(periodos[0]).toMatchObject({ tarjetaId: 12, importe: 50, estado: 'abierto' });
  });

  it('dos compras del mismo periodo se suman', () => {
    const periodos = gastoDeMovimientosCredito(
      [compra({ id: 1, amount: -50 }), compra({ id: 2, amount: -13.38, date: '2026-08-12' })],
      [CREDITO],
      '2026-08-15'
    );
    expect(gastoDeLaTarjeta(periodos, 12)).toBeCloseTo(63.38, 2);
  });

  it('un movimiento sin la marca de crédito NO cuenta aquí', () => {
    expect(
      gastoDeMovimientosCredito([compra({ gastoTarjetaCredito: undefined })], [CREDITO], '2026-08-15')
    ).toEqual([]);
  });

  it('un periodo ya cobrado no se re-suma · su importe real vendrá por el recibo', () => {
    // Compra de junio · su cargo (30-jun) ya salió antes de hoy (15-ago).
    const periodos = gastoDeMovimientosCredito([compra({ date: '2026-06-05' })], [CREDITO], '2026-08-15');
    expect(periodos).toEqual([]);
  });
});
