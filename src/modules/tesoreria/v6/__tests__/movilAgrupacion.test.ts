// Agrupación del móvil (§4.11).
//
// La pantalla móvil es una lista de cosas que hacer, no un resumen. De ahí las
// dos reglas que fija esto: una cuenta al día NO aparece, y las que se quedan
// cortas van primero — son las únicas donde confirmar cambia lo que hay que
// hacer hoy.

import { agruparPendientesPorCuenta, contarPendientes } from '../movilAgrupacion';
import type { Account, TreasuryEvent } from '../../../../services/db';

const cuenta = (id: number, alias: string): Account =>
  ({
    id,
    alias,
    iban: `ES91004915000512345678${id}`,
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
  }) as Account;

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    accountId: 1,
    type: 'expense',
    amount: 100,
    predictedDate: '2026-08-10',
    description: 'Recibo',
    sourceType: 'manual',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

const cuentas = [cuenta(1, 'Santander'), cuenta(2, 'Abanca')];
const saldos = new Map([
  [1, 1000],
  [2, 1000],
]);

describe('qué cuentas salen', () => {
  it('una cuenta al día NO aparece · no es una cosa que hacer', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [ev({ accountId: 1 })],
      saldoPorCuenta: saldos,
    });

    expect(grupos).toHaveLength(1);
    expect(grupos[0].cuenta.alias).toBe('Santander');
  });

  it('sin nada pendiente, la lista está vacía', () => {
    const grupos = agruparPendientesPorCuenta({ cuentas, eventos: [], saldoPorCuenta: saldos });
    expect(grupos).toEqual([]);
    expect(contarPendientes(grupos)).toBe(0);
  });

  it('un previsto descartado o ya ejecutado no cuenta', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [ev({ id: 1, descartado: true }), ev({ id: 2, status: 'executed' })],
      saldoPorCuenta: saldos,
    });
    expect(grupos).toEqual([]);
  });
});

describe('el orden lo manda el pulgar', () => {
  it('las cuentas que se quedan cortas van PRIMERO', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [
        ev({ id: 1, accountId: 1, amount: 50 }),      // Santander aguanta
        ev({ id: 2, accountId: 2, amount: 5000 }),    // Abanca se queda corta
      ],
      saldoPorCuenta: saldos,
    });

    expect(grupos.map((g) => g.cuenta.alias)).toEqual(['Abanca', 'Santander']);
    expect(grupos[0].seQuedaCorta).toBe(true);
    expect(grupos[1].seQuedaCorta).toBe(false);
  });

  it('dentro de una cuenta, por fecha · así se leen los recibos', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [
        ev({ id: 1, predictedDate: '2026-08-20', description: 'Tarde' }),
        ev({ id: 2, predictedDate: '2026-08-05', description: 'Pronto' }),
      ],
      saldoPorCuenta: saldos,
    });

    expect(grupos[0].pendientes.map((p) => p.concepto)).toEqual(['Pronto', 'Tarde']);
  });

  it('el saldo proyectado cuenta TODO lo pendiente de esa cuenta', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [
        ev({ id: 1, amount: 300 }),
        ev({ id: 2, amount: 300 }),
        ev({ id: 3, type: 'income', amount: 100 }),
      ],
      saldoPorCuenta: saldos,
    });

    expect(grupos[0].saldoProyectado).toBe(500); // 1000 − 300 − 300 + 100
  });
});

describe('lo que se lee en cada fila', () => {
  it('el importe lleva signo · un ingreso no se confunde con un cargo', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [ev({ type: 'income', amount: 475, description: 'Lucía Fernández' })],
      saldoPorCuenta: saldos,
    });
    expect(grupos[0].pendientes[0].importe).toBe(475);
  });

  it('la segunda línea dice de qué inmueble es', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [ev({ inmuebleId: 7 })],
      saldoPorCuenta: saldos,
      aliasInmueble: (id) => (id === 7 ? 'Tenderina 64' : undefined),
    });
    expect(grupos[0].pendientes[0].detalle).toBe('Tenderina 64');
  });

  it('sin inmueble, la segunda línea queda vacía y no inventa nada', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [ev()],
      saldoPorCuenta: saldos,
    });
    expect(grupos[0].pendientes[0].detalle).toBe('');
  });

  it('cuenta el total de pendientes para la cabecera', () => {
    const grupos = agruparPendientesPorCuenta({
      cuentas,
      eventos: [ev({ id: 1, accountId: 1 }), ev({ id: 2, accountId: 2 }), ev({ id: 3, accountId: 2 })],
      saldoPorCuenta: saldos,
    });
    expect(contarPendientes(grupos)).toBe(3);
  });
});
