// TAREA CC · COPIA-Y-RESTAURACIÓN
// ─────────────────────────────────────────────────────────────────────────────
// Copia de seguridad completa de `AtlasHorizonDB` a un único fichero .json y
// restauración desde él. Sin servidor: el fichero se descarga y se vuelve a
// cargar a mano. NO toca el esquema ni las migraciones (DB bump NO).
//
// Reglas duras (ver TAREACCCOPIAYRESTAURACION.md):
//   · TODOS los stores del esquema, recorriendo `db.objectStoreNames` (sin listas
//     blancas). Los vacíos también salen, como array vacío.
//   · Reemplazo total y todo-o-nada: una única transacción readwrite sobre todos
//     los stores. Si algo falla a mitad, la transacción aborta y la base queda
//     como estaba. Nada de fusión (evita colisiones de claves autoincrementales).
//   · Los binarios (`documents.content: Blob`, único binario del esquema · ver
//     verificación 4) viajan en base64 con marca explícita. Prohibido perderlos
//     en silencio: el codificador recorre cada registro y marca cualquier Blob.
//   · `keyval` es el ÚNICO store fuera de línea (createObjectStore sin keyPath):
//     sus claves NO viven dentro del valor, así que se capturan aparte con
//     getAllKeys y se restauran con put(valor, clave). El resto de stores llevan
//     la clave embebida (keyPath) y se restauran con put(registro).
//   · localStorage (verificación 5 · estado del usuario fuera de IndexedDB) viaja
//     en `otros.localStorage`.

import { initDB, DB_VERSION, DB_NAME } from '../db';
import type { AtlasHorizonDB } from '../db';
import type { StoreNames } from 'idb';
import { downloadBlob } from './documents';

// ── Formato del fichero ──────────────────────────────────────────────────────

/** Marca con la que viaja un Blob dentro de un registro (base64 + metadatos). */
export interface AtlasBlobMarker {
  __atlasBlob: true;
  mime: string;
  size: number;
  base64: string;
}

/** Entrada de un store fuera de línea (keyval): clave + valor por separado. */
export interface AtlasKeyvalEntry {
  k: IDBValidKey;
  v: unknown;
}

export const ATLAS_BACKUP_FORMATO = 1 as const;

export interface AtlasBackupFile {
  atlas: {
    formato: number;
    dbVersion: number;
    exportadoEl: string;
    origen: string;
    resumen: Record<string, number>;
    totalRegistros: number;
  };
  datos: Record<string, unknown[]>;
  otros?: {
    localStorage?: Record<string, string>;
  };
}

/** Metadatos de la última copia · para el aviso «hace N días» en Ajustes. */
export interface UltimaCopiaInfo {
  exportadoEl: string;
  totalRegistros: number;
}

const ULTIMA_COPIA_KEY = 'atlas-copia-seguridad-meta';
/** Umbral del aviso de copia antigua (§4). */
export const DIAS_COPIA_ANTIGUA = 30;

// ── Utilidades base64 ↔ Blob ─────────────────────────────────────────────────

function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el fichero'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el binario'));
    reader.onload = () => {
      const result = reader.result as string;
      // readAsDataURL devuelve `data:<mime>;base64,<datos>` · nos quedamos con los datos.
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Decodifica base64 → Blob de forma SÍNCRONA (atob) · imprescindible para no
 *  ceder el turno dentro de la transacción de importación (la cerraría). */
function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function isBlobMarker(value: unknown): value is AtlasBlobMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __atlasBlob?: unknown }).__atlasBlob === true &&
    typeof (value as AtlasBlobMarker).base64 === 'string'
  );
}

// ── Serialización de binarios dentro de un registro ──────────────────────────
// Recorre el registro y sustituye cada Blob por su marca base64. Es genérico (no
// sólo `documents.content`): si mañana otro store guardara un Blob, viajaría igual
// en vez de perderse en silencio.
//
// `ancestors` es el CAMINO actual (se añade al entrar, se quita al salir), no un
// «visto alguna vez». Así una referencia compartida en forma de diamante (dos
// campos apuntando al mismo sub-objeto, sin ciclo) se serializa bien, mientras que
// un ciclo real (arista hacia un ancestro) se detecta y ABORTA con un error claro,
// en vez de reintroducir la circularidad y romper `JSON.stringify` en silencio.

async function encodeBlobs(value: unknown, ancestors: Set<object>): Promise<unknown> {
  if (value instanceof Blob) {
    return {
      __atlasBlob: true,
      mime: value.type || 'application/octet-stream',
      size: value.size,
      base64: await blobToBase64(value),
    } as AtlasBlobMarker;
  }
  if (value && typeof value === 'object') {
    if (ancestors.has(value as object)) {
      throw new BackupError(
        'No se puede exportar la copia: un registro contiene una referencia circular.',
      );
    }
    ancestors.add(value as object);
    let out: unknown;
    if (Array.isArray(value)) {
      const arr: unknown[] = [];
      for (const item of value) arr.push(await encodeBlobs(item, ancestors));
      out = arr;
    } else {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        obj[k] = await encodeBlobs(v, ancestors);
      }
      out = obj;
    }
    ancestors.delete(value as object);
    return out;
  }
  return value;
}

/** Reconstruye Blobs desde sus marcas · SÍNCRONO (no cede el turno). */
function decodeBlobs(value: unknown): unknown {
  if (isBlobMarker(value)) {
    return base64ToBlob(value.base64, value.mime);
  }
  if (Array.isArray(value)) {
    return value.map(decodeBlobs);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = decodeBlobs(v);
    }
    return out;
  }
  return value;
}

// ── Exportación ──────────────────────────────────────────────────────────────

/**
 * Construye el objeto de copia leyendo TODOS los stores del esquema. No descarga
 * nada · se usa tanto para la descarga como para la copia obligatoria previa a un
 * reemplazo.
 */
export const buildBackup = async (): Promise<AtlasBackupFile> => {
  const db = await initDB();
  const storeNames = Array.from(db.objectStoreNames) as string[];

  const datos: Record<string, unknown[]> = {};
  const resumen: Record<string, number> = {};
  let totalRegistros = 0;

  for (const storeName of storeNames) {
    if (storeName === 'keyval') {
      // Store fuera de línea: capturamos clave + valor por separado.
      const keys = (await db.getAllKeys(storeName as StoreNames<AtlasHorizonDB>)) as IDBValidKey[];
      const values = await db.getAll(storeName as StoreNames<AtlasHorizonDB>);
      const entries: AtlasKeyvalEntry[] = [];
      for (let i = 0; i < keys.length; i++) {
        entries.push({ k: keys[i], v: await encodeBlobs(values[i], new Set<object>()) });
      }
      datos[storeName] = entries;
      resumen[storeName] = entries.length;
      totalRegistros += entries.length;
    } else {
      const records = await db.getAll(storeName as StoreNames<AtlasHorizonDB>);
      const encoded: unknown[] = [];
      for (const record of records) encoded.push(await encodeBlobs(record, new Set<object>()));
      datos[storeName] = encoded;
      resumen[storeName] = encoded.length;
      totalRegistros += encoded.length;
    }
  }

  // otros · localStorage (estado del usuario fuera de IndexedDB · verificación 5).
  const localStorageSnapshot: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key == null) continue;
      const val = localStorage.getItem(key);
      if (val != null) localStorageSnapshot[key] = val;
    }
  } catch {
    /* localStorage no disponible (modo privado extremo) · la copia sigue siendo válida */
  }

  const backup: AtlasBackupFile = {
    atlas: {
      formato: ATLAS_BACKUP_FORMATO,
      dbVersion: DB_VERSION,
      exportadoEl: new Date().toISOString(),
      origen: typeof window !== 'undefined' ? window.location.hostname : 'desconocido',
      resumen,
      totalRegistros,
    },
    datos,
    otros: { localStorage: localStorageSnapshot },
  };

  return backup;
};

/** Nombre del fichero: atlas-copia-AAAA-MM-DD-HHmm.json (hora local). */
export const backupFilename = (date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `atlas-copia-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(
    date.getHours(),
  )}${p(date.getMinutes())}.json`;
};

/**
 * Genera y descarga la copia. Devuelve el resumen para poder mostrarlo / guardar
 * la fecha de la última copia.
 */
export const exportBackup = async (): Promise<{ totalRegistros: number; exportadoEl: string }> => {
  const backup = await buildBackup();
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, backupFilename());
  setUltimaCopia({
    exportadoEl: backup.atlas.exportadoEl,
    totalRegistros: backup.atlas.totalRegistros,
  });
  return { totalRegistros: backup.atlas.totalRegistros, exportadoEl: backup.atlas.exportadoEl };
};

// ── Lectura / validación de un fichero de copia ──────────────────────────────

export type BackupCompatibilidad = 'igual' | 'antigua' | 'nueva';

export interface BackupPreview {
  archivo: AtlasBackupFile;
  dbVersionCopia: number;
  dbVersionActual: number;
  compatibilidad: BackupCompatibilidad;
  exportadoEl: string;
  origen: string;
  resumen: Record<string, number>;
  totalRegistros: number;
  /** Totales por store de la base ACTUAL · para el «se va a perder» del preview. */
  totalesActuales: Record<string, number>;
  totalActual: number;
}

export class BackupError extends Error {}

function esArchivoAtlas(data: unknown): data is AtlasBackupFile {
  if (!data || typeof data !== 'object') return false;
  const atlas = (data as AtlasBackupFile).atlas;
  const datos = (data as AtlasBackupFile).datos;
  return (
    !!atlas &&
    typeof atlas === 'object' &&
    typeof atlas.dbVersion === 'number' &&
    atlas.formato === ATLAS_BACKUP_FORMATO &&
    !!datos &&
    typeof datos === 'object'
  );
}

/**
 * Lee el fichero, valida que es una copia de ATLAS y devuelve un preview con lo
 * que hay dentro y lo que se perdería. NO escribe nada.
 *
 * Rechaza (BackupError con mensaje claro, no error de consola):
 *   · fichero que no es una copia de ATLAS
 *   · copia de una versión de base MÁS NUEVA que la app
 */
export const readBackupFile = async (file: File): Promise<BackupPreview> => {
  let data: unknown;
  try {
    const text = await readFileAsText(file);
    data = JSON.parse(text);
  } catch {
    throw new BackupError('El archivo no es una copia de ATLAS válida (no se pudo leer como JSON).');
  }

  if (!esArchivoAtlas(data)) {
    throw new BackupError('El archivo no es una copia de ATLAS. Elige un fichero atlas-copia-….json.');
  }

  const dbVersionCopia = data.atlas.dbVersion;
  const dbVersionActual = DB_VERSION;

  if (dbVersionCopia > dbVersionActual) {
    throw new BackupError(
      `La copia es de una versión posterior de ATLAS (base ${dbVersionCopia}, la tuya es ${dbVersionActual}). ` +
        'Actualiza la aplicación antes de restaurarla.',
    );
  }

  const compatibilidad: BackupCompatibilidad =
    dbVersionCopia === dbVersionActual ? 'igual' : 'antigua';

  // Totales de la base actual · para enseñar qué se pierde.
  const db = await initDB();
  const totalesActuales: Record<string, number> = {};
  let totalActual = 0;
  for (const storeName of Array.from(db.objectStoreNames) as string[]) {
    const n = await db.count(storeName as StoreNames<AtlasHorizonDB>);
    totalesActuales[storeName] = n;
    totalActual += n;
  }

  const resumen = data.atlas.resumen ?? {};
  const totalRegistros =
    typeof data.atlas.totalRegistros === 'number'
      ? data.atlas.totalRegistros
      : Object.values(resumen).reduce((a, b) => a + b, 0);

  return {
    archivo: data,
    dbVersionCopia,
    dbVersionActual,
    compatibilidad,
    exportadoEl: data.atlas.exportadoEl,
    origen: data.atlas.origen,
    resumen,
    totalRegistros,
    totalesActuales,
    totalActual,
  };
};

// ── Importación (reemplazo total · todo-o-nada) ──────────────────────────────

/**
 * Reemplaza TODA la base con el contenido de la copia. Todo-o-nada: una única
 * transacción readwrite sobre todos los stores. Si algo falla, la transacción
 * aborta y la base queda intacta.
 *
 * Sólo escribe stores que existan en el esquema ACTUAL (recorre
 * `db.objectStoreNames`). Un store presente en la copia pero ya inexistente en el
 * esquema se ignora (p.ej. stores retirados en un bump posterior); uno del
 * esquema ausente en la copia se VACÍA (la copia dice que no había nada).
 *
 * Devuelve el resumen realmente escrito (para el informe post-import).
 */
export const importBackup = async (
  archivo: AtlasBackupFile,
): Promise<{ escrito: Record<string, number>; totalRegistros: number }> => {
  const db = await initDB();
  const storeNames = Array.from(db.objectStoreNames) as string[];

  const escrito: Record<string, number> = {};
  let totalRegistros = 0;

  // Única transacción sobre TODOS los stores → atomicidad real.
  const tx = db.transaction(storeNames as StoreNames<AtlasHorizonDB>[], 'readwrite');
  // Si un put falla, idb aborta la tx y rechaza también `tx.done`. Consumimos esa
  // rechazo aquí para que no quede como unhandled rejection cuando el control de
  // flujo lo dirige el put que falló (no siempre llegamos a await tx.done).
  const done = tx.done.catch(() => undefined);

  try {
    // 1 · vaciar todos los stores.
    for (const storeName of storeNames) {
      await tx.objectStore(storeName as StoreNames<AtlasHorizonDB>).clear();
    }

    // 2 · reescribir desde la copia. Sólo await de operaciones IDB + decode
    //     síncrono → la transacción no se cierra a mitad.
    for (const storeName of storeNames) {
      const registros = archivo.datos[storeName];
      escrito[storeName] = 0;
      if (!Array.isArray(registros)) continue; // store ausente en la copia → queda vacío
      const store = tx.objectStore(storeName as StoreNames<AtlasHorizonDB>);

      if (storeName === 'keyval') {
        for (const raw of registros as AtlasKeyvalEntry[]) {
          if (!raw || typeof raw !== 'object' || !('k' in raw)) continue;
          await store.put(decodeBlobs(raw.v) as never, raw.k as IDBValidKey);
          escrito[storeName]++;
          totalRegistros++;
        }
      } else {
        for (const raw of registros) {
          await store.put(decodeBlobs(raw) as never);
          escrito[storeName]++;
          totalRegistros++;
        }
      }
    }

    await tx.done;
  } catch (err) {
    // Aborta explícitamente por si el fallo no lo hizo · deja la base intacta.
    try {
      tx.abort();
    } catch {
      /* ya abortada */
    }
    await done; // espera a que la tx termine de abortar (rechazo ya consumido)
    throw new BackupError(
      'La restauración falló y se ha deshecho: la base ha quedado como estaba. ' +
        (err instanceof Error ? err.message : 'Error desconocido'),
    );
  }

  // 3 · restaurar localStorage (estado secundario · fuera de la atomicidad de IDB).
  //     Reemplazo TOTAL, coherente con el de IndexedDB: se vacía primero para no
  //     dejar claves antiguas que la copia no tenía. Sólo se limpia cuando hay
  //     snapshot que rehidratar (una copia sin `otros.localStorage` no toca nada).
  const ls = archivo.otros?.localStorage;
  if (ls && typeof ls === 'object') {
    try {
      localStorage.clear();
      for (const [key, val] of Object.entries(ls)) {
        if (typeof val === 'string') localStorage.setItem(key, val);
      }
    } catch {
      /* localStorage no disponible · IDB ya se restauró correctamente */
    }
  }

  return { escrito, totalRegistros };
};

// ── Metadatos de la última copia (aviso §4) ──────────────────────────────────

export const getUltimaCopia = (): UltimaCopiaInfo | null => {
  try {
    const raw = localStorage.getItem(ULTIMA_COPIA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UltimaCopiaInfo;
    if (typeof parsed?.exportadoEl !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setUltimaCopia = (info: UltimaCopiaInfo): void => {
  try {
    localStorage.setItem(ULTIMA_COPIA_KEY, JSON.stringify(info));
  } catch {
    /* sin persistencia de meta · no bloquea la copia */
  }
};

/** true si nunca se ha hecho copia o la última tiene más de DIAS_COPIA_ANTIGUA días. */
export const copiaEsAntigua = (info: UltimaCopiaInfo | null = getUltimaCopia()): boolean => {
  if (!info) return true;
  const cuando = new Date(info.exportadoEl).getTime();
  if (Number.isNaN(cuando)) return true;
  const dias = (Date.now() - cuando) / (1000 * 60 * 60 * 24);
  return dias > DIAS_COPIA_ANTIGUA;
};

export { DB_NAME };
