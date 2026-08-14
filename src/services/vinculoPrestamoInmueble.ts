// Vínculo Préstamo <-> Inmueble · la FK `estructuraCompra.prestamoVinculadoId`.
//
// Vive en servicios (no en una página) porque lo usan dos lados: la ficha de
// inmueble (al vincular a mano) y el asistente de préstamo (al crear uno que
// financia un inmueble). Es la misma FK que ya fija la importación FEIN
// (`prestamosImportCreationService`).

import { initDB } from './db';
import type { Property } from './db';
import type { Prestamo } from '../types/prestamos';

/** Fija la FK del inmueble a un préstamo (idempotente · conserva lo demás). */
export async function fijarPrestamoVinculado(
  inmuebleId: number,
  prestamoId: string,
): Promise<void> {
  const db = await initDB();
  const prop = (await db.get('properties', inmuebleId)) as Property | undefined;
  if (!prop) return;
  const estructuraCompra = { ...(prop.estructuraCompra ?? {}), prestamoVinculadoId: prestamoId };
  await db.put('properties', { ...prop, estructuraCompra });
}

/**
 * Tras crear un préstamo, enlaza sus inmuebles de destino (ADQUISICIÓN/REFORMA)
 * que aún no tengan préstamo vinculado. Un inmueble que YA tiene FK no se pisa
 * (podría ser de otra hipoteca anterior).
 */
export async function sincronizarVinculoTrasCrearPrestamo(prestamo: Prestamo): Promise<void> {
  const inmueblesDestino = [
    ...new Set(
      (prestamo.destinos ?? [])
        .filter((d) => (d.tipo === 'ADQUISICION' || d.tipo === 'REFORMA') && d.inmuebleId)
        .map((d) => d.inmuebleId as string),
    ),
  ];
  if (inmueblesDestino.length === 0) return;

  const db = await initDB();
  for (const idStr of inmueblesDestino) {
    const inmuebleId = Number(idStr);
    if (!Number.isFinite(inmuebleId)) continue;
    const prop = (await db.get('properties', inmuebleId)) as Property | undefined;
    if (!prop || prop.estructuraCompra?.prestamoVinculadoId) continue;
    const estructuraCompra = { ...(prop.estructuraCompra ?? {}), prestamoVinculadoId: prestamo.id };
    await db.put('properties', { ...prop, estructuraCompra });
  }
}
