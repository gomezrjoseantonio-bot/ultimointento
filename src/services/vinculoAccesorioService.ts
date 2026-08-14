/**
 * vinculoAccesorioService.ts
 *
 * Alta MANUAL de un vínculo de accesorio (parking/trastero que se alquila junto
 * a un piso). "Accesorio" es una relación TEMPORAL: dos inmuebles con referencia
 * catastral propia (entidades independientes) que se alquilan juntos durante un
 * periodo. NO confundir con anexos sin referencia catastral, que son parte del
 * mismo inmueble y no se modelan aquí.
 *
 * El store `vinculosAccesorio` y su consumo (agregar el resultado del accesorio
 * al principal) ya existían; solo el IMPORT los creaba. Esto habilita el alta a
 * mano desde el contrato de alquiler (origenCreacion 'manual').
 */
import { initDB, VinculoAccesorio } from './db';

export interface AltaVinculoManual {
  inmueblePrincipalId: number;
  inmuebleAccesorioId: number;
  ejercicio: number;
  fechaInicio: string;
  fechaFin?: string;
}

/**
 * Crea (o reactiva) un vínculo de accesorio a mano. Idempotente: si ya existe el
 * vínculo [principal, accesorio, ejercicio] se actualiza (estado 'activo' +
 * fechas) en lugar de duplicar.
 */
export async function crearVinculoAccesorioManual(datos: AltaVinculoManual): Promise<VinculoAccesorio> {
  const { inmueblePrincipalId, inmuebleAccesorioId, ejercicio, fechaInicio, fechaFin } = datos;
  if (inmueblePrincipalId === inmuebleAccesorioId) {
    throw new Error('Un inmueble no puede ser accesorio de sí mismo');
  }
  const db = await initDB();
  const ahora = new Date().toISOString();

  const existente = (await db.getFromIndex(
    'vinculosAccesorio',
    'principal-accesorio-ejercicio',
    [inmueblePrincipalId, inmuebleAccesorioId, ejercicio],
  )) as VinculoAccesorio | undefined;

  if (existente?.id != null) {
    const actualizado: VinculoAccesorio = {
      ...existente,
      estado: 'activo',
      fechaInicio,
      fechaFin,
      origenCreacion: existente.origenCreacion === 'XML' ? 'XML' : 'manual',
      updatedAt: ahora,
    };
    await db.put('vinculosAccesorio', actualizado);
    return actualizado;
  }

  const vinculo: VinculoAccesorio = {
    inmueblePrincipalId,
    inmuebleAccesorioId,
    ejercicio,
    fechaInicio,
    fechaFin,
    estado: 'activo',
    origenCreacion: 'manual',
    createdAt: ahora,
    updatedAt: ahora,
  };
  const id = await db.add('vinculosAccesorio', vinculo);
  return { ...vinculo, id: id as number };
}

/**
 * Inmuebles que PUEDEN ser accesorios de `principalId`: cualquier otro inmueble
 * de la cartera (todos tienen referencia catastral propia = Caso 1). Un anexo
 * sin referencia (Caso 2) no es un inmueble en ATLAS, así que nunca aparece.
 * Excluye el propio principal.
 */
export async function getCandidatosAccesorio(principalId: number): Promise<Array<{ id: number; alias?: string; address?: string }>> {
  const db = await initDB();
  const props = (await db.getAll('properties')) as Array<{ id?: number; alias?: string; address?: string }>;
  return props
    .filter((p) => p.id != null && p.id !== principalId)
    .map((p) => ({ id: p.id as number, alias: p.alias, address: p.address }));
}
