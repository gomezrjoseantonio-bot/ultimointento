/**
 * Perfil de CUENTA (login · identidad de la app) · distinto del perfil FISCAL
 * (`personalDataService`). Persistencia local mínima en `keyval` para que la
 * página de Ajustes → Perfil deje de mentir (antes "Guardar cambios" no
 * guardaba nada). NO es gestión de cuenta · solo persiste lo editable.
 */
import { initDB } from './db';

const KEY = 'account_profile_v1';

export interface AccountProfile {
  nombre?: string;
  email?: string;
  telefono?: string;
  nif?: string;
}

export async function getAccountProfile(): Promise<AccountProfile> {
  try {
    const db = await initDB();
    const stored = (await db.get('keyval', KEY)) as AccountProfile | undefined;
    return stored ?? {};
  } catch {
    return {};
  }
}

export async function saveAccountProfile(profile: AccountProfile): Promise<void> {
  const db = await initDB();
  await db.put('keyval', profile, KEY);
}
