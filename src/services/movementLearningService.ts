import { initDB, Movement, MovementLearningRule, ReconciliationAuditLog, LearningLog } from './db';

/**
 * V1.1 Treasury - Movement Learning Service
 * 
 * Handles learning from manual reconciliation actions and applying
 * learned rules to similar movements automatically.
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
 */
function buildLearnKey(movement: Movement): string {
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
 * Generate a learn key for a movement (updated implementation)
 * This key identifies similar movements for learning purposes
 */
function generateLearnKey(movement: Movement): string {
  return buildLearnKey(movement);
}

/**
 * Create a learning rule from a manually reconciled movement
 */
export async function createLearningRule(
  movement: Movement,
  categoria: string,
  ambito: 'PERSONAL' | 'INMUEBLE',
  inmuebleId?: string
): Promise<MovementLearningRule> {
  try {
    const db = await initDB();
    
    const learnKey = generateLearnKey(movement);
    const counterparty = normalizeText(movement.counterparty || '');
    const cleanDescripcion = removeVolatileTokens(normalizeText(movement.description || ''));
    const amountSign = movement.amount >= 0 ? 'positive' : 'negative';

    // Check if rule already exists
    const existingRules = await db.getAllFromIndex('movementLearningRules', 'learnKey', learnKey);
    
    if (existingRules.length > 0) {
      // Update existing rule
      const rule = existingRules[0];
      rule.categoria = categoria;
      rule.ambito = ambito;
      rule.inmuebleId = inmuebleId;
      rule.appliedCount = rule.appliedCount + 1;
      rule.updatedAt = new Date().toISOString();
      rule.lastAppliedAt = new Date().toISOString();
      
      await db.put('movementLearningRules', rule);
      
      // Log the action
      const learningLog: LearningLog = {
        action: 'CREATE_RULE',
        movimientoId: movement.id,
        ruleId: rule.id,
        learnKey,
        categoria,
        ambito,
        inmuebleId,
        ts: new Date().toISOString()
      };
      await db.add('learningLogs', learningLog);
      
      console.log(`📚 Updated existing learning rule: ${learnKey}`);
      return rule;
    } else {
      // Create new rule
      const newRule: MovementLearningRule = {
        learnKey,
        counterpartyPattern: counterparty,
        descriptionPattern: cleanDescripcion,
        amountSign: amountSign as 'positive' | 'negative',
        categoria,
        ambito,
        inmuebleId,
        source: 'IMPLICIT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        appliedCount: 1,
        lastAppliedAt: new Date().toISOString()
      };
      
      const ruleId = await db.add('movementLearningRules', newRule);
      newRule.id = ruleId as number;
      
      // Log the action
      const learningLog: LearningLog = {
        action: 'CREATE_RULE',
        movimientoId: movement.id,
        ruleId: ruleId as number,
        learnKey,
        categoria,
        ambito,
        inmuebleId,
        ts: new Date().toISOString()
      };
      await db.add('learningLogs', learningLog);
      
      console.log(`📚 Created new learning rule: ${learnKey}`);
      return newRule;
    }
  } catch (error) {
    console.error('❌ Error creating learning rule:', error);
    throw error;
  }
}

/**
 * Create or update a learning rule by learn key
 */
export async function createOrUpdateRule(params: {
  learnKey: string;
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
}): Promise<MovementLearningRule> {
  try {
    const db = await initDB();
    const { learnKey, categoria, ambito, inmuebleId } = params;

    // Check if rule already exists
    const existingRules = await db.getAllFromIndex('movementLearningRules', 'learnKey', learnKey);
    
    if (existingRules.length > 0) {
      // Update existing rule
      const rule = existingRules[0];
      rule.categoria = categoria;
      rule.ambito = ambito;
      rule.inmuebleId = inmuebleId;
      rule.updatedAt = new Date().toISOString();
      
      await db.put('movementLearningRules', rule);
      console.log(`📚 Updated learning rule: ${learnKey}`);
      return rule;
    } else {
      // Create new rule
      const newRule: MovementLearningRule = {
        learnKey,
        counterpartyPattern: '', // Will be filled when movement is processed
        descriptionPattern: '',
        amountSign: 'positive', // Default, will be updated
        categoria,
        ambito,
        inmuebleId,
        source: 'IMPLICIT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        appliedCount: 0,
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
 * Apply rule to gray movements in same period and account (backfill)
 */
export async function applyRuleToGrays(params: {
  learnKey: string;
  periodo: string; // YYYY or YYYY-MM
  cuentaId: number;
  limit?: number;
}): Promise<{ updated: number; total: number }> {
  try {
    const db = await initDB();
    const { learnKey, periodo, cuentaId, limit = 500 } = params;

    // Get the learning rule
    const rules = await db.getAllFromIndex('movementLearningRules', 'learnKey', learnKey);
    if (rules.length === 0) {
      throw new Error(`Learning rule not found for key: ${learnKey}`);
    }
    
    const rule = rules[0];

    // Get all movements for the period and account
    const allMovements = await db.getAll('movements');
    
    const candidateMovements = allMovements.filter(movement => {
      // Only sin_match movements
      if (movement.statusConciliacion !== 'sin_match') return false;
      
      // Same account
      if (movement.accountId !== cuentaId) return false;
      
      // Same period (year or year-month)
      const movementDate = new Date(movement.date);
      const movementPeriod = periodo.length === 4 
        ? movementDate.getFullYear().toString()
        : `${movementDate.getFullYear()}-${String(movementDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (movementPeriod !== periodo) return false;
      
      // Check if movement matches the learn key
      return generateLearnKey(movement) === learnKey;
    });

    // Apply limit
    const movementsToUpdate = candidateMovements.slice(0, limit);
    let updated = 0;

    // Process in batches to avoid blocking
    const batchSize = 100;
    for (let i = 0; i < movementsToUpdate.length; i += batchSize) {
      const batch = movementsToUpdate.slice(i, i + batchSize);
      
      for (const movement of batch) {
        const updatedMovement: Movement = {
          ...movement,
          categoria: rule.categoria,
          ambito: rule.ambito,
          inmuebleId: rule.inmuebleId,
          statusConciliacion: 'match_automatico',
          learnKey,
          updatedAt: new Date().toISOString()
        };

        await db.put('movements', updatedMovement);
        
        // Log the action
        const learningLog: LearningLog = {
          action: 'BACKFILL',
          movimientoId: movement.id,
          ruleId: rule.id,
          learnKey,
          categoria: rule.categoria,
          ambito: rule.ambito,
          inmuebleId: rule.inmuebleId,
          ts: new Date().toISOString()
        };
        await db.add('learningLogs', learningLog);

        updated++;
      }
      
      // Small delay between batches to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Update rule applied count
    if (updated > 0) {
      rule.appliedCount += updated;
      rule.lastAppliedAt = new Date().toISOString();
      rule.updatedAt = new Date().toISOString();
      await db.put('movementLearningRules', rule);
    }

    console.log(`🔄 Backfill applied ${updated}/${candidateMovements.length} movements for rule ${learnKey}`);
    
    return { updated, total: candidateMovements.length };

  } catch (error) {
    console.error('❌ Error applying rule to gray movements:', error);
    throw error;
  }
}

/**
 * Apply all learning rules to movements during import
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

    // Update applied counts asynchronously
    for (const learnKey of Array.from(appliedRules)) {
      const rule = rulesMap.get(learnKey);
      if (rule && rule.id) {
        rule.appliedCount += 1;
        rule.lastAppliedAt = new Date().toISOString();
        rule.updatedAt = new Date().toISOString();
        await db.put('movementLearningRules', rule);
        
        // Log each application
        const learningLog: LearningLog = {
          action: 'APPLY_RULE',
          ruleId: rule.id,
          learnKey,
          categoria: rule.categoria,
          ambito: rule.ambito,
          inmuebleId: rule.inmuebleId,
          ts: new Date().toISOString()
        };
        await db.add('learningLogs', learningLog);
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
 * Perform manual reconciliation with learning and validation
 */
export async function performManualReconciliation(
  movementId: number,
  categoria: string,
  ambito: 'PERSONAL' | 'INMUEBLE',
  inmuebleId?: string
): Promise<{ appliedToSimilar: number }> {
  try {
    const db = await initDB();
    
    // Validation: categoria is required
    if (!categoria || categoria.trim() === '') {
      throw new Error('No se pudo crear la regla de aprendizaje.');
    }
    
    // Validation: ambito is required
    if (!ambito) {
      throw new Error('No se pudo crear la regla de aprendizaje.');
    }
    
    // Validation: if ambito='INMUEBLE' then inmuebleId is required
    if (ambito === 'INMUEBLE' && (!inmuebleId || inmuebleId.trim() === '')) {
      throw new Error('No se pudo crear la regla de aprendizaje.');
    }
    
    // Get the movement
    const movement = await db.get('movements', movementId);
    if (!movement) {
      throw new Error(`Movement ${movementId} not found`);
    }

    // Update the source movement to match_manual
    const learnKey = generateLearnKey(movement);
    const updatedMovement: Movement = {
      ...movement,
      categoria,
      ambito,
      inmuebleId,
      statusConciliacion: 'match_manual',
      learnKey,
      updatedAt: new Date().toISOString()
    };

    await db.put('movements', updatedMovement);

    // Create/update learning rule
    await createLearningRule(movement, categoria, ambito, inmuebleId);

    // Backfill: apply to similar movements in same period and account
    const movementDate = new Date(movement.date);
    const periodo = movementDate.getFullYear().toString(); // Use year as period
    const cuentaId = movement.accountId || 999;
    
    let appliedToSimilar = 0;
    try {
      const backfillResult = await applyRuleToGrays({
        learnKey,
        periodo,
        cuentaId,
        limit: 500 // Configurable limit per problem statement
      });
      appliedToSimilar = backfillResult.updated;
      
      if (backfillResult.total > backfillResult.updated) {
        console.warn(`Backfill parcial aplicado: ${backfillResult.updated}/${backfillResult.total}.`);
      }
    } catch (backfillError) {
      console.error('Backfill error:', backfillError);
      // Continue even if backfill fails
    }

    // Log the manual reconciliation
    const auditLog: ReconciliationAuditLog = {
      action: 'manual_reconcile',
      movimientoId: movementId,
      categoria,
      ambito,
      inmuebleId,
      learnKey,
      timestamp: new Date().toISOString()
    };
    await db.add('reconciliationAuditLogs', auditLog);

    console.log(`✅ Manual reconciliation completed for movement ${movementId}`);
    
    // TODO: Emit treasury:movementsUpdated event for UI refresh
    // This would be implemented when event system is available
    
    return { appliedToSimilar };

  } catch (error) {
    console.error('❌ Error in manual reconciliation:', error);
    throw error;
  }
}

/**
 * Apply existing learning rules to new movements during import (alias for applyAllRulesOnImport)
 */
export async function applyLearningRulesToNewMovements(movements: Movement[]): Promise<Movement[]> {
  return applyAllRulesOnImport(movements);
}

/**
 * Export object with the main service functions as specified in problem statement
 */
export const learningService = {
  createOrUpdateRule,
  applyRuleToGrays,
  applyAllRulesOnImport
};

/**
 * Get learning rules statistics
 */
export async function getLearningRulesStats(): Promise<{
  totalRules: number;
  totalApplications: number;
  recentRules: MovementLearningRule[];
}> {
  try {
    const db = await initDB();
    const allRules = await db.getAll('movementLearningRules');
    
    const totalApplications = allRules.reduce((sum, rule) => sum + rule.appliedCount, 0);
    const recentRules = allRules
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return {
      totalRules: allRules.length,
      totalApplications,
      recentRules
    };
  } catch (error) {
    console.error('❌ Error getting learning rules stats:', error);
    return {
      totalRules: 0,
      totalApplications: 0,
      recentRules: []
    };
  }
}

/**
 * Get learning logs for audit purposes
 */
export async function getLearningLogs(limit: number = 100): Promise<LearningLog[]> {
  try {
    const db = await initDB();
    const allLogs = await db.getAll('learningLogs');
    
    return allLogs
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('❌ Error getting learning logs:', error);
    return [];
  }
}