import { initDB, MobiliarioActivo } from './db';
import { mueblesInmuebleService } from './mueblesInmuebleService';

const DAY_MS = 86400000;

const sortByDateDesc = (a: MobiliarioActivo, b: MobiliarioActivo) => b.fechaAlta.localeCompare(a.fechaAlta);

export async function crearMobiliario(
  input: Omit<MobiliarioActivo, 'id' | 'activo' | 'createdAt' | 'updatedAt'>
): Promise<MobiliarioActivo> {
  const db = await initDB();
  const now = new Date().toISOString();
  const mueble: Omit<MobiliarioActivo, 'id'> = {
    ...input,
    activo: true,
    createdAt: now,
    updatedAt: now,
  };
  const id = await db.add('mobiliarioActivo', mueble);
  // Dual write: mueblesInmueble
  await mueblesInmuebleService.crear({
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
  }).catch(() => { /* silent dual write */ });
  return { ...mueble, id: id as number };
}

export async function actualizarMobiliario(
  id: number,
  updates: Partial<Omit<MobiliarioActivo, 'id' | 'createdAt'>>
): Promise<MobiliarioActivo> {
  const db = await initDB();
  const actual = await db.get('mobiliarioActivo', id);
  if (!actual) throw new Error('Mobiliario no encontrado');

  const mueble: MobiliarioActivo = {
    ...actual,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await db.put('mobiliarioActivo', mueble);
  // Dual write: update mirror in mueblesInmueble (best-effort)
  const mirrored = await mueblesInmuebleService.getPorInmueble(mueble.inmuebleId);
  const match = mirrored.find(m => m.descripcion === actual.descripcion && m.fechaAlta === actual.fechaAlta && Math.abs(m.importe - actual.importe) < 0.01);
  if (match?.id) {
    await mueblesInmuebleService.actualizar(match.id, {
      descripcion: mueble.descripcion,
      importe: mueble.importe,
      vidaUtil: mueble.vidaUtil || 10,
      activo: mueble.activo,
      proveedorNIF: mueble.proveedorNIF || undefined,
      proveedorNombre: mueble.proveedorNombre || undefined,
      documentId: mueble.documentId || undefined,
      movimientoId: mueble.movementId != null ? String(mueble.movementId) : undefined,
    }).catch(() => {});
  }
  return mueble;
}

export async function getMobiliarioPorInmueble(inmuebleId: number): Promise<MobiliarioActivo[]> {
  const db = await initDB();
  const items = await db.getAllFromIndex('mobiliarioActivo', 'inmuebleId', inmuebleId);
  return items.sort(sortByDateDesc);
}

export async function calcularAmortizacionMobiliarioAnual(
  inmuebleId: number,
  ejercicio: number,
  diasArrendados: number,
  diasDisponibles: number
): Promise<number> {
  const muebles = await getMobiliarioPorInmueble(inmuebleId);
  const inicioEjercicio = new Date(ejercicio, 0, 1);
  const finEjercicio = new Date(ejercicio, 11, 31);
  let total = 0;

  for (const mueble of muebles) {
    const fechaAlta = new Date(mueble.fechaAlta);
    const fechaBaja = mueble.fechaBaja ? new Date(mueble.fechaBaja) : null;

    if (fechaAlta > finEjercicio) continue;
    if (fechaBaja && fechaBaja < inicioEjercicio) continue;
    if (!mueble.activo && !fechaBaja) continue;

    const vidaUtil = mueble.vidaUtil || 10;
    const amortizacionAnual = mueble.importe / vidaUtil;

    // Check if fully amortized: years since purchase >= vida útil
    const anosDesdeAlta = (ejercicio - fechaAlta.getFullYear());
    const amortizacionAcumuladaPrevia = anosDesdeAlta > 0
      ? Math.min(mueble.importe, amortizacionAnual * anosDesdeAlta)
      : 0;
    if (amortizacionAcumuladaPrevia >= mueble.importe) continue; // Fully amortized

    const desde = fechaAlta > inicioEjercicio ? fechaAlta : inicioEjercicio;
    const hasta = fechaBaja && fechaBaja < finEjercicio ? fechaBaja : finEjercicio;
    const diasActivo = Math.max(0, Math.ceil((hasta.getTime() - desde.getTime()) / DAY_MS) + 1);
    if (diasActivo === 0) continue;

    const ratioArrendamiento = diasDisponibles > 0 ? diasArrendados / diasDisponibles : 1;
    // Cap so accumulated amortization never exceeds cost
    const amortEsteEjercicio = (amortizacionAnual / diasDisponibles) * diasActivo * ratioArrendamiento;
    const maxRestante = mueble.importe - amortizacionAcumuladaPrevia;
    total += Math.min(amortEsteEjercicio, maxRestante);
  }

  return Math.round(total * 100) / 100;
}

export async function darDeBajaMobiliario(id: number, fechaBaja: string): Promise<void> {
  await actualizarMobiliario(id, { activo: false, fechaBaja });
}

export async function eliminarMobiliario(id: number): Promise<void> {
  const db = await initDB();
  // Best-effort dual delete from mueblesInmueble
  const actual = await db.get('mobiliarioActivo', id);
  if (actual) {
    const mirrored = await mueblesInmuebleService.getPorInmueble(actual.inmuebleId);
    const match = mirrored.find(m => m.descripcion === actual.descripcion && m.fechaAlta === actual.fechaAlta && Math.abs(m.importe - actual.importe) < 0.01);
    if (match?.id) await mueblesInmuebleService.eliminar(match.id).catch(() => {});
  }
  await db.delete('mobiliarioActivo', id);
}
