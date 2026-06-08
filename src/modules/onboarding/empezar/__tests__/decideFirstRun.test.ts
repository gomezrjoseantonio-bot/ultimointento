/**
 * FIX onboarding · P1 · puerta de entrada. `decideFirstRun()` decide si un
 * usuario aterriza en `/empezar` (sin datos reales y sin progreso) o en el Panel.
 *
 * Cubre (§3):
 *   · usuario sin datos y sin progreso → 'empezar'
 *   · usuario con datos → 'panel' (no se le fuerza el welcome)
 *   · usuario sin datos pero con progreso → 'panel' (reentrante)
 */
let mockProperties: unknown[] = [];
let mockAccounts: unknown[] = [];
let mockContracts: unknown[] = [];
let mockState: { revealVisto: boolean; bloques: Record<string, { estado: string }> };

jest.mock('../../../../services/db', () => ({
  __esModule: true,
  initDB: async () => ({
    getAll: async (store: string) =>
      store === 'properties' ? mockProperties : store === 'accounts' ? mockAccounts : store === 'contracts' ? mockContracts : [],
  }),
}));

jest.mock('../../../../services/onboardingProgressService', () => ({
  __esModule: true,
  BLOQUES_ORDEN: ['persona', 'inmuebles', 'contratos', 'cuentas', 'prestamos', 'nomina', 'inversiones'],
  getOnboardingState: async () => mockState,
}));

import { decideFirstRun } from '../FirstRunRedirect';

const estadoPendiente = () => ({
  revealVisto: false,
  bloques: Object.fromEntries(
    ['persona', 'inmuebles', 'contratos', 'cuentas', 'prestamos', 'nomina', 'inversiones'].map((b) => [b, { estado: 'pendiente' }]),
  ),
});

beforeEach(() => {
  mockProperties = [];
  mockAccounts = [];
  mockContracts = [];
  mockState = estadoPendiente();
});

it('sin datos reales y sin progreso → empezar', async () => {
  expect(await decideFirstRun()).toBe('empezar');
});

it('con datos (una cuenta) → panel', async () => {
  mockAccounts = [{ id: 1 }];
  expect(await decideFirstRun()).toBe('panel');
});

it('sin datos pero con progreso (reveal visto) → panel', async () => {
  mockState = { ...estadoPendiente(), revealVisto: true };
  expect(await decideFirstRun()).toBe('panel');
});

it('sin datos pero con un bloque ya tocado → panel (reentrante)', async () => {
  const s = estadoPendiente();
  s.bloques.persona.estado = 'completado';
  mockState = s;
  expect(await decideFirstRun()).toBe('panel');
});
