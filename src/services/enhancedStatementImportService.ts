/**
 * ATLAS HORIZON - Enhanced Statement Import Service
 * 
 * Implements the unified import flow per problem statement:
 * 1. Detect account by IBAN from file
 * 2. Parse using bank profiles (Santander .xls support)
 * 3. Match with existing planned movements
 * 4. Create movements with proper status
 * 5. Never create demo data
 */

import { BankStatementParser } from './bankStatementParser';
import { matchMovementToBudget } from './budgetMatchingService';
import { initDB, Account, Movement, UnifiedMovementStatus } from './db';
import { safeMatch } from '../utils/safe';

interface ImportPreview {
  detectedAccountId?: number;
  detectedAccount?: Account;
  detectedIban?: string;
  totalMovements: number;
  confirmedMovements: number;
  unplannedMovements: number;
  transferMovements: number;
  errors: string[];
  warnings: string[];
}

interface ImportResult {
  success: boolean;
  imported: number;
  confirmed: number;
  unplanned: number;
  transfers: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
  batchId: string;
}

interface MovementToCreate {
  accountId: number;
  date: string;
  valueDate?: string;
  amount: number;
  description: string;
  counterparty?: string;
  reference?: string;
  unifiedStatus: UnifiedMovementStatus;
  source: 'import';
  category: {
    tipo: string;
    subtipo?: string;
  };
  isTransfer?: boolean;
  transferGroupId?: string;
}

export class EnhancedStatementImportService {
  private static instance: EnhancedStatementImportService;

  static getInstance(): EnhancedStatementImportService {
    if (!this.instance) {
      this.instance = new EnhancedStatementImportService();
    }
    return this.instance;
  }

  /**
   * Preview import - analyze file and detect account without creating movements
   */
  async previewImport(file: File): Promise<ImportPreview> {
    const result: ImportPreview = {
      totalMovements: 0,
      confirmedMovements: 0,
      unplannedMovements: 0,
      transferMovements: 0,
      errors: [],
      warnings: []
    };

    try {
      // Parse the file
      const parser = BankStatementParser.getInstance();
      const parseResult = await parser.parseFile(file);

      if (!parseResult.success || !parseResult.movements) {
        result.errors.push(parseResult.error || 'Failed to parse file');
        return result;
      }

      result.totalMovements = parseResult.movements.length;

      // Try to detect account by IBAN
      if (parseResult.detectedIban) {
        const account = await this.findAccountByIban(parseResult.detectedIban);
        if (account) {
          result.detectedAccountId = account.id;
          result.detectedAccount = account;
          result.detectedIban = parseResult.detectedIban;
        } else {
          result.warnings.push(`IBAN ${parseResult.detectedIban} not found in accounts`);
        }
      } else {
        result.warnings.push('No IBAN detected in file - manual account selection required');
      }

      // Analyze movements for matching potential
      for (const movement of parseResult.movements) {
        // Check if it's a transfer
        if (this.isTransferMovement(movement.description)) {
          result.transferMovements++;
        } else {
          // For now, assume all non-transfers are unplanned
          // In real implementation, we'd check against budget
          result.unplannedMovements++;
        }
      }

      // Validate for demo indicators
      const demoMovements = parseResult.movements.filter(mov => 
        this.isDemoMovement(mov.description, mov.amount)
      );
      
      if (demoMovements.length > 0) {
        result.warnings.push(`${demoMovements.length} potential demo movements detected - review before import`);
      }

    } catch (error) {
      result.errors.push(`Preview failed: ${error}`);
    }

    return result;
  }

  /**
   * Process full import with movement creation
   */
  async processImport(file: File, targetAccountId: number): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      confirmed: 0,
      unplanned: 0,
      transfers: 0,
      duplicates: 0,
      errors: 0,
      errorDetails: [],
      batchId: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    try {
      // Validate account exists
      const db = await initDB();
      const account = await db.get('accounts', targetAccountId);
      if (!account || !account.isActive) {
        throw new Error('Target account not found or inactive');
      }

      // Parse file
      const parser = BankStatementParser.getInstance();
      const parseResult = await parser.parseFile(file);

      if (!parseResult.success || !parseResult.movements) {
        throw new Error(parseResult.error || 'Failed to parse file');
      }

      // Process each movement
      const movementsToCreate: MovementToCreate[] = [];
      const transferGroups = new Map<string, MovementToCreate[]>();

      for (const parsedMovement of parseResult.movements) {
        try {
          // Skip demo movements
          if (this.isDemoMovement(parsedMovement.description, parsedMovement.amount)) {
            console.warn(`Skipping demo movement: ${parsedMovement.description}`);
            continue;
          }

          // Check for duplicates
          const existingMovement = await this.findDuplicateMovement(
            targetAccountId,
            parsedMovement.date,
            parsedMovement.amount,
            parsedMovement.description
          );

          if (existingMovement) {
            result.duplicates++;
            continue;
          }

          // Determine movement type and status
          const movementToCreate: MovementToCreate = {
            accountId: targetAccountId,
            date: parsedMovement.date,
            valueDate: parsedMovement.date, // Use same date if no value date
            amount: parsedMovement.amount,
            description: parsedMovement.description,
            counterparty: this.extractCounterparty(parsedMovement.description),
            reference: result.batchId,
            unifiedStatus: 'no_planificado', // Default status
            source: 'import',
            category: this.categorizeMovement(parsedMovement.description, parsedMovement.amount)
          };

          // Check if it's a transfer
          if (this.isTransferMovement(parsedMovement.description)) {
            movementToCreate.isTransfer = true;
            movementToCreate.unifiedStatus = 'confirmado'; // Transfers are automatically confirmed
            
            // Group transfers for potential pairing
            const transferId = this.generateTransferGroupId(parsedMovement);
            movementToCreate.transferGroupId = transferId;
            
            if (!transferGroups.has(transferId)) {
              transferGroups.set(transferId, []);
            }
            transferGroups.get(transferId)!.push(movementToCreate);
            
            result.transfers++;
          } else {
            // Try to match with budget
            const tempMovement: Partial<Movement> = {
              accountId: targetAccountId,
              date: parsedMovement.date,
              amount: parsedMovement.amount,
              description: parsedMovement.description,
              counterparty: movementToCreate.counterparty,
              category: movementToCreate.category
            };

            try {
              const matchResult = await matchMovementToBudget(tempMovement as Movement);
              if (matchResult.candidate && matchResult.confidence > 70) {
                movementToCreate.unifiedStatus = 'confirmado';
                result.confirmed++;
              } else {
                result.unplanned++;
              }
            } catch (matchError) {
              console.warn('Budget matching failed:', matchError);
              result.unplanned++;
            }
          }

          movementsToCreate.push(movementToCreate);

        } catch (movementError) {
          result.errors++;
          result.errorDetails.push(`Movement ${parsedMovement.description}: ${movementError}`);
        }
      }

      // Create movements in database
      for (const movement of movementsToCreate) {
        try {
          const movementRecord: Omit<Movement, 'id'> = {
            accountId: movement.accountId,
            date: movement.date,
            valueDate: movement.valueDate,
            amount: movement.amount,
            description: movement.description,
            counterparty: movement.counterparty,
            reference: movement.reference,
            status: 'pendiente',
            unifiedStatus: movement.unifiedStatus,
            source: movement.source,
            category: movement.category,
            is_transfer: movement.isTransfer,
            transfer_group_id: movement.transferGroupId,
            importBatch: result.batchId,
            type: movement.amount > 0 ? 'Ingreso' : 'Gasto',
            origin: 'CSV',
            movementState: movement.unifiedStatus === 'confirmado' ? 'Confirmado' : 'Previsto',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await db.add('movements', movementRecord);
          result.imported++;

        } catch (createError) {
          result.errors++;
          result.errorDetails.push(`Failed to create movement: ${createError}`);
        }
      }

      result.success = result.imported > 0;

    } catch (error) {
      result.errorDetails.push(`Import failed: ${error}`);
    }

    return result;
  }

  /**
   * Find account by IBAN
   */
  private async findAccountByIban(iban: string): Promise<Account | null> {
    try {
      const db = await initDB();
      const accounts = await db.getAll('accounts');
      const normalizedIban = iban.replace(/[\s-]/g, '').toUpperCase();
      
      return accounts.find(acc => 
        acc.iban?.replace(/[\s-]/g, '').toUpperCase() === normalizedIban &&
        acc.isActive &&
        !acc.deleted_at
      ) || null;
    } catch (error) {
      console.error('Error finding account by IBAN:', error);
      return null;
    }
  }

  /**
   * Check for duplicate movements
   */
  private async findDuplicateMovement(
    accountId: number,
    date: string,
    amount: number,
    description: string
  ): Promise<Movement | null> {
    try {
      const db = await initDB();
      const movements = await db.getAll('movements');
      
      return movements.find(mov =>
        mov.accountId === accountId &&
        mov.date === date &&
        Math.abs(mov.amount - amount) < 0.01 &&
        mov.description === description
      ) || null;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return null;
    }
  }

  /**
   * Check if movement is a demo/test movement
   */
  private isDemoMovement(description: string, amount: number): boolean {
    const desc = description.toLowerCase();
    const demoKeywords = [
      'demo', 'test', 'sample', 'ejemplo', 'prueba',
      'ficticio', 'simulado', 'plantilla', 'atlas',
      'horizon', 'treasury', 'tesoreria'
    ];

    return demoKeywords.some(keyword => desc.includes(keyword));
  }

  /**
   * Check if movement is a transfer
   */
  private isTransferMovement(description: string): boolean {
    const desc = description.toLowerCase();
    const transferKeywords = [
      'traspaso', 'transferencia', 'transfer', 'envío',
      'envio', 'entre cuentas', 'trf', 'tsf'
    ];

    return transferKeywords.some(keyword => desc.includes(keyword));
  }

  /**
   * Extract counterparty from description
   */
  private extractCounterparty(description: string): string | undefined {
    // Simple extraction - look for patterns like "A: COUNTERPARTY"
    const patterns = [
      /(?:A|DE|PARA|FROM|TO):\s*([^,\n]+)/i,
      /(?:BENEFICIARIO|ORDENANTE):\s*([^,\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = safeMatch(description, pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Categorize movement based on description and amount
   */
  private categorizeMovement(description: string, amount: number): { tipo: string; subtipo?: string } {
    const desc = description.toLowerCase();

    // Basic categorization rules
    if (amount > 0) {
      return { tipo: 'Ingresos', subtipo: 'Transferencias' };
    }

    // Expense categorization
    if (desc.includes('nomina') || desc.includes('salary')) {
      return { tipo: 'Gastos', subtipo: 'Nóminas' };
    }
    
    if (desc.includes('suministro') || desc.includes('luz') || desc.includes('gas')) {
      return { tipo: 'Gastos', subtipo: 'Suministros' };
    }
    
    if (desc.includes('alquiler') || desc.includes('rent')) {
      return { tipo: 'Gastos', subtipo: 'Alquileres' };
    }

    return { tipo: 'Gastos', subtipo: 'Otros' };
  }

  /**
   * Generate transfer group ID for pairing
   */
  private generateTransferGroupId(movement: any): string {
    // Use amount and date to group transfers
    const amount = Math.abs(movement.amount);
    const date = movement.date.split('T')[0]; // Get date part only
    return `transfer_${date}_${amount}`.replace(/[.-]/g, '_');
  }
}

// Export singleton instance
export const enhancedStatementImportService = EnhancedStatementImportService.getInstance();