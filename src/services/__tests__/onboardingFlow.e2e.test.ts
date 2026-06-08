/**
 * Onboarding día 0 · C8 · E2E del flujo completo (servicio de progreso).
 *
 * Cubre (§5 · C8):
 *   · núcleo → reveal · completar los 4 bloques de núcleo desbloquea el reveal
 *   · saltar bloque → semáforo · un bloque pendiente queda en `pendientes`
 *   · reentrada · el progreso sobrevive a "salir y volver" (persistido en keyval)
 *   · descartes · sobreviven a la reentrada
 */
const mockKeyval = new Map<string, unknown>();

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    get: async (_s: string, k: string) => mockKeyval.get(k),
    put: async (_s: string, v: unknown, k: string) => {
      mockKeyval.set(k, v);
    },
  }),
}));

import {
  getOnboardingState,
  computeProgress,
  setBloqueEstado,
  setRevealVisto,
  addDescarte,
  isDescartado,
  NUCLEO_BLOQUES,
} from '../onboardingProgressService';

beforeEach(() => {
  mockKeyval.clear();
});

it('flujo completo · núcleo → reveal · saltar bloque → semáforo · reentrada', async () => {
  // 0 · arranque · foto intacta
  let progress = computeProgress(await getOnboardingState());
  expect(progress.pct).toBe(0);
  expect(progress.nucleoCompleto).toBe(false);

  // 1 · completar el núcleo (persona · inmuebles · contratos · cuentas)
  for (const b of NUCLEO_BLOQUES) await setBloqueEstado(b, 'completado');

  // 2 · el núcleo completo desbloquea el reveal · resto pendiente en el semáforo
  let state = await getOnboardingState();
  progress = computeProgress(state);
  expect(state.nucleoCompleto).toBe(true);
  expect(progress.pct).toBe(73); // (2*4)/11
  expect(progress.pendientes).toEqual(['prestamos', 'nomina', 'inversiones']);

  // 3 · ver el reveal (marca revealVisto)
  await setRevealVisto(true);

  // 4 · saltar un bloque · queda pendiente; completar otro lo saca del semáforo
  await setBloqueEstado('nomina', 'completado');
  progress = computeProgress(await getOnboardingState());
  expect(progress.pendientes).toContain('inversiones'); // saltado
  expect(progress.pendientes).not.toContain('nomina'); // completado

  // 5 · reentrada · "salir y volver" · el progreso sobrevive (keyval)
  state = await getOnboardingState();
  expect(state.nucleoCompleto).toBe(true);
  expect(state.revealVisto).toBe(true);
  expect(state.bloques.nomina.estado).toBe('completado');
  expect(state.bloques.inversiones.estado).toBe('pendiente');
});

it('descartes sobreviven a la reentrada', async () => {
  await addDescarte('recurrente', 'clave-1');
  // "Recarga": leemos de nuevo de keyval.
  expect(await isDescartado('recurrente', 'clave-1')).toBe(true);
  expect(await isDescartado('prestamo', 'clave-1')).toBe(false);
});

it('completar todos los bloques → 100% (el widget del Panel desaparece)', async () => {
  const todos = ['persona', 'inmuebles', 'contratos', 'cuentas', 'prestamos', 'nomina', 'inversiones'] as const;
  for (const b of todos) await setBloqueEstado(b, 'completado');
  const progress = computeProgress(await getOnboardingState());
  expect(progress.pct).toBe(100);
  expect(progress.pendientes).toHaveLength(0);
});
