/**
 * Onboarding día 0 · Commit 2 · tests del servicio único de progreso.
 *
 * Cubre (§5 · C2):
 *   · % de completitud con núcleo ponderado DOBLE
 *   · nucleoCompleto = los 4 bloques de núcleo completados
 *   · persistencia keyval round-trip (estado sobrevive a get/set)
 *   · contribución parcial = medio peso
 *   · descartes (base §2.4)
 *
 * Aísla la lógica mockeando `initDB` con un keyval en memoria (evita la cadena
 * de migración real · esa se prueba en dbV79OnboardingMigration.test.ts).
 */

const mockKeyval = new Map<string, unknown>();

const mockDb = {
  get: async (_store: string, key: string) => mockKeyval.get(key),
  put: async (_store: string, value: unknown, key: string) => {
    mockKeyval.set(key, value);
  },
};

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => mockDb,
}));

import {
  defaultOnboardingState,
  computeProgress,
  isNucleoCompleto,
  getOnboardingState,
  setBloqueEstado,
  setCuentaVia,
  setRevealVisto,
  getProgress,
  getDescartes,
  addDescarte,
  isDescartado,
  BLOQUES_ORDEN,
  NUCLEO_BLOQUES,
  type OnboardingState,
} from '../onboardingProgressService';

beforeEach(() => {
  mockKeyval.clear();
});

describe('computeProgress · ponderación del núcleo', () => {
  it('estado por defecto · todo pendiente → 0%', () => {
    const p = computeProgress(defaultOnboardingState());
    expect(p.pct).toBe(0);
    expect(p.nucleoCompleto).toBe(false);
    expect(p.completados).toBe(0);
    expect(p.pendientes).toHaveLength(7);
  });

  it('un bloque de núcleo pesa DOBLE que uno de resto', () => {
    const conNucleo = defaultOnboardingState();
    conNucleo.bloques.persona.estado = 'completado'; // peso 2
    const conResto = defaultOnboardingState();
    conResto.bloques.prestamos.estado = 'completado'; // peso 1

    // peso total = 11 → 2/11 = 18% vs 1/11 = 9%
    expect(computeProgress(conNucleo).pct).toBe(18);
    expect(computeProgress(conResto).pct).toBe(9);
  });

  it('los 4 bloques de núcleo completados → 73% y nucleoCompleto', () => {
    const state = defaultOnboardingState();
    for (const b of NUCLEO_BLOQUES) state.bloques[b].estado = 'completado';
    const p = computeProgress(state);
    expect(p.pct).toBe(73); // (2*4)/11 = 0.7273
    expect(p.nucleoCompleto).toBe(true);
    expect(p.pendientes).toEqual(['prestamos', 'nomina', 'inversiones']);
  });

  it('los 7 bloques completados → 100%', () => {
    const state = defaultOnboardingState();
    for (const b of BLOQUES_ORDEN) state.bloques[b].estado = 'completado';
    const p = computeProgress(state);
    expect(p.pct).toBe(100);
    expect(p.completados).toBe(7);
    expect(p.pendientes).toHaveLength(0);
  });

  it('estado parcial aporta medio peso', () => {
    const state = defaultOnboardingState();
    state.bloques.persona.estado = 'parcial'; // 0.5 * 2 = 1 → 1/11 = 9%
    expect(computeProgress(state).pct).toBe(9);
    // parcial NO cuenta como completado en pendientes
    expect(computeProgress(state).pendientes).toContain('persona');
  });
});

describe('isNucleoCompleto', () => {
  it('falso si falta un bloque de núcleo', () => {
    const state = defaultOnboardingState();
    for (const b of NUCLEO_BLOQUES) state.bloques[b].estado = 'completado';
    state.bloques.cuentas.estado = 'parcial';
    expect(isNucleoCompleto(state)).toBe(false);
  });
});

describe('persistencia keyval', () => {
  it('estado vacío → devuelve default normalizado', async () => {
    const state = await getOnboardingState();
    expect(state.bloques.persona.estado).toBe('pendiente');
    expect(Object.keys(state.bloques)).toHaveLength(7);
  });

  it('setBloqueEstado persiste y recalcula nucleoCompleto', async () => {
    for (const b of NUCLEO_BLOQUES) await setBloqueEstado(b, 'completado');
    const state = await getOnboardingState();
    expect(state.nucleoCompleto).toBe(true);
    expect(state.bloques.contratos.estado).toBe('completado');
    expect((await getProgress()).pct).toBe(73);
  });

  it('setBloqueEstado guarda el detalle', async () => {
    await setBloqueEstado('inmuebles', 'parcial', '1 de 3 importados');
    const state = await getOnboardingState();
    expect(state.bloques.inmuebles).toEqual({ estado: 'parcial', detalle: '1 de 3 importados' });
  });

  it('setCuentaVia y setRevealVisto round-trip', async () => {
    await setCuentaVia(42, 'con_extracto');
    await setRevealVisto(true);
    const state = await getOnboardingState();
    expect(state.cuentas[42]).toBe('con_extracto');
    expect(state.revealVisto).toBe(true);
  });

  it('forward-compat · estado legacy sin algún bloque se normaliza', async () => {
    const legacy: Partial<OnboardingState> = {
      bloques: { persona: { estado: 'completado' } } as OnboardingState['bloques'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockKeyval.set('onboarding_v1', legacy);
    const state = await getOnboardingState();
    expect(state.bloques.persona.estado).toBe('completado');
    expect(state.bloques.inversiones.estado).toBe('pendiente'); // rellenado
  });
});

describe('descartes (base §2.4)', () => {
  it('addDescarte persiste y no duplica', async () => {
    await addDescarte('recurrente', 'clave-1');
    await addDescarte('recurrente', 'clave-1'); // duplicado ignorado
    const lista = await getDescartes();
    expect(lista).toHaveLength(1);
    expect(await isDescartado('recurrente', 'clave-1')).toBe(true);
    expect(await isDescartado('prestamo', 'clave-1')).toBe(false);
  });
});
