/**
 * Onboarding día 0 · C4 · test de regresión del bug `openingBalance`.
 *
 * Caso documentado (`getCurrentSaldoCuenta.ts:5` · `fondosService.getSaldoCuenta`):
 * el saldo de la cuenta NO debe ser el `openingBalance` crudo (queda obsoleto en
 * cuanto hay movimientos), sino el saldo real calculado con `accountBalanceService`.
 *
 * Verifica vía la API pública `getSaldoActualFondo` (que internamente resuelve el
 * saldo de la cuenta asignada en modo 'completo').
 */

const mockAccounts = new Map<number, unknown>();
const mockFondos = new Map<string, unknown>();
const mockTreasuryEvents: unknown[] = [];
const mockMovements: unknown[] = [];

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    get: async (store: string, key: unknown) =>
      store === 'accounts'
        ? mockAccounts.get(key as number)
        : store === 'fondos_ahorro'
          ? mockFondos.get(key as string)
          : undefined,
    getAll: async (store: string) =>
      store === 'treasuryEvents' ? mockTreasuryEvents : store === 'movements' ? mockMovements : [],
  }),
}));

import { getSaldoActualFondo } from '../fondosService';

beforeEach(() => {
  mockAccounts.clear();
  mockFondos.clear();
  mockTreasuryEvents.length = 0;
  mockMovements.length = 0;
});

it('getSaldoActualFondo refleja el saldo real (opening + movimientos) · no el openingBalance crudo', async () => {
  // Cuenta con openingBalance 1.000 € y un ingreso de 500 € → saldo real 1.500 €.
  mockAccounts.set(1, {
    id: 1,
    name: 'Principal',
    openingBalance: 1000,
    openingBalanceDate: '2024-01-01',
    status: 'ACTIVE',
  });
  mockMovements.push({ id: 10, accountId: 1, amount: 500, date: '2024-01-15', isOpeningBalance: false });

  mockFondos.set('f1', {
    id: 'f1',
    nombre: 'Colchón',
    tipo: 'colchon',
    activo: true,
    cuentasAsignadas: [{ cuentaId: 1, modo: 'completo' }],
  });

  const saldo = await getSaldoActualFondo('f1');

  expect(saldo).toBe(1500); // antes del fix devolvía 1000 (openingBalance crudo)
});
