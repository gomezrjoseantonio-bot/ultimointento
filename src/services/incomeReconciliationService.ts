import { initDB, Ingreso, Movement, IngresoEstado } from './db';
import toast from 'react-hot-toast';

/**
 * Income Reconciliation Service
 * Handles enhanced income status calculation and reconciliation workflow
 */

/**
 * Calculate current year accrued income for a property
 */
export const calculateCurrentYearAccruedIncome = async (
  propertyId: number,
  year: number
): Promise<{
  total: number;
  previsto: number;
  cobrado: number;
  parcialmenteCobrado: number;
  impagado: number;
}> => {
  const db = await initDB();
  
  // Get all income records for the property in the specified year
  const allIngresos = await db.getAll('ingresos');
  const yearIngresos = allIngresos.filter(ingreso => {
    const incomeDate = new Date(ingreso.fecha_emision);
    return incomeDate.getFullYear() === year && 
           ingreso.destino === 'inmueble_id' && 
           ingreso.destino_id === propertyId;
  });

  const result = {
    total: 0,
    previsto: 0,
    cobrado: 0,
    parcialmenteCobrado: 0,
    impagado: 0
  };

  for (const ingreso of yearIngresos) {
    result.total += ingreso.importe;
    
    switch (ingreso.estado) {
      case 'previsto':
        result.previsto += ingreso.importe;
        break;
      case 'cobrado':
        result.cobrado += ingreso.importe;
        break;
      case 'incompleto':
        result.parcialmenteCobrado += ingreso.importe;
        break;
      default:
        // Consider any other status as unpaid
        result.impagado += ingreso.importe;
        break;
    }
  }

  return result;
};

/**
 * Update income status based on reconciliation with treasury movements
 */
export const updateIncomeReconciliationStatus = async (
  ingresoId: number,
  movementId?: number
): Promise<void> => {
  const db = await initDB();
  
  try {
    const ingreso = await db.get('ingresos', ingresoId);
    if (!ingreso) {
      throw new Error(`Income record ${ingresoId} not found`);
    }

    let newStatus: IngresoEstado = ingreso.estado;

    if (movementId) {
      // Reconciling with a movement
      const movement = await db.get('movements', movementId);
      if (!movement) {
        throw new Error(`Movement ${movementId} not found`);
      }

      // Determine status based on amount comparison
      const expectedAmount = ingreso.importe;
      const receivedAmount = Math.abs(movement.amount); // Use absolute value for incoming amounts

      if (receivedAmount >= expectedAmount * 0.99) { // 99% tolerance for rounding
        newStatus = 'cobrado';
      } else if (receivedAmount > 0) {
        newStatus = 'incompleto'; // Partially collected
      }

      // Update the movement with reconciliation info
      movement.estado_conciliacion = 'conciliado';
      movement.linked_registro = {
        type: 'ingreso',
        id: ingresoId
      };
      await db.put('movements', movement);

      // Update the income with movement link
      ingreso.movement_id = movementId;
    } else {
      // Removing reconciliation - check if payment is overdue
      const today = new Date();
      const expectedDate = new Date(ingreso.fecha_prevista_cobro);
      
      if (today > expectedDate && ingreso.estado === 'previsto') {
        // Mark as overdue (impagado) if past due date
        newStatus = 'previsto'; // Keep as previsto for now, could add 'impagado' status
      }
      
      ingreso.movement_id = undefined;
    }

    // Update income status
    ingreso.estado = newStatus;
    ingreso.updatedAt = new Date().toISOString();
    await db.put('ingresos', ingreso);

    toast.success('Estado de ingreso actualizado');
  } catch (error) {
    console.error('Error updating income reconciliation status:', error);
    toast.error('Error al actualizar el estado del ingreso');
    throw error;
  }
};

/**
 * Find potential income-movement matches for reconciliation
 */
export const findIncomeReconciliationMatches = async (): Promise<Array<{
  ingreso: Ingreso;
  potentialMovements: Array<{
    movement: Movement;
    confidence: number;
    reason: string;
  }>;
}>> => {
  const db = await initDB();
  const matches: any[] = [];

  try {
    // Get unreconciled income records
    const allIngresos = await db.getAll('ingresos');
    const unreconciledIngresos = allIngresos.filter(i => 
      !i.movement_id && (i.estado === 'previsto' || i.estado === 'incompleto')
    );

    // Get unreconciled positive movements (incoming money)
    const movements = await db.getAll('movements');
    const unreconciledMovements = movements.filter(m => 
      m.amount > 0 && // Only positive amounts (income)
      (!m.estado_conciliacion || m.estado_conciliacion === 'pendiente')
    );

    for (const ingreso of unreconciledIngresos) {
      const potentialMovements: any[] = [];

      for (const movement of unreconciledMovements) {
        let confidence = 0;
        const reasons: string[] = [];

        // Amount matching (most important factor)
        const expectedAmount = ingreso.importe;
        const receivedAmount = movement.amount;
        const amountDiff = Math.abs(expectedAmount - receivedAmount);
        const amountDiffPercent = (amountDiff / expectedAmount) * 100;

        if (amountDiffPercent <= 1) { // Within 1%
          confidence += 40;
          reasons.push('Importe exacto');
        } else if (amountDiffPercent <= 5) { // Within 5%
          confidence += 30;
          reasons.push('Importe similar');
        } else if (amountDiffPercent <= 15) { // Within 15%
          confidence += 15;
          reasons.push('Importe aproximado');
        }

        // Date proximity
        const expectedDate = new Date(ingreso.fecha_prevista_cobro);
        const movementDate = new Date(movement.fecha);
        const daysDiff = Math.abs((movementDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 1) {
          confidence += 25;
          reasons.push('Fecha exacta');
        } else if (daysDiff <= 7) {
          confidence += 15;
          reasons.push('Fecha próxima');
        } else if (daysDiff <= 30) {
          confidence += 5;
          reasons.push('Fecha del mes');
        }

        // Description matching (if available)
        if (movement.description && ingreso.contraparte) {
          const descLower = movement.description.toLowerCase();
          const providerLower = ingreso.contraparte.toLowerCase();
          
          if (descLower.includes(providerLower) || providerLower.includes(descLower)) {
            confidence += 20;
            reasons.push('Coincidencia en descripción');
          }
        }

        // Only include if minimum confidence threshold is met
        if (confidence >= 20) {
          potentialMovements.push({
            movement,
            confidence,
            reason: reasons.join(', ')
          });
        }
      }

      // Sort by confidence and only include if we have matches
      if (potentialMovements.length > 0) {
        potentialMovements.sort((a, b) => b.confidence - a.confidence);
        matches.push({
          ingreso,
          potentialMovements: potentialMovements.slice(0, 3) // Top 3 matches
        });
      }
    }

    return matches;
  } catch (error) {
    console.error('Error finding income reconciliation matches:', error);
    return [];
  }
};

/**
 * Automatically reconcile high-confidence matches
 */
export const autoReconcileIncome = async (): Promise<{
  reconciled: number;
  skipped: number;
}> => {
  const matches = await findIncomeReconciliationMatches();
  let reconciled = 0;
  let skipped = 0;

  for (const match of matches) {
    const bestMatch = match.potentialMovements[0];
    
    // Only auto-reconcile very high confidence matches
    if (bestMatch && bestMatch.confidence >= 80) {
      try {
        await updateIncomeReconciliationStatus(match.ingreso.id!, bestMatch.movement.id);
        reconciled++;
      } catch (error) {
        console.error('Error auto-reconciling income:', error);
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  return { reconciled, skipped };
};