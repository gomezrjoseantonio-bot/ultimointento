import { initDB, Movement, MovementLearningRule, ReconciliationAuditLog } from './db';

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
 * Extract meaningful pattern from description
 * Removes amounts, dates, and reference numbers to focus on the core concept
 */
function extractDescriptionPattern(description: string): string {
  let pattern = normalizeText(description);
  
  // Remove common patterns that vary: amounts, dates, references
  pattern = pattern
    .replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, '') // Dates
    .replace(/\d+[,\.]\d{2}/g, '') // Amounts with decimals
    .replace(/\b\d{4,}\b/g, '') // Long numbers (references)
    .replace(/\bref\w*\s*\d+/g, '') // Reference numbers
    .replace(/\b[a-z0-9]{8,}\b/g, '') // Long alphanumeric codes
    .replace(/\s+/g, ' ')
    .trim();

  // Keep only first 50 chars of meaningful content
  return pattern.substring(0, 50).trim();
}

/**
 * Generate a learn key for a movement
 * This key identifies similar movements for learning purposes
 */
function generateLearnKey(movement: Movement): string {
  const counterparty = normalizeText(movement.counterparty || '');
  const descriptionPattern = extractDescriptionPattern(movement.description || '');
  const amountSign = movement.amount >= 0 ? 'positive' : 'negative';
  
  // Create a hash of the normalized components
  const keyString = `${counterparty}|${descriptionPattern}|${amountSign}`;
  return simpleHash(keyString);
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
    const descriptionPattern = extractDescriptionPattern(movement.description || '');
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
      rule.lastAppliedAt = new Date().toISOString();
      
      await db.put('movementLearningRules', rule);
      console.log(`📚 Updated existing learning rule: ${learnKey}`);
      return rule;
    } else {
      // Create new rule
      const newRule: MovementLearningRule = {
        learnKey,
        counterpartyPattern: counterparty,
        descriptionPattern,
        amountSign: amountSign as 'positive' | 'negative',
        categoria,
        ambito,
        inmuebleId,
        createdAt: new Date().toISOString(),
        appliedCount: 1,
        lastAppliedAt: new Date().toISOString()
      };
      
      await db.add('movementLearningRules', newRule);
      console.log(`📚 Created new learning rule: ${learnKey}`);
      return newRule;
    }
  } catch (error) {
    console.error('❌ Error creating learning rule:', error);
    throw error;
  }
}

/**
 * Apply learning rules to similar movements in the same period
 */
export async function applyLearningRuleToSimilarMovements(
  sourceMovement: Movement,
  learnKey: string,
  categoria: string,
  ambito: 'PERSONAL' | 'INMUEBLE',
  inmuebleId?: string
): Promise<number> {
  try {
    const db = await initDB();
    
    // Get all sin_match movements from the same year
    const sourceYear = new Date(sourceMovement.date).getFullYear();
    const allMovements = await db.getAll('movements');
    
    const candidateMovements = allMovements.filter(movement => {
      if (movement.id === sourceMovement.id) return false; // Skip source movement
      if (movement.statusConciliacion !== 'sin_match') return false;
      
      const movementYear = new Date(movement.date).getFullYear();
      if (movementYear !== sourceYear) return false;
      
      // Check if movement would generate the same learn key
      return generateLearnKey(movement) === learnKey;
    });

    let appliedCount = 0;

    // Apply rule to similar movements
    for (const movement of candidateMovements) {
      const updatedMovement: Movement = {
        ...movement,
        categoria,
        ambito,
        inmuebleId,
        statusConciliacion: 'match_automatico',
        learnKey,
        updatedAt: new Date().toISOString()
      };

      await db.put('movements', updatedMovement);
      
      // Log the action
      const auditLog: ReconciliationAuditLog = {
        action: 'learn_rule_applied',
        movimientoId: movement.id!,
        categoria,
        ambito,
        inmuebleId,
        learnKey,
        timestamp: new Date().toISOString()
      };
      await db.add('reconciliationAuditLogs', auditLog);

      appliedCount++;
    }

    if (appliedCount > 0) {
      console.log(`🤖 Applied learning rule to ${appliedCount} similar movements`);
    }

    return appliedCount;

  } catch (error) {
    console.error('❌ Error applying learning rule:', error);
    throw error;
  }
}

/**
 * Perform manual reconciliation with learning
 */
export async function performManualReconciliation(
  movementId: number,
  categoria: string,
  ambito: 'PERSONAL' | 'INMUEBLE',
  inmuebleId?: string
): Promise<{ appliedToSimilar: number }> {
  try {
    const db = await initDB();
    
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

    // Apply to similar movements
    const appliedToSimilar = await applyLearningRuleToSimilarMovements(
      movement, learnKey, categoria, ambito, inmuebleId
    );

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
    
    return { appliedToSimilar };

  } catch (error) {
    console.error('❌ Error in manual reconciliation:', error);
    throw error;
  }
}

/**
 * Apply existing learning rules to new movements during import
 */
export async function applyLearningRulesToNewMovements(movements: Movement[]): Promise<Movement[]> {
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

    // Update rule application counts
    const appliedRules = new Set<string>();
    processedMovements.forEach(movement => {
      if (movement.learnKey && movement.statusConciliacion === 'match_automatico') {
        appliedRules.add(movement.learnKey);
      }
    });

    // Update applied counts for used rules
    Array.from(appliedRules).forEach(async (learnKey) => {
      const rule = rulesMap.get(learnKey);
      if (rule && rule.id) {
        rule.appliedCount += 1;
        rule.lastAppliedAt = new Date().toISOString();
        await db.put('movementLearningRules', rule);
      }
    });

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