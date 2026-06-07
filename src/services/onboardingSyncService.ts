/**
 * Onboarding día 0 · sincroniza el estado de los bloques de NÚCLEO con la
 * realidad de los stores (reentrante · §0.1.4). Si el usuario ya tiene datos
 * (porque los creó dentro o fuera del onboarding), el bloque queda `completado`
 * automáticamente y el semáforo lo refleja.
 *
 * Solo MARCA presencia · nunca desmarca un bloque (no destructivo).
 */
import { initDB } from './db';
import { personalDataService } from './personalDataService';
import { getOnboardingState, setBloqueEstado } from './onboardingProgressService';
import type { Property } from './db';

export async function syncNucleoFromData(): Promise<void> {
  const db = await initDB();
  const [properties, contracts, accounts, personal] = await Promise.all([
    db.getAll('properties') as Promise<Property[]>,
    db.getAll('contracts'),
    db.getAll('accounts'),
    personalDataService.getPersonalData().catch(() => null),
  ]);

  const state = await getOnboardingState();

  if (personal && state.bloques.persona.estado !== 'completado') {
    await setBloqueEstado('persona', 'completado', 'Datos personales completados');
  }
  if (properties.length > 0 && state.bloques.inmuebles.detalle !== `${properties.length} inmueble(s)`) {
    await setBloqueEstado('inmuebles', 'completado', `${properties.length} inmueble(s)`);
  }
  if (contracts.length > 0 && state.bloques.contratos.detalle !== `${contracts.length} contrato(s)`) {
    await setBloqueEstado('contratos', 'completado', `${contracts.length} contrato(s)`);
  }
  if (accounts.length > 0 && state.bloques.cuentas.detalle !== `${accounts.length} cuenta(s)`) {
    await setBloqueEstado('cuentas', 'completado', `${accounts.length} cuenta(s)`);
  }
}
