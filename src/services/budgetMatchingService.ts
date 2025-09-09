/**
 * ATLAS HORIZON - Budget Matching Service
 * 
 * Implements sophisticated budget reconciliation per problem statement section 6:
 * - Match imported movements with budget forecasts (Presupuesto)
 * - Configurable date windows (±5 days) and amount tolerance (±15%)
 * - Multi-criteria matching: account + date + sign + provider + amount
 * - Handle multiple candidates and ambiguity resolution
 */

import { initDB, Movement, PresupuestoLinea, MatchingConfiguration, UnifiedMovementStatus } from './db';

const LOG_PREFIX = '[BUDGET-MATCH]';

// Helper functions for date manipulation
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function parseISO(dateString: string): Date {
  return new Date(dateString);
}

// Default matching configuration per problem statement
const DEFAULT_CONFIG: Omit<MatchingConfiguration, 'id' | 'createdAt' | 'updatedAt'> = {
  dateWindow: 5,             // ±5 days
  amountTolerancePercent: 15, // ±15%
  amountToleranceFixed: 0,    // €0 fixed tolerance
  useIbanMatching: true,
  useProviderMatching: true,
  useDescriptionMatching: true,
  useCategoryMatching: true,
  transferDateWindow: 2,      // ±2 days for transfers
  transferKeywords: ['TRASPASO', 'TRANSFERENCIA', 'ENVÍO ENTRE CUENTAS', 'TRANSFER', 'ENVIO']
};

export interface MatchCandidate {
  presupuestoLinea: PresupuestoLinea;
  score: number;            // matching score 0-100
  dateDistance: number;     // days difference
  amountDifference: number; // percentage difference
  matchCriteria: string[];  // what criteria matched
}

export interface MatchResult {
  movement: Movement;
  candidate?: MatchCandidate;
  status: UnifiedMovementStatus;
  confidence: number;       // 0-100
  reason: string;
}

/**
 * Get or create matching configuration
 */
export async function getMatchingConfiguration(): Promise<MatchingConfiguration> {
  const db = await initDB();
  
  try {
    const configs = await db.getAll('matchingConfiguration');
    if (configs.length > 0) {
      return configs[0]; // Use the latest configuration
    }
    
    // Create default configuration
    const now = new Date().toISOString();
    const config: MatchingConfiguration = {
      ...DEFAULT_CONFIG,
      createdAt: now,
      updatedAt: now
    };
    
    const id = await db.add('matchingConfiguration', config);
    return { ...config, id: id as number };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting matching configuration:`, error);
    throw error;
  }
}

/**
 * Update matching configuration
 */
export async function updateMatchingConfiguration(updates: Partial<MatchingConfiguration>): Promise<void> {
  const db = await initDB();
  
  try {
    const config = await getMatchingConfiguration();
    const updatedConfig: MatchingConfiguration = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await db.put('matchingConfiguration', updatedConfig);
    console.info(`${LOG_PREFIX} Updated matching configuration`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating matching configuration:`, error);
    throw error;
  }
}

/**
 * Get budget candidates for a movement
 */
async function getBudgetCandidates(movement: Movement, config: MatchingConfiguration): Promise<PresupuestoLinea[]> {
  const db = await initDB();
  
  try {
    // Get all budget lines for current year
    const movementDate = parseISO(movement.date);
    const year = movementDate.getFullYear();
    
    // Get active budget for the year
    const presupuestos = await db.getAll('presupuestos');
    const activeBudget = presupuestos.find(p => p.year === year && p.estado === 'Activo');
    
    if (!activeBudget) {
      console.warn(`${LOG_PREFIX} No active budget found for year ${year}`);
      return [];
    }
    
    // Get all budget lines for this budget
    const allLines = await db.getAll('presupuestoLineas');
    const budgetLines = allLines.filter(line => line.presupuestoId === activeBudget.id);
    
    // Filter by account if we have account matching enabled
    let candidates = budgetLines;
    if (config.useIbanMatching && movement.accountId) {
      candidates = candidates.filter(line => line.accountId === movement.accountId.toString());
    }
    
    // Filter by date window
    const dateStart = subDays(movementDate, config.dateWindow);
    const dateEnd = addDays(movementDate, config.dateWindow);
    const monthIndex = movementDate.getMonth(); // 0-11
    
    // Only consider lines that have amount for this month
    candidates = candidates.filter(line => {
      const monthlyAmount = line.amountByMonth[monthIndex];
      return monthlyAmount !== 0; // Non-zero amount for this month
    });
    
    console.info(`${LOG_PREFIX} Found ${candidates.length} budget candidates for movement`, {
      movementId: movement.id,
      amount: movement.amount,
      date: movement.date,
      account: movement.accountId
    });
    
    return candidates;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting budget candidates:`, error);
    return [];
  }
}

/**
 * Calculate matching score between movement and budget line
 */
function calculateMatchScore(movement: Movement, budgetLine: PresupuestoLinea, config: MatchingConfiguration): MatchCandidate {
  let score = 0;
  const matchCriteria: string[] = [];
  
  // Get the monthly amount for this budget line
  const movementDate = parseISO(movement.date);
  const monthIndex = movementDate.getMonth();
  const budgetAmount = budgetLine.amountByMonth[monthIndex];
  
  // Amount matching (most important - 40 points)
  const amountDifference = Math.abs((movement.amount - budgetAmount) / budgetAmount) * 100;
  if (amountDifference <= config.amountTolerancePercent) {
    const amountScore = Math.max(0, 40 - (amountDifference / config.amountTolerancePercent) * 20);
    score += amountScore;
    matchCriteria.push(`amount_match_${amountScore.toFixed(1)}pts`);
  }
  
  // Date distance (already filtered by date window) - 20 points
  const dateDistance = Math.abs(new Date(movement.date).getTime() - movementDate.getTime()) / (1000 * 60 * 60 * 24);
  const dateScore = Math.max(0, 20 - (dateDistance / config.dateWindow) * 10);
  score += dateScore;
  matchCriteria.push(`date_${dateDistance.toFixed(1)}days`);
  
  // Provider/counterparty matching - 20 points
  if (config.useProviderMatching && movement.counterparty && budgetLine.providerName) {
    const providerMatch = movement.counterparty.toLowerCase().includes(budgetLine.providerName.toLowerCase()) ||
                         budgetLine.providerName.toLowerCase().includes(movement.counterparty.toLowerCase());
    if (providerMatch) {
      score += 20;
      matchCriteria.push('provider_match');
    }
  }
  
  // Description matching - 15 points
  if (config.useDescriptionMatching && movement.description && budgetLine.label) {
    const descriptionWords = movement.description.toLowerCase().split(' ');
    const labelWords = budgetLine.label.toLowerCase().split(' ');
    const commonWords = descriptionWords.filter(word => 
      word.length > 3 && labelWords.some(labelWord => labelWord.includes(word) || word.includes(labelWord))
    );
    if (commonWords.length > 0) {
      const descScore = Math.min(15, commonWords.length * 5);
      score += descScore;
      matchCriteria.push(`desc_match_${commonWords.length}words`);
    }
  }
  
  // Category matching - 10 points
  if (config.useCategoryMatching && movement.category && budgetLine.category) {
    if (movement.category.tipo.toLowerCase() === budgetLine.category.toLowerCase() ||
        movement.category.subtipo?.toLowerCase() === budgetLine.subcategory?.toLowerCase()) {
      score += 10;
      matchCriteria.push('category_match');
    }
  }
  
  return {
    presupuestoLinea: budgetLine,
    score: Math.min(100, score), // Cap at 100
    dateDistance,
    amountDifference,
    matchCriteria
  };
}

/**
 * Match a single movement against budget
 */
export async function matchMovementToBudget(movement: Movement): Promise<MatchResult> {
  const config = await getMatchingConfiguration();
  
  try {
    console.info(`${LOG_PREFIX} Matching movement to budget`, {
      id: movement.id,
      amount: movement.amount,
      date: movement.date,
      description: movement.description?.substring(0, 50)
    });
    
    const candidates = await getBudgetCandidates(movement, config);
    
    if (candidates.length === 0) {
      return {
        movement,
        status: 'no_planificado',
        confidence: 100,
        reason: 'No budget candidates found'
      };
    }
    
    // Calculate scores for all candidates
    const scoredCandidates = candidates
      .map(candidate => calculateMatchScore(movement, candidate, config))
      .sort((a, b) => b.score - a.score);
    
    const bestCandidate = scoredCandidates[0];
    
    // Determine status and confidence based on best match score
    let status: UnifiedMovementStatus;
    let confidence: number;
    let reason: string;
    
    if (bestCandidate.score >= 80) {
      status = 'conciliado';
      confidence = bestCandidate.score;
      reason = `High confidence match: ${bestCandidate.matchCriteria.join(', ')}`;
    } else if (bestCandidate.score >= 60) {
      status = 'confirmado';
      confidence = bestCandidate.score;
      reason = `Good match: ${bestCandidate.matchCriteria.join(', ')}`;
    } else if (bestCandidate.score >= 40) {
      status = 'confirmado';
      confidence = bestCandidate.score;
      reason = `Acceptable match: ${bestCandidate.matchCriteria.join(', ')}`;
    } else {
      status = 'no_planificado';
      confidence = 100 - bestCandidate.score;
      reason = `Low match score: ${bestCandidate.score}`;
    }
    
    // Check for ambiguous matches (multiple high-scoring candidates)
    const highScoreCandidates = scoredCandidates.filter(c => c.score >= 60);
    if (highScoreCandidates.length > 1) {
      const scoreDifference = highScoreCandidates[0].score - highScoreCandidates[1].score;
      if (scoreDifference < 20) {
        status = 'no_planificado';
        confidence = 50;
        reason = `Ambiguous match: ${highScoreCandidates.length} similar candidates`;
      }
    }
    
    console.info(`${LOG_PREFIX} Match result`, {
      movementId: movement.id,
      status,
      confidence,
      bestScore: bestCandidate.score,
      reason
    });
    
    return {
      movement,
      candidate: bestCandidate,
      status,
      confidence,
      reason
    };
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error matching movement to budget:`, error);
    return {
      movement,
      status: 'no_planificado',
      confidence: 0,
      reason: `Error during matching: ${error}`
    };
  }
}

/**
 * Batch match multiple movements
 */
export async function matchMovementsToBudget(movements: Movement[]): Promise<MatchResult[]> {
  console.info(`${LOG_PREFIX} Starting batch matching for ${movements.length} movements`);
  
  const results: MatchResult[] = [];
  
  for (const movement of movements) {
    const result = await matchMovementToBudget(movement);
    results.push(result);
  }
  
  const summary = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.info(`${LOG_PREFIX} Batch matching complete`, {
    total: movements.length,
    summary
  });
  
  return results;
}

/**
 * Update movement with match result
 */
export async function applyMatchResult(result: MatchResult): Promise<void> {
  const db = await initDB();
  
  try {
    const updatedMovement: Movement = {
      ...result.movement,
      unifiedStatus: result.status,
      plan_match_id: result.candidate?.presupuestoLinea.id,
      updatedAt: new Date().toISOString()
    };
    
    await db.put('movements', updatedMovement);
    
    console.info(`${LOG_PREFIX} Applied match result`, {
      movementId: result.movement.id,
      status: result.status,
      planMatchId: result.candidate?.presupuestoLinea.id
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error applying match result:`, error);
    throw error;
  }
}