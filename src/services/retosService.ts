// retosService · CRUD para el store 'retos' (Mi Plan v3)
// 1 reto activo por mes · índice mes UNIQUE en IndexedDB

import { initDB } from './db';
import type { Reto, RetoEstado, RetoTipo } from '../types/miPlan';

// ── UUID helper ───────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Validaciones internas ─────────────────────────────────────────────────────

function isValidMes(mes: string): boolean {
  return /^\d{4}-\d{2}$/.test(mes);
}

function validateRetoInput(input: Omit<Reto, 'id' | 'createdAt' | 'updatedAt'>): void {
  if (!isValidMes(input.mes)) {
    throw new Error(`mes debe tener formato YYYY-MM, recibido: '${input.mes}'`);
  }
  if ((input.tipo === 'ahorro' || input.tipo === 'ejecucion') && !input.metaCantidad) {
    throw new Error(`tipo='${input.tipo}' requiere metaCantidad`);
  }
  if (input.tipo === 'revision' && input.metaBinaria === undefined) {
    throw new Error("tipo='revision' requiere metaBinaria");
  }
}

async function validateSoloUnActivo(
  estado: RetoEstado,
  excludeId?: string,
): Promise<void> {
  if (estado !== 'activo') return;
  const activos = await listRetos({ estado: 'activo' });
  const activosFiltrados = activos.filter((r) => r.id !== excludeId);
  if (activosFiltrados.length > 0) {
    throw new Error(
      `Ya existe un reto activo (mes: ${activosFiltrados[0].mes}). ` +
        'Solo puede haber 1 reto activo a la vez.',
    );
  }
}

// ── createReto ────────────────────────────────────────────────────────────────

export async function createReto(
  input: Omit<Reto, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Reto> {
  validateRetoInput(input);
  await validateSoloUnActivo(input.estado);

  const db = await initDB();
  const now = new Date().toISOString();
  const reto: Reto = {
    ...input,
    id: generateId(),
    origenSugerencia: input.origenSugerencia ?? 'usuario',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.put('retos', reto);
  } catch (err) {
    // IndexedDB lanza ConstraintError si hay duplicado en el índice UNIQUE 'mes'
    if (
      err instanceof Error &&
      (err.name === 'ConstraintError' || err.message?.includes('constraint'))
    ) {
      throw new Error(
        `Ya existe un reto para el mes '${reto.mes}'. ` +
          'Solo puede haber 1 reto por mes.',
      );
    }
    throw err;
  }
  return reto;
}

// ── getReto ───────────────────────────────────────────────────────────────────

export async function getReto(id: string): Promise<Reto | undefined> {
  const db = await initDB();
  return (await db.get('retos', id)) as Reto | undefined;
}

// ── getRetoByMes ──────────────────────────────────────────────────────────────

export async function getRetoByMes(mes: string): Promise<Reto | undefined> {
  if (!isValidMes(mes)) {
    throw new Error(`mes debe tener formato YYYY-MM, recibido: '${mes}'`);
  }
  const db = await initDB();
  try {
    return (await db.getFromIndex('retos', 'mes', mes)) as Reto | undefined;
  } catch {
    const all = (await db.getAll('retos')) as Reto[];
    return all.find((r) => r.mes === mes);
  }
}

// ── listRetos ─────────────────────────────────────────────────────────────────

export async function listRetos(filters?: {
  estado?: RetoEstado;
  tipo?: RetoTipo;
  añoFrom?: string;
  añoTo?: string;
}): Promise<Reto[]> {
  const db = await initDB();
  let all = (await db.getAll('retos')) as Reto[];
  if (filters?.estado) {
    all = all.filter((r) => r.estado === filters.estado);
  }
  if (filters?.tipo) {
    all = all.filter((r) => r.tipo === filters.tipo);
  }
  if (filters?.añoFrom) {
    all = all.filter((r) => r.mes >= filters.añoFrom!);
  }
  if (filters?.añoTo) {
    all = all.filter((r) => r.mes <= filters.añoTo!);
  }
  return all;
}

// ── updateReto ────────────────────────────────────────────────────────────────

export async function updateReto(
  id: string,
  patch: Partial<Omit<Reto, 'id' | 'createdAt'>>,
): Promise<Reto> {
  const db = await initDB();
  const current = (await db.get('retos', id)) as Reto | undefined;
  if (!current) {
    throw new Error(`Reto con id '${id}' no encontrado`);
  }
  if (patch.estado === 'activo') {
    await validateSoloUnActivo('activo', id);
  }
  const updated: Reto = {
    ...current,
    ...(patch as Partial<Reto>),
    id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  try {
    await db.put('retos', updated);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'ConstraintError' || err.message?.includes('constraint'))
    ) {
      throw new Error(
        `Ya existe un reto para el mes '${updated.mes}'. ` +
          'Solo puede haber 1 reto por mes.',
      );
    }
    throw err;
  }
  return updated;
}

// ── deleteReto ────────────────────────────────────────────────────────────────

export async function deleteReto(id: string): Promise<void> {
  const db = await initDB();
  const current = (await db.get('retos', id)) as Reto | undefined;
  if (!current) {
    throw new Error(`Reto con id '${id}' no encontrado`);
  }
  await db.delete('retos', id);
}

// ── getRetoActivo ─────────────────────────────────────────────────────────────

export async function getRetoActivo(): Promise<Reto | undefined> {
  const activos = await listRetos({ estado: 'activo' });
  return activos[0];
}

// ── getRetosUltimos12Meses ────────────────────────────────────────────────────

export async function getRetosUltimos12Meses(): Promise<Reto[]> {
  const hoy = new Date();
  const hace12 = new Date(hoy);
  hace12.setMonth(hace12.getMonth() - 11);

  const añoFrom = `${hace12.getFullYear()}-${String(hace12.getMonth() + 1).padStart(2, '0')}`;
  const añoTo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const retos = await listRetos({ añoFrom, añoTo });
  return retos.sort((a, b) => a.mes.localeCompare(b.mes));
}

// ── cerrarReto ────────────────────────────────────────────────────────────────

export async function cerrarReto(
  id: string,
  resultado: 'completado' | 'parcial' | 'fallado',
  notas?: string,
): Promise<Reto> {
  return updateReto(id, {
    estado: resultado,
    notasCierre: notas,
  } as Partial<Reto>);
}
