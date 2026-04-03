// WRAPPER — delegates to mejorasInmuebleService
// Maintains MejoraActivo return type for backward compatibility with consumers
import { MejoraActivo } from './db';
import { mejorasInmuebleService } from './mejorasInmuebleService';

const sortByDateDesc = (a: MejoraActivo, b: MejoraActivo) => {
  const aDate = a.fecha ?? `${a.ejercicio}-01-01`;
  const bDate = b.fecha ?? `${b.ejercicio}-01-01`;
  return bDate.localeCompare(aDate);
};

export async function crearMejora(
  input: Omit<MejoraActivo, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MejoraActivo> {
  const result = await mejorasInmuebleService.crear({
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
  });
  return {
    ...input,
    id: result.id,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  } as MejoraActivo;
}

export async function actualizarMejora(
  id: number,
  updates: Partial<Omit<MejoraActivo, 'id' | 'createdAt'>>
): Promise<MejoraActivo> {
  const result = await mejorasInmuebleService.actualizar(id, {
    descripcion: updates.descripcion,
    tipo: updates.tipo,
    importe: updates.importe,
    fecha: updates.fecha,
    proveedorNIF: updates.proveedorNIF,
    proveedorNombre: updates.proveedorNombre,
    documentId: updates.documentId,
    movimientoId: updates.movementId != null ? String(updates.movementId) : undefined,
  });
  return {
    inmuebleId: result.inmuebleId,
    ejercicio: result.ejercicio,
    descripcion: result.descripcion,
    tipo: result.tipo,
    importe: result.importe,
    fecha: result.fecha,
    proveedorNIF: result.proveedorNIF || '',
    proveedorNombre: result.proveedorNombre,
    documentId: result.documentId,
    movementId: result.movimientoId,
    id: result.id,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  } as MejoraActivo;
}

export async function getMejorasPorInmueble(inmuebleId: number): Promise<MejoraActivo[]> {
  const mejoras = await mejorasInmuebleService.getPorInmueble(inmuebleId);
  return mejoras.map(m => ({
    id: m.id,
    inmuebleId: m.inmuebleId,
    ejercicio: m.ejercicio,
    descripcion: m.descripcion,
    tipo: m.tipo,
    importe: m.importe,
    fecha: m.fecha,
    proveedorNIF: m.proveedorNIF || '',
    proveedorNombre: m.proveedorNombre,
    documentId: m.documentId,
    movementId: m.movimientoId,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  } as MejoraActivo)).sort(sortByDateDesc);
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

export async function getTotalCapexHastaEjercicio(
  inmuebleId: number,
  ejercicio: number
): Promise<number> {
  const mejoras = await getMejorasHastaEjercicio(inmuebleId, ejercicio);
  return mejoras
    .filter((m) => m.tipo !== 'reparacion')
    .reduce((sum, mejora) => sum + mejora.importe, 0);
}

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
  await mejorasInmuebleService.eliminar(id);
}
