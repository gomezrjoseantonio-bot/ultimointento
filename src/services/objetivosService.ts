// objetivosService · CRUD para el store 'objetivos' (Mi Plan v3)
// Gestiona los 4 tipos de objetivo: acumular · amortizar · comprar · reducir
// NOTA: El antiguo servicio de objetivos financieros (singleton) ha sido
// renombrado a escenariosService.ts

import { initDB } from './db';
import type { Objetivo, ObjetivoEstado, ObjetivoTipo } from '../types/miPlan';

// ── UUID helper ───────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Validaciones internas ─────────────────────────────────────────────────────

function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

async function validateFKFondo(fondoId: string): Promise<void> {
  const db = await initDB();
  try {
    const fondo = await db.get('fondos_ahorro', fondoId);
    if (!fondo) {
      throw new Error(`El fondo con id '${fondoId}' no existe en fondos_ahorro`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('El fondo')) throw err;
    throw new Error(`No se pudo verificar el fondo '${fondoId}' (store no disponible)`);
  }
}

async function validateFKPrestamo(prestamoId: string): Promise<void> {
  const db = await initDB();
  try {
    // prestamos.id es string (UUID) — ver src/types/prestamos.ts
    const prestamo = await db.get('prestamos', prestamoId as unknown as string);
    if (!prestamo) {
      throw new Error(`El préstamo con id '${prestamoId}' no existe en prestamos`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('El préstamo')) throw err;
    throw new Error(`No se pudo verificar el préstamo '${prestamoId}' (store no disponible)`);
  }
}

async function validateObjetivoInput(
  input: Omit<Objetivo, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  // fechaCierre debe ser fecha válida
  if (!isValidDate(input.fechaCierre)) {
    throw new Error(`fechaCierre debe tener formato YYYY-MM-DD, recibido: '${input.fechaCierre}'`);
  }

  // fechaCierre no puede ser pasada al crear
  const cierre = new Date(input.fechaCierre);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (cierre < hoy) {
    throw new Error(`fechaCierre no puede ser una fecha pasada: '${input.fechaCierre}'`);
  }

  // Validaciones por tipo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inp = input as any;
  if (inp.tipo === 'acumular') {
    if (!inp.fondoId) throw new Error("tipo='acumular' requiere fondoId");
    if ((inp.metaCantidad ?? 0) <= 0) throw new Error('metaCantidad debe ser > 0');
    await validateFKFondo(inp.fondoId as string);
  } else if (inp.tipo === 'amortizar') {
    if (!inp.prestamoId) throw new Error("tipo='amortizar' requiere prestamoId");
    if ((inp.metaCantidad ?? 0) <= 0) throw new Error('metaCantidad debe ser > 0');
    await validateFKPrestamo(inp.prestamoId as string);
  } else if (inp.tipo === 'comprar') {
    if (!inp.fondoId) throw new Error("tipo='comprar' requiere fondoId");
    if ((inp.metaCantidad ?? 0) <= 0) throw new Error('metaCantidad debe ser > 0');
    await validateFKFondo(inp.fondoId as string);
  } else if (inp.tipo === 'reducir') {
    if ((inp.metaCantidadMensual ?? 0) <= 0) throw new Error('metaCantidadMensual debe ser > 0');
    if (!inp.categoriaGasto) throw new Error("tipo='reducir' requiere categoriaGasto");
  }
}

// ── Vinculación bidireccional objetivo ↔ fondo (T27.3) ────────────────────────
//
// Si `objetivoId` apunta a `fondoId` nuevo:
//   1. Si el fondo ya estaba vinculado a OTRO objetivo · ese objetivo pierde su `fondoId`
//   2. El fondo escribe `objetivoVinculadoId = objetivoId`
//
// Implementado con db.put directo · sin recursión a updateFondo/updateObjetivo.
async function _sincronizarVinculacionFondo(
  objetivoId: string,
  fondoId: string,
): Promise<void> {
  const db = await initDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fondo = (await db.get('fondos_ahorro', fondoId)) as any;
  if (!fondo) return;

  // 1. Si el fondo ya estaba vinculado a otro objetivo distinto · ese objetivo pierde su fondoId
  const objetivoIdActual = fondo.objetivoVinculadoId as string | undefined;
  if (objetivoIdActual && objetivoIdActual !== objetivoId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objetivoAnterior = (await db.get('objetivos', objetivoIdActual)) as any;
    if (objetivoAnterior) {
      const { fondoId: _omit, ...rest } = objetivoAnterior;
      void _omit;
      await db.put('objetivos', {
        ...rest,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 2. El fondo apunta al nuevo objetivo
  await db.put('fondos_ahorro', {
    ...fondo,
    objetivoVinculadoId: objetivoId,
    updatedAt: new Date().toISOString(),
  });
}

// Limpia la vinculación inversa cuando un objetivo se desvincula del fondo.
async function _limpiarVinculacionFondo(fondoId: string): Promise<void> {
  const db = await initDB();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fondo = (await db.get('fondos_ahorro', fondoId)) as any;
  if (!fondo) return;
  const { objetivoVinculadoId: _omit, ...rest } = fondo;
  void _omit;
  await db.put('fondos_ahorro', {
    ...rest,
    updatedAt: new Date().toISOString(),
  });
}

// ── createObjetivo ────────────────────────────────────────────────────────────

export async function createObjetivo(
  input: Omit<Objetivo, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Objetivo> {
  await validateObjetivoInput(input);
  const db = await initDB();
  const now = new Date().toISOString();
  const objetivo: Objetivo = {
    ...(input as Objetivo),
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  await db.put('objetivos', objetivo);

  // V67 (T27.3) · sincronización inversa · si el objetivo apunta a un fondo ·
  // ese fondo recibe `objetivoVinculadoId = nuevoObjetivo.id`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fondoId = (objetivo as any).fondoId as string | undefined;
  if (fondoId) {
    await _sincronizarVinculacionFondo(objetivo.id, fondoId);
  }

  return objetivo;
}

// ── getObjetivo ───────────────────────────────────────────────────────────────

export async function getObjetivo(id: string): Promise<Objetivo | undefined> {
  const db = await initDB();
  return (await db.get('objetivos', id)) as Objetivo | undefined;
}

// ── listObjetivos ─────────────────────────────────────────────────────────────

export async function listObjetivos(filters?: {
  estado?: ObjetivoEstado;
  tipo?: ObjetivoTipo;
}): Promise<Objetivo[]> {
  const db = await initDB();
  let all = (await db.getAll('objetivos')) as Objetivo[];
  if (filters?.estado) {
    all = all.filter((o) => o.estado === filters.estado);
  }
  if (filters?.tipo) {
    all = all.filter((o) => o.tipo === filters.tipo);
  }
  return all;
}

// ── updateObjetivo ────────────────────────────────────────────────────────────

export async function updateObjetivo(
  id: string,
  patch: Partial<Omit<Objetivo, 'id' | 'createdAt'>>,
): Promise<Objetivo> {
  const db = await initDB();
  const current = (await db.get('objetivos', id)) as Objetivo | undefined;
  if (!current) {
    throw new Error(`Objetivo con id '${id}' no encontrado`);
  }
  const updated: Objetivo = {
    ...current,
    ...(patch as unknown as Partial<Objetivo>),
    id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  } as Objetivo;
  await db.put('objetivos', updated);

  // V67 (T27.3) · sincronizar fondo cuando cambia el fondoId del objetivo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fondoIdAnterior = (current as any).fondoId as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fondoIdNuevo = (updated as any).fondoId as string | undefined;
  if (fondoIdAnterior !== fondoIdNuevo) {
    if (fondoIdAnterior) {
      await _limpiarVinculacionFondo(fondoIdAnterior);
    }
    if (fondoIdNuevo) {
      await _sincronizarVinculacionFondo(id, fondoIdNuevo);
    }
  }

  return updated;
}

// ── archiveObjetivo ───────────────────────────────────────────────────────────

export async function archiveObjetivo(id: string): Promise<void> {
  await updateObjetivo(id, { estado: 'archivado' } as Partial<Objetivo>);
}

// ── deleteObjetivo ────────────────────────────────────────────────────────────

export async function deleteObjetivo(id: string): Promise<void> {
  const current = await getObjetivo(id);
  if (!current) {
    throw new Error(`Objetivo con id '${id}' no encontrado`);
  }
  if (current.estado !== 'archivado') {
    throw new Error(`Solo se pueden eliminar objetivos archivados. Estado actual: '${current.estado}'`);
  }
  // V67 (T27.3) · si el objetivo tenía fondo · ese fondo pierde su vinculación inversa
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fondoId = (current as any).fondoId as string | undefined;
  if (fondoId) {
    await _limpiarVinculacionFondo(fondoId);
  }
  const db = await initDB();
  await db.delete('objetivos', id);
}

// ── getObjetivosByFondo ───────────────────────────────────────────────────────

export async function getObjetivosByFondo(fondoId: string): Promise<Objetivo[]> {
  const db = await initDB();
  try {
    return (await db.getAllFromIndex('objetivos', 'fondoId', fondoId)) as Objetivo[];
  } catch {
    // Fallback si el índice no está disponible
    const all = (await db.getAll('objetivos')) as Objetivo[];
    return all.filter(
      (o) => (o.tipo === 'acumular' || o.tipo === 'comprar') && o.fondoId === fondoId,
    );
  }
}

// ── getObjetivosByPrestamo ────────────────────────────────────────────────────

export async function getObjetivosByPrestamo(prestamoId: string): Promise<Objetivo[]> {
  const db = await initDB();
  try {
    return (await db.getAllFromIndex('objetivos', 'prestamoId', prestamoId)) as Objetivo[];
  } catch {
    const all = (await db.getAll('objetivos')) as Objetivo[];
    return all.filter((o) => o.tipo === 'amortizar' && o.prestamoId === prestamoId);
  }
}
