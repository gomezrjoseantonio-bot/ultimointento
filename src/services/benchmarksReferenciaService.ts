// benchmarksReferenciaService · CRUD del store `benchmarksReferencia` (V72).
// T-INVERSIONES-DETALLE-PP-v1 · PR 2 · §4.A + §8.
//
// Reglas:
// - Migración idempotente vía flag `migration_v72_benchmarksReferencia_v1`
//   en `keyval`. Llamar `runMigration_v72()` una vez al arranque · si el
//   flag ya está · no hace nada (no sobrescribe ediciones del usuario).
// - `codigo` es índice unique · validar antes de insertar.
// - `valoresAnuales` se actualiza año a año desde la UI (no mass-replace).

import { initDB } from './db';
import type { BenchmarkReferencia, TipoBenchmark } from '../types/benchmarksReferencia';
import { SEED_BENCHMARKS_V72 } from '../data/seeds/benchmarksReferencia';

const MIGRATION_FLAG_KEY = 'migration_v72_benchmarksReferencia_v1';

// ── UUID helper ───────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ── Lectura ───────────────────────────────────────────────────────────────────

export async function listBenchmarks(): Promise<BenchmarkReferencia[]> {
  const db = await initDB();
  const rows = await db.getAll('benchmarksReferencia');
  // Orden estable · tipo · luego codigo.
  return rows.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
    return a.codigo.localeCompare(b.codigo);
  });
}

export async function getBenchmark(id: string): Promise<BenchmarkReferencia | undefined> {
  const db = await initDB();
  return db.get('benchmarksReferencia', id);
}

export async function getBenchmarkByCodigo(
  codigo: string,
): Promise<BenchmarkReferencia | undefined> {
  const db = await initDB();
  return db.getFromIndex('benchmarksReferencia', 'codigo', codigo);
}

// ── Escritura ─────────────────────────────────────────────────────────────────

export interface CreateBenchmarkInput {
  codigo: string;
  nombre: string;
  tipo: TipoBenchmark;
  divisa: string;
  descripcion?: string;
  fuenteUrl?: string;
  notaInterna?: string;
  valoresAnuales?: Record<number, number>;
}

export async function createBenchmark(
  input: CreateBenchmarkInput,
): Promise<BenchmarkReferencia> {
  if (!input.codigo?.trim()) throw new Error('codigo es obligatorio');
  if (!input.nombre?.trim()) throw new Error('nombre es obligatorio');
  if (!input.divisa?.trim()) throw new Error('divisa es obligatoria');

  // Normaliza codigo UNA vez · trim + uppercase · evita falsos negativos en
  // lookup unique cuando el usuario teclea con espacios o casing distinto.
  const codigo = input.codigo.trim().toUpperCase();

  const existente = await getBenchmarkByCodigo(codigo);
  if (existente) {
    throw new Error(`Ya existe un benchmark con codigo '${codigo}'`);
  }

  const ahora = nowISO();
  const tieneValores = !!input.valoresAnuales && Object.keys(input.valoresAnuales).length > 0;
  const bench: BenchmarkReferencia = {
    id: generateId(),
    codigo,
    nombre: input.nombre.trim(),
    tipo: input.tipo,
    divisa: input.divisa.trim().toUpperCase(),
    descripcion: input.descripcion?.trim() ?? '',
    valoresAnuales: input.valoresAnuales ?? {},
    fuenteUrl: input.fuenteUrl?.trim() || undefined,
    notaInterna: input.notaInterna?.trim() || undefined,
    ultimaActualizacion: tieneValores ? ahora.slice(0, 10) : null,
    fechaCreacion: ahora,
    fechaModificacion: ahora,
  };
  const db = await initDB();
  await db.put('benchmarksReferencia', bench);
  return bench;
}

export interface UpdateBenchmarkInput {
  nombre?: string;
  descripcion?: string;
  /** undefined = no tocar · '' = limpiar el campo (se guarda como undefined). */
  fuenteUrl?: string;
  /** undefined = no tocar · '' = limpiar el campo (se guarda como undefined). */
  notaInterna?: string;
  divisa?: string;
}

export async function updateBenchmark(
  id: string,
  patch: UpdateBenchmarkInput,
): Promise<BenchmarkReferencia> {
  const db = await initDB();
  const actual = await db.get('benchmarksReferencia', id);
  if (!actual) throw new Error(`Benchmark '${id}' no encontrado`);

  // `nombre` y `divisa` son obligatorios · si vienen vacíos en el patch
  // se ignoran (se mantiene el valor actual).
  // `fuenteUrl` y `notaInterna` son opcionales · distinguir entre "no viene
  // en patch" (no tocar) y "viene cadena vacía" (limpiar → undefined).
  const nombreNuevo = patch.nombre?.trim();
  const divisaNueva = patch.divisa?.trim();

  const merged: BenchmarkReferencia = {
    ...actual,
    nombre: nombreNuevo || actual.nombre,
    descripcion: patch.descripcion?.trim() ?? actual.descripcion,
    fuenteUrl:
      'fuenteUrl' in patch
        ? patch.fuenteUrl?.trim() || undefined
        : actual.fuenteUrl,
    notaInterna:
      'notaInterna' in patch
        ? patch.notaInterna?.trim() || undefined
        : actual.notaInterna,
    divisa: divisaNueva ? divisaNueva.toUpperCase() : actual.divisa,
    fechaModificacion: nowISO(),
  };
  await db.put('benchmarksReferencia', merged);
  return merged;
}

export async function setValorAnual(
  id: string,
  ano: number,
  valorPct: number,
): Promise<BenchmarkReferencia> {
  if (!Number.isInteger(ano) || ano < 1900 || ano > 2200) {
    throw new Error(`año fuera de rango razonable: ${ano}`);
  }
  if (!Number.isFinite(valorPct)) {
    throw new Error(`valorPct debe ser numérico finito · recibido ${valorPct}`);
  }
  const db = await initDB();
  const actual = await db.get('benchmarksReferencia', id);
  if (!actual) throw new Error(`Benchmark '${id}' no encontrado`);
  const ahora = nowISO();
  const merged: BenchmarkReferencia = {
    ...actual,
    valoresAnuales: { ...actual.valoresAnuales, [ano]: valorPct },
    ultimaActualizacion: ahora.slice(0, 10),
    fechaModificacion: ahora,
  };
  await db.put('benchmarksReferencia', merged);
  return merged;
}

export async function deleteValorAnual(
  id: string,
  ano: number,
): Promise<BenchmarkReferencia> {
  const db = await initDB();
  const actual = await db.get('benchmarksReferencia', id);
  if (!actual) throw new Error(`Benchmark '${id}' no encontrado`);
  const { [ano]: _eliminado, ...resto } = actual.valoresAnuales;
  const tieneOtros = Object.keys(resto).length > 0;
  const ahora = nowISO();
  const merged: BenchmarkReferencia = {
    ...actual,
    valoresAnuales: resto,
    ultimaActualizacion: tieneOtros ? ahora.slice(0, 10) : null,
    fechaModificacion: ahora,
  };
  await db.put('benchmarksReferencia', merged);
  return merged;
}

export async function deleteBenchmark(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('benchmarksReferencia', id);
}

// ── Migración / seed ──────────────────────────────────────────────────────────

/**
 * Ejecuta la precarga del seed V72 si el flag de migración aún no está puesto
 * en `keyval`. Idempotente · si el flag está · no hace nada · NO sobrescribe
 * ediciones del usuario.
 *
 * Llamar una vez al arranque (p.ej. desde `bootstrapStores`).
 */
export async function runMigration_v72(): Promise<{
  ejecutada: boolean;
  insertados: number;
}> {
  const db = await initDB();

  // Transacción multi-store · check flag + inserts + write flag son atómicos.
  // Garantiza idempotencia frente a tabs concurrentes: si dos arranques
  // corren a la vez · sólo uno verá `flag == null` y hará el seed; el otro
  // verá el flag puesto y devolverá `{ejecutada: false}`. Además captura
  // ConstraintError por si entre check y put alguien creó el código
  // manualmente, sin abortar la migración completa.
  const tx = db.transaction(['benchmarksReferencia', 'keyval'], 'readwrite');
  const storeBench = tx.objectStore('benchmarksReferencia');
  const storeKv = tx.objectStore('keyval');

  const flag = await storeKv.get(MIGRATION_FLAG_KEY);
  if (flag) {
    await tx.done;
    return { ejecutada: false, insertados: 0 };
  }

  let insertados = 0;
  const indexCodigo = storeBench.index('codigo');
  for (const seed of SEED_BENCHMARKS_V72) {
    try {
      const existente = await indexCodigo.get(seed.codigo);
      if (!existente) {
        await storeBench.put({ ...seed });
        insertados++;
      }
    } catch (err) {
      // ConstraintError (DOMException name) · alguien insertó el mismo
      // codigo en una tx paralela · seguimos con el resto sin abortar.
      const name = (err as { name?: string })?.name;
      if (name !== 'ConstraintError') throw err;
    }
  }

  await storeKv.put({ ejecutada: nowISO(), seedCount: insertados }, MIGRATION_FLAG_KEY);
  await tx.done;
  return { ejecutada: true, insertados };
}

/**
 * Restaura los 6 benchmarks del seed sobreescribiendo los que tengan mismo
 * código. Para usar desde la UI "Restaurar precarga". NO toca ediciones de
 * benchmarks con códigos distintos.
 */
export async function restaurarSeedV72(): Promise<number> {
  const db = await initDB();
  let escritos = 0;
  for (const seed of SEED_BENCHMARKS_V72) {
    const existente = await db.getFromIndex('benchmarksReferencia', 'codigo', seed.codigo);
    if (existente) {
      // Conserva el id existente para no romper referencias.
      await db.put('benchmarksReferencia', {
        ...seed,
        id: existente.id,
        fechaCreacion: existente.fechaCreacion,
        fechaModificacion: nowISO(),
      });
    } else {
      await db.put('benchmarksReferencia', { ...seed });
    }
    escritos++;
  }
  return escritos;
}

/**
 * True si TODOS los benchmarks de la lista dada tienen `valoresAnuales` vacío.
 * Predicado puro · sin I/O · útil cuando la UI ya tiene la lista cargada.
 */
export function vaciosEnLista(lista: ReadonlyArray<BenchmarkReferencia>): boolean {
  if (lista.length === 0) return true;
  return lista.every((b) => Object.keys(b.valoresAnuales).length === 0);
}

/**
 * True si TODOS los benchmarks del store tienen `valoresAnuales` vacío.
 * Usado por el banner de la UI "Datos pendientes · introduce manualmente".
 * Hace una lectura completa · prefiere `vaciosEnLista` si ya tienes la lista.
 */
export async function todosVacios(): Promise<boolean> {
  const lista = await listBenchmarks();
  return vaciosEnLista(lista);
}
