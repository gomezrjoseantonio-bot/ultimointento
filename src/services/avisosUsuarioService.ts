// avisosUsuarioService · CRUD del store `avisosUsuario` (V73 · PR 3).
// T-INVERSIONES-DETALLE-PP-v1 · §4.E + §9.
//
// Patrón Jose · TODOS los avisos cerrables con X · persistencia aquí ·
// restaurables desde Ajustes → Avisos.

import { initDB } from './db';
import type { AvisoCerrado } from '../types/avisosUsuario';

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Marca un aviso como cerrado · si ya estaba cerrado · actualiza fechaCierre.
 */
export async function cerrarAviso(
  avisoId: string,
  meta?: { ubicacionContexto?: string; etiqueta?: string },
): Promise<AvisoCerrado> {
  if (!avisoId?.trim()) throw new Error('avisoId es obligatorio');
  const aviso: AvisoCerrado = {
    avisoId: avisoId.trim(),
    fechaCierre: nowISO(),
    ubicacionContexto: meta?.ubicacionContexto,
    etiqueta: meta?.etiqueta,
  };
  const db = await initDB();
  await db.put('avisosUsuario', aviso);
  return aviso;
}

/**
 * True si el aviso debe mostrarse (no está cerrado).
 *
 * Inverso útil para el caller · `if (await estaAvisoActivo('benchmark-orange-loss')) ...`
 */
export async function estaAvisoActivo(avisoId: string): Promise<boolean> {
  if (!avisoId?.trim()) return true;
  const db = await initDB();
  const existente = await db.get('avisosUsuario', avisoId.trim());
  return !existente;
}

/**
 * Restaura (reactiva) un aviso individual · borra del store.
 */
export async function restaurarAviso(avisoId: string): Promise<void> {
  if (!avisoId?.trim()) return;
  const db = await initDB();
  await db.delete('avisosUsuario', avisoId.trim());
}

/**
 * Restaura TODOS los avisos cerrados · borra el store entero.
 * Devuelve cuántos avisos había cerrados.
 */
export async function restaurarTodos(): Promise<number> {
  const db = await initDB();
  const tx = db.transaction('avisosUsuario', 'readwrite');
  const store = tx.objectStore('avisosUsuario');
  const keys = await store.getAllKeys();
  for (const k of keys) {
    await store.delete(k);
  }
  await tx.done;
  return keys.length;
}

/**
 * Lista los avisos cerrados · ordenados por fechaCierre descendente
 * (más recientes primero · útil para la UI Ajustes → Avisos).
 */
export async function listarCerrados(): Promise<AvisoCerrado[]> {
  const db = await initDB();
  const rows = await db.getAll('avisosUsuario');
  return rows.sort((a, b) => b.fechaCierre.localeCompare(a.fechaCierre));
}
