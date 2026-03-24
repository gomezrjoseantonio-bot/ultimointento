import { initDB, MejoraActivo } from './db';

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
  await db.delete('mejorasActivo', id);
}
