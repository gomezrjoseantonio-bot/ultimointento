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
import { performAutoReconciliation } from './treasuryCreationService';
import { emitTreasuryEvent } from './treasuryEventsService';

// IBAN validation regex (simplified European format)
const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/;

/**
 * Validates IBAN format
 */
export function validateIBAN(iban: string): boolean {
  if (!iban) return false; // IBAN is now required
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
   * GET /api/treasury/accounts?include_inactive=true|false
   * FIX PACK v2.0: Support filtering by active/inactive state
   */
  static async getAccounts(include_inactive: boolean = false): Promise<Account[]> {
    const db = await initDB();
    const allAccounts = await db.getAll('accounts');
    
    // Never show deleted accounts (deleted_at is not null)
    const nonDeletedAccounts = allAccounts.filter(acc => !acc.deleted_at);
    
    if (include_inactive) {
      return nonDeletedAccounts; // Return both active and inactive
    } else {
      return nonDeletedAccounts.filter(acc => acc.isActive); // Only active
    }
  }

  /**
   * POST /api/treasury/accounts
   */
  static async createAccount(accountData: {
    alias?: string;
    bank: string;
    iban: string;
    includeInConsolidated?: boolean;
    openingBalance: number;
    openingBalanceDate?: string;
    usage_scope?: 'personal' | 'inmuebles' | 'mixto';
    logo_url?: string;
  }): Promise<Account> {
    // Validate IBAN - now required
    if (!validateIBAN(accountData.iban)) {
      throw new Error('Formato de IBAN inválido');
    }

    // Validate required fields - bank and IBAN are required
    if (!accountData.bank) {
      throw new Error('El banco es obligatorio');
    }

    if (!accountData.iban) {
      throw new Error('El IBAN es obligatorio');
    }

    const db = await initDB();
    const now = new Date().toISOString();
    
    const newAccount: Account = {
      name: accountData.alias, // Using name field as alias
      bank: accountData.bank,
      iban: accountData.iban.replace(/\s/g, '').toUpperCase(),
      destination: 'horizon', // Default to horizon
      balance: accountData.openingBalance,
      openingBalance: accountData.openingBalance,
      openingBalanceDate: accountData.openingBalanceDate || now,
      includeInConsolidated: accountData.includeInConsolidated ?? true,
      currency: 'EUR',
      isActive: true,
      usage_scope: accountData.usage_scope || 'mixto', // Default to 'mixto'
      logo_url: accountData.logo_url,
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
    alias?: string;
    bank: string;
    iban: string;
    includeInConsolidated?: boolean;
    openingBalance: number;
    openingBalanceDate?: string;
    usage_scope?: 'personal' | 'inmuebles' | 'mixto';
    logo_url?: string;
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
      ...(accountData.alias !== undefined && { name: accountData.alias }),
      ...(accountData.bank && { bank: accountData.bank }),
      ...(accountData.iban !== undefined && { iban: accountData.iban.replace(/\s/g, '').toUpperCase() }),
      ...(accountData.includeInConsolidated !== undefined && { includeInConsolidated: accountData.includeInConsolidated }),
      ...(accountData.openingBalance !== undefined && { openingBalance: accountData.openingBalance }),
      ...(accountData.openingBalanceDate && { openingBalanceDate: accountData.openingBalanceDate }),
      ...(accountData.usage_scope && { usage_scope: accountData.usage_scope }),
      ...(accountData.logo_url !== undefined && { logo_url: accountData.logo_url }),
      updatedAt: new Date().toISOString()
    };

    await db.put('accounts', updatedAccount);
    return updatedAccount;
  }

  /**
   * DELETE /api/treasury/accounts/:id
   * FIX PACK v2.0: Deactivates an account (is_active = false, deleted_at = NULL)
   */
  static async deactivateAccount(id: number): Promise<Account> {
    const db = await initDB();
    
    // Get existing account
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    if (!existingAccount.isActive) {
      throw new Error('La cuenta ya está desactivada');
    }

    // Check if account has movements to warn user
    const allMovements = await db.getAll('movements');
    const accountMovements = allMovements.filter(m => m.accountId === id);
    
    if (accountMovements.length > 0) {
      console.warn(`Account ${id} has ${accountMovements.length} movements. Deactivating but preserving data.`);
    }

    const deactivatedAccount: Account = {
      ...existingAccount,
      isActive: false,
      deleted_at: undefined, // Ensure deleted_at remains null for deactivation
      updatedAt: new Date().toISOString()
    };

    await db.put('accounts', deactivatedAccount);
    
    // Emit domain event for account deactivation
    try {
      await emitTreasuryEvent({
        type: 'ACCOUNT_CHANGED',
        payload: { account: deactivatedAccount, previousAccount: existingAccount }
      });
    } catch (error) {
      console.error('Error emitting account deactivation event:', error);
      // Don't fail the operation if event emission fails
    }

    return deactivatedAccount;
  }

  /**
   * PATCH /api/treasury/accounts/:id { is_active }
   * FIX PACK v2.0: Activates a previously deactivated account
   */
  static async activateAccount(id: number): Promise<Account> {
    const db = await initDB();
    
    // Get existing account
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    if (existingAccount.deleted_at) {
      throw new Error('No se puede activar una cuenta eliminada');
    }

    if (existingAccount.isActive) {
      throw new Error('La cuenta ya está activa');
    }

    const activatedAccount: Account = {
      ...existingAccount,
      isActive: true,
      updatedAt: new Date().toISOString()
    };

    await db.put('accounts', activatedAccount);
    
    // Emit domain event for account activation
    try {
      await emitTreasuryEvent({
        type: 'ACCOUNT_CHANGED',
        payload: { account: activatedAccount, previousAccount: existingAccount }
      });
    } catch (error) {
      console.error('Error emitting account activation event:', error);
      // Don't fail the operation if event emission fails
    }

    return activatedAccount;
  }

  /**
   * DELETE /api/treasury/accounts/:id (hard delete)
   * FIX PACK v2.0: Attempts hard delete, returns 409 if account has movements
   */
  static async deleteAccount(id: number): Promise<{ success: boolean; requiresWizard?: boolean; refs_summary?: any }> {
    const db = await initDB();
    
    // Get existing account
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    // Check for movements
    const allMovements = await db.getAll('movements');
    const accountMovements = allMovements.filter(m => m.accountId === id);
    
    if (accountMovements.length > 0) {
      // Return conflict status - requires wizard
      return {
        success: false,
        requiresWizard: true,
        refs_summary: {
          movements: accountMovements.length,
          // TODO: Add other reference types like automatization rules
        }
      };
    }

    // Safe to hard delete - no movements
    await db.delete('accounts', id);
    
    // Emit domain event for account deletion
    try {
      await emitTreasuryEvent({
        type: 'ACCOUNT_DELETED',
        payload: { accountId: id, account: existingAccount }
      });
    } catch (error) {
      console.error('Error emitting account deletion event:', error);
      // Don't fail the operation if event emission fails
    }

    return { success: true };
  }

  /**
   * DELETE /api/treasury/accounts/:id/cascade
   * ATLAS REQUIREMENT: Complete cascading delete for accounts
   * Deletes account and ALL related data (movements, rules, alerts, etc.)
   */
  static async cascadeDeleteAccount(id: number): Promise<{ success: boolean; deletedItems: any }> {
    const db = await initDB();
    
    // Get existing account
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    const deletedItems = {
      movements: 0,
      rules: 0,
      // Future: alerts, documents, etc.
    };

    try {
      // 1. Delete all movements associated with this account
      const allMovements = await db.getAll('movements');
      const accountMovements = allMovements.filter(m => m.accountId === id);
      
      for (const movement of accountMovements) {
        await db.delete('movements', movement.id!);
        deletedItems.movements++;
      }

      // 2. Delete classification rules that reference this account
      const savedRules = localStorage.getItem('classificationRules');
      if (savedRules) {
        const rules = JSON.parse(savedRules);
        const filteredRules = rules.filter((rule: any) => {
          // Remove rules that have conditions referencing this account
          const hasAccountCondition = rule.conditions?.some((cond: any) => 
            cond.field === 'account_id' && cond.value === id
          );
          if (hasAccountCondition) {
            deletedItems.rules++;
            return false;
          }
          return true;
        });
        localStorage.setItem('classificationRules', JSON.stringify(filteredRules));
      }

      // 3. Future: Delete related alerts, documents, OCR metadata, etc.
      // TODO: Implement when these features are available
      // - Delete alerts referencing this account
      // - Delete documents linked to this account
      // - Delete OCR metadata for this account
      // - Delete any automation rules specific to this account

      // 4. Delete the account itself
      await db.delete('accounts', id);

      // Emit domain event for cascading deletion
      try {
        await emitTreasuryEvent({
          type: 'ACCOUNT_DELETED',
          payload: { 
            accountId: id, 
            account: existingAccount
          }
        });
      } catch (error) {
        console.error('Error emitting cascade deletion event:', error);
        // Don't fail the operation if event emission fails
      }

      return { success: true, deletedItems };
    } catch (error) {
      console.error('Error during cascade deletion:', error);
      throw new Error('Error al eliminar la cuenta y datos asociados');
    }
  }

  /**
   * POST /api/treasury/accounts/:id/delete_wizard
   * FIX PACK v2.0: Guided deletion for accounts with movements
   */
  static async executeDeleteWizard(id: number, decisions: {
    movements: 'reassign' | 'archive';
    targetAccountId?: number; // Required if movements = 'reassign'
    // TODO: Add automation rules handling
  }): Promise<{ success: boolean }> {
    const db = await initDB();
    
    // Get existing account
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    // Get movements
    const allMovements = await db.getAll('movements');
    const accountMovements = allMovements.filter(m => m.accountId === id);
    
    if (accountMovements.length === 0) {
      // No movements, just hard delete
      await db.delete('accounts', id);
      return { success: true };
    }

    // Handle movements based on decision
    if (decisions.movements === 'reassign') {
      if (!decisions.targetAccountId) {
        throw new Error('Target account ID required for reassignment');
      }
      
      // Verify target account exists and is active
      const targetAccount = await db.get('accounts', decisions.targetAccountId);
      if (!targetAccount || !targetAccount.isActive || targetAccount.deleted_at) {
        throw new Error('Cuenta destino no válida');
      }

      // Reassign all movements to target account
      for (const movement of accountMovements) {
        const updatedMovement = {
          ...movement,
          accountId: decisions.targetAccountId,
          updatedAt: new Date().toISOString()
        };
        await db.put('movements', updatedMovement);
      }
      
    } else if (decisions.movements === 'archive') {
      // TODO: Implement archive account creation
      // For now, we'll mark movements as archived but keep them
      // This should create a virtual account_archive_<id> 
      console.warn('Archive functionality not yet implemented');
      throw new Error('Función de archivo aún no implementada');
    }

    // Delete the account after reassigning/archiving movements
    await db.delete('accounts', id);
    
    // Emit domain event for wizard completion
    try {
      await emitTreasuryEvent({
        type: 'ACCOUNT_DELETE_WIZARD_COMPLETED',
        payload: { 
          accountId: id, 
          account: existingAccount,
          decisions,
          movedMovements: accountMovements.length
        }
      });
    } catch (error) {
      console.error('Error emitting delete wizard completion event:', error);
      // Don't fail the operation if event emission fails
    }

    return { success: true };
  }

  /**
   * FIX PACK v2.0: Validate that an account can have movements created on it
   */
  static async validateAccountForMovement(accountId: number): Promise<void> {
    const db = await initDB();
    
    const account = await db.get('accounts', accountId);
    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    if (account.deleted_at) {
      throw new Error('No se pueden crear movimientos en una cuenta eliminada');
    }

    if (!account.isActive) {
      throw new Error('No se pueden crear movimientos en una cuenta desactivada');
    }
  }
}

/**
 * Treasury Import API
 */
export class TreasuryImportAPI {
  /**
   * POST /api/treasury/import - FIX-EXTRACTOS compliant implementation
   * 
   * Key requirements:
   * - Never store original file content
   * - Generate batch metadata with SHA-256 hash for idempotency
   * - Detect and prevent duplicate imports
   * - Normalize movements to Treasury format
   * - Attempt automatic reconciliation
   */
  static async importTransactions(
    file: File,
    accountId: number,
    skipDuplicates: boolean = true,
    usuario?: string
  ): Promise<{
    inserted: number;
    duplicates: number;
    failed: number;
    reconciled?: number;
    pendingReview?: number;
    batchId: string;
  }> {
    const db = await initDB();
    
    // Verify account exists
    const account = await db.get('accounts', accountId);
    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    // FIX-EXTRACTOS: Generate batch hash for idempotency
    const { generateBatchHash, checkBatchHashExists } = await import('../utils/batchHashUtils');
    const batchHash = await generateBatchHash(file);
    
    // Check if this file was already imported (idempotency)
    const hashExists = await checkBatchHashExists(batchHash, db);
    if (hashExists) {
      throw new Error('Este archivo ya ha sido importado anteriormente');
    }

    // Detect file format
    const fileExtension = file.name.toLowerCase().split('.').pop();
    let formatoDetectado: 'CSV' | 'XLS' | 'XLSX';
    switch (fileExtension) {
      case 'xlsx':
        formatoDetectado = 'XLSX';
        break;
      case 'xls':
        formatoDetectado = 'XLS';
        break;
      case 'csv':
        formatoDetectado = 'CSV';
        break;
      default:
        throw new Error('Formato de archivo no soportado. Use CSV, XLS o XLSX');
    }

    // Parse bank statement file using BankParserService
    const { BankParserService } = await import('../features/inbox/importers/bankParser');
    const bankParser = new BankParserService();
    const parseResult = await bankParser.parseFile(file);
    
    if (!parseResult.success || !parseResult.movements || parseResult.movements.length === 0) {
      throw new Error('No se pudieron procesar movimientos del archivo');
    }

    // Calculate date range from movements
    const dates = parseResult.movements
      .map(m => m.date instanceof Date ? m.date : new Date(m.date))
      .filter(d => !isNaN(d.getTime()));
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const results = {
      inserted: 0,
      duplicates: 0,
      failed: 0,
      reconciled: 0,
      pendingReview: 0
    };

    const now = new Date().toISOString();
    const importBatchId = `import_${Date.now()}_${accountId}`;

    // FIX-EXTRACTOS: Create enhanced import batch record with required metadata
    const importBatch: ImportBatch = {
      id: importBatchId,
      filename: file.name,
      accountId,
      totalRows: parseResult.movements.length,
      importedRows: 0,
      skippedRows: 0,
      duplicatedRows: 0,
      errorRows: 0,
      
      // FIX-EXTRACTOS: Required batch metadata for audit
      origenBanco: parseResult.metadata?.bankDetected?.bankKey || 'generic',
      formatoDetectado,
      cuentaIban: account.iban || parseResult.metadata?.detectedIban,
      rangoFechas: {
        min: minDate.toISOString().split('T')[0],
        max: maxDate.toISOString().split('T')[0]
      },
      timestampImport: now,
      hashLote: batchHash,
      usuario: usuario || 'sistema',
      
      createdAt: now
    };

    // Get existing movements for duplicate detection
    const existingMovements = await db.getAll('movements');
    const accountMovements = existingMovements.filter(m => m.accountId === accountId);

    // Process each movement from the parsed result
    for (const parsedMovement of parseResult.movements) {
      try {
        // FIX-EXTRACTOS: Normalize movement data according to requirements
        const movementDate = parsedMovement.date instanceof Date ? 
          parsedMovement.date.toISOString().split('T')[0] : 
          parsedMovement.date;
          
        // Check for duplicates using (accountId, date, amount, description) hash
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

        // FIX-EXTRACTOS: Convert to Movement format with normalization
        // Cargos = negativo; Abonos = positivo
        let normalizedAmount = parseEuropeanNumber(parsedMovement.amount);
        
        // Ensure proper sign handling for charges and credits based on description
        // Since we don't have explicit type field, infer from amount sign and description
        if (normalizedAmount < 0) {
          // Already negative, likely a cargo (charge)
          normalizedAmount = -Math.abs(normalizedAmount);
        } else if (normalizedAmount > 0) {
          // Positive, likely an abono (credit)
          normalizedAmount = Math.abs(normalizedAmount);
        }

        const movement: Movement = {
          accountId,
          date: movementDate,
          valueDate: parsedMovement.valueDate ? 
            (parsedMovement.valueDate instanceof Date ? parsedMovement.valueDate.toISOString().split('T')[0] : parsedMovement.valueDate) :
            movementDate,
          amount: normalizedAmount,
          description: parsedMovement.description || '',
          counterparty: parsedMovement.counterparty,
          reference: parsedMovement.reference,
          status: 'pendiente', // Estado inicial = Pendiente
          state: 'pending',
          sourceBank: parseResult.metadata?.bankDetected?.bankKey || importBatch.origenBanco,
          currency: parsedMovement.currency || 'EUR', // EUR por defecto
          balance: parseEuropeanNumber(parsedMovement.balance || 0),
          
          // V1.0 required fields
          type: normalizedAmount >= 0 ? 'Ingreso' : 'Gasto',
          origin: 'CSV',
          movementState: 'Confirmado', // Imported movements are confirmed
          category: '', // Will be set by rules engine
          tags: [],
          isAutoTagged: false,
          
          // FIX-EXTRACTOS: Import metadata (no raw file content!)
          importBatch: importBatchId,
          csvRowIndex: parsedMovement.originalRow,
          
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
        importBatch.errorRows++;
      }
    }

    // FIX-EXTRACTOS: Save import batch metadata (NO FILE CONTENT)
    await db.add('importBatches', importBatch);

    // FIX-EXTRACTOS: Attempt automatic reconciliation
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

    return {
      ...results,
      batchId: importBatchId
    };
  }
}

/**
 * Main Treasury API interface
 */
export const treasuryAPI = {
  accounts: TreasuryAccountsAPI,
  import: TreasuryImportAPI
};