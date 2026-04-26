// src/services/ejercicioFiscalService.ts
// V62 (TAREA 7 sub-tarea 3): el store legacy `ejerciciosFiscales` fue
// eliminado. Este módulo se mantiene como capa de compatibilidad mínima
// que redirige las operaciones al store actual `ejerciciosFiscalesCoord`
// (modelo coordinador, keyPath: `año`).
//
// Doble exposición intencional:
//   - Exports top-level (consumido por `import * as ejercicioFiscalService`,
//     p.ej. `fiscalLifecycleService`, `fiscalYearLifecycleService`).
//   - Const `ejercicioFiscalService` con los mismos métodos (consumido por
//     `import { ejercicioFiscalService }`, p.ej. `datosFiscalesService`,
//     `declaracionOnboardingService`, `useEjercicioFiscal`).
//
// El interface `EjercicioFiscal` (legacy, vivía en db.ts antes de V62) se
// re-exporta aquí para que los pocos consumidores que lo importan sigan
// compilando. Los campos extra que la versión legacy soportaba se aceptan
// vía index signature: lo que se persiste es sólo lo válido para
// `EjercicioFiscalCoord`.

import {
  initDB,
  type EjercicioFiscalCoord,
  type EjercicioFiscal as DbEjercicioFiscal,
  type EstadoEjercicio as DbEstadoEjercicio,
} from './db';

// Re-exportamos los tipos canónicos definidos en `./db` para que todos
// los consumidores compartan la misma forma (evita conflictos de tipo).
export type EstadoEjercicio = DbEstadoEjercicio;
export type EjercicioFiscal = DbEjercicioFiscal;

function nowIso(): string {
  return new Date().toISOString();
}

function emptyArrastresIn(): EjercicioFiscalCoord['arrastresIn'] {
  return {
    fuente: 'ninguno',
    gastosPendientes: [],
    perdidasPatrimoniales: [],
    amortizacionesAcumuladas: [],
    deduccionesPendientes: [],
  };
}

function coordToLegacy(c: EjercicioFiscalCoord): EjercicioFiscal {
  return {
    ejercicio: c.año,
    año: c.año,
    estado: c.estado,
    origen: 'manual',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function legacyAño(record: EjercicioFiscal): number | undefined {
  if (typeof record.año === 'number') return record.año;
  if (typeof record.ejercicio === 'number') return record.ejercicio;
  return undefined;
}

// ───────────────────────────────────────────────────────────────────────────
// Top-level exports (consumed via `import * as ejercicioFiscalService`)
// ───────────────────────────────────────────────────────────────────────────

export async function getEjercicio(ejercicio: number): Promise<EjercicioFiscal | undefined> {
  const db = await initDB();
  const coord = await db.get('ejerciciosFiscalesCoord', ejercicio);
  return coord ? coordToLegacy(coord) : undefined;
}

export async function getAllEjercicios(): Promise<EjercicioFiscal[]> {
  const db = await initDB();
  try {
    const coords = await db.getAll('ejerciciosFiscalesCoord');
    return coords.map(coordToLegacy);
  } catch {
    return [];
  }
}

export async function getOrCreateEjercicio(
  año: number,
  estadoDefault: EstadoEjercicio = 'en_curso',
): Promise<EjercicioFiscal> {
  const db = await initDB();
  const existing = await db.get('ejerciciosFiscalesCoord', año);
  if (existing) {
    return coordToLegacy(existing);
  }
  const now = nowIso();
  const created: EjercicioFiscalCoord = {
    año,
    estado: estadoDefault,
    arrastresIn: emptyArrastresIn(),
    inmuebleIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.put('ejerciciosFiscalesCoord', created);
  return coordToLegacy(created);
}

/**
 * Persiste el registro legacy en `ejerciciosFiscalesCoord`.
 * Sólo se conservan los campos válidos del modelo coordinador (estado,
 * fechas). El resto de campos legacy se descartan en silencio.
 */
export async function saveLegacyEjercicioRecord(record: EjercicioFiscal): Promise<EjercicioFiscal> {
  const año = legacyAño(record);
  if (typeof año !== 'number') {
    throw new Error('El registro legacy debe incluir ejercicio o año.');
  }
  const db = await initDB();
  const now = nowIso();
  const existing = await db.get('ejerciciosFiscalesCoord', año);
  const merged: EjercicioFiscalCoord = existing
    ? {
        ...existing,
        estado: record.estado ?? existing.estado,
        updatedAt: now,
      }
    : {
        año,
        estado: record.estado ?? 'en_curso',
        arrastresIn: emptyArrastresIn(),
        inmuebleIds: [],
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
        updatedAt: now,
      };
  await db.put('ejerciciosFiscalesCoord', merged);
  return coordToLegacy(merged);
}

export async function saveEjercicio(record: EjercicioFiscal): Promise<void> {
  await saveLegacyEjercicioRecord(record);
}

export async function cerrarEjercicio(ejercicio: number): Promise<EjercicioFiscal> {
  const current = await getOrCreateEjercicio(ejercicio);
  current.estado = 'pendiente';
  current.cerradoAt = nowIso();
  return saveLegacyEjercicioRecord(current);
}

/**
 * V62: el store legacy fue eliminado · persistimos a `ejerciciosFiscalesCoord`
 * marcando el ejercicio como `declarado`. Los args extra (declaración,
 * origen, fechaPresentacion, ...) se mantienen por compatibilidad de firma;
 * sólo `fechaPresentacion` se usa para anotar `createdAt`. El detalle de la
 * declaración (snapshotsDeclaracion, arrastresIRPF, etc.) se persiste a
 * través de `declaracionDistributorService`.
 */
export async function declararEjercicio(
  ejercicio: number,
  _declaracion?: unknown,
  _origen?: string,
  fechaPresentacion?: string,
  _pdfRef?: string,
  _casillasRaw?: Record<string, number | string>,
): Promise<EjercicioFiscal> {
  const db = await initDB();
  const now = nowIso();
  const fecha = fechaPresentacion ?? now;
  const existing = await db.get('ejerciciosFiscalesCoord', ejercicio);
  const updated: EjercicioFiscalCoord = existing
    ? { ...existing, estado: 'declarado', updatedAt: now }
    : {
        año: ejercicio,
        estado: 'declarado',
        arrastresIn: emptyArrastresIn(),
        inmuebleIds: [],
        createdAt: fecha,
        updatedAt: now,
      };
  await db.put('ejerciciosFiscalesCoord', updated);
  const result = coordToLegacy(updated);
  result.declaradoAt = fecha;
  return result;
}

export async function getTresVerdades(ejercicio: number): Promise<{
  calculado?: undefined;
  declarado?: undefined;
  estado: EstadoEjercicio;
}> {
  const current = await getOrCreateEjercicio(ejercicio);
  return { calculado: undefined, declarado: undefined, estado: current.estado };
}

/**
 * V62: la cobertura documental dependía del store eliminado
 * `documentosFiscales`. Se devuelve un informe vacío hasta que la
 * funcionalidad se reimplemente sobre `documents` (sub-tareas
 * posteriores). Los hooks que la consumen ya manejan la lista vacía.
 */
export async function getCoberturaDocumental(_ejercicio: number): Promise<{
  ejercicio: number;
  totalEsperados: number;
  totalEntregados: number;
  cobertura: number;
  lineas: never[];
}> {
  return {
    ejercicio: _ejercicio,
    totalEsperados: 0,
    totalEntregados: 0,
    cobertura: 0,
    lineas: [],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Const object (consumed via `import { ejercicioFiscalService }`)
// ───────────────────────────────────────────────────────────────────────────

export const ejercicioFiscalService = {
  getEjercicio,
  getAllEjercicios,
  getOrCreateEjercicio,
  saveLegacyEjercicioRecord,
  saveEjercicio,
  cerrarEjercicio,
  declararEjercicio,
  getTresVerdades,
  getCoberturaDocumental,
};
