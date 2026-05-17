// objetivosVitalesService · CRUD del store `objetivosVitales` (V73 · PR 3).
// T-INVERSIONES-DETALLE-PP-v1 · §4.C Caso B.
//
// Convive con `objetivosService` (T27.1 · 4 tipos operativos ligados a fondos/
// préstamos/categorías). Aquí gestionamos los HITOS VITALES (eventos de vida
// con fecha · jubilación · salida empresa · etc.) usados por BloqueHitos
// en la ficha de inversiones.

import { initDB } from './db';
import type { ObjetivoVital, TipoObjetivoVital } from '../types/objetivosVitales';

// ── UUID + ISO helpers ────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export async function listObjetivosVitales(): Promise<ObjetivoVital[]> {
  const db = await initDB();
  const rows = await db.getAll('objetivosVitales');
  // Orden por fechaEstimada ascendente · más próximos primero.
  return rows.sort((a, b) => a.fechaEstimada.localeCompare(b.fechaEstimada));
}

export async function getObjetivoVital(id: string): Promise<ObjetivoVital | undefined> {
  const db = await initDB();
  return db.get('objetivosVitales', id);
}

/**
 * Filtra hitos vitales relevantes para una posición concreta:
 * - fechaEstimada > hoy
 * - planFinancieroAsociado === null (globales) || === planId (asociados)
 *
 * Spec §5.5 · usado por BloqueHitos en la ficha PP (PR 4).
 */
export async function getHitosVitalesParaPosicion(
  planId: string,
  hoy: Date = new Date(),
): Promise<ObjetivoVital[]> {
  const lista = await listObjetivosVitales();
  const hoyISO = hoy.toISOString().slice(0, 10);
  return lista.filter(
    (o) =>
      o.fechaEstimada > hoyISO &&
      (o.planFinancieroAsociado === null || o.planFinancieroAsociado === planId),
  );
}

// ── Escritura ─────────────────────────────────────────────────────────────────

export interface CreateObjetivoVitalInput {
  nombre: string;
  fechaEstimada: string;
  descripcion?: string;
  planFinancieroAsociado?: string | null;
  tipo: TipoObjetivoVital;
}

export async function createObjetivoVital(
  input: CreateObjetivoVitalInput,
): Promise<ObjetivoVital> {
  if (!input.nombre?.trim()) throw new Error('nombre es obligatorio');
  if (!isValidISODate(input.fechaEstimada)) {
    throw new Error(`fechaEstimada debe ser yyyy-mm-dd · recibido '${input.fechaEstimada}'`);
  }
  const ahora = nowISO();
  const objetivo: ObjetivoVital = {
    id: generateId(),
    nombre: input.nombre.trim(),
    fechaEstimada: input.fechaEstimada,
    descripcion: input.descripcion?.trim() || undefined,
    planFinancieroAsociado: input.planFinancieroAsociado ?? null,
    tipo: input.tipo,
    fechaCreacion: ahora,
    fechaModificacion: ahora,
  };
  const db = await initDB();
  await db.put('objetivosVitales', objetivo);
  return objetivo;
}

export interface UpdateObjetivoVitalInput {
  nombre?: string;
  fechaEstimada?: string;
  /** '' = limpiar (→ undefined) · undefined = no tocar. */
  descripcion?: string;
  /** `null` para desasociar · `string` para asociar · `undefined` = no tocar. */
  planFinancieroAsociado?: string | null;
  tipo?: TipoObjetivoVital;
}

export async function updateObjetivoVital(
  id: string,
  patch: UpdateObjetivoVitalInput,
): Promise<ObjetivoVital> {
  const db = await initDB();
  const actual = await db.get('objetivosVitales', id);
  if (!actual) throw new Error(`Objetivo vital '${id}' no encontrado`);
  if (patch.fechaEstimada !== undefined && !isValidISODate(patch.fechaEstimada)) {
    throw new Error(`fechaEstimada debe ser yyyy-mm-dd · recibido '${patch.fechaEstimada}'`);
  }
  const nombreNuevo = patch.nombre?.trim();
  // Semántica de patch: `undefined` = no tocar · presente (incluso vacío
  // o `null`) = aplicar. Usamos `!== undefined` para que un caller que
  // construya el patch con spread/destructuring no borre campos por
  // accidente (un `'descripcion' in patch` con `undefined` lo trataba
  // como "presente" y rompía la semántica documentada).
  const merged: ObjetivoVital = {
    ...actual,
    nombre: nombreNuevo || actual.nombre,
    fechaEstimada: patch.fechaEstimada ?? actual.fechaEstimada,
    descripcion:
      patch.descripcion !== undefined
        ? patch.descripcion.trim() || undefined
        : actual.descripcion,
    planFinancieroAsociado:
      patch.planFinancieroAsociado !== undefined
        ? patch.planFinancieroAsociado
        : actual.planFinancieroAsociado,
    tipo: patch.tipo ?? actual.tipo,
    fechaModificacion: nowISO(),
  };
  await db.put('objetivosVitales', merged);
  return merged;
}

export async function deleteObjetivoVital(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('objetivosVitales', id);
}
