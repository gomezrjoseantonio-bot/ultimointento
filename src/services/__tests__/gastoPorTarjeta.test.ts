// Cuánto se ha gastado con una tarjeta en un periodo · VOCABULARIO §3.5.
//
// Es la cifra de la que salen las otras tres: el cargo previsto, la
// bonificación de la hipoteca y el rendimiento del cashback. Si esta miente,
// mienten las tres — y dos de ellas se presumen ante terceros.

import { gastoDeLaTarjeta, gastoPorTarjeta } from '../gastoPorTarjeta';
import type { TreasuryEvent } from '../db';

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
  // Contarlo inflaría la bonificación y el cashback a la vez.
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
