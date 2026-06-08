/**
 * FIX onboarding · PUNTO 2 · P3 · aviso "compra financiada sin préstamo vinculado".
 *
 * Cubre (§3): un inmueble con financiación y sin préstamo vinculado genera el
 * pendiente (deep-link a préstamos); vinculado o sin financiación, no.
 */
let mockProperties: Array<Record<string, unknown>> = [];

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    getAll: async (store: string) => (store === 'properties' ? mockProperties : []),
  }),
}));

import { getAvisosOnboarding } from '../onboardingAvisosService';

beforeEach(() => {
  mockProperties = [];
});

it('financiado sin préstamo vinculado → aviso con deep-link a préstamos', async () => {
  mockProperties = [{ id: 1, alias: 'Piso Centro', estructuraCompra: { importeFinanciado: 80000 } }];
  const avisos = await getAvisosOnboarding();
  expect(avisos).toHaveLength(1);
  expect(avisos[0].label).toMatch(/Piso Centro/);
  expect(avisos[0].label).toMatch(/sin préstamo vinculado/i);
  expect(avisos[0].deepLink).toBe('/empezar/prestamos');
});

it('financiado CON préstamo vinculado → sin aviso', async () => {
  mockProperties = [{ id: 1, alias: 'Piso', estructuraCompra: { importeFinanciado: 80000, prestamoVinculadoId: 'prest_1' } }];
  expect(await getAvisosOnboarding()).toHaveLength(0);
});

it('sin financiación → sin aviso', async () => {
  mockProperties = [
    { id: 1, alias: 'Piso', estructuraCompra: { aportacionPropia: 50000 } },
    { id: 2, alias: 'Parking' },
  ];
  expect(await getAvisosOnboarding()).toHaveLength(0);
});
