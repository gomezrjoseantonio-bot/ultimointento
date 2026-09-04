/**
 * Treasury API Service
 * 
 * Provides API-like interface for treasury operations using IndexedDB
 * Implements the endpoints required by the problem statement:
 * - POST /api/treasury/accounts → crea y devuelve cuenta
 * - GET /api/treasury/accounts → lista
 * - PUT /api/treasury/accounts/:id → edita
 */

import { initDB, Account, AccountStatus } from './db';
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
 * Treasury Accounts API
 */
export class TreasuryAccountsAPI {
  /**
   * GET /api/treasury/accounts?includeInactive=true|false
   * Enhanced filtering with new status system: ACTIVE | INACTIVE (never DELETED)
   */
  static async getAccounts(includeInactive: boolean = false): Promise<Account[]> {
    const db = await initDB();
    const allAccounts = await db.getAll('accounts');
    
    // Filter based on new status system
    // DELETED accounts are never returned (hard deleted from storage)
    // Legacy support: also filter out accounts with deleted_at set
    const visibleAccounts = allAccounts.filter(acc => {
      // `status` es requerido en el tipo, pero registros legacy pueden no traerlo:
      // se lee ensanchado a `| undefined` para conservar el fallback a `activa`.
      const status: AccountStatus | undefined = acc.status;
      // Never show truly deleted accounts - enhanced defensive filtering
      if (status === 'DELETED' || acc.deleted_at || acc.activa === false) return false;

      // Nota: la guarda anterior ya excluyó `activa === false`, así que aquí
      // `activa` es siempre true → el fallback legacy se reduce a `!status`.
      if (includeInactive) {
        // Return both ACTIVE and INACTIVE when requested
        return status === 'ACTIVE' || status === 'INACTIVE' || !status;
      } else {
        // Only return ACTIVE accounts by default
        return status === 'ACTIVE' || !status;
      }
    });
    
    return visibleAccounts;
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
      alias: accountData.alias || 'Nueva Cuenta', // Required field in new interface
      name: accountData.alias, // Using name field as alias
      bank: accountData.bank,
      iban: accountData.iban.replace(/\s/g, '').toUpperCase(),
      destination: 'horizon', // Default to horizon
      balance: accountData.openingBalance,
      openingBalance: accountData.openingBalance,
      openingBalanceDate: accountData.openingBalanceDate || now,
      includeInConsolidated: accountData.includeInConsolidated ?? true,
      currency: 'EUR',
      status: 'ACTIVE', // Required status field
      isActive: true,
      activa: true, // Required field in new interface
      usage_scope: accountData.usage_scope || 'mixto', // Default to 'mixto'
      logo_url: accountData.logo_url,
      createdAt: now,
      updatedAt: now
    };

    const accountId = await db.add('accounts', newAccount);
    
    // SOLUTION: Ensure no demo movements are created with new accounts
    const { ensureCleanAccountCreation } = await import('./demoDataCleanupService');
    await ensureCleanAccountCreation(accountId as number);
    
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
   * DELETE /api/treasury/accounts/:id?mode=soft|hard
   * Enhanced delete with hard/soft mode support
   */
  static async deleteAccount(id: number, mode: 'soft' | 'hard' = 'soft', options?: {
    reassignToAccountId?: number;
    confirmCascade?: boolean;
  }): Promise<{ success: boolean; summary?: any }> {
    const db = await initDB();
    
    // Get existing account
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    if (mode === 'soft') {
      return await this.softDeleteAccount(id);
    } else {
      return await this.hardDeleteAccount(id, options);
    }
  }

  /**
   * Soft delete: Set status to INACTIVE, preserve all data
   */
  private static async softDeleteAccount(id: number): Promise<{ success: boolean; summary: any }> {
    const db = await initDB();
    const existingAccount = await db.get('accounts', id);
    
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    if (existingAccount.status === 'INACTIVE' || (!existingAccount.status && !existingAccount.activa)) {
      throw new Error('La cuenta ya está desactivada');
    }

    // Check if account has movements to warn user — use accountId index to avoid full table scan
    const accountMovements = await db.getAllFromIndex('movements', 'accountId', id);
    
    const softDeletedAccount: Account = {
      ...existingAccount,
      status: 'INACTIVE',
      deactivatedAt: new Date().toISOString(),
      activa: false, // Keep legacy field in sync
      isActive: false, // Keep legacy field in sync
      deleted_at: undefined, // Soft delete doesn't use deleted_at
      updatedAt: new Date().toISOString()
    };

    await db.put('accounts', softDeletedAccount);
    
    // Emit domain event for account deactivation
    try {
      await emitTreasuryEvent({
        type: 'ACCOUNT_CHANGED',
        payload: { account: softDeletedAccount, previousAccount: existingAccount }
      });
    } catch (error) {
      console.error('Error emitting account deactivation event:', error);
    }

    return {
      success: true,
      summary: {
        action: 'soft_delete',
        accountId: id,
        movementsPreserved: accountMovements.length,
        message: 'Cuenta desactivada. Puedes reactivarla cuando quieras; no aparecerá en cálculos ni importaciones.'
      }
    };
  }

  /**
   * Hard delete: Permanently remove account and handle cascade cleanup
   */
  private static async hardDeleteAccount(id: number, options?: {
    reassignToAccountId?: number;
    confirmCascade?: boolean;
  }): Promise<{ success: boolean; summary: any }> {
    const db = await initDB();
    const existingAccount = await db.get('accounts', id);
    
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    // Check for blocking conditions
    const blockingReferences = await this.checkBlockingReferences(id);
    if (blockingReferences.hasBlocking && !options?.confirmCascade) {
      throw new Error(`No se puede eliminar definitivamente. ${blockingReferences.message}`);
    }

    const summary = {
      action: 'hard_delete',
      accountId: id,
      removedItems: {} as Record<string, number>,
      reassignedItems: {} as Record<string, number>,
      blockedBy: [] as string[]
    };

    try {
      // 1. Handle movements — use accountId index to avoid full table scan
      const accountMovements = await db.getAllFromIndex('movements', 'accountId', id);
      
      if (accountMovements.length > 0) {
        if (options?.reassignToAccountId) {
          // Reassign movements to target account
          const targetAccount = await db.get('accounts', options.reassignToAccountId);
          if (!targetAccount || targetAccount.status === 'DELETED') {
            throw new Error('Cuenta destino no válida para reasignación');
          }

          for (const movement of accountMovements) {
            const updatedMovement = {
              ...movement,
              accountId: options.reassignToAccountId,
              account_id: options.reassignToAccountId,
              updatedAt: new Date().toISOString()
            };
            await db.put('movements', updatedMovement);
          }
          
          summary.reassignedItems['movements'] = accountMovements.length;
        } else {
          // Delete movements
          for (const movement of accountMovements) {
            if (movement.id) {
              await db.delete('movements', movement.id);
            }
          }
          summary.removedItems['movements'] = accountMovements.length;
        }
      }

      // 2. Delete the account itself
      await db.delete('accounts', id);

      // 3. Emit domain event for hard delete
      try {
        await emitTreasuryEvent({
          type: 'ACCOUNT_DELETED',
          payload: { accountId: id, account: existingAccount }
        });
      } catch (error) {
        console.error('Error emitting account deletion event:', error);
      }

      return { success: true, summary };

    } catch (error) {
      console.error('Error during hard delete:', error);
      throw new Error(`Error eliminando cuenta: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check for references that would block hard delete
   */
  private static async checkBlockingReferences(accountId: number): Promise<{
    hasBlocking: boolean;
    message: string;
    references: string[];
  }> {
    const references: string[] = [];
    
    try {
      // Check for active contracts using this account
      const db = await initDB();
      
      // Check contracts (if contracts table exists)
      try {
        const allContracts = await db.getAll('contracts');
        const activeContracts = allContracts.filter(c => 
          c.cuentaCobroId === accountId && c.estadoContrato === 'activo'
        );
        if (activeContracts.length > 0) {
          references.push(`${activeContracts.length} contratos activos`);
        }
      } catch (error) {
        // Contracts table may not exist
      }

      // Add other blocking reference checks here as needed
      
    } catch (error) {
      console.warn('Error checking blocking references:', error);
    }

    return {
      hasBlocking: references.length > 0,
      message: references.length > 0 ? 
        `Cuenta referenciada por: ${references.join(', ')}. Reasigna estas referencias o confirma eliminación en cascada.` : 
        '',
      references
    };
  }

  /**
   * PATCH /api/treasury/accounts/:id/activate
   * Reactivate a previously deactivated account
   */
  static async activateAccount(id: number): Promise<Account> {
    const db = await initDB();
    
    // Get existing account
    const existingAccount = await db.get('accounts', id);
    if (!existingAccount) {
      throw new Error('Cuenta no encontrada');
    }

    // Check if account is deleted (can't reactivate deleted accounts)
    if (existingAccount.status === 'DELETED' || existingAccount.deleted_at) {
      throw new Error('No se puede activar una cuenta eliminada definitivamente');
    }

    // Check if already active
    if (existingAccount.status === 'ACTIVE' || (!existingAccount.status && existingAccount.activa)) {
      throw new Error('La cuenta ya está activa');
    }

    const activatedAccount: Account = {
      ...existingAccount,
      status: 'ACTIVE',
      deactivatedAt: undefined, // Clear deactivation timestamp
      activa: true, // Keep legacy field in sync
      isActive: true, // Keep legacy field in sync
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

    // Get movements — use accountId index to avoid full table scan
    const accountMovements = await db.getAllFromIndex('movements', 'accountId', id);
    
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
 * Main Treasury API interface
 */
export const treasuryAPI = {
  accounts: TreasuryAccountsAPI,
};