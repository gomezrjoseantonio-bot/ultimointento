import { initDB, ArrastreIRPF, SnapshotDeclaracion } from './db';
import { calcularDeclaracionIRPF } from './irpfCalculationService';

export interface CrearSnapshotOpts {
  origen?: 'cierre_automatico' | 'importacion_manual';
  incluirCasillasAEAT?: boolean;
  force?: boolean;
}

export interface ArrastreImportadoInput {
  tipo: ArrastreIRPF['tipo'];
  importePendiente: number;
  importeOriginal?: number;
  ejercicioOrigen: number;
  ejercicioCaducidad?: number;
  inmuebleId?: number;
}

export interface ImportacionDeclaracionManualInput {
  casillasAEAT: Record<string, number>;
  datos?: Partial<SnapshotDeclaracion['datos']>;
  arrastresGenerados?: ArrastreImportadoInput[];
  arrastresAplicadosIds?: number[];
}

const STORE_NAME = 'snapshotsDeclaracion';
const ARRSTRES_STORE_NAME = 'arrastresIRPF';

function sortObjectKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeysDeep);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, sortObjectKeysDeep(val)]);

    return Object.fromEntries(entries);
  }

  return value;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function encodeUtf8(text: string): Promise<Uint8Array> {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text);
  }

  // Fallback legacy sin TextEncoder (sin dependencias Node)
  const utf8 = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) {
    bytes[i] = utf8.charCodeAt(i);
  }
  return bytes;
}

async function computeSha256(payload: unknown): Promise<string> {
  const canonicalPayload = JSON.stringify(sortObjectKeysDeep(payload));
  const encoded = await encodeUtf8(canonicalPayload);

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    const hex = toHex(digest);
    if (hex.length > 0) {
      return hex;
    }
  }

  // Fallback sin WebCrypto (entornos legacy/test): hash determinista no criptográfico.
  // Se usa únicamente para mantener verificación de integridad local cuando SubtleCrypto no está disponible.
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < encoded.length; i++) {
    hash ^= encoded[i];
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildCasillasAEAT(snapshot: SnapshotDeclaracion['datos']): Record<string, number> {
  return {
    '0435': snapshot.baseGeneral.total ?? 0,
    '0460': snapshot.baseAhorro.total ?? 0,
    '0500': snapshot.minimosPersonales.total ?? 0,
    '0560': snapshot.liquidacion.cuotaIntegra ?? 0,
    '0595': snapshot.liquidacion.cuotaLiquida ?? 0,
    '0670': snapshot.liquidacion.deduccionesDobleImposicion ?? 0,
  };
}

async function findLatestSnapshotByEjercicio(ejercicio: number): Promise<SnapshotDeclaracion | null> {
  const db = await initDB();
  const snapshots = (await db.getAllFromIndex(STORE_NAME, 'ejercicio', ejercicio)) as SnapshotDeclaracion[];

  if (snapshots.length === 0) {
    return null;
  }

  return snapshots.sort((a, b) => b.fechaSnapshot.localeCompare(a.fechaSnapshot))[0] ?? null;
}

async function findExistingCierreAutomatico(ejercicio: number): Promise<SnapshotDeclaracion | null> {
  const db = await initDB();
  const snapshots = (await db.getAllFromIndex(STORE_NAME, 'ejercicio', ejercicio)) as SnapshotDeclaracion[];

  const cierreAutomatico = snapshots
    .filter((snapshot) => snapshot.origen === 'cierre_automatico')
    .sort((a, b) => b.fechaSnapshot.localeCompare(a.fechaSnapshot))[0];

  return cierreAutomatico ?? null;
}

async function getArrastresForEjercicio(ejercicio: number): Promise<{ arrastresGenerados: number[]; arrastresAplicados: number[] }> {
  const db = await initDB();

  const generados = (await db.getAllFromIndex(ARRSTRES_STORE_NAME, 'ejercicioOrigen', ejercicio)) as ArrastreIRPF[];
  const allArrastres = (await db.getAll(ARRSTRES_STORE_NAME)) as ArrastreIRPF[];

  const arrastresGenerados = generados
    .map((arrastre) => arrastre.id)
    .filter((id): id is number => typeof id === 'number')
    .sort((a, b) => a - b);

  const arrastresAplicados = allArrastres
    .filter((arrastre) => arrastre.aplicaciones.some((aplicacion) => aplicacion.ejercicio === ejercicio))
    .map((arrastre) => arrastre.id)
    .filter((id): id is number => typeof id === 'number')
    .sort((a, b) => a - b);

  return {
    arrastresGenerados,
    arrastresAplicados,
  };
}

async function persistArrastresImportados(
  ejercicio: number,
  arrastres: ArrastreImportadoInput[] = []
): Promise<number[]> {
  if (arrastres.length === 0) return [];

  const db = await initDB();
  const now = new Date().toISOString();
  const createdIds: number[] = [];

  for (const arrastre of arrastres) {
    const id = await db.add(ARRSTRES_STORE_NAME, {
      ejercicioOrigen: arrastre.ejercicioOrigen,
      tipo: arrastre.tipo,
      importeOriginal: arrastre.importeOriginal ?? arrastre.importePendiente,
      importePendiente: arrastre.importePendiente,
      ejercicioCaducidad: arrastre.ejercicioCaducidad,
      inmuebleId: arrastre.inmuebleId,
      aplicaciones: [],
      estado: 'pendiente',
      createdAt: now,
      updatedAt: now,
    } as ArrastreIRPF);

    if (typeof id === 'number') {
      createdIds.push(id);
    }
  }

  return createdIds;
}

export async function crearSnapshotDeclaracion(
  ejercicio: number,
  opts: CrearSnapshotOpts = {}
): Promise<SnapshotDeclaracion> {
  const origen = opts.origen ?? 'cierre_automatico';

  if (origen === 'cierre_automatico' && opts.force !== true) {
    const existing = await findExistingCierreAutomatico(ejercicio);
    if (existing) {
      return existing;
    }
  }

  const declaracion = await calcularDeclaracionIRPF(ejercicio, { usarConciliacion: true });
  const { arrastresGenerados, arrastresAplicados } = await getArrastresForEjercicio(ejercicio);

  const datos: SnapshotDeclaracion['datos'] = {
    baseGeneral: declaracion.baseGeneral,
    baseAhorro: declaracion.baseAhorro,
    reducciones: declaracion.reducciones,
    minimosPersonales: declaracion.minimoPersonal,
    liquidacion: declaracion.liquidacion,
    arrastresGenerados,
    arrastresAplicados,
  };

  const fechaSnapshot = new Date().toISOString();
  const hash = await computeSha256({ ejercicio, fechaSnapshot, datos, origen });
  const createdAt = new Date().toISOString();

  const snapshot: SnapshotDeclaracion = {
    ejercicio,
    fechaSnapshot,
    datos,
    origen,
    hash,
    createdAt,
    casillasAEAT: opts.incluirCasillasAEAT ? buildCasillasAEAT(datos) : undefined,
  };

  const db = await initDB();
  const id = await db.add(STORE_NAME, snapshot);

  return {
    ...snapshot,
    id: typeof id === 'number' ? id : undefined,
  };
}

export async function crearSnapshotDeclaracionManual(
  ejercicio: number,
  input: ImportacionDeclaracionManualInput
): Promise<SnapshotDeclaracion> {
  const generatedIds = await persistArrastresImportados(ejercicio, input.arrastresGenerados);
  const arrastresAplicados = input.arrastresAplicadosIds ?? [];

  const datos: SnapshotDeclaracion['datos'] = {
    baseGeneral: input.datos?.baseGeneral ?? { total: 0 },
    baseAhorro: input.datos?.baseAhorro ?? { total: 0 },
    reducciones: input.datos?.reducciones ?? {},
    minimosPersonales: input.datos?.minimosPersonales ?? { total: 0 },
    liquidacion: input.datos?.liquidacion ?? {
      cuotaIntegra: 0,
      cuotaLiquida: 0,
      deduccionesDobleImposicion: 0,
    },
    arrastresGenerados: generatedIds,
    arrastresAplicados,
  };

  const fechaSnapshot = new Date().toISOString();
  const hash = await computeSha256({
    ejercicio,
    fechaSnapshot,
    datos,
    origen: 'importacion_manual',
    casillasAEAT: input.casillasAEAT,
  });

  const snapshot: SnapshotDeclaracion = {
    ejercicio,
    fechaSnapshot,
    datos,
    casillasAEAT: input.casillasAEAT,
    origen: 'importacion_manual',
    hash,
    createdAt: new Date().toISOString(),
  };

  const db = await initDB();
  const id = await db.add(STORE_NAME, snapshot);

  return {
    ...snapshot,
    id: typeof id === 'number' ? id : undefined,
  };
}

export async function obtenerSnapshotDeclaracion(ejercicio: number): Promise<SnapshotDeclaracion | null> {
  return findLatestSnapshotByEjercicio(ejercicio);
}

export async function listarSnapshotsDeclaracion(): Promise<SnapshotDeclaracion[]> {
  const db = await initDB();
  const snapshots = (await db.getAll(STORE_NAME)) as SnapshotDeclaracion[];
  return snapshots.sort((a, b) => b.fechaSnapshot.localeCompare(a.fechaSnapshot));
}

export async function verificarIntegridadSnapshot(
  idSnapshot: number
): Promise<{ ok: boolean; hashActual: string; hashGuardado?: string }> {
  const db = await initDB();
  const snapshot = (await db.get(STORE_NAME, idSnapshot)) as SnapshotDeclaracion | undefined;

  if (!snapshot) {
    throw new Error(`No existe snapshotDeclaracion con id ${idSnapshot}.`);
  }

  const hashActual = await computeSha256({
    ejercicio: snapshot.ejercicio,
    fechaSnapshot: snapshot.fechaSnapshot,
    datos: snapshot.datos,
    origen: snapshot.origen,
  });

  return {
    ok: hashActual === snapshot.hash,
    hashActual,
    hashGuardado: snapshot.hash,
  };
}
