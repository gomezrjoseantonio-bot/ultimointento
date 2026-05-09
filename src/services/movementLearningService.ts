import { initDB, Movement, MovementLearningRule } from './db';

/**
 * V1.1 Treasury · Movement Learning Service
 *
 * Aprende de las confirmaciones del usuario en `/tesoreria/importar` para
 * auto-categorizar futuras importaciones. El path activo es
 * bankStatementOrchestrator.confirmDecisions → feedLearningRule →
 * createOrUpdateRule.
 *
 * T16-cleanup (este PR):
 * - Eliminado el subsistema `performManualReconciliation` + `createLearningRule`
 *   + `applyRuleToGrays` (sin callers de UI desde 2025).
 * - Eliminado el subsistema de auditoría history[] (`appendHistory`,
 *   `getLearningLogs`, `getLearningRulesStats`) — no había lectores de
 *   producción. El campo `MovementLearningRule.history?` queda marcado como
 *   @deprecated en `db.ts`; los registros existentes lo conservan dormido
 *   hasta el próximo bump DB.
 * - `createOrUpdateRule` ya no escribe entradas a `history[]`. Resto del
 *   contrato (T16-fix-functional · appliedCount, patrones, lastAppliedAt) se
 *   mantiene intacto.
 */

/**
 * Simple hash function for browser compatibility
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Normalize text for pattern matching
 */
function normalizeText(text: string): string {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

/**
 * Remove volatile tokens from text (dates, numbers, references, IBANs)
 */
function removeVolatileTokens(text: string): string {
  return text
    .replace(/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/g, '') // Dates
    .replace(/\d+[,.]\d{2}/g, '') // Amounts with decimals
    .replace(/\b\d{4,}\b/g, '') // Long numbers (references)
    .replace(/\bref\w*\s*\d+/g, '') // Reference numbers
    .replace(/\b[a-z0-9]{8,}\b/g, '') // Long alphanumeric codes
    .replace(/\bES\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/gi, '') // Spanish IBANs
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]+/g, '') // International IBANs
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract n-grams (2-3 words) from text and return most frequent ones
 */
function extractNGrams(text: string, maxGrams: number = 3): string[] {
  const words = text.split(/\s+/).filter(word => word.length > 2); // Filter short words
  const ngrams: string[] = [];

  // Generate 2-grams and 3-grams
  for (let i = 0; i < words.length; i++) {
    // 2-grams
    if (i < words.length - 1) {
      ngrams.push(`${words[i]} ${words[i + 1]}`);
    }
    // 3-grams
    if (i < words.length - 2) {
      ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  // Count frequency and return most common
  const counts: { [key: string]: number } = {};
  ngrams.forEach(gram => {
    counts[gram] = (counts[gram] || 0) + 1;
  });

  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxGrams)
    .map(([gram]) => gram);
}

/**
 * Build robust learn key per problem statement v1 format
 * Structure: v1|signo|ngramA|ngramB|ngramC
 *
 * Exported for movementSuggestionService: the suggestion engine looks up rules
 * by computing the same learnKey from a just-imported movement.
 */
export function buildLearnKey(movement: Movement): string {
  const contraparte = normalizeText(movement.counterparty || '');
  const descripcion = normalizeText(movement.description || '');

  // Remove volatile tokens
  const cleanContraparte = removeVolatileTokens(contraparte);
  const cleanDescripcion = removeVolatileTokens(descripcion);

  // Combine both texts for n-gram extraction
  const combinedText = `${cleanContraparte} ${cleanDescripcion}`.trim();

  // Extract top 3 n-grams
  const ngrams = extractNGrams(combinedText, 3);

  // Determine amount sign
  const signo = movement.amount >= 0 ? 'positive' : 'negative';

  // Build key: v1|signo|ngramA|ngramB|ngramC
  const keyParts = ['v1', signo, ...ngrams];
  const keyString = keyParts.join('|');

  return simpleHash(keyString);
}

/**
 * Generate a learn key for a movement (alias kept for internal use).
 */
function generateLearnKey(movement: Movement): string {
  return buildLearnKey(movement);
}

/**
 * Create or update a learning rule by learn key.
 *
 * T16-fix-functional preserved:
 * - Each call counts as one application (`appliedCount` arranca en 1 al crear
 *   y se incrementa al actualizar). Esto alimenta el boost de confianza en
 *   `movementSuggestionService.suggestFromLearningRule`.
 * - Cuando el caller dispone del `Movement` (orchestrator), lo pasa en
 *   `params.movement` para rellenar `counterpartyPattern`, `descriptionPattern`
 *   y `amountSign` en la creación, y para no dejar patrones vacíos en upserts
 *   sobre reglas previamente creadas sin contexto.
 *
 * T16-cleanup: ya no escribe entradas a `history[]`. El campo permanece en el
 * tipo como @deprecated y los registros viejos lo mantienen dormido.
 */
export async function createOrUpdateRule(params: {
  learnKey: string;
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  movement?: Movement;
}): Promise<MovementLearningRule> {
  try {
    const db = await initDB();
    const { learnKey, categoria, ambito, inmuebleId, movement } = params;
    const now = new Date().toISOString();

    const derivedCounterparty = movement
      ? normalizeText(movement.counterparty || '')
      : undefined;
    const derivedDescription = movement
      ? removeVolatileTokens(normalizeText(movement.description || ''))
      : undefined;
    const derivedAmountSign: 'positive' | 'negative' | undefined = movement
      ? (movement.amount >= 0 ? 'positive' : 'negative')
      : undefined;

    // Check if rule already exists
    const existingRules = await db.getAllFromIndex('movementLearningRules', 'learnKey', learnKey);

    if (existingRules.length > 0) {
      // Update existing rule
      const rule = existingRules[0];
      // Snapshot before any mutation so the amountSign override condition
      // checks the rule's PRE-existing state, not what we are about to write.
      const wasOrchestratorPlaceholder =
        !rule.counterpartyPattern && !rule.descriptionPattern;
      rule.categoria = categoria;
      rule.ambito = ambito;
      rule.inmuebleId = inmuebleId;
      // B2 · backfill empty patterns when caller now provides a Movement
      if (derivedCounterparty !== undefined && !rule.counterpartyPattern) {
        rule.counterpartyPattern = derivedCounterparty;
      }
      if (derivedDescription !== undefined && !rule.descriptionPattern) {
        rule.descriptionPattern = derivedDescription;
      }
      if (derivedAmountSign !== undefined && wasOrchestratorPlaceholder) {
        rule.amountSign = derivedAmountSign;
      }
      // B1 · this call counts as one application
      rule.appliedCount = (rule.appliedCount ?? 0) + 1;
      rule.lastAppliedAt = now;
      rule.updatedAt = now;

      await db.put('movementLearningRules', rule);
      console.log(`📚 Updated learning rule: ${learnKey}`);
      return rule;
    } else {
      // Create new rule (sin history writes — T16-cleanup)
      const newRule: MovementLearningRule = {
        learnKey,
        counterpartyPattern: derivedCounterparty ?? '',
        descriptionPattern: derivedDescription ?? '',
        amountSign: derivedAmountSign ?? 'positive',
        categoria,
        ambito,
        inmuebleId,
        source: 'IMPLICIT',
        createdAt: now,
        updatedAt: now,
        appliedCount: 1, // B1 · creation already counts as the first application
        lastAppliedAt: now,
      };

      const ruleId = await db.add('movementLearningRules', newRule);
      newRule.id = ruleId as number;

      console.log(`📚 Created learning rule: ${learnKey}`);
      return newRule;
    }
  } catch (error) {
    console.error('❌ Error creating/updating learning rule:', error);
    throw error;
  }
}

/**
 * Apply all learning rules to movements during import.
 *
 * Sin lectores activos tras T16-cleanup (el legacy `bankStatementImportService`
 * fue eliminado en este PR). Se mantiene como API pública para futuros
 * consumidores. El path UI activo (orchestrator) usa
 * `movementSuggestionService.suggestForUnmatched`, que muestra sugerencias al
 * usuario antes de aplicarlas — distinto contrato.
 */
export async function applyAllRulesOnImport(movements: Movement[]): Promise<Movement[]> {
  try {
    const db = await initDB();

    // Get all learning rules
    const allRules = await db.getAll('movementLearningRules');
    const rulesMap = new Map<string, MovementLearningRule>();

    allRules.forEach(rule => {
      rulesMap.set(rule.learnKey, rule);
    });

    const processedMovements = movements.map(movement => {
      const learnKey = generateLearnKey(movement);
      const rule = rulesMap.get(learnKey);

      if (rule) {
        // Apply learned classification
        return {
          ...movement,
          categoria: rule.categoria,
          ambito: rule.ambito,
          inmuebleId: rule.inmuebleId,
          statusConciliacion: 'match_automatico' as const,
          learnKey,
          updatedAt: new Date().toISOString()
        };
      }

      // No rule found, keep as sin_match with default ambito
      return {
        ...movement,
        ambito: 'PERSONAL' as const,
        statusConciliacion: 'sin_match' as const,
        updatedAt: new Date().toISOString()
      };
    });

    // Update rule application counts for used rules
    const appliedRules = new Set<string>();
    processedMovements.forEach(movement => {
      if (movement.learnKey && movement.statusConciliacion === 'match_automatico') {
        appliedRules.add(movement.learnKey);
      }
    });

    // Update applied counts asynchronously (sin history writes — T16-cleanup)
    for (const learnKey of Array.from(appliedRules)) {
      const rule = rulesMap.get(learnKey);
      if (rule && rule.id) {
        rule.appliedCount += 1;
        rule.lastAppliedAt = new Date().toISOString();
        rule.updatedAt = new Date().toISOString();
        await db.put('movementLearningRules', rule);
      }
    }

    if (appliedRules.size > 0) {
      console.log(`🤖 Applied ${appliedRules.size} learning rules to new movements`);
    }

    return processedMovements;

  } catch (error) {
    console.error('❌ Error applying learning rules to new movements:', error);
    return movements.map(movement => ({
      ...movement,
      ambito: 'PERSONAL' as const,
      statusConciliacion: 'sin_match' as const,
      updatedAt: new Date().toISOString()
    }));
  }
}

/**
 * Apply existing learning rules to new movements during import (alias for applyAllRulesOnImport)
 */
export async function applyLearningRulesToNewMovements(movements: Movement[]): Promise<Movement[]> {
  return applyAllRulesOnImport(movements);
}

/**
 * Service surface kept for compat with consumers that destructure the bundle.
 */
export const learningService = {
  createOrUpdateRule,
  applyAllRulesOnImport,
};

// ── D-CRUD-MEDIA sub-tarea 16 · listar / borrar reglas individualmente ───────

/**
 * Lista todas las reglas de aprendizaje persistidas, ordenadas por
 * fecha de actualización descendente (más recientemente aplicadas primero).
 */
export async function listRules(): Promise<MovementLearningRule[]> {
  const db = await initDB();
  const all = ((await db.getAll('movementLearningRules')) ?? []) as MovementLearningRule[];
  return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * Borra una regla de aprendizaje. La regla deja de aplicarse a futuras
 * importaciones · los movimientos ya clasificados conservan su categoría.
 */
export async function deleteRule(id: number): Promise<void> {
  const db = await initDB();
  await db.delete('movementLearningRules', id);
}
