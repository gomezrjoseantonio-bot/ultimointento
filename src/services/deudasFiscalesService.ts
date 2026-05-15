/**
 * deudasFiscalesService.ts
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 · sub-tarea 1 · hueco 4.
 *
 * Gestión de deudas fiscales con la AEAT (modelos 100, 303, 130, 184).
 * Store `deudasFiscales` creado en V71 (DB_VERSION 70 → 71).
 *
 * Sin seed automático: el store empieza vacío. La UI F6 (sub-tarea 6)
 * añadirá registros manualmente.
 */

import { initDB, DeudaFiscal } from './db';

export type { DeudaFiscal };

export type DeudaEstado = DeudaFiscal['estado'];

export interface FiltroDeudas {
  estado?: DeudaEstado;
}

const ESTADOS_ABIERTOS: ReadonlyArray<DeudaEstado> = [
  'voluntario',
  'ejecutivo',
  'apremio',
  'embargo',
  'aplazada',
];

function ahora(): string {
  return new Date().toISOString();
}

export async function getDeudaById(id: number): Promise<DeudaFiscal | null> {
  const db = await initDB();
  const deuda = await db.get('deudasFiscales', id);
  return deuda ?? null;
}

export async function getDeudas(filtro?: FiltroDeudas): Promise<DeudaFiscal[]> {
  const db = await initDB();
  const todas = (await db.getAll('deudasFiscales')) as DeudaFiscal[];
  if (filtro?.estado) {
    return todas.filter((d) => d.estado === filtro.estado);
  }
  return todas;
}

export async function getDeudasAbiertas(): Promise<DeudaFiscal[]> {
  const db = await initDB();
  const todas = (await db.getAll('deudasFiscales')) as DeudaFiscal[];
  return todas.filter((d) => ESTADOS_ABIERTOS.includes(d.estado));
}

export async function getTotalAbierto(): Promise<number> {
  const abiertas = await getDeudasAbiertas();
  return abiertas.reduce((sum, d) => sum + (d.total ?? 0), 0);
}

export async function crearDeuda(
  input: Omit<DeudaFiscal, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DeudaFiscal> {
  const db = await initDB();
  const now = ahora();
  const record: Omit<DeudaFiscal, 'id'> = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const id = (await db.add('deudasFiscales', record as DeudaFiscal)) as number;
  return { ...record, id };
}

export async function marcarPagada(id: number, fechaPago: string): Promise<DeudaFiscal> {
  const db = await initDB();
  const existing = await db.get('deudasFiscales', id);
  if (!existing) {
    throw new Error(`Deuda fiscal id=${id} no encontrada`);
  }
  const updated: DeudaFiscal = {
    ...existing,
    estado: 'pagada',
    pagadaEl: fechaPago,
    updatedAt: ahora(),
  };
  await db.put('deudasFiscales', updated);
  return updated;
}

export async function actualizarRecargo(
  id: number,
  nuevoEstado: DeudaEstado,
): Promise<DeudaFiscal> {
  const db = await initDB();
  const existing = await db.get('deudasFiscales', id);
  if (!existing) {
    throw new Error(`Deuda fiscal id=${id} no encontrada`);
  }
  const updated: DeudaFiscal = {
    ...existing,
    estado: nuevoEstado,
    updatedAt: ahora(),
  };
  await db.put('deudasFiscales', updated);
  return updated;
}
