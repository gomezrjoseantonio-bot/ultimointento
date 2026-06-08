/**
 * FIX onboarding · PUNTO 2 · P3.bis (corrección Jose) · el aviso "compras
 * financiadas sin préstamo vinculado" es LATENTE y RESUMIDO.
 *
 * Cubre (§3):
 *  - latencia · con el bloque préstamos pendiente y cero préstamos NO aparece.
 *  - emergencia · con ≥1 préstamo en el sistema (o bloque préstamos completado)
 *    aparece en UNA sola línea "N inmuebles…", nunca una fila por inmueble.
 *  - sin financiación o ya vinculado · sin aviso.
 */
let mockProperties: Array<Record<string, unknown>> = [];
let mockPrestamos: Array<Record<string, unknown>> = [];
let mockPrestamosEstado: 'pendiente' | 'parcial' | 'completado' = 'pendiente';

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    getAll: async (store: string) =>
      store === 'properties' ? mockProperties : store === 'prestamos' ? mockPrestamos : [],
  }),
}));

jest.mock('../onboardingProgressService', () => ({
  __esModule: true,
  getOnboardingState: async () => ({ bloques: { prestamos: { estado: mockPrestamosEstado } } }),
}));

import { getAvisosOnboarding } from '../onboardingAvisosService';

beforeEach(() => {
  mockProperties = [];
  mockPrestamos = [];
  mockPrestamosEstado = 'pendiente';
});

it('latencia · financiado sin vincular pero sin préstamos y bloque pendiente → sin aviso', async () => {
  mockProperties = [{ id: 1, alias: 'Piso Centro', estructuraCompra: { importeFinanciado: 80000 } }];
  expect(await getAvisosOnboarding()).toHaveLength(0);
});

it('emergencia con ≥1 préstamo · una sola línea resumida con el recuento', async () => {
  mockProperties = [
    { id: 1, alias: 'Piso Centro', estructuraCompra: { importeFinanciado: 80000 } },
    { id: 2, alias: 'Local', estructuraCompra: { importeFinanciado: 50000 } },
  ];
  mockPrestamos = [{ id: 'prest_otro' }];
  const avisos = await getAvisosOnboarding();
  expect(avisos).toHaveLength(1);
  expect(avisos[0].label).toBe('2 inmuebles financiados pendientes de vincular préstamo');
  expect(avisos[0].deepLink).toBe('/empezar/prestamos');
});

it('emergencia con bloque préstamos completado aunque no haya préstamos · una línea, singular', async () => {
  mockProperties = [{ id: 1, alias: 'Piso Centro', estructuraCompra: { importeFinanciado: 80000 } }];
  mockPrestamosEstado = 'completado';
  const avisos = await getAvisosOnboarding();
  expect(avisos).toHaveLength(1);
  expect(avisos[0].label).toBe('1 inmueble financiado pendiente de vincular préstamo');
});

it('financiado CON préstamo vinculado → sin aviso (aunque haya préstamos)', async () => {
  mockProperties = [{ id: 1, alias: 'Piso', estructuraCompra: { importeFinanciado: 80000, prestamoVinculadoId: 'prest_1' } }];
  mockPrestamos = [{ id: 'prest_1' }];
  expect(await getAvisosOnboarding()).toHaveLength(0);
});

it('sin financiación → sin aviso', async () => {
  mockProperties = [
    { id: 1, alias: 'Piso', estructuraCompra: { aportacionPropia: 50000 } },
    { id: 2, alias: 'Parking' },
  ];
  mockPrestamos = [{ id: 'prest_1' }];
  expect(await getAvisosOnboarding()).toHaveLength(0);
});
