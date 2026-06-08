// FIX PUNTO 4 (P4) · regresión del saldo inicial. El `openingBalance` guardado
// es EXACTAMENTE el que leen Tesorería y el cashflow: `calculateAccountBalanceAtDate`
// (la función canónica que usan `fondosService.getSaldoCuenta` y
// `loadSaldosActualesCuentas`) lo refleja entero y NO lo duplica con el
// movimiento de apertura (marcado `isOpeningBalance`).
import { calculateAccountBalanceAtDate } from '../accountBalanceService';
import type { Account, Movement, TreasuryEvent } from '../db';

const CUTOFF = '2026-12-31';

const account = (over: Partial<Account> = {}): Account =>
  ({ id: 7, openingBalance: 1234.56, openingBalanceDate: '2026-01-01', status: 'ACTIVE', activa: true, ...over }) as Account;

// El movimiento de apertura que crea `cuentasService.create` (isOpeningBalance).
const aperturaMov = (): Movement =>
  ({ id: 1, accountId: 7, date: '2026-01-01', amount: 1234.56, isOpeningBalance: true }) as unknown as Movement;

const noEvents: TreasuryEvent[] = [];

describe('openingBalance · saldo guardado = saldo leído (P4)', () => {
  it('el saldo leído es exactamente el openingBalance guardado', () => {
    const saldo = calculateAccountBalanceAtDate({
      account: account(),
      cutoffDate: CUTOFF,
      treasuryEvents: noEvents,
      movements: [aperturaMov()],
    });
    expect(saldo).toBe(1234.56);
  });

  it('el movimiento de apertura NO duplica el saldo inicial', () => {
    const conApertura = calculateAccountBalanceAtDate({
      account: account(),
      cutoffDate: CUTOFF,
      treasuryEvents: noEvents,
      movements: [aperturaMov()],
    });
    const sinApertura = calculateAccountBalanceAtDate({
      account: account(),
      cutoffDate: CUTOFF,
      treasuryEvents: noEvents,
      movements: [],
    });
    expect(conApertura).toBe(sinApertura);
  });

  it('los movimientos posteriores se acumulan SOBRE el saldo inicial guardado', () => {
    const movimientoNormal = ({ id: 2, accountId: 7, date: '2026-03-10', amount: 100 }) as unknown as Movement;
    const saldo = calculateAccountBalanceAtDate({
      account: account(),
      cutoffDate: CUTOFF,
      treasuryEvents: noEvents,
      movements: [aperturaMov(), movimientoNormal],
    });
    expect(saldo).toBe(1334.56);
  });
});
