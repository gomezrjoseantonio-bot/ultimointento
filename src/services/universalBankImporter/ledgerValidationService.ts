/**
 * Ledger Validation and Balance Reconstruction Service
 * Validates balance consistency and reconstructs missing balances
 */

export interface LedgerValidationResult {
  isConsistent: boolean;
  inconsistentRows: number[];
  tolerance: number;
  totalInconsistencies: number;
  reconstructedBalances?: number[];
  recommendation: 'accept' | 'reconstruct' | 'manual_review';
}

export interface MovementWithBalance {
  date: Date;
  amount: number;
  balance?: number;
  description: string;
  rowIndex: number;
}

export interface LedgerSummary {
  openingBalance?: number;
  closingBalance?: number;
  totalInflows: number;
  totalOutflows: number;
  netMovement: number;
  periodStart: Date;
  periodEnd: Date;
  movementCount: number;
}

export class LedgerValidationService {
  
  /**
   * Validate ledger consistency (balance progression)
   */
  validateLedger(
    movements: MovementWithBalance[],
    tolerance: number = 0.01
  ): LedgerValidationResult {
    
    if (movements.length === 0) {
      return {
        isConsistent: true,
        inconsistentRows: [],
        tolerance,
        totalInconsistencies: 0,
        recommendation: 'accept'
      };
    }

    // Sort by date to ensure proper order
    const sortedMovements = [...movements].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    const inconsistentRows: number[] = [];
    let totalInconsistencies = 0;

    // Check each movement against the previous balance
    for (let i = 1; i < sortedMovements.length; i++) {
      const current = sortedMovements[i];
      const previous = sortedMovements[i - 1];

      // Skip if either movement lacks balance
      if (current.balance === undefined || previous.balance === undefined) {
        continue;
      }

      const expectedBalance = previous.balance + current.amount;
      const actualBalance = current.balance;
      const difference = Math.abs(actualBalance - expectedBalance);

      if (difference > tolerance) {
        inconsistentRows.push(current.rowIndex);
        totalInconsistencies++;
      }
    }

    const inconsistencyRate = totalInconsistencies / Math.max(sortedMovements.length - 1, 1);
    
    // Determine recommendation
    let recommendation: 'accept' | 'reconstruct' | 'manual_review';
    if (inconsistencyRate === 0) {
      recommendation = 'accept';
    } else if (inconsistencyRate > 0.2) { // More than 20% inconsistent
      recommendation = 'reconstruct';
    } else {
      recommendation = 'manual_review';
    }

    return {
      isConsistent: totalInconsistencies === 0,
      inconsistentRows,
      tolerance,
      totalInconsistencies,
      recommendation
    };
  }

  /**
   * Reconstruct balances from movements
   */
  reconstructBalances(
    movements: MovementWithBalance[],
    openingBalance?: number
  ): number[] {
    
    if (movements.length === 0) {
      return [];
    }

    // Sort by date
    const sortedMovements = [...movements].sort((a, b) => a.date.getTime() - b.date.getTime());
    const reconstructed: number[] = new Array(movements.length);

    // Determine starting balance
    let runningBalance: number;
    
    if (openingBalance !== undefined) {
      // Use provided opening balance
      runningBalance = openingBalance;
    } else {
      // Try to infer from first movement with balance
      const firstWithBalance = sortedMovements.find(m => m.balance !== undefined);
      if (firstWithBalance) {
        runningBalance = firstWithBalance.balance! - firstWithBalance.amount;
      } else {
        // Start from zero if no balance information available
        runningBalance = 0;
      }
    }

    // Reconstruct each balance
    for (let i = 0; i < sortedMovements.length; i++) {
      runningBalance += sortedMovements[i].amount;
      reconstructed[i] = Math.round(runningBalance * 100) / 100; // Round to 2 decimals
    }

    return reconstructed;
  }

  /**
   * Calculate ledger summary for a period
   */
  calculateLedgerSummary(
    movements: MovementWithBalance[],
    openingBalance?: number
  ): LedgerSummary {
    
    if (movements.length === 0) {
      const now = new Date();
      return {
        totalInflows: 0,
        totalOutflows: 0,
        netMovement: 0,
        periodStart: now,
        periodEnd: now,
        movementCount: 0
      };
    }

    // Sort by date
    const sortedMovements = [...movements].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let totalInflows = 0;
    let totalOutflows = 0;

    // Calculate inflows and outflows
    for (const movement of sortedMovements) {
      if (movement.amount > 0) {
        totalInflows += movement.amount;
      } else {
        totalOutflows += Math.abs(movement.amount);
      }
    }

    const netMovement = totalInflows - totalOutflows;
    
    // Determine balances
    const firstMovement = sortedMovements[0];
    const lastMovement = sortedMovements[sortedMovements.length - 1];
    
    let calculatedOpeningBalance = openingBalance;
    let calculatedClosingBalance: number | undefined;

    if (lastMovement.balance !== undefined) {
      calculatedClosingBalance = lastMovement.balance;
      
      // If no opening balance provided, calculate it
      if (calculatedOpeningBalance === undefined && firstMovement.balance !== undefined) {
        calculatedOpeningBalance = firstMovement.balance - firstMovement.amount;
      }
    } else if (calculatedOpeningBalance !== undefined) {
      // Calculate closing balance from opening + net movement
      calculatedClosingBalance = calculatedOpeningBalance + netMovement;
    }

    return {
      openingBalance: calculatedOpeningBalance,
      closingBalance: calculatedClosingBalance,
      totalInflows: Math.round(totalInflows * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      netMovement: Math.round(netMovement * 100) / 100,
      periodStart: firstMovement.date,
      periodEnd: lastMovement.date,
      movementCount: movements.length
    };
  }

  /**
   * Validate ledger summary (opening + net = closing)
   */
  validateLedgerSummary(
    summary: LedgerSummary,
    tolerance: number = 0.01
  ): { isValid: boolean; error?: string } {
    
    if (summary.openingBalance === undefined || summary.closingBalance === undefined) {
      return { isValid: true }; // Cannot validate without both balances
    }

    const expectedClosing = summary.openingBalance + summary.netMovement;
    const actualClosing = summary.closingBalance;
    const difference = Math.abs(actualClosing - expectedClosing);

    if (difference <= tolerance) {
      return { isValid: true };
    }

    return {
      isValid: false,
      error: `Balance mismatch: Expected ${expectedClosing.toFixed(2)}, got ${actualClosing.toFixed(2)} (diff: ${difference.toFixed(2)})`
    };
  }

  /**
   * Detect and fix common ledger issues
   */
  detectLedgerIssues(movements: MovementWithBalance[]): {
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (movements.length === 0) {
      return { issues, suggestions };
    }

    // Check for duplicate dates with different amounts
    const dateGroups = new Map<string, MovementWithBalance[]>();
    for (const movement of movements) {
      const dateKey = movement.date.toDateString();
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)!.push(movement);
    }

    for (const [date, dayMovements] of dateGroups) {
      if (dayMovements.length > 10) {
        issues.push(`High activity on ${date}: ${dayMovements.length} movements`);
        suggestions.push('Review for potential duplicates or batch processing');
      }
    }

    // Check for unrealistic amounts
    for (const movement of movements) {
      if (Math.abs(movement.amount) > 100000) {
        issues.push(`Large amount detected: ${movement.amount.toFixed(2)} on ${movement.date.toDateString()}`);
        suggestions.push('Verify large transactions for accuracy');
      }
    }

    // Check for proper date ordering
    const sortedMovements = [...movements].sort((a, b) => a.date.getTime() - b.date.getTime());
    let outOfOrderCount = 0;
    for (let i = 0; i < movements.length; i++) {
      if (movements[i] !== sortedMovements[i]) {
        outOfOrderCount++;
      }
    }

    if (outOfOrderCount > 0) {
      issues.push(`${outOfOrderCount} movements are out of chronological order`);
      suggestions.push('Sort movements by date for proper balance progression');
    }

    return { issues, suggestions };
  }

  /**
   * Generate monthly summaries
   */
  generateMonthlySummaries(movements: MovementWithBalance[]): {
    [monthKey: string]: LedgerSummary;
  } {
    if (movements.length === 0) {
      return {};
    }

    // Group movements by month
    const monthlyGroups = new Map<string, MovementWithBalance[]>();
    
    for (const movement of movements) {
      const monthKey = `${movement.date.getFullYear()}-${String(movement.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, []);
      }
      monthlyGroups.get(monthKey)!.push(movement);
    }

    // Calculate summary for each month
    const summaries: { [monthKey: string]: LedgerSummary } = {};
    let previousClosingBalance: number | undefined;

    const sortedMonths = Array.from(monthlyGroups.keys()).sort();
    
    for (const monthKey of sortedMonths) {
      const monthMovements = monthlyGroups.get(monthKey)!;
      const summary = this.calculateLedgerSummary(monthMovements, previousClosingBalance);
      summaries[monthKey] = summary;
      previousClosingBalance = summary.closingBalance;
    }

    return summaries;
  }
}

export const ledgerValidationService = new LedgerValidationService();