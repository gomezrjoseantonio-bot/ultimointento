import { initDB, MejoraActivo } from './db';
import { mejorasInmuebleService } from './mejorasInmuebleService';

const sortByDateDesc = (a: MejoraActivo, b: MejoraActivo) => {
  const aDate = a.fecha ?? `${a.ejercicio}-01-01`;
  const bDate = b.fecha ?? `${b.ejercicio}-01-01`;
  return bDate.localeCompare(aDate);
};

export async function crearMejora(
  input: Omit<MejoraActivo, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MejoraActivo> {
  const db = await initDB();
  const now = new Date().toISOString();
  const mejora: Omit<MejoraActivo, 'id'> = { ...input, createdAt: now, updatedAt: now };
  const id = await db.add('mejorasActivo', mejora);
  // Dual write: mejorasInmueble
  await mejorasInmuebleService.crear({
    inmuebleId: input.inmuebleId,
    ejercicio: input.ejercicio,
    descripcion: input.descripcion || '',
    tipo: input.tipo || 'mejora',
    importe: input.importe || 0,
    fecha: input.fecha || `${input.ejercicio}-12-31`,
    proveedorNIF: input.proveedorNIF || undefined,
    proveedorNombre: input.proveedorNombre || undefined,
    documentId: input.documentId || undefined,
    movimientoId: input.movementId != null ? String(input.movementId) : undefined,
  }).catch(() => { /* silent — best effort dual write */ });
  return { ...mejora, id: id as number };
}

export async function actualizarMejora(
  id: number,
  updates: Partial<Omit<MejoraActivo, 'id' | 'createdAt'>>
): Promise<MejoraActivo> {
  const db = await initDB();
  const actual = await db.get('mejorasActivo', id);
  if (!actual) throw new Error('Mejora no encontrada');

  const mejora: MejoraActivo = {
    ...actual,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await db.put('mejorasActivo', mejora);
  // Dual write: update mirror in mejorasInmueble (best-effort)
  const mirrored = await mejorasInmuebleService.getPorInmueble(mejora.inmuebleId);
  const match = mirrored.find(m => m.descripcion === actual.descripcion && m.ejercicio === actual.ejercicio && Math.abs(m.importe - actual.importe) < 0.01);
  if (match?.id) {
    await mejorasInmuebleService.actualizar(match.id, {
      descripcion: mejora.descripcion,
      tipo: mejora.tipo,
      importe: mejora.importe,
      fecha: mejora.fecha || `${mejora.ejercicio}-12-31`,
      proveedorNIF: mejora.proveedorNIF || undefined,
      proveedorNombre: mejora.proveedorNombre || undefined,
      documentId: mejora.documentId || undefined,
      movimientoId: mejora.movementId != null ? String(mejora.movementId) : undefined,
    }).catch(() => {});
  }
  return mejora;
}

export async function getMejorasPorInmueble(inmuebleId: number): Promise<MejoraActivo[]> {
  const db = await initDB();
  const mejoras = await db.getAllFromIndex('mejorasActivo', 'inmuebleId', inmuebleId);
  return mejoras.sort(sortByDateDesc);
}

export async function getMejorasHastaEjercicio(
  inmuebleId: number,
  ejercicio: number
): Promise<MejoraActivo[]> {
  const mejoras = await getMejorasPorInmueble(inmuebleId);
  return mejoras.filter((m) => m.ejercicio <= ejercicio);
}

export async function getTotalMejorasHastaEjercicio(
  inmuebleId: number,
  ejercicio: number
): Promise<number> {
  const mejoras = await getMejorasHastaEjercicio(inmuebleId, ejercicio);
  return mejoras.reduce((sum, mejora) => sum + mejora.importe, 0);
}

/**
 * Get total CAPEX (tipo='mejora' | 'ampliacion', excludes 'reparacion') up to a fiscal year.
 * Used for portfolio cost breakdown KPI.
 */
export async function getTotalCapexHastaEjercicio(
  inmuebleId: number,
  ejercicio: number
): Promise<number> {
  const mejoras = await getMejorasHastaEjercicio(inmuebleId, ejercicio);
  return mejoras
    .filter((m) => m.tipo !== 'reparacion')
    .reduce((sum, mejora) => sum + mejora.importe, 0);
}

/**
 * Get total reparaciones (tipo='reparacion') for a property in a specific year → casilla 0106
 */
export async function getTotalReparacionesEjercicio(
  inmuebleId: number,
  ejercicio: number
): Promise<number> {
  const mejoras = await getMejorasPorInmueble(inmuebleId);
  return mejoras
    .filter((m) => m.tipo === 'reparacion' && m.ejercicio === ejercicio)
    .reduce((sum, mejora) => sum + mejora.importe, 0);
}

export async function eliminarMejora(id: number): Promise<void> {
  const db = await initDB();
  // Best-effort dual delete from mejorasInmueble
  const actual = await db.get('mejorasActivo', id);
  if (actual) {
    const mirrored = await mejorasInmuebleService.getPorInmueble(actual.inmuebleId);
    const match = mirrored.find(m => m.descripcion === actual.descripcion && m.ejercicio === actual.ejercicio && Math.abs(m.importe - actual.importe) < 0.01);
    if (match?.id) await mejorasInmuebleService.eliminar(match.id).catch(() => {});
  }
  await db.delete('mejorasActivo', id);
}
