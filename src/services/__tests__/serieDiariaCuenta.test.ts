// F3 · la serie diaria de una cuenta · el gráfico "Día a día de {mes}".
//
// El candado que de verdad importa es la FUENTE DOBLE: lo confirmado sale de
// `movements` y lo pendiente de `treasuryEvents`. Leyendo solo eventos, las
// barras sólidas saldrían vacías, porque en este modelo `confirmed` significa
// "decidido, esperando al banco" y lo que ya se movió vive como Movement.

import { serieDiariaCuenta } from '../tesoreriaV6Metrics';
import type { Movement, TreasuryEvent } from '../db';

const YEAR = 2026;
const MONTH0 = 7; // agosto

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent => ({
  type: 'expense',
  amount: 100,
  predictedDate: '2026-08-10',
  description: 'x',
  sourceType: 'manual',
  status: 'predicted',
  accountId: 1,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const mov = (over: Partial<Movement> = {}): Movement =>
  ({
    id: 1,
    accountId: 1,
    date: '2026-08-05',
    amount: -50,
    description: 'x',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Movement;

const serie = (eventos: TreasuryEvent[], movimientos: Movement[] = [], cuentaId = 1) =>
  serieDiariaCuenta({ cuentaId, eventos, movimientos, year: YEAR, month0: MONTH0 });

const dia = (s: ReturnType<typeof serie>, iso: string) => s.find((d) => d.dia === iso)!;

describe('la rejilla del mes', () => {
  it('devuelve un punto por día, agosto entero, aunque no haya nada', () => {
    const s = serie([], []);
    expect(s).toHaveLength(31);
    expect(s[0].dia).toBe('2026-08-01');
    expect(s[30].dia).toBe('2026-08-31');
    // Sin datos, todo a cero: el gráfico pinta el mes vacío, no una lista corta.
    expect(s.every((d) => d.entradaConf + d.entradaPrev + d.salidaConf + d.salidaPrev === 0)).toBe(true);
  });

  it('respeta los meses de 28, 30 y 31 días', () => {
    const enFebrero = serieDiariaCuenta({ cuentaId: 1, eventos: [], movimientos: [], year: 2026, month0: 1 });
    const enAbril = serieDiariaCuenta({ cuentaId: 1, eventos: [], movimientos: [], year: 2026, month0: 3 });
    expect(enFebrero).toHaveLength(28);
    expect(enAbril).toHaveLength(30);
  });
});

describe('la fuente doble', () => {
  it('lo CONFIRMADO sale de movements · un evento confirmed NO lo llena', () => {
    // Este es el fallo que la fuente única habría producido: el evento está
    // "confirmado" pero el dinero no se ha movido, así que es pendiente.
    const s = serie(
      [ev({ status: 'confirmed', type: 'income', amount: 500, predictedDate: '2026-08-12' })],
      []
    );
    const d = dia(s, '2026-08-12');
    expect(d.entradaConf).toBe(0);
    expect(d.entradaPrev).toBe(500);
  });

  it('lo PENDIENTE sale de treasuryEvents vivos', () => {
    const s = serie([
      ev({ type: 'income', amount: 300, predictedDate: '2026-08-03' }),
      ev({ type: 'expense', amount: 120, predictedDate: '2026-08-03' }),
    ]);
    const d = dia(s, '2026-08-03');
    expect(d.entradaPrev).toBe(300);
    expect(d.salidaPrev).toBe(120);
  });

  it('un movimiento real llena la barra sólida, por signo', () => {
    const s = serie([], [
      mov({ id: 1, date: '2026-08-05', amount: 900 }),
      mov({ id: 2, date: '2026-08-05', amount: -250 }),
    ]);
    const d = dia(s, '2026-08-05');
    expect(d.entradaConf).toBe(900);
    // Los importes salen en positivo · la dirección la da el eje, no el signo.
    expect(d.salidaConf).toBe(250);
  });

  it('confirmado y pendiente conviven en el mismo día sin pisarse', () => {
    const s = serie(
      [ev({ type: 'expense', amount: 40, predictedDate: '2026-08-09' })],
      [mov({ date: '2026-08-09', amount: -60 })]
    );
    const d = dia(s, '2026-08-09');
    expect(d.salidaConf).toBe(60);
    expect(d.salidaPrev).toBe(40);
  });
});

describe('lo que NO cuenta', () => {
  it('un previsto descartado no existe · nunca ocurrió', () => {
    const s = serie([ev({ amount: 999, predictedDate: '2026-08-10', descartado: true })]);
    expect(dia(s, '2026-08-10').salidaPrev).toBe(0);
  });

  it('un evento ya ejecutado no se cuenta dos veces · su realidad es el movimiento', () => {
    const s = serie(
      [ev({ status: 'executed', amount: 70, predictedDate: '2026-08-11' })],
      [mov({ date: '2026-08-11', amount: -70 })]
    );
    const d = dia(s, '2026-08-11');
    expect(d.salidaPrev).toBe(0);
    expect(d.salidaConf).toBe(70);
  });

  it('una pieza de tarjeta no es un cargo de la cuenta · sale en el recibo', () => {
    const s = serie([ev({ sourceType: 'gasto_tarjeta', amount: 33, predictedDate: '2026-08-14' })]);
    expect(dia(s, '2026-08-14').salidaPrev).toBe(0);
  });

  it('la compra con tarjeta de crédito tampoco · llega en el recibo', () => {
    const s = serie([], [mov({ date: '2026-08-15', amount: -80, gastoTarjetaCredito: true })]);
    expect(dia(s, '2026-08-15').salidaConf).toBe(0);
  });

  it('el saldo de apertura no es un movimiento del día', () => {
    const s = serie([], [mov({ date: '2026-08-01', amount: 5000, isOpeningBalance: true })]);
    expect(dia(s, '2026-08-01').entradaConf).toBe(0);
  });

  it('un traspaso interno no entra · ni por la pata que sale ni por la que entra', () => {
    // Sus dos patas espejo inflarían las barras de los dos lados a la vez.
    const s = serie(
      [ev({ categoryKey: 'traspaso_salida', amount: 2000, predictedDate: '2026-08-20' })],
      [mov({ date: '2026-08-20', amount: -2000, categoryKey: 'traspaso_salida' })]
    );
    const d = dia(s, '2026-08-20');
    expect(d.salidaPrev).toBe(0);
    expect(d.salidaConf).toBe(0);
  });

  it('lo de OTRA cuenta no se cuela', () => {
    const s = serie(
      [ev({ accountId: 2, amount: 400, predictedDate: '2026-08-07' })],
      [mov({ accountId: 2, date: '2026-08-07', amount: -400 })],
      1
    );
    const d = dia(s, '2026-08-07');
    expect(d.salidaPrev).toBe(0);
    expect(d.salidaConf).toBe(0);
  });

  it('lo de otro mes se queda fuera de la rejilla', () => {
    const s = serie(
      [ev({ amount: 500, predictedDate: '2026-09-02' })],
      [mov({ date: '2026-07-30', amount: -500 })]
    );
    expect(s.every((d) => d.salidaPrev === 0 && d.salidaConf === 0)).toBe(true);
  });
});

describe('acumulación en el día', () => {
  it('varios apuntes del mismo día se suman, y se redondea a dos decimales', () => {
    const s = serie(
      [
        ev({ type: 'income', amount: 10.1, predictedDate: '2026-08-18' }),
        ev({ type: 'income', amount: 20.2, predictedDate: '2026-08-18' }),
      ],
      [mov({ id: 1, date: '2026-08-18', amount: -0.1 }), mov({ id: 2, date: '2026-08-18', amount: -0.2 })]
    );
    const d = dia(s, '2026-08-18');
    expect(d.entradaPrev).toBe(30.3);
    expect(d.salidaConf).toBe(0.3);
  });

  it('la magnitud manda sobre el signo del importe guardado', () => {
    // Los generadores no comparten convención de signo: un gasto puede venir
    // con `amount` negativo. Sin |amount| se contaría como ingreso.
    const s = serie([ev({ type: 'expense', amount: -45, predictedDate: '2026-08-22' })]);
    const d = dia(s, '2026-08-22');
    expect(d.salidaPrev).toBe(45);
    expect(d.entradaPrev).toBe(0);
  });
});
