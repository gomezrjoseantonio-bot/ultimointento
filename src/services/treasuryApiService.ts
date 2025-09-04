/**
 * Treasury API Service
 * 
 * Provides API-like interface for treasury operations using IndexedDB
 * Implements the endpoints required by the problem statement:
 * - POST /api/treasury/accounts → crea y devuelve cuenta
 * - GET /api/treasury/accounts → lista
 * - PUT /api/treasury/accounts/:id → edita
 * - POST /api/treasury/import → importa movimientos
 */

import { initDB, Account, Movement, ImportBatch } from './db';
import { parseCSV } from './csvParserService';
import { performAutoReconciliation } from './treasuryCreationService';
import { emitTreasuryEvent } from './treasuryEventsService';

// IBAN validation regex (simplified European format)
const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/;

/**
 * Validates IBAN format
 */
export function validateIBAN(iban: string): boolean {
  if (!iban) return true; // IBAN is optional
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  return IBAN_REGEX.test(cleanIban);
}

/**
 * Converts European decimal format (1.234,56) to number (1234.56)
 */
export function parseEuropeanNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Handle European format: "1.234,56" -> 1234.56
  const cleanValue = value.toString()
    .replace(/\./g, '') // Remove thousand separators
    .replace(/,/g, '.'); // Replace decimal comma with dot
  
  return parseFloat(cleanValue) || 0;
}

/**
 * Treasury Accounts API
 */
export class TreasuryAccountsAPI {
  /**
   * GET /api/treasury/accounts
   */
  static async getAccounts(): Promise<Account[]> {
    const db = await initDB();
    const allAccounts = await db.getAll('accounts');
    return allAccounts.filter(acc => acc.isActive);
  }

  /**
   * POST /api/treasury/accounts
   */
  static async createAccount(accountData: {
    alias: string;
    bank: string;
    iban?: string;
    includeInConsolidated?: boolean;
    openingBalance: number;
    openingBalanceDate?: string;
  }): Promise<Account> {
    // Validate IBAN if provided
    if (accountData.iban && !validateIBAN(accountData.iban)) {
      throw new Error('Formato de IBAN inválido');
    }

    // Validate required fields
    if (!accountData.alias || !accountData.bank) {
      throw new Error('Alias y banco son campos obligatorios');
    }

    const db = await initDB();
    const now = new Date().toISOString();
    
    const newAccount: Account = {
      name: accountData.alias, // Using name field as alias
      bank: accountData.bank,
      iban: accountData.iban?.replace(/\s/g, '').toUpperCase(),
      destination: 'horizon', // Default to horizon
      balance: accountData.openingBalance,
      openingBalance: accountData.openingBalance,
      openingBalanceDate: accountData.openingBalanceDate || now,
      includeInConsolidated: accountData.includeInConsolidated ?? true,
      currency: 'EUR',
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    const accountId = await db.add('accounts', newAccount);
    return { ...newAccount, id: accountId as number };
  }

  /**
   * PUT /api/treasury/accounts/:id
   */
  static async updateAccount(id: number, accountData: Partial<{
    alias: string;
    bank: string;
    iban?: string;
    includeInConsolidated?: boolean;
    openingBalance: number;
    openingBalanceDate?: string;
  }>): Promise<Account> {
    const db = await initDB();
    
    // Get existing account
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    // Validate IBAN if provided
    if (accountData.iban && !validateIBAN(accountData.iban)) {
      throw new Error('Formato de IBAN inválido');
    }

    const updatedAccount: Account = {
      ...existingAccount,
      ...(accountData.alias && { name: accountData.alias }),
      ...(accountData.bank && { bank: accountData.bank }),
      ...(accountData.iban !== undefined && { iban: accountData.iban?.replace(/\s/g, '').toUpperCase() }),
      ...(accountData.includeInConsolidated !== undefined && { includeInConsolidated: accountData.includeInConsolidated }),
      ...(accountData.openingBalance !== undefined && { openingBalance: accountData.openingBalance }),
      ...(accountData.openingBalanceDate && { openingBalanceDate: accountData.openingBalanceDate }),
      updatedAt: new Date().toISOString()
    };

    await db.put('accounts', updatedAccount);
    return updatedAccount;
  }
}

/**
 * Treasury Import API
 */
export class TreasuryImportAPI {
  /**
   * POST /api/treasury/import
   */
  static async importTransactions(
    file: File,
    accountId: number,
    skipDuplicates: boolean = true
  ): Promise<{
    inserted: number;
    duplicates: number;
    failed: number;
    reconciled?: number;
    pendingReview?: number;
  }> {
    const db = await initDB();
    
    // Verify account exists
    const account = await db.get('accounts', accountId);
    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    // Parse CSV/Excel file
    const fileContent = await file.text();
    const parseResult = await parseCSV(fileContent);
    
    if (!parseResult.movements || parseResult.movements.length === 0) {
      throw new Error('No se pudieron procesar movimientos del archivo');
    }

    const results = {
      inserted: 0,
      duplicates: 0,
      failed: 0,
      reconciled: 0,
      pendingReview: 0
    };

    const now = new Date().toISOString();
    const importBatchId = `import_${Date.now()}_${accountId}`;

    // Create import batch record
    const importBatch: ImportBatch = {
      id: importBatchId,
      filename: file.name,
      accountId,
      totalRows: parseResult.totalRows || parseResult.movements.length,
      importedRows: 0,
      skippedRows: 0,
      duplicatedRows: 0,
      createdAt: now
    };

    // Get existing movements for duplicate detection
    const existingMovements = await db.getAll('movements');
    const accountMovements = existingMovements.filter(m => m.accountId === accountId);

    for (const parsedMovement of parseResult.movements) {
      try {
        // Check for duplicates using (accountId, date, amount, description) hash
        const movementDate = parsedMovement.date instanceof Date ? 
          parsedMovement.date.toISOString().split('T')[0] : 
          parsedMovement.date;
          
        const isDuplicate = accountMovements.some(existing => 
          existing.accountId === accountId &&
          existing.date === movementDate &&
          Math.abs(existing.amount - parseEuropeanNumber(parsedMovement.amount)) < 0.01 &&
          existing.description === parsedMovement.description
        );

        if (isDuplicate && skipDuplicates) {
          results.duplicates++;
          importBatch.duplicatedRows++;
          continue;
        }

        // Convert to Movement format
        const movement: Movement = {
          accountId,
          date: parsedMovement.date instanceof Date ? parsedMovement.date.toISOString().split('T')[0] : parsedMovement.date,
          valueDate: parsedMovement.valueDate ? 
            (parsedMovement.valueDate instanceof Date ? parsedMovement.valueDate.toISOString().split('T')[0] : parsedMovement.valueDate) :
            (parsedMovement.date instanceof Date ? parsedMovement.date.toISOString().split('T')[0] : parsedMovement.date),
          amount: parseEuropeanNumber(parsedMovement.amount),
          description: parsedMovement.description,
          counterparty: parsedMovement.counterparty,
          reference: parsedMovement.reference,
          status: 'pendiente',
          state: 'pending', // treasury_transactions requirement
          sourceBank: parseResult.detectedBank?.bankKey || 'generic',
          currency: 'EUR',
          balance: parseEuropeanNumber(parsedMovement.balance || 0),
          rawRow: parsedMovement, // Store original parsed data
          importBatch: importBatchId,
          createdAt: now,
          updatedAt: now
        };

        await db.add('movements', movement);
        results.inserted++;
        importBatch.importedRows++;

        // Emit domain event for movement creation
        await emitTreasuryEvent({
          type: 'MOVEMENT_CREATED',
          payload: { movement: { ...movement, id: Date.now() + results.inserted } }
        });

      } catch (error) {
        console.error('Error importing movement:', error);
        results.failed++;
        importBatch.skippedRows++;
      }
    }

    // Save import batch
    await db.add('importBatches', importBatch);

    // Perform auto-reconciliation if we have new movements
    if (results.inserted > 0) {
      try {
        const reconciliationResult = await performAutoReconciliation();
        results.reconciled = reconciliationResult.reconciled;
        
        // Count pending reviews (movements that need manual review)
        const allMovements = await db.getAll('movements');
        const recentMovements = allMovements.filter(m => 
          m.importBatch === importBatchId && 
          m.state === 'pending'
        );
        results.pendingReview = recentMovements.length;
      } catch (error) {
        console.error('Auto-reconciliation failed:', error);
        // Don't fail the import if reconciliation fails
      }
    }

    return results;
  }
}

/**
 * Main Treasury API interface
 */
export const treasuryAPI = {
  accounts: TreasuryAccountsAPI,
  import: TreasuryImportAPI
};