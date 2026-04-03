// WRAPPER — delegates to mueblesInmuebleService
// Maintains MobiliarioActivo return type for backward compatibility with consumers
import { MobiliarioActivo } from './db';
import { mueblesInmuebleService } from './mueblesInmuebleService';

const sortByDateDesc = (a: MobiliarioActivo, b: MobiliarioActivo) => b.fechaAlta.localeCompare(a.fechaAlta);

function mapToMobiliario(m: any): MobiliarioActivo {
  return {
    id: m.id,
    inmuebleId: m.inmuebleId,
    ejercicio: m.ejercicio,
    descripcion: m.descripcion,
    fechaAlta: m.fechaAlta,
    importe: m.importe,
    vidaUtil: m.vidaUtil || 10,
    activo: m.activo ?? true,
    fechaBaja: m.fechaBaja,
    proveedorNIF: m.proveedorNIF || '',
    proveedorNombre: m.proveedorNombre,
    documentId: m.documentId,
    movementId: m.movimientoId,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  } as MobiliarioActivo;
}

export async function crearMobiliario(
  input: Omit<MobiliarioActivo, 'id' | 'activo' | 'createdAt' | 'updatedAt'>
): Promise<MobiliarioActivo> {
  const result = await mueblesInmuebleService.crear({
    inmuebleId: input.inmuebleId,
    ejercicio: input.ejercicio || new Date(input.fechaAlta).getFullYear(),
    descripcion: input.descripcion || '',
    fechaAlta: input.fechaAlta,
    importe: input.importe || 0,
    vidaUtil: input.vidaUtil || 10,
    activo: true,
    proveedorNIF: input.proveedorNIF || undefined,
    proveedorNombre: input.proveedorNombre || undefined,
    documentId: input.documentId || undefined,
    movimientoId: input.movementId != null ? String(input.movementId) : undefined,
  });
  return mapToMobiliario(result);
}

export async function actualizarMobiliario(
  id: number,
  updates: Partial<Omit<MobiliarioActivo, 'id' | 'createdAt'>>
): Promise<MobiliarioActivo> {
  const result = await mueblesInmuebleService.actualizar(id, {
    descripcion: updates.descripcion,
    importe: updates.importe,
    vidaUtil: updates.vidaUtil,
    activo: updates.activo,
    fechaBaja: updates.fechaBaja,
    proveedorNIF: updates.proveedorNIF,
    proveedorNombre: updates.proveedorNombre,
    documentId: updates.documentId,
    movimientoId: updates.movementId != null ? String(updates.movementId) : undefined,
  });
  return mapToMobiliario(result);
}

export async function getMobiliarioPorInmueble(inmuebleId: number): Promise<MobiliarioActivo[]> {
  const muebles = await mueblesInmuebleService.getPorInmueble(inmuebleId);
  return muebles.map(mapToMobiliario).sort(sortByDateDesc);
}

export async function calcularAmortizacionMobiliarioAnual(
  inmuebleId: number,
  ejercicio: number,
  diasArrendados: number,
  diasDisponibles: number
): Promise<number> {
  return mueblesInmuebleService.calcularAmortizacionMobiliarioAnual(
    inmuebleId, ejercicio, diasArrendados, diasDisponibles
  );
}

export async function darDeBajaMobiliario(id: number, fechaBaja: string): Promise<void> {
  await mueblesInmuebleService.darDeBaja(id, fechaBaja);
}

export async function eliminarMobiliario(id: number): Promise<void> {
  await mueblesInmuebleService.eliminar(id);
}
