// escenariosService · Gestiona el singleton 'escenarios' (Mi Plan v3)
// Renombrado de objetivosService.ts · migra los 7 KPIs de objetivos_financieros

import { initDB } from './db';
import type { Escenario, Hito } from '../types/miPlan';

// ── UUID helper ───────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const ESCENARIO_DEFAULTS: Escenario = {
  id: 1,
  modoVivienda: 'alquiler',
  gastosVidaLibertadMensual: 2500,
  estrategia: 'hibrido',
  hitos: [],
  // KPIs preexistentes (de objetivos_financieros)
  rentaPasivaObjetivo: 3_000,
  patrimonioNetoObjetivo: 600_000,
  cajaMinima: 10_000,
  dtiMaximo: 35,
  ltvMaximo: 50,
  yieldMinimaCartera: 8,
  tasaAhorroMinima: 15,
  updatedAt: new Date().toISOString(),
};

// ── getEscenarioActivo ────────────────────────────────────────────────────────

export async function getEscenarioActivo(): Promise<Escenario> {
  try {
    const db = await initDB();
    const existing = await db.get('escenarios', 1).catch(() => null);
    if (existing) {
      return {
        ...ESCENARIO_DEFAULTS,
        ...existing,
        hitos: Array.isArray(existing.hitos) ? existing.hitos : [],
      };
    }
    return { ...ESCENARIO_DEFAULTS, updatedAt: new Date().toISOString() };
  } catch {
    return { ...ESCENARIO_DEFAULTS, updatedAt: new Date().toISOString() };
  }
}

// ── saveEscenarioActivo ───────────────────────────────────────────────────────

export async function saveEscenarioActivo(
  partial: Partial<Omit<Escenario, 'id' | 'updatedAt'>>,
): Promise<Escenario> {
  const db = await initDB();
  const current = await getEscenarioActivo();
  const updated: Escenario = {
    ...current,
    ...partial,
    id: 1,
    hitos: partial.hitos !== undefined ? partial.hitos : current.hitos,
    updatedAt: new Date().toISOString(),
  };
  await db.put('escenarios', updated);
  return updated;
}

// ── resetEscenario ────────────────────────────────────────────────────────────

export async function resetEscenario(): Promise<Escenario> {
  const db = await initDB();
  const reset: Escenario = {
    ...ESCENARIO_DEFAULTS,
    hitos: [],
    updatedAt: new Date().toISOString(),
  };
  await db.put('escenarios', reset);
  return reset;
}

// ── addHito ───────────────────────────────────────────────────────────────────

export async function addHito(hitoInput: Omit<Hito, 'id'>): Promise<Hito> {
  const current = await getEscenarioActivo();
  const hito: Hito = {
    ...hitoInput,
    id: generateId(),
  };
  await saveEscenarioActivo({ hitos: [...current.hitos, hito] });
  return hito;
}

// ── updateHito ────────────────────────────────────────────────────────────────

export async function updateHito(hitoId: string, patch: Partial<Omit<Hito, 'id'>>): Promise<Hito> {
  const current = await getEscenarioActivo();
  const idx = current.hitos.findIndex((h) => h.id === hitoId);
  if (idx === -1) {
    throw new Error(`Hito con id '${hitoId}' no encontrado`);
  }
  const updated: Hito = { ...current.hitos[idx], ...patch };
  const newHitos = [...current.hitos];
  newHitos[idx] = updated;
  await saveEscenarioActivo({ hitos: newHitos });
  return updated;
}

// ── removeHito ────────────────────────────────────────────────────────────────

export async function removeHito(hitoId: string): Promise<void> {
  const current = await getEscenarioActivo();
  const newHitos = current.hitos.filter((h) => h.id !== hitoId);
  await saveEscenarioActivo({ hitos: newHitos });
}

// ── listHitos ─────────────────────────────────────────────────────────────────

export async function listHitos(): Promise<Hito[]> {
  const current = await getEscenarioActivo();
  return current.hitos;
}

export type { Escenario } from '../types/miPlan';
