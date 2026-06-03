// src/services/alquileresV3FixService.ts
//
// V78.1 (fix post-deploy modelo alquileres v3) · utilidades de auto-curación de datos.
//
// Las funciones reciben la `db` ya abierta (no llaman a initDB) para poder invocarse desde el
// hook post-upgrade de db.ts SIN crear un ciclo de import en runtime (aquí solo importamos
// tipos de db.ts, que se borran al compilar).

import type { IDBPDatabase } from 'idb';
import type { Property, BoteAnualSinIdentificar, Contract } from './db';
import { calcularFechaFinLAUImport, FECHA_FIN_INDEFINIDO } from './contractService';

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

/** ¿El contrato proviene de una importación AEAT? (tiene algún ejercicio con fuente xml_aeat). */
const esContratoImportadoAEAT = (c: Contract): boolean =>
  Object.values(c.ejerciciosFiscales ?? {}).some((e: any) => e?.fuente === 'xml_aeat');

/**
 * V78.1 (Extra 1 · LAU 5 años) · recalcula `fechaFin`/`endDate` de los contratos HABITUALES
 * ya creados por importación AEAT que quedaron con el sentinel indefinido (`2099-12-31`).
 *
 * Alcance acordado (ver decisiones del Commit 4):
 *  - SOLO contratos con algún ejercicio `fuente === 'xml_aeat'` (no toca contratos manuales que
 *    el usuario dejó indefinidos a propósito).
 *  - SOLO `modalidad === 'habitual'` (temporada/vacacional conservan su fin).
 *  - SOLO los que hoy tienen `fechaFin` indefinido (2099 o vacío); no pisa fechas ya concretas.
 *  - Regla "+5y solo si futuro": si inicio+5y cae en el pasado respecto a `hoy`, se mantiene
 *    indefinido (no se marca como vencido un contrato con fecha de inicio antigua/inventada).
 *
 * Idempotente y determinista (`hoy` inyectable). Devuelve el nº de contratos modificados.
 */
export async function recalcularFechaFinContratosAEAT(
  db: IDBPDatabase<any>,
  hoy: Date = new Date(),
): Promise<number> {
  const contratos = (await db.getAll('contracts')) as Contract[];
  let actualizados = 0;

  for (const c of contratos) {
    if (c?.id == null) continue;
    if (c.modalidad !== 'habitual') continue;
    if (!esContratoImportadoAEAT(c)) continue;

    const finActual = (c.fechaFin ?? '').slice(0, 10);
    const esIndefinido = finActual === '' || finActual === FECHA_FIN_INDEFINIDO;
    if (!esIndefinido) continue;
    if (!c.fechaInicio) continue;

    const nuevoFin = calcularFechaFinLAUImport(c.fechaInicio, hoy);
    if (nuevoFin === finActual) continue; // sigue indefinido → no-op

    c.fechaFin = nuevoFin;
    (c as any).endDate = nuevoFin;
    await db.put('contracts', c);
    actualizados++;
  }

  return actualizados;
}

/** ¿El contrato tiene una firma registrada (digital o manual)? Mismo criterio que
 *  `estaFirmado()` del módulo inmuebles, inlineado aquí para no importar desde
 *  `modules/*` en la capa de servicios. */
const tieneFirmaRegistrada = (c: Contract): boolean => {
  if (c.firma?.estado === 'firmado') return true;
  if (typeof c.fechaFirmaContrato === 'string' && c.fechaFirmaContrato.trim() !== '') return true;
  return false;
};

/**
 * REORG Contratos · migración SUAVE (sin DB bump) del flag `documentoFirmado`.
 *
 * Deja `documentoFirmado` definido en todos los Contracts existentes:
 *  - `false` si el contrato carece de soporte documental firmado: `estadoContrato
 *    === 'sin_firmar'`, o procede de importación (`origenImportacion` rentila/
 *    plantilla_atlas, o algún ejercicio con `fuente === 'xml_aeat'`) y NO tiene
 *    una firma registrada.
 *  - `true` en el resto (creados manualmente o con firma registrada).
 *
 * Idempotente: NO pisa un `documentoFirmado` ya definido. Devuelve el nº de
 * contratos modificados.
 */
export async function backfillDocumentoFirmado(db: IDBPDatabase<any>): Promise<number> {
  const contratos = (await db.getAll('contracts')) as Contract[];
  let actualizados = 0;

  for (const c of contratos) {
    if (c?.id == null) continue;
    if (typeof c.documentoFirmado === 'boolean') continue; // ya definido · idempotente

    const importadoSinFirma =
      c.estadoContrato === 'sin_firmar' ||
      c.origenImportacion === 'rentila' ||
      c.origenImportacion === 'plantilla_atlas' ||
      esContratoImportadoAEAT(c);

    c.documentoFirmado = tieneFirmaRegistrada(c) ? true : !importadoSinFirma;
    await db.put('contracts', c);
    actualizados++;
  }

  return actualizados;
}
