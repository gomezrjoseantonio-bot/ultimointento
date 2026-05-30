// src/services/alquileresV3FixService.ts
//
// V78.1 (fix post-deploy modelo alquileres v3) · utilidades de auto-curación de datos.
//
// Las funciones reciben la `db` ya abierta (no llaman a initDB) para poder invocarse desde el
// hook post-upgrade de db.ts SIN crear un ciclo de import en runtime (aquí solo importamos
// tipos de db.ts, que se borran al compilar).

import type { IDBPDatabase } from 'idb';
import type { Property, BoteAnualSinIdentificar } from './db';

/** Normaliza una referencia catastral igual que el distribuidor (sin espacios/puntos/guiones). */
const normRef = (v?: string | null): string =>
  (v ?? '').replace(/[\s.-]/g, '').trim().toUpperCase();

/**
 * V78.1 (fix H2) · repuebla `nifsDetectados` de los botes ya creados leyendo la declaración
 * archivada en `ejerciciosFiscalesCoord[año].aeat.declaracionCompleta`.
 *
 * Solo toca botes de inmuebles cuyo `modoExplotacion` es `por_habitaciones`/`mixto` (donde TODOS
 * los bloques del XML van al bote, así que todos sus NIFs pertenecen al bote). Los `piso_completo`
 * se saltan: su bote (si existe) solo agrega bloques SIN NIF, y los bloques con NIF fueron a
 * contratos identificados (Camino 1).
 *
 * Idempotente: hace merge sin duplicar y solo escribe si añade algún NIF nuevo.
 * Devuelve el nº de botes actualizados.
 */
export async function repoblarNifsBotesDesdeArchivo(db: IDBPDatabase<any>): Promise<number> {
  const coords = (await db.getAll('ejerciciosFiscalesCoord')) as any[];
  const props = (await db.getAll('properties')) as Property[];

  const idByRef = new Map<string, number>();
  const modoById = new Map<number, Property['modoExplotacion']>();
  for (const p of props) {
    if (p?.id == null) continue;
    const rc = normRef(p.cadastralReference);
    if (rc) idByRef.set(rc, p.id);
    modoById.set(p.id, p.modoExplotacion);
  }

  let actualizados = 0;
  for (const ej of coords) {
    const decl = ej?.aeat?.declaracionCompleta;
    const año = Number(ej?.año ?? decl?.meta?.ejercicio);
    if (!decl?.inmuebles || !año) continue;

    for (const inm of decl.inmuebles) {
      if (inm?.esAccesorioDe) continue;
      const id = idByRef.get(normRef(inm?.refCatastral));
      if (id == null) continue;
      const modo = modoById.get(id);
      if (modo !== 'por_habitaciones' && modo !== 'mixto') continue;

      const nifs = (inm.arrendamientos ?? [])
        .flatMap((a: any) => a?.nifArrendatarios ?? [])
        .map((n: any) => (n ?? '').trim())
        .filter((n: string) => n.length > 0);
      if (nifs.length === 0) continue;

      const bote = (await db.getFromIndex('botesAnualesSinIdentificar', 'inmuebleId-año', [
        id,
        año,
      ])) as BoteAnualSinIdentificar | undefined;
      if (!bote?.id) continue;

      const before = bote.nifsDetectados?.length ?? 0;
      const merged = Array.from(new Set([...(bote.nifsDetectados ?? []), ...nifs]));
      if (merged.length !== before) {
        bote.nifsDetectados = merged;
        bote.fechaUltimaModificación = new Date().toISOString();
        await db.put('botesAnualesSinIdentificar', bote);
        actualizados++;
      }
    }
  }

  return actualizados;
}
