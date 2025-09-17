import { initDB, Movement, PresupuestoLinea, ReconciliationAuditLog } from './db';

/**
 * V1.1 Treasury - Budget Reclassification Service
 * 
 * Handles automatic reclassification of gray movements (sin_match) 
 * when budget changes occur. Uses predefined rules and typical 
 * description patterns to suggest categories and scopes.
 */

// Dictionary of typical Spanish utility/service provider patterns
const TYPICAL_PROVIDERS: { [key: string]: { categoria: string; ambito: 'PERSONAL' | 'INMUEBLE' } } = {
  'endesa': { categoria: 'Suministros', ambito: 'INMUEBLE' },
  'iberdrola': { categoria: 'Suministros', ambito: 'INMUEBLE' },
  'naturgy': { categoria: 'Suministros', ambito: 'INMUEBLE' },
  'gas natural': { categoria: 'Suministros', ambito: 'INMUEBLE' },
  'movistar': { categoria: 'Suministros', ambito: 'PERSONAL' },
  'telefonica': { categoria: 'Suministros', ambito: 'PERSONAL' },
  'orange': { categoria: 'Suministros', ambito: 'PERSONAL' },
  'vodafone': { categoria: 'Suministros', ambito: 'PERSONAL' },
  'canal isabel': { categoria: 'Suministros', ambito: 'INMUEBLE' },
  'aqualia': { categoria: 'Suministros', ambito: 'INMUEBLE' },
  'ayuntamiento': { categoria: 'IBI', ambito: 'INMUEBLE' },
  'hacienda': { categoria: 'IBI', ambito: 'INMUEBLE' },
  'comunidad': { categoria: 'Comunidad', ambito: 'INMUEBLE' },
  'administracion': { categoria: 'Comunidad', ambito: 'INMUEBLE' },
  'seguro': { categoria: 'Seguros', ambito: 'INMUEBLE' },
  'mapfre': { categoria: 'Seguros', ambito: 'PERSONAL' },
  'allianz': { categoria: 'Seguros', ambito: 'PERSONAL' },
  'axa': { categoria: 'Seguros', ambito: 'PERSONAL' },
  'santander': { categoria: 'Intereses', ambito: 'PERSONAL' },
  'bbva': { categoria: 'Intereses', ambito: 'PERSONAL' },
  'caixabank': { categoria: 'Intereses', ambito: 'PERSONAL' },
};

const IBI_KEYWORDS = ['ibi', 'impuesto bienes', 'tasa urbana', 'catastro'];
const COMMUNITY_KEYWORDS = ['comunidad', 'administracion', 'cuota mensual', 'gastos comunes'];
const UTILITIES_KEYWORDS = ['luz', 'agua', 'gas', 'electricidad', 'suministro'];
const INSURANCE_KEYWORDS = ['seguro', 'poliza', 'prima'];

/**
 * Normalize a string for pattern matching
 */
function normalizeString(str: string): string {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Analyze movement description and counterparty to suggest category and scope
 */
function analyzeMovementForCategory(movement: Movement): {
  categoria?: string;
  ambito?: 'PERSONAL' | 'INMUEBLE';
} {
  const description = normalizeString(movement.description || '');
  const counterparty = normalizeString(movement.counterparty || '');
  const combined = `${description} ${counterparty}`;

  // Check typical providers first
  for (const [provider, classification] of Object.entries(TYPICAL_PROVIDERS)) {
    if (combined.includes(provider)) {
      return classification;
    }
  }

  // Check keyword patterns
  if (IBI_KEYWORDS.some(keyword => combined.includes(keyword))) {
    return { categoria: 'IBI', ambito: 'INMUEBLE' };
  }

  if (COMMUNITY_KEYWORDS.some(keyword => combined.includes(keyword))) {
    return { categoria: 'Comunidad', ambito: 'INMUEBLE' };
  }

  if (UTILITIES_KEYWORDS.some(keyword => combined.includes(keyword))) {
    return { categoria: 'Suministros', ambito: 'INMUEBLE' };
  }

  if (INSURANCE_KEYWORDS.some(keyword => combined.includes(keyword))) {
    return { categoria: 'Seguros', ambito: 'PERSONAL' };
  }

  // Default for rent payments (positive amounts from known patterns)
  if (movement.amount > 0 && (combined.includes('alquiler') || combined.includes('renta'))) {
    return { categoria: 'Alquiler', ambito: 'INMUEBLE' };
  }

  return {};
}

/**
 * Check if movement matches any budget line for the same period
 */
async function findBudgetMatch(movement: Movement, presupuestoLineas: PresupuestoLinea[]): Promise<{
  categoria?: string;
  ambito?: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
}> {
  const movementDate = new Date(movement.date);
  const movementMonth = movementDate.getMonth(); // 0-based

  for (const linea of presupuestoLineas) {
    // Check if movement amount roughly matches budget line for this month
    const budgetAmount = linea.amountByMonth[movementMonth];
    if (budgetAmount === 0) continue;

    // Allow for 20% variance in amount matching
    const amountDiff = Math.abs(Math.abs(movement.amount) - Math.abs(budgetAmount));
    const tolerance = Math.abs(budgetAmount) * 0.2;

    if (amountDiff <= tolerance) {
      // Check if description/counterparty might match
      const normalized = normalizeString(`${movement.description} ${movement.counterparty}`);
      const lineaNormalized = normalizeString(`${linea.label} ${linea.providerName || ''}`);
      
      // Basic keyword matching
      const lineaWords = lineaNormalized.split(' ').filter(w => w.length > 3);
      const hasMatch = lineaWords.some(word => normalized.includes(word));

      if (hasMatch) {
        return {
          categoria: linea.category,
          ambito: linea.scope === 'INMUEBLES' ? 'INMUEBLE' : 'PERSONAL',
          inmuebleId: linea.inmuebleId
        };
      }
    }
  }

  return {};
}

/**
 * Reclassify movements when budget is updated
 */
export async function reclassifyMovementsOnBudgetUpdate(periodo: { year: number; presupuestoId: string }): Promise<void> {
  try {
    const db = await initDB();
    
    // Get all sin_match movements for this year
    const allMovements = await db.getAll('movements');
    const sinMatchMovements = allMovements.filter(movement => {
      if (movement.statusConciliacion !== 'sin_match') return false;
      
      const movementYear = new Date(movement.date).getFullYear();
      return movementYear === periodo.year;
    });

    if (sinMatchMovements.length === 0) {
      console.log('🟡 No sin_match movements found for reclassification');
      return;
    }

    // Get budget lines for this period
    const presupuestoLineas = await db.getAll('presupuestoLineas');
    const periodLineas = presupuestoLineas.filter(
      linea => linea.presupuestoId === periodo.presupuestoId
    );

    let reclassifiedCount = 0;

    // Process each movement
    for (const movement of sinMatchMovements) {
      let categoria: string | undefined;
      let ambito: 'PERSONAL' | 'INMUEBLE' | undefined;
      let inmuebleId: string | undefined;

      // First try to match with budget
      const budgetMatch = await findBudgetMatch(movement, periodLineas);
      if (budgetMatch.categoria) {
        categoria = budgetMatch.categoria;
        ambito = budgetMatch.ambito;
        inmuebleId = budgetMatch.inmuebleId;
      } else {
        // Fall back to pattern analysis
        const patternMatch = analyzeMovementForCategory(movement);
        categoria = patternMatch.categoria;
        ambito = patternMatch.ambito;
      }

      // Update movement if we found a match
      if (categoria && ambito) {
        const updatedMovement: Movement = {
          ...movement,
          categoria,
          ambito,
          inmuebleId,
          // Keep as sin_match until actual reconciliation
          statusConciliacion: 'sin_match',
          updatedAt: new Date().toISOString()
        };

        await db.put('movements', updatedMovement);
        
        // Log the action
        const auditLog: ReconciliationAuditLog = {
          action: 'budget_trigger',
          movimientoId: movement.id!,
          categoria,
          ambito,
          inmuebleId,
          timestamp: new Date().toISOString()
        };
        await db.add('reconciliationAuditLogs', auditLog);

        reclassifiedCount++;
      }
    }

    console.log(`✅ Budget reclassification completed: ${reclassifiedCount} movements auto-categorized`);

  } catch (error) {
    console.error('❌ Error in budget reclassification:', error);
    throw error;
  }
}

/**
 * Emit budget updated event to trigger reclassification
 */
export async function emitBudgetUpdatedEvent(presupuestoId: string, year: number): Promise<void> {
  try {
    // Trigger reclassification
    await reclassifyMovementsOnBudgetUpdate({ year, presupuestoId });
    
    // Emit event for other listeners (if any)
    window.dispatchEvent(new CustomEvent('budget:updated', {
      detail: { presupuestoId, year }
    }));

    console.log(`🔄 Budget updated event emitted for ${year} (${presupuestoId})`);

  } catch (error) {
    console.error('❌ Error emitting budget updated event:', error);
    throw error;
  }
}