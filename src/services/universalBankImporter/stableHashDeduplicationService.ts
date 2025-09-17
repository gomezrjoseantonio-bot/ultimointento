/**
 * Stable Hash-based Deduplication Service
 * Implements idempotent deduplication with stable hash generation
 */

export interface MovementForDeduplication {
  accountId: number;
  date: string; // ISO date format
  amount: number;
  description: string;
  reference?: string;
  counterparty?: string;
}

export interface DeduplicationResult {
  originalCount: number;
  uniqueCount: number;
  duplicateCount: number;
  uniqueMovements: MovementForDeduplication[];
  duplicateHashes: string[];
  processingTimeMs: number;
}

export interface HashComponents {
  accountId: string;
  dateISO: string;
  importeSigned: string;
  descripcionNormalizada: string;
  refOpcional: string;
}

export class StableHashDeduplicationService {
  
  private static readonly HASH_SEPARATOR = '|';
  
  /**
   * Generate stable hash for movement deduplication
   */
  generateMovementHash(movement: MovementForDeduplication): string {
    const components = this.extractHashComponents(movement);
    const hashInput = [
      components.accountId,
      components.dateISO,
      components.importeSigned,
      components.descripcionNormalizada,
      components.refOpcional
    ].join(StableHashDeduplicationService.HASH_SEPARATOR);
    
    return this.computeHash(hashInput);
  }

  /**
   * Extract and normalize hash components
   */
  private extractHashComponents(movement: MovementForDeduplication): HashComponents {
    return {
      accountId: movement.accountId.toString(),
      dateISO: this.normalizeDateISO(movement.date),
      importeSigned: this.normalizeAmount(movement.amount),
      descripcionNormalizada: this.normalizeDescription(movement.description),
      refOpcional: this.normalizeReference(movement.reference)
    };
  }

  /**
   * Normalize date to ISO format (YYYY-MM-DD)
   */
  private normalizeDateISO(date: string): string {
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date');
      }
      return dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch (error) {
      // Fallback: try to parse common formats
      return this.parseCommonDateFormats(date);
    }
  }

  /**
   * Parse common date formats and convert to ISO
   */
  private parseCommonDateFormats(dateStr: string): string {
    const cleaned = dateStr.trim();
    
    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // YYYY/MM/DD or YYYY-MM-DD
    const yyyymmdd = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (yyyymmdd) {
      const [, year, month, day] = yyyymmdd;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Fallback: return as-is and hope for the best
    return cleaned;
  }

  /**
   * Normalize amount to fixed precision string
   */
  private normalizeAmount(amount: number): string {
    // Round to 2 decimal places and format consistently
    const rounded = Math.round(amount * 100) / 100;
    return rounded.toFixed(2);
  }

  /**
   * Normalize description for consistent comparison
   */
  private normalizeDescription(description: string): string {
    return description
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/[áàâäã]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôöõ]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/ç/g, 'c')
      .replace(/[^\w\s]/g, ''); // Remove special characters except spaces
  }

  /**
   * Normalize reference (optional field)
   */
  private normalizeReference(reference?: string): string {
    if (!reference) {
      return '';
    }
    
    return reference
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ''); // Remove all spaces
  }

  /**
   * Compute SHA-1 hash (for browser compatibility)
   */
  private async computeHash(input: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Modern browser with Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await window.crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback to simple hash for testing environments
      return this.simpleHash(input);
    }
  }

  /**
   * Simple hash function for environments without crypto API
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Synchronous version for testing
   */
  generateMovementHashSync(movement: MovementForDeduplication): string {
    const components = this.extractHashComponents(movement);
    const hashInput = [
      components.accountId,
      components.dateISO,
      components.importeSigned,
      components.descripcionNormalizada,
      components.refOpcional
    ].join(StableHashDeduplicationService.HASH_SEPARATOR);
    
    return this.simpleHash(hashInput);
  }

  /**
   * Deduplicate array of movements
   */
  async deduplicateMovements(movements: MovementForDeduplication[]): Promise<DeduplicationResult> {
    const startTime = performance.now();
    
    const seenHashes = new Set<string>();
    const duplicateHashes: string[] = [];
    const uniqueMovements: MovementForDeduplication[] = [];

    for (const movement of movements) {
      const hash = await this.generateMovementHash(movement);
      
      if (seenHashes.has(hash)) {
        duplicateHashes.push(hash);
      } else {
        seenHashes.add(hash);
        uniqueMovements.push(movement);
      }
    }

    const endTime = performance.now();

    return {
      originalCount: movements.length,
      uniqueCount: uniqueMovements.length,
      duplicateCount: duplicateHashes.length,
      uniqueMovements,
      duplicateHashes,
      processingTimeMs: endTime - startTime
    };
  }

  /**
   * Synchronous deduplication for testing
   */
  deduplicateMovementsSync(movements: MovementForDeduplication[]): DeduplicationResult {
    const startTime = performance.now();
    
    const seenHashes = new Set<string>();
    const duplicateHashes: string[] = [];
    const uniqueMovements: MovementForDeduplication[] = [];

    for (const movement of movements) {
      const hash = this.generateMovementHashSync(movement);
      
      if (seenHashes.has(hash)) {
        duplicateHashes.push(hash);
      } else {
        seenHashes.add(hash);
        uniqueMovements.push(movement);
      }
    }

    const endTime = performance.now();

    return {
      originalCount: movements.length,
      uniqueCount: uniqueMovements.length,
      duplicateCount: duplicateHashes.length,
      uniqueMovements,
      duplicateHashes,
      processingTimeMs: endTime - startTime
    };
  }

  /**
   * Check if movement is duplicate against existing hashes
   */
  async isDuplicate(
    movement: MovementForDeduplication, 
    existingHashes: Set<string>
  ): Promise<boolean> {
    const hash = await this.generateMovementHash(movement);
    return existingHashes.has(hash);
  }

  /**
   * Validate hash components for debugging
   */
  validateHashComponents(movement: MovementForDeduplication): {
    isValid: boolean;
    issues: string[];
    components: HashComponents;
  } {
    const components = this.extractHashComponents(movement);
    const issues: string[] = [];

    // Validate account ID
    if (!components.accountId || components.accountId === '0') {
      issues.push('Invalid or missing account ID');
    }

    // Validate date
    if (!components.dateISO || !components.dateISO.match(/^\d{4}-\d{2}-\d{2}$/)) {
      issues.push('Invalid date format (expected YYYY-MM-DD)');
    }

    // Validate amount
    if (!components.importeSigned || isNaN(parseFloat(components.importeSigned))) {
      issues.push('Invalid amount format');
    }

    // Validate description
    if (!components.descripcionNormalizada || components.descripcionNormalizada.length < 3) {
      issues.push('Description too short or missing');
    }

    return {
      isValid: issues.length === 0,
      issues,
      components
    };
  }

  /**
   * Generate hash breakdown for debugging
   */
  getHashBreakdown(movement: MovementForDeduplication): {
    rawComponents: any;
    normalizedComponents: HashComponents;
    hashInput: string;
    finalHash: string;
  } {
    const normalizedComponents = this.extractHashComponents(movement);
    const hashInput = [
      normalizedComponents.accountId,
      normalizedComponents.dateISO,
      normalizedComponents.importeSigned,
      normalizedComponents.descripcionNormalizada,
      normalizedComponents.refOpcional
    ].join(StableHashDeduplicationService.HASH_SEPARATOR);
    
    return {
      rawComponents: {
        accountId: movement.accountId,
        date: movement.date,
        amount: movement.amount,
        description: movement.description,
        reference: movement.reference
      },
      normalizedComponents,
      hashInput,
      finalHash: this.simpleHash(hashInput)
    };
  }
}

export const stableHashDeduplicationService = new StableHashDeduplicationService();