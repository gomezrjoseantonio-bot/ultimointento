// El consumo de una tarjeta · lo REAL frente a lo previsto.
//
// La fila de la tarjeta enseñaba el importe del recibo bajo el rótulo
// "consumido · ciclo". El recibo suma piezas confirmadas y sin confirmar, así
// que una tarjeta con cinco compras anotadas y ninguna punteada decía "has
// consumido 1.010,72 €" cuando no se había confirmado ni un euro. Estos casos
// son el candado de esa distinción.

import { consumoDeTarjeta, serieDiariaTarjeta } from '../tesoreriaV6Metrics';
import type { Movement, TreasuryEvent } from '../db';

/** Una PIEZA de tarjeta · una compra anotada, punteable una a una. */
const pieza = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    sourceType: 'gasto_tarjeta',
    tarjetaId: 7,
    type: 'expense',
    amount: 100,
    predictedDate: '2026-08-04',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

const movimiento = (over: Partial<Movement> = {}): Movement =>
  ({
    id: 1,
    accountId: 3,
    tarjetaId: 7,
    date: '2026-08-04',
    amount: -50,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Movement;

const consumo = (eventos: TreasuryEvent[], movimientos: Movement[] = []) =>
  consumoDeTarjeta({
    tarjetaId: 7,
    eventos,
    movimientos,
    desde: '2026-08-01',
    hasta: '2026-08-31',
  });

describe('lo anotado NO es lo consumido', () => {
  it('cinco compras sin puntear son 0 € consumidos · todo pendiente', () => {
    const compras = [358.71, 320, 160, 108.9, 63.11].map((amount, i) =>
      pieza({ id: i + 1, amount })
    );

    const r = consumo(compras);
    expect(r.confirmado).toBe(0);
    expect(r.pendiente).toBe(1010.72);
    // El recibo del ciclo sí es la suma: es lo que el banco va a cargar.
    expect(r.total).toBe(1010.72);
    expect(r.porConfirmar).toBe(5);
  });

  it('al puntear una compra pasa a consumida · y deja de estar pendiente', () => {
    const r = consumo([
      pieza({ id: 1, amount: 320, status: 'executed', actualAmount: 320 }),
      pieza({ id: 2, amount: 160 }),
    ]);

    expect(r.confirmado).toBe(320);
    expect(r.pendiente).toBe(160);
    expect(r.total).toBe(480);
    expect(r.porConfirmar).toBe(1);
  });

  it('manda el importe REAL de la compra punteada, no el que se anotó', () => {
    // Se anotó 100 € y el banco cobró 87,40: lo consumido es 87,40.
    const r = consumo([pieza({ amount: 100, status: 'executed', actualAmount: 87.4 })]);
    expect(r.confirmado).toBe(87.4);
  });

  it('una compra descartada no cuenta ni como consumo ni como pendiente', () => {
    const r = consumo([pieza({ amount: 200, descartado: true })]);
    expect(r.total).toBe(0);
    expect(r.porConfirmar).toBe(0);
  });
});

describe('cada tarjeta cuenta lo suyo', () => {
  it('las piezas de otra tarjeta no suman', () => {
    const r = consumo([pieza({ id: 1, amount: 100 }), pieza({ id: 2, amount: 999, tarjetaId: 8 })]);
    expect(r.total).toBe(100);
  });

  it('fuera del rango no suma · el ciclo lo acota quien llama', () => {
    const r = consumo([pieza({ amount: 100, predictedDate: '2026-07-30' })]);
    expect(r.total).toBe(0);
  });
});

describe('el débito va por movimientos · no tiene piezas', () => {
  it('lo gastado con la tarjeta de débito cuenta como consumido', () => {
    const r = consumo([], [movimiento({ amount: -75.5 })]);
    expect(r.confirmado).toBe(75.5);
    expect(r.pendiente).toBe(0);
  });

  it('un abono (importe positivo) no infla el consumo', () => {
    const r = consumo([], [movimiento({ amount: 40 })]);
    expect(r.confirmado).toBe(0);
  });
});

describe('el día a día de la tarjeta', () => {
  const serie = (eventos: TreasuryEvent[], movimientos: Movement[] = []) =>
    serieDiariaTarjeta({ tarjetaId: 7, eventos, movimientos, year: 2026, month0: 7 });

  it('tiene un punto por día del mes · agosto son 31', () => {
    expect(serie([])).toHaveLength(31);
  });

  it('separa en cada día lo punteado de lo que falta', () => {
    const dias = serie([
      pieza({ id: 1, amount: 320, predictedDate: '2026-08-04', status: 'executed', actualAmount: 320 }),
      pieza({ id: 2, amount: 160, predictedDate: '2026-08-04' }),
      pieza({ id: 3, amount: 63.11, predictedDate: '2026-08-01' }),
    ]);

    const dia4 = dias.find((d) => d.dia === '2026-08-04')!;
    expect(dia4.salidaConf).toBe(320);
    expect(dia4.salidaPrev).toBe(160);

    const dia1 = dias.find((d) => d.dia === '2026-08-01')!;
    expect(dia1.salidaConf).toBe(0);
    expect(dia1.salidaPrev).toBe(63.11);
  });

  it('una tarjeta no ingresa · una devolución RESTA del gasto de su día', () => {
    // Con barra hacia arriba se leería como un cobro, que no lo es.
    const dias = serie([
      pieza({ id: 1, amount: 100, predictedDate: '2026-08-10' }),
      pieza({ id: 2, amount: 30, type: 'income', predictedDate: '2026-08-10' }),
    ]);

    const dia = dias.find((d) => d.dia === '2026-08-10')!;
    expect(dia.salidaPrev).toBe(70);
    expect(dia.entradaConf).toBe(0);
    expect(dia.entradaPrev).toBe(0);
  });
});
