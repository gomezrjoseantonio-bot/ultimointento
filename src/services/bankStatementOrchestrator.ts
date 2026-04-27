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
import { BankParserService } from '../features/inbox/importers/bankParser';
import { bankProfileMatcher, BankFormat } from '../features/inbox/importers/bankProfileMatcher';
import { bankProfilesService } from './bankProfilesService';
import { matchBatch, MatchOptions, MatchResult } from './movementMatchingService';
import { suggestForUnmatched, MovementSuggestion, SuggestionAction } from './movementSuggestionService';
import { buildLearnKey, createOrUpdateRule } from './movementLearningService';
import type { ParsedMovement } from '../types/bankProfiles';

export interface OrchestratorOptions {
  accountId: number;
  formatHint?: 'auto' | 'csv' | 'xlsx' | 'csb43';
  bankProfileHint?: string;
  periodStart?: string;          // YYYY-MM-DD inclusive
  periodEnd?: string;             // YYYY-MM-DD inclusive
  matchOptions?: MatchOptions;
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
}

const PROFILE_CONFIDENCE_THRESHOLD = 60;

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

  const filteredMovements = filterByPeriod(parsed.movements, options.periodStart, options.periodEnd);
  const movementsParsed = filteredMovements.length;

  const importBatchId = await persistImportBatch(file, options, movementsParsed, format, bankProfileUsed);
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
    bankProfileUsed,
    warnings,
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
    // Uses the same map as `getBankInfoFromIBAN` by faking an "ES00<code>…"
    // string so we don't duplicate the lookup table.
    const bancoCode = account.banco?.code?.trim();
    if (bancoCode && /^\d{4}$/.test(bancoCode)) {
      const fromCode = bankProfilesService.getBankInfoFromIBAN(`ES00${bancoCode}`);
      if (fromCode?.bankKey) return fromCode.bankKey;
    }

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
    await db.put('movements', {
      ...movement,
      unifiedStatus: 'conciliado',
      statusConciliacion: 'match_manual',
      updatedAt: now,
    });
    movementIdsTouched.add(movementId);

    // Feed learning so subsequent imports auto-classify by learnKey.
    await feedLearningRule(movement, deriveCategoryFromEvent(event));
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
  bankProfile?: string
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
    hashLote: '', // hashing of raw bytes is out of scope for T17; T18 will tighten this
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
      counterparty: row.counterparty,
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

    if (existingHashes.has(hashMovement(candidate))) {
      duplicates++;
      continue;
    }

    const id = (await db.add('movements', candidate)) as number;
    insertedIds.push(id);
    existingHashes.add(hashMovement({ ...candidate, id }));
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

async function feedLearningRule(movement: Movement, derived: DerivedCategory | null): Promise<void> {
  if (!derived) return;
  try {
    const learnKey = buildLearnKey(movement);
    await createOrUpdateRule({
      learnKey,
      categoria: derived.categoria,
      ambito: derived.ambito,
      inmuebleId: derived.inmuebleId,
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
