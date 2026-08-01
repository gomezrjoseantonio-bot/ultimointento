// ============================================================================
// Líneas de extracto ignoradas (Tesorería V6 · D1)
// ============================================================================
//
// Por D4, una línea del extracto que el usuario deja sin resolver **no se
// materializa**: no hay `Movement` que la represente. Por eso el "ignorado" no
// puede vivir en el movimiento —no existe— y vive donde vive el fichero:
// `ImportBatch.lineasIgnoradas[]`.
//
// Al reimportar un extracto, las líneas cuyo `hashLinea` ya conste como
// ignorada no vuelven a aparecer como "a resolver": se muestran plegadas como
// "N ignoradas", con recuperar por línea.
//
// El ámbito de consulta es la CUENTA, no el batch: al reimportar se crea un
// batch nuevo, así que para saber qué ignoró el usuario hay que mirar todos los
// batches de esa cuenta.
// ============================================================================

import { initDB, ImportBatch } from './db';
import { generateLineHash, isCurrentLineHashVersion, type StatementLineIdentity } from '../utils/batchHashUtils';

export type { StatementLineIdentity };
export { generateLineHash };

/** Entrada tal y como se persiste en `ImportBatch.lineasIgnoradas`. */
export interface LineaIgnorada {
  hashLinea: string;
  ignoradaAt: string;
}

/**
 * Batches de una cuenta, por el índice `importBatches.accountId` (db.ts:104).
 *
 * El índice ya existe, así que usarlo no cuesta esquema. El `getAll` + filtro
 * queda de respaldo para entornos donde el handle de DB no expone
 * `getAllFromIndex` (mocks de test, backups parciales), en vez de reventar.
 */
async function batchesDeCuenta(accountId: number): Promise<ImportBatch[]> {
  const db = await initDB();
  const porIndice = (db as { getAllFromIndex?: unknown }).getAllFromIndex;
  if (typeof porIndice === 'function') {
    return ((await db.getAllFromIndex('importBatches', 'accountId', accountId)) ?? []) as ImportBatch[];
  }
  const todos = ((await db.getAll('importBatches')) ?? []) as ImportBatch[];
  return todos.filter((b) => b.accountId === accountId);
}

/**
 * Hashes ignorados en una cuenta, de cualquier importación previa.
 *
 * Descarta los hashes de una versión antigua del algoritmo: si el normalizador
 * cambiase, un hash `v0:` ya no identifica lo mismo y tratarlo como válido
 * escondería líneas que no son las que el usuario ignoró. Reaparecer es el
 * fallo seguro; esconder de más, no.
 */
export async function getIgnoredLineHashes(accountId: number): Promise<Set<string>> {
  const out = new Set<string>();
  for (const batch of await batchesDeCuenta(accountId)) {
    for (const l of batch.lineasIgnoradas ?? []) {
      if (isCurrentLineHashVersion(l.hashLinea)) out.add(l.hashLinea);
    }
  }
  return out;
}

/** Hashes ignorados cuya versión de algoritmo ya no es la vigente. */
export async function getStaleIgnoredLineHashes(accountId: number): Promise<LineaIgnorada[]> {
  const out: LineaIgnorada[] = [];
  for (const batch of await batchesDeCuenta(accountId)) {
    for (const l of batch.lineasIgnoradas ?? []) {
      if (!isCurrentLineHashVersion(l.hashLinea)) out.push(l);
    }
  }
  return out;
}

/**
 * Marca una línea como ignorada en el batch de la sesión en curso.
 *
 * Idempotente: ignorar dos veces la misma línea no duplica la entrada ni
 * reescribe su `ignoradaAt` (la marca es de cuándo se ignoró la primera vez).
 */
export async function ignoreLine(
  importBatchId: string,
  line: StatementLineIdentity,
  now: string = new Date().toISOString()
): Promise<string> {
  const hashLinea = generateLineHash(line);
  const db = await initDB();
  const batch = (await db.get('importBatches', importBatchId)) as ImportBatch | undefined;
  if (!batch) throw new Error(`ImportBatch no encontrado: ${importBatchId}`);

  const actuales = batch.lineasIgnoradas ?? [];
  if (actuales.some((l) => l.hashLinea === hashLinea)) return hashLinea;

  await db.put('importBatches', {
    ...batch,
    lineasIgnoradas: [...actuales, { hashLinea, ignoradaAt: now }],
  });
  return hashLinea;
}

/**
 * Recupera una línea ignorada · vuelve a "a resolver".
 *
 * Busca en todos los batches de la cuenta, no solo en el de la sesión: la línea
 * pudo ignorarse en una importación anterior y es ahí donde está la entrada.
 * Devuelve cuántas entradas se borraron (0 si no había ninguna).
 */
export async function recoverLine(accountId: number, hashLinea: string): Promise<number> {
  const db = await initDB();
  let borradas = 0;
  for (const batch of await batchesDeCuenta(accountId)) {
    const actuales = batch.lineasIgnoradas ?? [];
    const quedan = actuales.filter((l) => l.hashLinea !== hashLinea);
    if (quedan.length === actuales.length) continue;
    borradas += actuales.length - quedan.length;
    await db.put('importBatches', { ...batch, lineasIgnoradas: quedan });
  }
  return borradas;
}

/** Reparte las líneas de una sesión entre las que hay que resolver y las ya ignoradas. */
export function splitIgnoradas<T extends StatementLineIdentity>(
  lines: T[],
  ignoredHashes: Set<string>
): { aResolver: T[]; ignoradas: Array<{ line: T; hashLinea: string }> } {
  const aResolver: T[] = [];
  const ignoradas: Array<{ line: T; hashLinea: string }> = [];
  for (const line of lines) {
    const hashLinea = generateLineHash(line);
    if (ignoredHashes.has(hashLinea)) ignoradas.push({ line, hashLinea });
    else aResolver.push(line);
  }
  return { aResolver, ignoradas };
}
