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
// processFile is read-mostly: it parses, deduplicates, bulk-inserts the new
// movements as `unifiedStatus='no_planificado'`, and then *proposes* matches
// and suggestions. It does NOT touch treasuryEvents nor learning rules. The
// user reviews the proposal in the UI, ticks/unticks rows, and confirms via
// confirmDecisions, which is the single point that mutates everything else
// atomically (event status, movement status, learning rules).
//
// cancelImportBatch lets the user undo a whole import in one click (e.g. wrong
// file picked) — removes the inserted movements and the batch row.
import { initDB, ImportBatch, Movement, MovementLearningRule, TreasuryEvent } from './db';
import { contraparteDeBizum, pareceBizum } from './bizum';
import { BankParserService } from '../features/inbox/importers/bankParser';
import { bankProfileMatcher, BankFormat } from '../features/inbox/importers/bankProfileMatcher';
import { bankProfilesService } from './bankProfilesService';
import { matchBatch, MatchOptions, MatchResult } from './movementMatchingService';
import { suggestForUnmatched, MovementSuggestion, SuggestionAction } from './movementSuggestionService';
import { buildLearnKey, createOrUpdateRule } from './movementLearningService';
import { aplicarReconciliacionConfirmado } from './reconciliarConfirmado';
import { leerExtractoBancoPdf } from './leerExtractoBancoPdf';
import type { ParsedMovement } from '../types/bankProfiles';

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
  movementsInserted: number;
  duplicatesSkipped: number;
  matchResult: MatchResult;
  suggestions: Map<number, MovementSuggestion[]>;
  bankProfileUsed?: string;
  warnings: string[];
}

export interface ConfirmationPayload {
  approvedMatches: { movementId: number; treasuryEventId: number }[];
  approvedSuggestions: { movementId: number; suggestionIndex: number }[];
  ignoredMovementIds: number[];
  /**
   * Líneas del extracto que son un movimiento que YA tenías anotado
   * (Confirmado). Al aplicarlas, ese confirmado sube a Conciliado con la
   * clasificación que le pusiste, y la línea duplicada del import se borra.
   */
  reconciliacionesConfirmado?: { importMovementId: number; confirmadoMovementId: number }[];
}

const PROFILE_CONFIDENCE_THRESHOLD = 60;

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
  if (accountHint && profileMatch.profile && profileMatch.profile.toLowerCase() !== accountHint.toLowerCase()) {
    warnings.push(
      `La cuenta destino indica "${accountHint}" pero el contenido del archivo apunta a "${profileMatch.profile}". Si es un error, descarta y vuelve a empezar con la cuenta correcta.`
    );
  }

  const parser = new BankParserService();
  const parsed = await parser.parseFile(file);
  if (!parsed.success || !parsed.movements) {
    throw new Error(parsed.error ?? 'No se pudieron parsear movimientos del archivo.');
  }

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
  const insertResult = await insertMovements(filteredMovements, options.accountId, importBatchId);

  const matchResult = await matchBatch(insertResult.insertedIds, options.matchOptions);
  const suggestions = await suggestForUnmatched(matchResult.sinMatch);

  await updateImportBatchSummary(importBatchId, movementsParsed, insertResult.inserted, insertResult.duplicates);

  return {
    importBatchId,
    movementsParsed,
    movementsInserted: insertResult.inserted,
    duplicatesSkipped: insertResult.duplicates,
    matchResult,
    suggestions,
    bankProfileUsed: ctx.bankProfileUsed,
    warnings: ctx.warnings,
  };
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

export async function confirmDecisions(
  importBatchId: string,
  payload: ConfirmationPayload
): Promise<void> {
  const db = await initDB();
  const now = new Date().toISOString();

  // Resolve every suggestion up front so we can fail fast before mutating state.
  const movementIdsTouched = new Set<number>();
  const suggestionsByMovement = new Map<number, MovementSuggestion>();
  for (const approval of payload.approvedSuggestions) {
    const movement = (await db.get('movements', approval.movementId)) as Movement | undefined;
    if (!movement) {
      throw new Error(`Movimiento ${approval.movementId} no encontrado al confirmar sugerencia`);
    }
    const suggestionMap = await suggestForUnmatched([approval.movementId]);
    const suggestions = suggestionMap.get(approval.movementId) ?? [];
    const suggestion = suggestions[approval.suggestionIndex];
    if (!suggestion) {
      throw new Error(
        `Sugerencia índice ${approval.suggestionIndex} no encontrada para movimiento ${approval.movementId}`
      );
    }
    suggestionsByMovement.set(approval.movementId, suggestion);
  }

  // Apply matches: link existing movement to existing predicted event.
  for (const { movementId, treasuryEventId } of payload.approvedMatches) {
    const movement = (await db.get('movements', movementId)) as Movement | undefined;
    const event = (await db.get('treasuryEvents', treasuryEventId)) as TreasuryEvent | undefined;
    if (!movement || !event) continue;
    if (event.status === 'executed') continue; // already matched in another flow

    await db.put('treasuryEvents', {
      ...event,
      status: 'executed',
      executedMovementId: movementId,
      executedAt: now,
      actualDate: movement.date,
      actualAmount: movement.amount,
    });
    // La línea del banco HEREDA la clasificación de la previsión con la que
    // cuadra: categoría, familia, ámbito e inmueble. Tú los definiste en el
    // previsto; la conciliación no debe perderlos y quedarse solo con el texto
    // en crudo del banco (que sí se conserva como descripción, para cotejar y
    // para cruzar con la factura). Sin esto, cuadrar un gasto lo dejaba sin
    // familia y no había forma de cruzarlo luego.
    await db.put('movements', {
      ...movement,
      ...(event.categoryKey != null ? { categoryKey: event.categoryKey } : {}),
      ...(event.subtypeKey != null ? { subtypeKey: event.subtypeKey } : {}),
      // F2b · el concepto fino de la previsión también se hereda al cuadrar.
      ...(event.conceptoId != null ? { conceptoId: event.conceptoId } : {}),
      ...(event.ambito != null ? { ambito: event.ambito } : {}),
      ...(event.inmuebleId != null ? { inmuebleId: String(event.inmuebleId) } : {}),
      unifiedStatus: 'conciliado',
      statusConciliacion: 'match_manual',
      updatedAt: now,
    });
    movementIdsTouched.add(movementId);

    // Feed learning so subsequent imports auto-classify by learnKey.
    //
    // Aquí el usuario no sólo dice de qué categoría es: dice de QUIÉN es. Al
    // confirmar esta línea contra esta previsión está enseñando que el nombre
    // que manda el banco y el que hay en el contrato son la misma persona, y
    // eso es lo que viaja en `contraparteConfirmada`.
    await feedLearningRule(
      movement,
      deriveCategoryFromEvent(event),
      event.counterparty ?? event.providerName
    );
  }

  // Reconciliar contra un Confirmado que ya tenías · "las dos cosas".
  // Una sola implementación del colapso, compartida con la limpieza de
  // duplicados ya creados (`reconciliarConfirmado`).
  for (const { importMovementId, confirmadoMovementId } of payload.reconciliacionesConfirmado ?? []) {
    const importMov = (await db.get('movements', importMovementId)) as Movement | undefined;
    if (!importMov) continue;
    await aplicarReconciliacionConfirmado(db, importMov, confirmadoMovementId, now);
    movementIdsTouched.add(importMovementId);
  }

  // Apply approved suggestions.
  for (const [movementId, suggestion] of suggestionsByMovement) {
    const movement = (await db.get('movements', movementId)) as Movement | undefined;
    if (!movement) continue;
    await applySuggestion(movement, suggestion, now);
    movementIdsTouched.add(movementId);
  }

  // Mark ignored movements as reviewed-but-not-conciliated.
  for (const movementId of payload.ignoredMovementIds) {
    if (movementIdsTouched.has(movementId)) continue;
    const movement = (await db.get('movements', movementId)) as Movement | undefined;
    if (!movement) continue;
    await db.put('movements', {
      ...movement,
      unifiedStatus: 'no_planificado',
      statusConciliacion: 'sin_match',
      updatedAt: now,
    });
  }
}

export async function cancelImportBatch(importBatchId: string): Promise<{ removed: number }> {
  const db = await initDB();
  const allMovements = ((await db.getAll('movements')) ?? []) as Movement[];
  const toRemove = allMovements.filter(m => m.importBatch === importBatchId && m.id != null);

  for (const movement of toRemove) {
    await db.delete('movements', movement.id!);
  }
  try {
    await db.delete('importBatches', importBatchId);
  } catch (err) {
    // Non-fatal: the batch row may not exist if the import failed mid-flight.
    console.warn('[orchestrator] cancelImportBatch: importBatches row not found', err);
  }

  return { removed: toRemove.length };
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

function isoDate(value: Date | string | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
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
  insertedIds: number[];
  inserted: number;
  duplicates: number;
}

async function insertMovements(
  parsed: ParsedMovement[],
  accountId: number,
  importBatchId: string
): Promise<InsertResult> {
  const db = await initDB();
  const now = new Date().toISOString();
  const existing = ((await db.getAll('movements')) ?? []) as Movement[];
  const existingHashes = new Set(existing.map(hashMovement));

  const insertedIds: number[] = [];
  let duplicates = 0;

  for (const row of parsed) {
    const date = isoDate(row.date);
    if (!date) continue;
    const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    const description = row.description ?? '';

    const candidate: Movement = {
      accountId,
      date,
      valueDate: isoDate(row.valueDate) ?? date,
      amount,
      description,
      // §Bizum · quién está al otro lado.
      //
      // El banco lo trae en el texto ("BIZUM DE ADNAN PARWEZ") y sin leerlo la
      // línea cae en el saco de "transferencia recibida" sin dueño — que es
      // justo el dato que la convierte en la renta de una habitación. Solo se
      // rellena si el fichero no traía contraparte: lo que venga en su columna
      // manda sobre lo que se deduzca del texto.
      counterparty: row.counterparty ?? contraparteDeBizum(description),
      ...(pareceBizum(description) ? { paymentMethod: 'Bizum' as const } : {}),
      reference: row.reference,
      balance: row.balance,
      currency: row.currency,
      unifiedStatus: 'no_planificado',
      source: 'import',
      type: amount >= 0 ? 'Ingreso' : 'Gasto',
      origin: 'CSV',
      movementState: 'Confirmado',
      state: 'pending',
      status: 'pendiente',
      category: { tipo: amount >= 0 ? 'Ingresos' : 'Gastos' },
      tags: [],
      isAutoTagged: false,
      ambito: 'PERSONAL',
      statusConciliacion: 'sin_match',
      importBatch: importBatchId,
      createdAt: now,
      updatedAt: now,
    };

    // Se deduplica SOLO contra movimientos que YA existían (de otros lotes), no
    // contra las otras líneas de ESTE extracto. Un banco lista dos cargos
    // idénticos —misma fecha, mismo importe, mismo concepto— cuando de verdad
    // hubo dos (p.ej. la comunidad de dos pisos: Nº mov 839 y 840): son dos
    // movimientos reales y deben entrar los dos. Reimportar el MISMO fichero ya
    // lo frena el hash del lote (D1 bis); un fichero solapado sí casa contra lo
    // previo. Por eso el hash del nuevo NO se añade al set.
    if (existingHashes.has(hashMovement(candidate))) {
      duplicates++;
      continue;
    }

    const id = (await db.add('movements', candidate)) as number;
    insertedIds.push(id);
  }

  return { insertedIds, inserted: insertedIds.length, duplicates };
}

function hashMovement(m: Movement): string {
  // Same dedup signature used by bankStatementImportService since 2025: the
  // tuple {accountId | date | amount-cents | description}. Idempotent across
  // re-imports of the exact same statement.
  const cents = Math.round(m.amount * 100);
  return `${m.accountId}|${m.date}|${cents}|${(m.description ?? '').trim()}`;
}

async function applySuggestion(movement: Movement, suggestion: MovementSuggestion, now: string): Promise<void> {
  const db = await initDB();

  switch (suggestion.action.kind) {
    case 'create_treasury_event':
    case 'assign_to_contract':
    case 'mark_personal_expense': {
      const event = buildTreasuryEventFromAction(movement, suggestion.action, now);
      const eventId = (await db.add('treasuryEvents', event)) as number;
      await db.put('treasuryEvents', { ...event, id: eventId, executedMovementId: movement.id });
      await db.put('movements', {
        ...movement,
        unifiedStatus: 'conciliado',
        statusConciliacion: 'match_manual',
        updatedAt: now,
      });
      await feedLearningRule(movement, deriveCategoryFromAction(suggestion.action));
      return;
    }
    case 'ignore':
      await db.put('movements', {
        ...movement,
        unifiedStatus: 'no_planificado',
        statusConciliacion: 'sin_match',
        updatedAt: now,
      });
      return;
  }
}

function buildTreasuryEventFromAction(
  movement: Movement,
  action: SuggestionAction,
  now: string
): TreasuryEvent {
  const base = {
    amount: Math.abs(movement.amount),
    predictedDate: movement.date,
    description: movement.description,
    accountId: movement.accountId,
    status: 'executed' as const,
    actualDate: movement.date,
    actualAmount: movement.amount,
    executedMovementId: movement.id,
    executedAt: now,
    generadoPor: 'user' as const,
    createdAt: now,
    updatedAt: now,
  };

  switch (action.kind) {
    case 'create_treasury_event':
      return {
        ...base,
        type: action.type,
        sourceType: action.sourceType,
        sourceId: typeof action.sourceId === 'number' ? action.sourceId : undefined,
        ambito: action.ambito,
        inmuebleId: action.inmuebleId,
        categoryKey: action.categoryKey,
      };
    case 'assign_to_contract':
      return {
        ...base,
        type: movement.amount >= 0 ? 'income' : 'expense',
        sourceType: 'contract',
        sourceId: action.contractId,
        ambito: 'INMUEBLE',
      };
    case 'mark_personal_expense':
      return {
        ...base,
        type: movement.amount >= 0 ? 'income' : 'expense',
        sourceType: 'personal_expense',
        ambito: 'PERSONAL',
        categoryKey: action.categoryKey,
      };
    case 'ignore':
      // Defensive: applySuggestion handles `ignore` directly without calling
      // this builder. Throw so a future caller doesn't silently misuse it.
      throw new Error('buildTreasuryEventFromAction: ignore action has no event representation');
  }
}

interface DerivedCategory {
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
}

function deriveCategoryFromEvent(event: TreasuryEvent): DerivedCategory | null {
  const categoria = event.categoryKey ?? event.categoryLabel;
  if (!categoria) return null;
  return {
    categoria,
    ambito: event.ambito ?? 'PERSONAL',
    inmuebleId: event.inmuebleId != null ? String(event.inmuebleId) : undefined,
  };
}

function deriveCategoryFromAction(action: SuggestionAction): DerivedCategory | null {
  switch (action.kind) {
    case 'create_treasury_event':
      if (!action.categoryKey) return null;
      return {
        categoria: action.categoryKey,
        ambito: action.ambito,
        inmuebleId: action.inmuebleId != null ? String(action.inmuebleId) : undefined,
      };
    case 'mark_personal_expense':
      return { categoria: action.categoryKey, ambito: 'PERSONAL' };
    case 'assign_to_contract':
      return null; // contract-bound learning is too instance-specific to generalise
    case 'ignore':
      return null;
  }
}

async function feedLearningRule(
  movement: Movement,
  derived: DerivedCategory | null,
  contraparteConfirmada?: string
): Promise<void> {
  if (!derived) return;
  try {
    const learnKey = buildLearnKey(movement);
    // T16-fix-functional · pasar el movimiento permite a createOrUpdateRule
    // rellenar counterpartyPattern/descriptionPattern/amountSign y propagar
    // movimientoId al history[] (B2 + B8 del audit T16).
    await createOrUpdateRule({
      learnKey,
      categoria: derived.categoria,
      ambito: derived.ambito,
      inmuebleId: derived.inmuebleId,
      movement,
      contraparteConfirmada,
    });
  } catch (err) {
    // Learning is opportunistic — do not block confirmation if it fails.
    console.warn('[orchestrator] feedLearningRule failed', err);
  }
}

// Re-export the matching/suggestion types so consumers don't need three imports.
export type { MatchResult } from './movementMatchingService';
export type { MovementSuggestion } from './movementSuggestionService';
// Acknowledge the imported MovementLearningRule type so editors don't flag it
// as unused — `feedLearningRule` returns the shape implicitly via createOrUpdateRule.
export type { MovementLearningRule };
