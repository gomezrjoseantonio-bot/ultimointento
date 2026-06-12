/**
 * FIX onboarding PUNTO 7 · P2 · `syncNucleoFromData` marca el bloque
 * `inversiones` en cuanto existe ≥1 posición (store `inversiones` o
 * `planesPensiones`) · marca presencia, no desmarca.
 */

const stores: Record<string, unknown[]> = {
  properties: [],
  contracts: [],
  accounts: [],
  inversiones: [],
  planesPensiones: [],
};
const keyval = new Map<string, unknown>();

const mockDb = {
  getAll: async (store: string) => stores[store] ?? [],
  get: async (_store: string, key: string) => keyval.get(key),
  put: async (_store: string, value: unknown, key: string) => {
    keyval.set(key, value);
  },
};

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => mockDb,
}));
jest.mock('../personalDataService', () => ({
  __esModule: true,
  personalDataService: { getPersonalData: async () => null },
}));

import { syncNucleoFromData } from '../onboardingSyncService';
import { getOnboardingState } from '../onboardingProgressService';

beforeEach(() => {
  for (const k of Object.keys(stores)) stores[k] = [];
  keyval.clear();
});

it('sin posiciones · el bloque inversiones queda pendiente', async () => {
  await syncNucleoFromData();
  const state = await getOnboardingState();
  expect(state.bloques.inversiones.estado).toBe('pendiente');
});

it('con ≥1 posición en el store inversiones · marca el bloque completado', async () => {
  stores.inversiones = [{ id: 1 }, { id: 2 }];
  await syncNucleoFromData();
  const state = await getOnboardingState();
  expect(state.bloques.inversiones.estado).toBe('completado');
  expect(state.bloques.inversiones.detalle).toBe('2 posición(es)');
});

it('suma posiciones de inversiones + planes de pensiones', async () => {
  stores.inversiones = [{ id: 1 }];
  stores.planesPensiones = [{ id: 'a' }, { id: 'b' }];
  await syncNucleoFromData();
  const state = await getOnboardingState();
  expect(state.bloques.inversiones.estado).toBe('completado');
  expect(state.bloques.inversiones.detalle).toBe('3 posición(es)');
});
