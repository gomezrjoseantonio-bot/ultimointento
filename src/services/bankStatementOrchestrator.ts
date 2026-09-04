// TAREA 17 sub-task 17.5 · Bank statement orchestrator.
//
// End-to-end coordinator of the import pipeline. Single entry point used by
// the new `BankStatementUploadPage` UI (sub-task 17.4) and by the inbox
// document router. Wraps four existing pieces of code:
//
//   - bankProfileMatcher.match      → detect which bank-profile applies
//   - BankParserService.parseFile   → CSV/XLS/XLSX → ParsedMovement[]
//   - movementMatchingService       → propose pairings vs. treasuryEvents
//   - movementSuggestionService     → propose actions for sin-match movements
//
// E1.5 · EL CORTE · processFile parsea, deduplica y guarda las LÍNEAS del
// extracto (`lineasExtracto`) · NO crea ningún movimiento. Después *propone*
// (emparejamiento, sugerencias, reconocimiento) sobre esas líneas con las
// puertas por línea de E1.4b. El `Movement` nace SOLO al resolver
// (`confirmarDecisiones`, la ficha, el traspaso → `materializarLinea`). Mientras
// tanto la línea sin resolver cuenta en el saldo por sí misma
// (`accountBalanceService`).
//
// cancelImportBatch deshace la sesión entera: las líneas del lote, los
// movimientos que el usuario ya hubiera creado en ella y sus fichas.
import { initDB, ImportBatch, Movement, MovementLearningRule } from './db';
import { BankParserService } from '../features/inbox/importers/bankParser';
import { bankProfileMatcher, BankFormat } from '../features/inbox/importers/bankProfileMatcher';
import {
  contradiceLaCuentaElegida,
  PROFILE_CONFIDENCE_THRESHOLD,
} from './deteccionDeBanco';
import { bankProfilesService } from './bankProfilesService';
import { matchLineas, MatchOptions } from './movementMatchingService';
import { suggestForLineas } from './movementSuggestionService';
import { reconocerDeterministasDeLineas } from './deterministas/matcheoDeterminista';
import { leerExtractoBancoPdf } from './leerExtractoBancoPdf';
import type { ParsedMovement } from '../types/bankProfiles';
import type { DescarteLineaExtracto, LineaExtractoPersistida } from './db/types-lineasExtracto';
import { lineaDesdeFila, lineasDelLote } from './lineasExtractoService';
import {
  entraAlMatcheo,
  type LoQueSeReconocePorLinea,
  type MatchResultPorLinea,
  type SugerenciaPorLinea,
} from './lineaComoMovimiento';
import { limpiarFichasDeMovimientos, type DbParaFichas, type FichasLimpiadas } from './fichasDelLote';

export interface OrchestratorOptions {
  accountId: number;
  formatHint?: 'auto' | 'csv' | 'xlsx' | 'csb43';
  bankProfileHint?: string;
  periodStart?: string;          // YYYY-MM-DD inclusive
  periodEnd?: string;             // YYYY-MM-DD inclusive
  matchOptions?: MatchOptions;
  /**
   * V6 · D1 bis · seguir adelante con un extracto ya importado.
   *
   * Por defecto `processFile` se planta si el `hashLote` del fichero ya consta
   * (`StatementAlreadyImportedError`), porque subir dos veces el mismo extracto
   * duplica movimientos y falsea todos los saldos. La UI muestra el aviso con
   * la fecha del import anterior y solo reintenta con este flag si el usuario
   * lo confirma explícitamente.
   */
  allowReimport?: boolean;
}

export interface OrchestratorResult {
  importBatchId: string;
  movementsParsed: number;
  /** E1.5 · líneas del lote que ENTRAN a la sesión (con fecha e importe, no duplicadas). */
  lineasImportadas: number;
  duplicatesSkipped: number;
  /** Por `lineaId` (E1.5) · el emparejamiento con previstos. */
  matchResult: MatchResultPorLinea;
  /** Por `lineaId` (E1.5) · lo que se propone para lo no casado. */
  suggestions: Map<number, SugerenciaPorLinea[]>;
  /**
   * FASE 2 · lo que ATLAS reconoce mirando los libros que el usuario ya le dio
   * (cuadro del préstamo, venta, pagos de inversión, nómina) y el piso que
   * probablemente paga cada gasto, según su última declaración.
   *
   * No va contra `treasuryEvents` a propósito: las previsiones solo existen del
   * mes en curso hacia delante (`treasuryBootstrapService.ts:124`) y el extracto
   * trae el pasado, así que para casi todo el fichero no hay previsión contra la
   * que casar. Ese es el motivo real de que se reconocieran dos de cien.
   */
  reconocido: LoQueSeReconocePorLinea;
  bankProfileUsed?: string;
  warnings: string[];
}


/**
 * V6 · D1 bis · el fichero ya se importó (mismo `hashLote`).
 *
 * Se lanza ANTES de parsear e insertar nada, para que la UI pueda avisar con la
 * fecha del import previo y dejar decidir. Reintentar con
 * `allowReimport: true` es la única forma de continuar.
 */
export class StatementAlreadyImportedError extends Error {
  constructor(
    readonly hashLote: string,
    readonly importadoEl: string,
    readonly filenamePrevio: string
  ) {
    super(
      `Este extracto ya se importó el ${importadoEl.slice(0, 10)} (${filenamePrevio}). ` +
        'Volver a importarlo duplicaría los movimientos.'
    );
    this.name = 'StatementAlreadyImportedError';
  }
}

/**
 * Batch previo MÁS RECIENTE con el mismo hash, o `null`.
 *
 * El más reciente y no el primero: tras un `allowReimport` hay varias filas con
 * el mismo `hashLote`, y avisar con la fecha del import más antiguo confundiría
 * ("ya se importó el 3 de marzo" cuando en realidad se reimportó ayer).
 *
 * Ignora los batches sin hash (pre-V6, todos con `hashLote: ''`), que por eso
 * nunca pueden dar un falso positivo.
 */
async function findBatchByHash(hashLote: string): Promise<ImportBatch | null> {
  if (!hashLote) return null;
  const db = await initDB();
  const batches = ((await db.getAll('importBatches')) ?? []) as ImportBatch[];
  let ultimo: ImportBatch | null = null;
  for (const b of batches) {
    if (b.hashLote !== hashLote) continue;
    if (!ultimo || b.timestampImport > ultimo.timestampImport) ultimo = b;
  }
  return ultimo;
}

export class BankProfileNotDetectedError extends Error {
  constructor() {
    super('No se pudo detectar el banco automáticamente. Elige el banco manualmente y vuelve a intentarlo.');
    this.name = 'BankProfileNotDetectedError';
  }
}

// E1.5 · Guardar vive en su propio módulo (habla en `lineaId` y crea los
// movimientos). Se re-exporta desde aquí para que quien ya importaba
// `confirmDecisions` del orquestador siga encontrándolo.
export { confirmDecisions, type ConfirmationPayload } from './confirmarDecisiones';

export async function processFile(
  file: File,
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const warnings: string[] = [];

  // V6 · D1 bis · idempotencia por fichero, ANTES de parsear o insertar nada.
  // Reutiliza `generateBatchHash` (import diferido · usa crypto.subtle), que ya
  // existía y usaba el otro camino de importación: una sola implementación.
  const { generateBatchHash } = await import('../utils/batchHashUtils');
  const hashLote = await generateBatchHash(file);
  const previo = await findBatchByHash(hashLote);
  if (previo && !options.allowReimport) {
    throw new StatementAlreadyImportedError(hashLote, previo.timestampImport, previo.filename);
  }
  if (previo) {
    warnings.push(
      `Extracto reimportado a petición del usuario · ya se había importado el ` +
        `${previo.timestampImport.slice(0, 10)}. Las líneas repetidas se descartan por hash de movimiento.`
    );
  }

  const format = resolveFormat(options.formatHint, file);

  // The user has already picked a destination account in the UI. That account
  // carries the bank identity in `iban` (Spanish bank-code) and `banco.name`,
  // so we derive a `bankProfileHint` from it BEFORE running file-content
  // detection. This is the most reliable signal because the user explicitly
  // told us which bank they're importing from. File detection becomes a
  // safety net only when the chosen account has no recognisable bank info
  // (very rare in production data — would indicate the account row is
  // malformed).
  const accountHint = options.bankProfileHint ?? (await deriveBankHintFromAccount(options.accountId));

  const profileMatch = await bankProfileMatcher.match(file, format);
  const bankProfileUsed = accountHint ?? profileMatch.profile ?? undefined;

  if (!accountHint && (!profileMatch.profile || profileMatch.confidence < PROFILE_CONFIDENCE_THRESHOLD)) {
    throw new BankProfileNotDetectedError();
  }
  if (!accountHint && profileMatch.confidence < 80) {
    warnings.push(
      `Detectado banco "${profileMatch.profile}" con baja confianza (${profileMatch.confidence}/100). Verifica que es correcto.`
    );
  }
  if (contradiceLaCuentaElegida(accountHint, profileMatch)) {
    warnings.push(
      `La cuenta destino indica "${accountHint}" pero el contenido del archivo apunta a "${profileMatch.profile}". Si es un error, descarta y vuelve a empezar con la cuenta correcta.`
    );
  }

  const parser = new BankParserService();
  const parsed = await parser.parseFile(file);
  if (!parsed.success || !parsed.movements) {
    throw new Error(parsed.error ?? 'No se pudieron parsear movimientos del archivo.');
  }
  // Lo que el parser tenga que decir del fichero (p.ej. «sin fecha de cargo»)
  // llega al drawer por el mismo canal que el resto de avisos del import.
  warnings.push(...(parsed.warnings ?? []));

  return procesarLoteParseado(file, options, parsed.movements, {
    hashLote,
    bankProfileUsed,
    warnings,
    format,
  });
}

/**
 * V6 · el extracto de una cuenta en PDF · lo lee la IA y sigue el MISMO camino
 * que un xls (insertar → emparejar → revisar en el drawer). Mantiene la
 * idempotencia por fichero (hash del PDF), así que subir dos veces el mismo PDF
 * avisa igual que un xls repetido.
 */
export async function processPdf(
  file: File,
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const warnings: string[] = [];
  const { generateBatchHash } = await import('../utils/batchHashUtils');
  const hashLote = await generateBatchHash(file);
  const previo = await findBatchByHash(hashLote);
  if (previo && !options.allowReimport) {
    throw new StatementAlreadyImportedError(hashLote, previo.timestampImport, previo.filename);
  }
  if (previo) {
    warnings.push(
      `Extracto reimportado a petición del usuario · ya se había importado el ` +
        `${previo.timestampImport.slice(0, 10)}. Las líneas repetidas se descartan por hash de movimiento.`
    );
  }

  const lineas = await leerExtractoBancoPdf(file);
  if (lineas.length === 0) {
    throw new Error('No se leyó ningún movimiento en el PDF. ¿Es un extracto de esta cuenta?');
  }
  warnings.push(`Extracto leído con IA · ${lineas.length} movimientos. Revísalos antes de guardar.`);

  return procesarLoteParseado(file, options, lineas, {
    hashLote,
    bankProfileUsed: 'IA (PDF)',
    warnings,
    format: 'csv',
  });
}

/**
 * Cola común del import · desde los movimientos ya parseados (por SheetJS o por
 * la IA): filtra por periodo, persiste el lote, inserta, empareja y propone. NO
 * toca `treasuryEvents` ni reglas: eso lo hace `confirmDecisions` al Guardar.
 */
async function procesarLoteParseado(
  file: File,
  options: OrchestratorOptions,
  parsedMovements: ParsedMovement[],
  ctx: { hashLote: string; bankProfileUsed?: string; warnings: string[]; format: BankFormat }
): Promise<OrchestratorResult> {
  const filteredMovements = filterByPeriod(parsedMovements, options.periodStart, options.periodEnd);
  const movementsParsed = filteredMovements.length;

  const importBatchId = await persistImportBatch(
    file,
    options,
    movementsParsed,
    ctx.format,
    ctx.bankProfileUsed,
    ctx.hashLote
  );
  const insertResult = await insertLineas(filteredMovements, options.accountId, importBatchId);

  // E1.5 · el análisis va por LÍNEA (puertas de E1.4b) · no hay movimientos.
  const propuesta = await analizarLineas(insertResult.lineas, options.matchOptions);

  await updateImportBatchSummary(importBatchId, movementsParsed, insertResult.inserted, insertResult.duplicates);

  return {
    importBatchId,
    movementsParsed,
    lineasImportadas: insertResult.inserted,
    duplicatesSkipped: insertResult.duplicates,
    ...propuesta,
    bankProfileUsed: ctx.bankProfileUsed,
    warnings: ctx.warnings,
  };
}

/**
 * E1.5 · emparejar, proponer y reconocer sobre LÍNEAS · lo comparten el import
 * (`procesarLoteParseado`) y retomar un lote (`reabrirLote`). Lecturas puras.
 *
 * Lo determinista se mira sobre las líneas que NO casaron con una previsión:
 * lo que ya cuadró no necesita que se le busque un origen, y buscárselo solo
 * podría contradecir lo que el emparejador ya resolvió.
 */
export async function analizarLineas(
  lineas: LineaExtractoPersistida[],
  matchOptions?: MatchOptions
): Promise<Pick<OrchestratorResult, 'matchResult' | 'suggestions' | 'reconocido'>> {
  const entran = lineas.filter(entraAlMatcheo);
  const matchResult = await matchLineas(entran, matchOptions);
  const sinMatch = new Set(matchResult.sinMatch);
  const sinCasar = entran.filter((l) => sinMatch.has(l.id as number));
  const suggestions = await suggestForLineas(sinCasar);
  const reconocido = await (async (): Promise<LoQueSeReconocePorLinea> => {
    try {
      return await reconocerDeterministasDeLineas(sinCasar);
    } catch (err) {
      console.warn('[orchestrator] no se pudo reconocer contra los libros del usuario', err);
      return { origenes: new Map(), atribuciones: new Map() };
    }
  })();
  return { matchResult, suggestions, reconocido };
}

// Reads the destination account from IndexedDB and infers its bank-profile key
// from `iban` (Spanish bank-code lookup), then `banco.name`, then `banco.code`.
// Returns null when no signal is found — callers fall back to file-content
// detection.
async function deriveBankHintFromAccount(accountId: number): Promise<string | null> {
  try {
    const db = await initDB();
    const account = (await db.get('accounts', accountId)) as
      | { iban?: string; banco?: { name?: string; code?: string } }
      | undefined;
    if (!account) return null;

    if (account.iban) {
      const ibanClean = account.iban.replace(/\s+/g, '');
      const fromIban = bankProfilesService.getBankInfoFromIBAN(ibanClean);
      if (fromIban?.bankKey) return fromIban.bankKey;
    }

    // Fall back to banco.name. Loaded profiles are matched case-insensitively
    // by partial inclusion (e.g. "Banco de Sabadell" → profile "Sabadell").
    await bankProfilesService.loadProfiles();
    const profiles = bankProfilesService.getProfiles();
    const bancoName = account.banco?.name?.toLowerCase().trim();
    if (bancoName) {
      const match = profiles.find(p => bancoName.includes(p.bankKey.toLowerCase()));
      if (match) return match.bankKey;
    }

    // Final fallback: a 4-digit Spanish entity code stored in `banco.code`.
    // Uses the dedicated helper rather than synthesising a fake IBAN, so this
    // path stays correct even if IBAN parsing semantics change later.
    const fromCode = bankProfilesService.getBankKeyFromSpanishEntityCode(account.banco?.code);
    if (fromCode) return fromCode;

    return null;
  } catch {
    return null;
  }
}

export async function cancelImportBatch(
  importBatchId: string
): Promise<{ removed: number; fichas: FichasLimpiadas }> {
  const db = await initDB();
  const allMovements = ((await db.getAll('movements')) ?? []) as Movement[];
  const toRemove = allMovements.filter(m => m.importBatch === importBatchId && m.id != null);

  // E1.5-previo · las fichas de gasto/mejora que el usuario creó desde la
  // sesión apuntan a estos movimientos: se limpian ANTES de borrarlos, que es
  // cuando aún se pueden encontrar. Sin esto quedaba una fila fiscal apuntando
  // a un movimiento inexistente.
  let fichas: FichasLimpiadas = { gastosBorrados: 0, gastosDesenlazados: 0, mejorasBorradas: 0 };
  try {
    fichas = await limpiarFichasDeMovimientos(
      db as unknown as DbParaFichas,
      toRemove.map(m => m.id as number)
    );
  } catch (err) {
    console.warn('[orchestrator] cancelImportBatch: no se pudieron limpiar las fichas del lote', err);
  }

  for (const movement of toRemove) {
    await db.delete('movements', movement.id!);
  }
  // E1.3 · las líneas del lote se van con él: si se quedaran, el lote seguiría
  // pareciendo «a medias» y sus decisiones sobrevivirían a un descarte.
  try {
    for (const linea of await lineasDelLote(db, importBatchId)) {
      if (linea.id != null) await db.delete('lineasExtracto', linea.id);
    }
  } catch (err) {
    console.warn('[orchestrator] cancelImportBatch: no se pudieron borrar las líneas del lote', err);
  }
  try {
    await db.delete('importBatches', importBatchId);
  } catch (err) {
    // Non-fatal: the batch row may not exist if the import failed mid-flight.
    console.warn('[orchestrator] cancelImportBatch: importBatches row not found', err);
  }

  return { removed: toRemove.length, fichas };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveFormat(hint: OrchestratorOptions['formatHint'], file: File): BankFormat {
  if (hint && hint !== 'auto') return hint;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) return 'csv';
  if (lowerName.endsWith('.xlsx')) return 'xlsx';
  if (lowerName.endsWith('.xls')) return 'xls';
  return 'xlsx';
}

function filterByPeriod(
  movements: ParsedMovement[],
  periodStart?: string,
  periodEnd?: string
): ParsedMovement[] {
  if (!periodStart && !periodEnd) return movements;
  return movements.filter(m => {
    const iso = isoDate(m.date);
    if (!iso) return true;
    if (periodStart && iso < periodStart) return false;
    if (periodEnd && iso > periodEnd) return false;
    return true;
  });
}

/**
 * El DÍA de calendario, no el instante.
 *
 * Antes hacía `.toISOString()`, que pasa a UTC. Como `parseSpanishDate`
 * construye `new Date(año, mes-1, día)` —medianoche LOCAL—, en España (UTC+1/+2)
 * esa conversión devolvía siempre el día anterior: el 2 de febrero a las 00:00
 * de Madrid es el 1 de febrero a las 23:00 en UTC. Toda fecha de cargo del
 * extracto entraba en la base corrida un día.
 *
 * Se lee con los mismos componentes con los que se escribió.
 */
export function isoDate(value: Date | string | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return diaLocal(value);
  }
  // Una cadena que YA es un día ISO se respeta tal cual: reparsearla la haría
  // pasar por UTC y volvería a correrla.
  const yaEsDia = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (yaEsDia) return yaEsDia[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return diaLocal(parsed);
}

/** El día que marca el reloj de quien mira · sin pasar por UTC. */
function diaLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function persistImportBatch(
  file: File,
  options: OrchestratorOptions,
  parsedRows: number,
  format: BankFormat,
  bankProfile?: string,
  hashLote = ''
): Promise<string> {
  const db = await initDB();
  const id = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const batch: ImportBatch = {
    id,
    filename: file.name,
    accountId: options.accountId,
    totalRows: parsedRows,
    importedRows: 0,
    skippedRows: 0,
    duplicatedRows: 0,
    errorRows: 0,
    origenBanco: bankProfile ?? 'unknown',
    formatoDetectado: normaliseFormatoForStore(format),
    rangoFechas: { min: options.periodStart ?? '', max: options.periodEnd ?? '' },
    timestampImport: new Date().toISOString(),
    hashLote, // V6 · D1 bis: SHA-256 del contenido · idempotencia por fichero
    createdAt: new Date().toISOString(),
  };
  await db.put('importBatches', batch);
  return id;
}

function normaliseFormatoForStore(format: BankFormat): ImportBatch['formatoDetectado'] {
  // ImportBatch.formatoDetectado is typed as 'CSV' | 'XLS' | 'XLSX'. We store
  // CSB43 as 'CSV' for the audit row and keep the granular format in the
  // origenBanco/warnings channel.
  if (format === 'csv' || format === 'csb43') return 'CSV';
  if (format === 'xls') return 'XLS';
  return 'XLSX';
}

async function updateImportBatchSummary(
  importBatchId: string,
  parsed: number,
  inserted: number,
  duplicates: number
): Promise<void> {
  const db = await initDB();
  const existing = (await db.get('importBatches', importBatchId)) as ImportBatch | undefined;
  if (!existing) return;
  await db.put('importBatches', {
    ...existing,
    totalRows: parsed,
    importedRows: inserted,
    duplicatedRows: duplicates,
    skippedRows: parsed - inserted - duplicates,
  });
}

interface InsertResult {
  /** Las líneas del lote, ya persistidas (con su `id`). */
  lineas: LineaExtractoPersistida[];
  /** Las que ENTRAN a la sesión · con fecha e importe, no duplicadas. */
  inserted: number;
  duplicates: number;
}

/**
 * E1.5 · guarda las LÍNEAS del extracto · NO crea ningún movimiento.
 *
 * Cada fila del parser deja su rastro en `lineasExtracto`: con `descarte`
 * (`sin_fecha`, `sin_importe`, `duplicada`) si no puede entrar a la sesión, y
 * PENDIENTE si entra. El movimiento nace al resolverla (`materializarLinea`).
 *
 * DEDUPE · mina M4 · la huella (`hashMovement`) se compara contra los
 * movimientos que ya existen Y contra las líneas ya guardadas: tras el corte
 * una línea sin resolver no tiene movimiento, y sin mirar las líneas un
 * extracto SOLAPADO la volvería a traer y, al resolver, nacerían dos cargos
 * del mismo dinero. Se deduplica SOLO contra lotes anteriores, no contra las
 * otras filas de ESTE fichero: dos cargos idénticos el mismo día (la comunidad
 * de dos pisos) son dos operaciones reales y entran las dos.
 */
async function insertLineas(
  parsed: ParsedMovement[],
  accountId: number,
  importBatchId: string
): Promise<InsertResult> {
  const db = await initDB();
  const now = new Date().toISOString();
  const existingHashes = await huellasExistentes(db);

  const lineas: LineaExtractoPersistida[] = [];
  let inserted = 0;
  let duplicates = 0;

  for (const row of parsed) {
    const date = isoDate(row.date);
    const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
    const description = row.description ?? '';
    const importeSeguro = Number.isFinite(amount) ? amount : 0;
    const huella = hashMovement({ accountId, date: date ?? '', amount: importeSeguro, description } as Movement);

    const persistir = async (d: { descarte?: DescarteLineaExtracto }) => {
      const linea = lineaDesdeFila(row, {
        accountId,
        importBatchId,
        fechaOperacion: date ?? '',
        fechaValor: isoDate(row.valueDate) ?? date ?? '',
        importe: importeSeguro,
        hashMovement: huella,
        ahora: now,
        movementIds: [],
        ...d,
      });
      const id = Number(await db.add('lineasExtracto', linea));
      lineas.push({ ...linea, id });
    };

    if (!date) {
      await persistir({ descarte: 'sin_fecha' });
      continue;
    }
    if (!Number.isFinite(amount)) {
      await persistir({ descarte: 'sin_importe' });
      continue;
    }
    if (existingHashes.has(huella)) {
      duplicates++;
      await persistir({ descarte: 'duplicada' });
      continue;
    }
    // La huella de la nueva NO se añade al set: ver DEDUPE arriba.
    await persistir({});
    inserted++;
  }

  return { lineas, inserted, duplicates };
}

/** Las huellas de todo lo que ya se importó · movimientos Y líneas (M4). */
async function huellasExistentes(db: Awaited<ReturnType<typeof initDB>>): Promise<Set<string>> {
  const existing = ((await db.getAll('movements')) ?? []) as Movement[];
  const huellas = new Set(existing.map(hashMovement));
  try {
    const lineas = ((await db.getAll('lineasExtracto')) ?? []) as LineaExtractoPersistida[];
    for (const l of lineas) if (l.hashMovement) huellas.add(l.hashMovement);
  } catch {
    // Base anterior a V91 · sin líneas que mirar.
  }
  return huellas;
}

/**
 * La huella con la que se detecta un duplicado entre importaciones.
 *
 * Se exporta para poder PROBAR lo que no se ve: que `reference` no entra aquí.
 * Al llevar el identificador del banco al movimiento (FASE 2.0.1), lo único que
 * no podía pasar era que esa huella cambiara — un extracto solapado dejaría de
 * reconocer sus propias líneas y duplicaría los cargos.
 */
export function hashMovement(m: Movement): string {
  // Same dedup signature used by bankStatementImportService since 2025: the
  // tuple {accountId | date | amount-cents | description}. Idempotent across
  // re-imports of the exact same statement.
  const cents = Math.round(m.amount * 100);
  return `${m.accountId}|${m.date}|${cents}|${(m.description ?? '').trim()}`;
}


// Re-export the matching/suggestion types so consumers don't need three imports.
export type { MatchResult } from './movementMatchingService';
export type { MovementSuggestion } from './movementSuggestionService';
export type { MatchResultPorLinea, SugerenciaPorLinea, LoQueSeReconocePorLinea } from './lineaComoMovimiento';
// Acknowledge the imported MovementLearningRule type so editors don't flag it
// as unused — `feedLearningRule` returns the shape implicitly via createOrUpdateRule.
export type { MovementLearningRule };
