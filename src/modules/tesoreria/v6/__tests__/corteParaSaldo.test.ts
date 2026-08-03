// El saldo tiene que contar lo de HOY.
//
// `calculateAccountBalanceAtDate` filtra por `< cutoffDate` estrictamente, así
// que pedirle el saldo "a fecha de hoy" dejaba fuera todo lo de hoy. Y lo de
// hoy es justo lo que el usuario acaba de puntear: el cargo salía de "por
// confirmar" —dejaba de contar como pendiente— y tampoco entraba en el saldo,
// con lo que confirmar un GASTO subía el saldo final.
//
// Este candado empareja las dos piezas: el corte que usa Tesorería contra el
// servicio real de saldos.

import { __private__ } from '../TesoreriaV6Page';
import { calculateAccountBalanceAtDate } from '../../../../services/accountBalanceService';
import type { Account, Movement } from '../../../../services/db';

const { corteParaSaldo } = __private__;

const HOY = '2026-08-03';

const cuenta = {
  id: 1,
  openingBalance: 1000,
  openingBalanceDate: '2026-01-01',
} as Account;

const cargoDeHoy = {
  id: 10,
  accountId: 1,
  date: HOY,
  amount: -48,
} as Movement;

const saldoCon = (cutoffDate: string) =>
  calculateAccountBalanceAtDate({
    account: cuenta,
    cutoffDate,
    treasuryEvents: [],
    movements: [cargoDeHoy],
  });

describe('el corte del saldo', () => {
  it('es el día siguiente · si no, lo de hoy no cuenta', () => {
    expect(corteParaSaldo(HOY)).toBe('2026-08-04');
  });

  it('un cargo de hoy SÍ está descontado del saldo', () => {
    expect(saldoCon(corteParaSaldo(HOY))).toBe(952);
  });

  // La demostración del fallo: con el corte en hoy, ese cargo desaparecía.
  it('con el corte en hoy quedaba fuera', () => {
    expect(saldoCon(HOY)).toBe(1000);
  });

  it('cruza el fin de mes sin inventarse un día 32', () => {
    expect(corteParaSaldo('2026-08-31')).toBe('2026-09-01');
    expect(corteParaSaldo('2026-12-31')).toBe('2027-01-01');
  });
});
