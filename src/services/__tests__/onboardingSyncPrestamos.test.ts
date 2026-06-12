/**
 * FIX onboarding · PUNTO 5 (P4) · el bloque `prestamos` (no-núcleo) se marca
 * `completado` cuando hay ≥1 préstamo en el store · así sube el % tanto por la
 * plantilla (refresh tras importar) como por la vía manual (al volver SOBRE el
 * flujo). No-destructivo · no toca los demás bloques ni desmarca.
 */
let mockStores: Record<string, unknown[]> = {};
const setBloqueCalls: Array<{ bloque: string; estado: string; detalle?: string }> = [];

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    getAll: async (store: string) => mockStores[store] ?? [],
  }),
}));

jest.mock('../personalDataService', () => ({
  __esModule: true,
  personalDataService: { getPersonalData: async () => null },
}));

let mockState: { bloques: Record<string, { estado: string; detalle?: string }> };
jest.mock('../onboardingProgressService', () => ({
  __esModule: true,
  getOnboardingState: async () => mockState,
  setBloqueEstado: async (bloque: string, estado: string, detalle?: string) => {
    setBloqueCalls.push({ bloque, estado, detalle });
    mockState.bloques[bloque] = { estado, detalle };
  },
}));

import { syncNucleoFromData } from '../onboardingSyncService';

beforeEach(() => {
  mockStores = { properties: [], contracts: [], accounts: [], prestamos: [] };
  setBloqueCalls.length = 0;
  mockState = { bloques: { prestamos: { estado: 'pendiente' } } };
});

it('≥1 préstamo → marca el bloque prestamos completado', async () => {
  mockStores.prestamos = [{ id: 'p1' }, { id: 'p2' }];
  await syncNucleoFromData();
  const call = setBloqueCalls.find((c) => c.bloque === 'prestamos');
  expect(call).toEqual({ bloque: 'prestamos', estado: 'completado', detalle: '2 préstamo(s)' });
});

it('cero préstamos → NO marca el bloque prestamos', async () => {
  mockStores.prestamos = [];
  await syncNucleoFromData();
  expect(setBloqueCalls.some((c) => c.bloque === 'prestamos')).toBe(false);
});

it('idempotente · si ya está marcado con el mismo detalle no reescribe', async () => {
  mockStores.prestamos = [{ id: 'p1' }];
  mockState.bloques.prestamos = { estado: 'completado', detalle: '1 préstamo(s)' };
  await syncNucleoFromData();
  expect(setBloqueCalls.some((c) => c.bloque === 'prestamos')).toBe(false);
});
