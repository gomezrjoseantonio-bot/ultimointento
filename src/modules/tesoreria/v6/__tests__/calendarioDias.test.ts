// El mes día a día (§4.9).
//
// El test que da sentido al fichero es el del punto ámbar: un día con neto
// POSITIVO puede dejar una cuenta en rojo si el ingreso entra en una cuenta y
// el cargo sale de otra. Mirar el neto del día no lo detecta nunca.

import {
  construirDias,
  resumirMes,
  huecosIniciales,
  diasDelMes,
} from '../calendarioDias';
import type { Account, Movement, TreasuryEvent } from '../../../../services/db';

const HOY = '2026-03-10';

const cuenta = (id: number): Account =>
  ({ id, iban: `ES91004915000512345678${id}`, status: 'ACTIVE', activa: true, createdAt: '', updatedAt: '' }) as Account;

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    accountId: 1,
    type: 'expense',
    amount: 100,
    predictedDate: '2026-03-15',
    description: 'Recibo',
    sourceType: 'manual',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

const mov = (over: Partial<Movement> = {}): Movement =>
  ({
    id: 1,
    accountId: 1,
    amount: -50,
    date: '2026-03-05',
    description: 'Compra',
    ...over,
  }) as Movement;

const base = {
  year: 2026,
  month0: 2, // marzo
  cuentas: [cuenta(1), cuenta(2)],
  saldoPorCuenta: new Map([
    [1, 1000],
    [2, 1000],
  ]),
  hoy: HOY,
};

describe('la rejilla', () => {
  it('marzo de 2026 tiene 31 días y empieza en domingo · 6 huecos con lunes primero', () => {
    expect(diasDelMes(2026, 2)).toBe(31);
    // 1-mar-2026 es domingo · getDay() = 0, pero con la semana en lunes va el 7º.
    expect(huecosIniciales(2026, 2)).toBe(6);
  });

  it('un mes que empieza en lunes no deja huecos', () => {
    // 1-jun-2026 es lunes.
    expect(huecosIniciales(2026, 5)).toBe(0);
  });

  it('un día sin apuntes no tiene cifra que enseñar', () => {
    const dias = construirDias({ ...base, eventos: [], movimientos: [] });
    expect(dias[0].apuntes).toBe(0);
    expect(dias[0].neto).toBe(0);
  });

  it('el neto del día suma realidad y previsión', () => {
    const dias = construirDias({
      ...base,
      eventos: [ev({ predictedDate: '2026-03-15', amount: 100 })],
      movimientos: [mov({ date: '2026-03-15', amount: -30 })],
    });
    const dia15 = dias.find((d) => d.numero === 15)!;
    expect(dia15.neto).toBe(-130);
    expect(dia15.apuntes).toBe(2);
  });

  it('lo de otro mes no se cuela', () => {
    const dias = construirDias({
      ...base,
      eventos: [ev({ predictedDate: '2026-04-02' })],
      movimientos: [],
    });
    expect(dias.every((d) => d.apuntes === 0)).toBe(true);
  });

  it('un previsto descartado no cuenta · no va a ocurrir', () => {
    const dias = construirDias({
      ...base,
      eventos: [ev({ descartado: true })],
      movimientos: [],
    });
    expect(dias.find((d) => d.numero === 15)!.apuntes).toBe(0);
  });

  it('marca los días con previstos sin confirmar', () => {
    const dias = construirDias({ ...base, eventos: [ev()], movimientos: [] });
    expect(dias.find((d) => d.numero === 15)!.tienePendientes).toBe(true);
    expect(dias.find((d) => d.numero === 14)!.tienePendientes).toBe(false);
  });
});

describe('el punto ámbar · días que dejan una cuenta corta', () => {
  it('AVISA aunque el neto del día sea positivo · el aviso es por cuenta', () => {
    // Entran 2.000 en la cuenta 2 y salen 1.500 de la cuenta 1, que solo tiene
    // 1.000. El día cierra en +500, pero la cuenta 1 se queda en −500.
    const dias = construirDias({
      ...base,
      eventos: [
        ev({ id: 1, accountId: 1, type: 'expense', amount: 1500, predictedDate: '2026-03-20' }),
        ev({ id: 2, accountId: 2, type: 'income', amount: 2000, predictedDate: '2026-03-20' }),
      ],
      movimientos: [],
    });

    const dia20 = dias.find((d) => d.numero === 20)!;
    expect(dia20.neto).toBe(500);
    expect(dia20.dejaCuentaCorta).toBe(true);
  });

  it('no avisa si la cuenta aguanta', () => {
    const dias = construirDias({
      ...base,
      eventos: [ev({ amount: 500, predictedDate: '2026-03-20' })],
      movimientos: [],
    });
    expect(dias.find((d) => d.numero === 20)!.dejaCuentaCorta).toBe(false);
  });

  it('el saldo se ARRASTRA · dos cargos que por separado aguantan y juntos no', () => {
    const dias = construirDias({
      ...base,
      eventos: [
        ev({ id: 1, amount: 700, predictedDate: '2026-03-12' }),
        ev({ id: 2, amount: 700, predictedDate: '2026-03-18' }),
      ],
      movimientos: [],
    });

    expect(dias.find((d) => d.numero === 12)!.dejaCuentaCorta).toBe(false);
    // 1000 − 700 − 700 = −400
    expect(dias.find((d) => d.numero === 18)!.dejaCuentaCorta).toBe(true);
  });

  it('NO avisa los días siguientes solo porque la cuenta siga en rojo', () => {
    // El punto marca el día que DEJA la cuenta corta. Encenderlo también en los
    // días posteriores llenaba de ámbar el resto del mes, y entonces deja de
    // significar "mira aquí".
    const dias = construirDias({
      ...base,
      eventos: [ev({ amount: 1500, predictedDate: '2026-03-12' })],
      movimientos: [],
    });
    expect(dias.find((d) => d.numero === 12)!.dejaCuentaCorta).toBe(true);
    expect(dias.find((d) => d.numero === 25)!.dejaCuentaCorta).toBe(false);
  });

  it('un día SIN movimientos nunca lleva punto, esté como esté la cuenta', () => {
    const dias = construirDias({
      ...base,
      eventos: [ev({ amount: 1500, predictedDate: '2026-03-12' })],
      movimientos: [],
    });
    const vacio = dias.find((d) => d.numero === 13)!;
    expect(vacio.apuntes).toBe(0);
    expect(vacio.dejaCuentaCorta).toBe(false);
  });

  it('pero un cargo NUEVO sobre una cuenta ya en rojo sí vuelve a avisar', () => {
    const dias = construirDias({
      ...base,
      eventos: [
        ev({ id: 1, amount: 1500, predictedDate: '2026-03-12' }),
        ev({ id: 2, amount: 200, predictedDate: '2026-03-20' }),
      ],
      movimientos: [],
    });
    expect(dias.find((d) => d.numero === 12)!.dejaCuentaCorta).toBe(true);
    expect(dias.find((d) => d.numero === 20)!.dejaCuentaCorta).toBe(true);
  });

  it('un negativo en un día YA PASADO no avisa · es historia, no acción', () => {
    const dias = construirDias({
      ...base,
      eventos: [],
      movimientos: [mov({ date: '2026-03-02', amount: -5000 })],
    });
    expect(dias.find((d) => d.numero === 2)!.dejaCuentaCorta).toBe(false);
  });

  it('un movimiento pasado NO se vuelve a restar · ya está en el saldo de hoy', () => {
    // Si se contase dos veces, este cargo de 900 dejaría la cuenta en 100 − 900.
    const dias = construirDias({
      ...base,
      eventos: [ev({ amount: 900, predictedDate: '2026-03-20' })],
      movimientos: [mov({ date: '2026-03-01', amount: -900 })],
    });
    expect(dias.find((d) => d.numero === 20)!.dejaCuentaCorta).toBe(false);
  });

  it('un previsto VENCIDO y sin confirmar avisa en su día · el cargo no ha llegado', () => {
    // Su fecha pasó, pero sigue sin ocurrir: el dinero no ha salido y cuando
    // salga hundirá la cuenta. Es exactamente lo que hay que ver.
    const dias = construirDias({
      ...base,
      eventos: [ev({ amount: 1500, predictedDate: '2026-03-05' })],
      movimientos: [],
    });
    expect(dias.find((d) => d.numero === 5)!.dejaCuentaCorta).toBe(true);
    // Y no se propaga al resto del mes.
    expect(dias.find((d) => d.numero === 10)!.dejaCuentaCorta).toBe(false);
  });
});

describe('el resumen del mes', () => {
  it('separa lo que queda entrar de lo que queda salir, y cierra', () => {
    const resumen = resumirMes({
      year: 2026,
      month0: 2,
      eventos: [
        ev({ id: 1, type: 'income', amount: 1200 }),
        ev({ id: 2, type: 'expense', amount: 300 }),
      ],
      saldoTotalHoy: 2000,
    });

    expect(resumen).toEqual({ quedaEntrar: 1200, quedaSalir: -300, cierre: 2900 });
  });

  it('lo ya confirmado no queda por entrar ni por salir', () => {
    const resumen = resumirMes({
      year: 2026,
      month0: 2,
      eventos: [ev({ status: 'executed', type: 'income', amount: 1200 })],
      saldoTotalHoy: 2000,
    });
    expect(resumen).toEqual({ quedaEntrar: 0, quedaSalir: 0, cierre: 2000 });
  });
});
