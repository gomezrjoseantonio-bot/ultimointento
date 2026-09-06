// E2.4.1b · la naturaleza manda · un movimiento interno mueve la cuenta pero
// no cuenta en «cuánto gané / cuánto gasté».

import type { Account, Movement, TreasuryEvent } from '../../db';
import { conSigno, sentidoDe } from '../catalogoUnico';
import { clasificacionDeOrigen } from '../clasificacionDeOrigen';
import { calcularKpisHero, calcularRealidad, esTraspasoInterno, importeConSigno } from '../../tesoreriaV6Metrics';
import { calculateAccountBalanceAtDate } from '../../accountBalanceService';

const AHORA = '2026-08-01T00:00:00.000Z';
const ev = (over: Partial<TreasuryEvent>): TreasuryEvent =>
  ({
    naturaleza: 'gasto',
    amount: 100,
    predictedDate: '2026-08-15',
    description: 'x',
    sourceType: 'manual',
    accountId: 1,
    status: 'predicted',
    ambito: 'personal',
    createdAt: AHORA,
    updatedAt: AHORA,
    ...over,
  }) as TreasuryEvent;
const mov = (over: Partial<Movement>): Movement =>
  ({
    id: 1,
    accountId: 1,
    date: '2026-08-10',
    amount: -100,
    description: 'x',
    status: 'conciliado',
    unifiedStatus: 'conciliado',
    source: 'import',
    category: { tipo: 'Gastos' },
    naturaleza: 'gasto',
    origin: 'CSV',
    movementState: 'Conciliado',
    ambito: 'personal',
    statusConciliacion: 'sin_match',
    createdAt: AHORA,
    updatedAt: AHORA,
    ...over,
  }) as Movement;

describe('sentido y signo · lo que antes decía `type`', () => {
  it('un ingreso entra y un gasto sale · siempre', () => {
    expect(sentidoDe({ naturaleza: 'ingreso' })).toBe('entra');
    expect(sentidoDe({ naturaleza: 'gasto' })).toBe('sale');
    expect(conSigno({ naturaleza: 'ingreso' }, -500)).toBe(500);
    expect(conSigno({ naturaleza: 'gasto' }, 500)).toBe(-500);
  });

  it('un movimiento interno lo dice él · y si no lo dice, sale', () => {
    expect(sentidoDe({ naturaleza: 'movimiento_interno', sentido: 'entra' })).toBe('entra');
    expect(sentidoDe({ naturaleza: 'movimiento_interno' })).toBe('sale');
    expect(importeConSigno(ev({ naturaleza: 'movimiento_interno', sentido: 'entra', amount: 300 }))).toBe(300);
  });

  it('la cuota de un préstamo es gasto · prestamo_hipoteca · cargo entero', () => {
    expect(clasificacionDeOrigen('hipoteca')).toEqual({ naturaleza: 'gasto', familia: 'prestamo_hipoteca' });
    expect(clasificacionDeOrigen('prestamo')).toEqual({ naturaleza: 'gasto', familia: 'prestamo_hipoteca' });
    expect(clasificacionDeOrigen('amortizacion_anticipada').familia).toBe('prestamo_hipoteca');
    // Una aportación cambia el dinero de sitio, no de dueño.
    expect(clasificacionDeOrigen('inversion_aportacion')).toMatchObject({
      naturaleza: 'movimiento_interno',
      sentido: 'sale',
      familia: 'aportacion',
    });
    expect(clasificacionDeOrigen('nomina')).toEqual({ naturaleza: 'ingreso', familia: 'nomina' });
  });
});

describe('un movimiento interno NO cuenta en gasto/ingreso · SÍ en el saldo', () => {
  const cuentas = [{ id: 1, status: 'ACTIVE' }, { id: 2, status: 'ACTIVE' }] as unknown as Account[];

  it('los KPIs del mes ignoran las dos patas de un traspaso · un gasto y un ingreso reales sí cuentan', () => {
    const eventos = [
      ev({ id: 1, naturaleza: 'movimiento_interno', sentido: 'sale', familia: 'traspaso', amount: 2000, accountId: 1 }),
      ev({ id: 2, naturaleza: 'movimiento_interno', sentido: 'entra', familia: 'traspaso', amount: 2000, accountId: 2 }),
      ev({ id: 3, naturaleza: 'gasto', familia: 'suministro', amount: 80 }),
      ev({ id: 4, naturaleza: 'ingreso', familia: 'alquiler', amount: 950 }),
    ];
    const k = calcularKpisHero({ cuentas, saldoPorCuenta: new Map(), eventos, year: 2026, month0: 7 });
    expect(k.pendienteSalir).toBe(-80);
    expect(k.pendienteEntrar).toBe(950);
    expect(esTraspasoInterno(eventos[0])).toBe(true);
    expect(esTraspasoInterno(eventos[2])).toBe(false);
  });

  it('lo pagado de verdad este mes no ve la pata del traspaso', () => {
    const movimientos = [
      mov({ id: 1, amount: -2000, naturaleza: 'movimiento_interno', familia: 'traspaso' }),
      mov({ id: 2, accountId: 2, amount: 2000, naturaleza: 'movimiento_interno', familia: 'traspaso' }),
      mov({ id: 3, amount: -80, naturaleza: 'gasto', familia: 'suministro' }),
    ];
    const r = calcularRealidad({ movimientos, eventos: [], year: 2026, month0: 7 });
    expect(r.pagadoReal).toBe(80);
  });

  it('el saldo de la cuenta SÍ mueve con la pata del traspaso · es dinero que se fue de aquí', () => {
    const account = { id: 1, status: 'ACTIVE', openingBalance: 0 } as unknown as Account;
    const movements = [
      mov({ id: 1, amount: -2000, naturaleza: 'movimiento_interno', familia: 'traspaso' }),
      mov({ id: 3, amount: -80, naturaleza: 'gasto' }),
    ];
    const saldo = calculateAccountBalanceAtDate({ account, cutoffDate: '2026-08-31', treasuryEvents: [], movements });
    expect(saldo).toBe(-2080);

    // Y un previsto interno pendiente también lo mueve, con su sentido.
    const conPrevisto = calculateAccountBalanceAtDate({
      account,
      cutoffDate: '2026-08-31',
      treasuryEvents: [ev({ id: 9, naturaleza: 'movimiento_interno', sentido: 'entra', familia: 'traspaso', amount: 500, status: 'confirmed', predictedDate: '2026-08-20' })],
      movements,
    });
    expect(conPrevisto).toBe(-1580);
  });
});
