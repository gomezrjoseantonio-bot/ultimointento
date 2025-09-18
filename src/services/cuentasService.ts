/**
 * ATLAS Cuentas Service
 * Stable service for account management with strong validations
 * Enhanced with Treasury v1.2 cascade deletion capabilities
 */

import { Account, initDB } from '../services/db';
import { validateIbanEs, normalizeIban, detectBankByIBAN } from '../utils/accountHelpers';

// Logging prefix for Treasury operations
const LOG_PREFIX = '[TESO-ACCOUNTS]';

export interface CreateAccountData {
  alias?: string;  // ATLAS: alias is now optional
  iban: string;
  tipo?: 'CORRIENTE' | 'AHORRO' | 'OTRA';
  titular?: { nombre?: string; nif?: string; };
  logoUser?: string; // User uploaded logo
}

export interface UpdateAccountData {
  alias?: string;  // ATLAS: alias is optional
  isDefault?: boolean;
  activa?: boolean;
  titular?: { nombre?: string; nif?: string; };
  logoUser?: string; // User uploaded logo
}

class CuentasService {
  private accounts: Account[] = [];
  private eventListeners: ((event: string, data?: any) => void)[] = [];

  constructor() {
    this.loadInitialData();
  }

  /**
   * Initialize service with data from localStorage
   */
  private async loadInitialData(): Promise<void> {
    try {
      // Load accounts from localStorage
      const stored = localStorage.getItem('atlas_accounts');
      if (stored) {
        this.accounts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[ACCOUNTS] Failed to load initial data:', error);
    }
  }

  /**
   * Save accounts to localStorage
   */
  private saveAccounts(): void {
    try {
      localStorage.setItem('atlas_accounts', JSON.stringify(this.accounts));
    } catch (error) {
      console.error('[ACCOUNTS] Failed to save accounts:', error);
    }
  }

  /**
   * Sync account to IndexedDB (treasury storage)
   */
  private async syncAccountToIndexedDB(account: Account): Promise<void> {
    try {
      const db = await initDB();
      
      // Check if account already exists in IndexedDB
      const existingAccounts = await db.getAll('accounts');
      const existingAccount = existingAccounts.find(acc => acc.iban === account.iban);
      
      // Transform atlas account to treasury account format
      const treasuryAccount = {
        id: existingAccount?.id, // Keep existing ID if updating
        alias: account.alias,
        name: account.alias,
        iban: account.iban,
        banco: account.banco,
        bank: account.banco?.name || 'Banco',
        destination: 'horizon', // Set the required destination field
        activa: account.activa ?? true,
        isActive: account.activa ?? true,
        logoUser: account.logoUser,
        logo_url: account.logoUser || account.banco?.brand?.logoUrl,
        tipo: account.tipo || 'CORRIENTE',
        moneda: account.moneda || 'EUR',
        currency: 'EUR',
        titular: account.titular,
        isDefault: account.isDefault || false,
        balance: existingAccount?.balance || 0, // Preserve existing balance
        openingBalance: existingAccount?.openingBalance || 0,
        openingBalanceDate: existingAccount?.openingBalanceDate || account.createdAt,
        includeInConsolidated: true,
        usage_scope: 'mixto',
        deleted_at: account.deleted_at, // Preserve deletion status
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      };
      
      if (existingAccount) {
        // Update existing account
        await db.put('accounts', treasuryAccount);
      } else {
        // Create new account
        delete treasuryAccount.id; // Let IndexedDB assign new ID
        await db.add('accounts', treasuryAccount);
      }
      
      console.info('[ACCOUNTS] Synced to IndexedDB:', { 
        alias: account.alias || 'Sin alias',
        iban: account.iban.slice(-4),
        action: existingAccount ? 'updated' : 'created',
        deleted: !!account.deleted_at
      });
    } catch (error) {
      console.error('[ACCOUNTS] Failed to sync to IndexedDB:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Emit events to listeners
   */
  private emit(event: string, data?: any): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[ACCOUNTS] Event listener error:', error);
      }
    });
  }

  /**
   * Add event listener
   */
  public on(listener: (event: string, data?: any) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * List all active accounts
   */
  public async list(): Promise<Account[]> {
    return this.accounts.filter(acc => !acc.deleted_at);
  }

  /**
   * Get account by ID
   */
  public async get(id: number): Promise<Account | null> {
    return this.accounts.find(acc => acc.id === id && !acc.deleted_at) || null;
  }

  /**
   * Create new account with validations
   */
  public async create(data: CreateAccountData): Promise<Account> {
    // Validate alias if provided (now optional)
    if (data.alias !== undefined) {
      const alias = data.alias.trim();
      if (alias.length > 40) {
        throw new Error('El alias no puede superar 40 caracteres');
      }
    }

    // Validate and normalize IBAN
    const ibanValidation = validateIbanEs(data.iban);
    if (!ibanValidation.ok) {
      throw new Error(ibanValidation.message);
    }

    const normalizedIban = normalizeIban(data.iban);
    
    // Check for duplicates
    const existingAccount = this.accounts.find(
      acc => acc.iban === normalizedIban && !acc.deleted_at
    );
    if (existingAccount) {
      throw new Error('Ya existe una cuenta con este IBAN');
    }

    // Detect bank information using new function
    const bankInfo = detectBankByIBAN(normalizedIban);

    // Create new account
    const newAccount: Account = {
      id: this.generateId(),
      alias: data.alias?.trim() || undefined, // ATLAS: alias is optional
      iban: normalizedIban,
      banco: bankInfo || undefined,
      logoUser: data.logoUser,
      tipo: data.tipo || 'CORRIENTE',
      moneda: 'EUR',
      titular: data.titular,
      status: 'ACTIVE', // New required field
      activa: true,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.accounts.push(newAccount);
    this.saveAccounts();

    // Sync to IndexedDB (treasury storage)
    await this.syncAccountToIndexedDB(newAccount);

    // Telemetry (dev-only, no PII)
    if (process.env.NODE_ENV === 'development') {
      console.info('[ACCOUNTS] create', { 
        alias: newAccount.alias || 'Sin alias', 
        bankCode: newAccount.banco?.code 
      });
    }

    this.emit('accounts:updated', { type: 'created', account: newAccount });
    return newAccount;
  }

  /**
   * Update existing account
   */
  public async update(id: number, data: UpdateAccountData): Promise<Account> {
    const accountIndex = this.accounts.findIndex(acc => acc.id === id && !acc.deleted_at);
    if (accountIndex === -1) {
      throw new Error('Cuenta no encontrada');
    }

    const account = this.accounts[accountIndex];

    // Validate alias if provided (now optional)
    if (data.alias !== undefined) {
      const alias = data.alias.trim();
      if (alias.length > 40) {
        throw new Error('El alias no puede superar 40 caracteres');
      }
      account.alias = alias || undefined; // Can be set to undefined (no alias)
    }

    // Handle default account logic
    if (data.isDefault === true) {
      // Unmark current default account
      this.accounts.forEach(acc => {
        if (acc.id !== id && acc.isDefault) {
          acc.isDefault = false;
        }
      });
      account.isDefault = true;
    } else if (data.isDefault === false) {
      account.isDefault = false;
    }

    // Update other fields
    if (data.activa !== undefined) {
      account.activa = data.activa;
    }
    if (data.titular !== undefined) {
      account.titular = data.titular;
    }
    if (data.logoUser !== undefined) {
      account.logoUser = data.logoUser;
    }

    account.updatedAt = new Date().toISOString();
    this.saveAccounts();

    // Sync to IndexedDB (treasury storage)
    await this.syncAccountToIndexedDB(account);

    // Telemetry (dev-only, no PII)
    if (process.env.NODE_ENV === 'development') {
      console.info('[ACCOUNTS] update', { 
        id, 
        isDefault: account.isDefault 
      });
    }

    this.emit('accounts:updated', { type: 'updated', account });
    return account;
  }

  /**
   * Deactivate account (soft delete) - Enhanced with status system
   */
  public async deactivate(id: number): Promise<void> {
    const accountIndex = this.accounts.findIndex(acc => acc.id === id && !acc.deleted_at);
    if (accountIndex === -1) {
      throw new Error('Cuenta no encontrada');
    }

    const account = this.accounts[accountIndex];
    
    // Update to new status system
    account.status = 'INACTIVE';
    account.deactivatedAt = new Date().toISOString();
    
    // Keep legacy fields in sync for backward compatibility
    account.activa = false;
    account.isActive = false;
    
    account.updatedAt = new Date().toISOString();
    
    // If it was the default account, unmark it
    if (account.isDefault) {
      account.isDefault = false;
    }

    this.saveAccounts();

    // Sync to IndexedDB (treasury storage)
    await this.syncAccountToIndexedDB(account);

    // Telemetry (dev-only, no PII)
    if (process.env.NODE_ENV === 'development') {
      console.info('[ACCOUNTS] deactivate', { id });
    }

    this.emit('accounts:updated', { type: 'deactivated', account });
  }

  /**
   * Reactivate account (opposite of deactivate) - Enhanced with status system
   */
  public async reactivate(id: number): Promise<void> {
    const accountIndex = this.accounts.findIndex(acc => acc.id === id && !acc.deleted_at);
    if (accountIndex === -1) {
      throw new Error('Cuenta no encontrada');
    }

    const account = this.accounts[accountIndex];
    
    // Update to new status system
    account.status = 'ACTIVE';
    account.deactivatedAt = undefined; // Clear deactivation timestamp
    
    // Keep legacy fields in sync for backward compatibility
    account.activa = true;
    account.isActive = true;
    
    account.updatedAt = new Date().toISOString();

    this.saveAccounts();

    // Sync to IndexedDB (treasury storage)
    await this.syncAccountToIndexedDB(account);

    // Telemetry (dev-only, no PII)
    if (process.env.NODE_ENV === 'development') {
      console.info('[ACCOUNTS] reactivate', { id });
    }

    this.emit('accounts:updated', { type: 'reactivated', account });
  }

  /**
   * Hard delete account with enhanced cascade cleanup
   * Implements the requirements from problem statement: real hard delete with checkbox for movements
   */
  public async hardDelete(id: number, options: {
    deleteMovements?: boolean;
    confirmCascade?: boolean;
  }): Promise<{ success: boolean; summary?: any }> {
    const account = this.accounts.find(acc => acc.id === id && !acc.deleted_at);
    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    console.info(`${LOG_PREFIX} Starting hard deletion for account ${id}: ${account.alias}`);

    try {
      // Get movements count for summary
      const allMovements = JSON.parse(localStorage.getItem('atlas_movimientos') || '[]');
      const accountMovements = allMovements.filter((m: any) => m.cuentaId === id && !m.deleted_at);
      const movementsCount = accountMovements.length;

      const summary = {
        action: 'hard_delete',
        accountId: id,
        removedItems: {} as Record<string, number>
      };

      // Step 1: Handle movements according to checkbox
      if (options.deleteMovements && movementsCount > 0) {
        // Delete movements from localStorage
        const filteredMovements = allMovements.filter((m: any) => m.cuentaId !== id || m.deleted_at);
        localStorage.setItem('atlas_movimientos', JSON.stringify(filteredMovements));
        summary.removedItems.movements = movementsCount;

        // Also delete from IndexedDB treasury storage
        const db = await initDB();
        const allTreasuryMovements = await db.getAll('movements');
        const treasuryAccountMovements = allTreasuryMovements.filter(m => m.account_id === id);
        
        for (const movement of treasuryAccountMovements) {
          if (movement.id) {
            await db.delete('movements', movement.id);
          }
        }
      }

      // Step 2: Delete account from IndexedDB treasury storage
      const db = await initDB();
      try {
        await db.delete('accounts', id);
      } catch (error) {
        console.warn(`${LOG_PREFIX} Account not found in treasury DB or error deleting:`, error);
      }

      // Step 3: Clean caches and aggregated data
      this.cleanAccountCaches(id);

      // Step 4: Remove from local accounts array
      const accountIndex = this.accounts.findIndex(acc => acc.id === id);
      if (accountIndex !== -1) {
        this.accounts.splice(accountIndex, 1);
        this.saveAccounts();
      }

      // Emit event for UI updates
      this.emit('accounts:updated', { type: 'hard_deleted', account, summary });

      console.info(`${LOG_PREFIX} Hard deletion completed successfully`, summary);
      
      return { success: true, summary };

    } catch (error) {
      console.error(`${LOG_PREFIX} Error during hard delete:`, error);
      throw error;
    }
  }

  /**
   * Migrate existing accounts to new status system
   * Converts legacy activa/deleted_at fields to status enum
   */
  public async migrateAccountStatuses(): Promise<{ migrated: number; skipped: number }> {
    let migrated = 0;
    let skipped = 0;

    console.info(`${LOG_PREFIX} Starting account status migration`);

    for (const account of this.accounts) {
      // Skip accounts that already have the new status field
      if (account.status) {
        skipped++;
        continue;
      }

      // Determine status based on legacy fields
      if (account.deleted_at) {
        // These should be marked as DELETED - but since they're still in storage, 
        // they were probably soft-deleted, so mark as INACTIVE
        account.status = 'INACTIVE';
        account.deactivatedAt = account.deleted_at;
        account.activa = false;
        account.isActive = false;
      } else if (account.activa === false || account.isActive === false) {
        account.status = 'INACTIVE';
        account.deactivatedAt = account.updatedAt; // Best guess for deactivation time
        account.activa = false;
        account.isActive = false;
      } else {
        account.status = 'ACTIVE';
        account.activa = true;
        account.isActive = true;
      }

      account.updatedAt = new Date().toISOString();
      migrated++;
    }

    if (migrated > 0) {
      this.saveAccounts();
      
      // Sync all accounts to IndexedDB
      for (const account of this.accounts) {
        await this.syncAccountToIndexedDB(account);
      }
    }

    console.info(`${LOG_PREFIX} Migration completed: ${migrated} migrated, ${skipped} skipped`);
    
    this.emit('accounts:updated', { type: 'bulk_migrated', count: migrated });
    
    return { migrated, skipped };
  }

  /**
   * Check if account can be deleted (no active references)
   */
  public async canDelete(id: number): Promise<{ ok: boolean; references?: string[]; counts?: Record<string, number> }> {
    const account = this.accounts.find(acc => acc.id === id && !acc.deleted_at);
    if (!account) {
      return { ok: false, references: ['Cuenta no encontrada'] };
    }

    // Check for references in other entities
    // Note: In a real implementation, these would be actual database queries
    const references: string[] = [];
    const counts: Record<string, number> = {};

    try {
      // Check prestamos (loans) - loans with this account as "cuenta de cargo" block deletion
      const prestamosData = localStorage.getItem('atlas_prestamos');
      if (prestamosData) {
        const prestamos = JSON.parse(prestamosData);
        const prestamosCount = prestamos.filter((p: any) => 
          (p.cuentaId === id || p.cuentaCargo === account.iban) && !p.deleted_at
        ).length;
        if (prestamosCount > 0) {
          references.push('préstamos');
          counts['préstamos'] = prestamosCount;
        }
      }

      // Check alquileres (rentals) - would normally query actual database
      const alquileresData = localStorage.getItem('atlas_alquileres');
      if (alquileresData) {
        const alquileres = JSON.parse(alquileresData);
        const alquileresCount = alquileres.filter((a: any) => a.cuentaId === id && !a.deleted_at).length;
        if (alquileresCount > 0) {
          references.push('Alquileres');
          counts['Alquileres'] = alquileresCount;
        }
      }

      // Check tesoreria movimientos (treasury movements) - would normally query actual database
      const movimientosData = localStorage.getItem('atlas_movimientos');
      if (movimientosData) {
        const movimientos = JSON.parse(movimientosData);
        const movimientosCount = movimientos.filter((m: any) => m.cuentaId === id && !m.deleted_at).length;
        if (movimientosCount > 0) {
          references.push('Movimientos');
          counts['Movimientos'] = movimientosCount;
        }
      }

      if (references.length > 0) {
        return { ok: false, references, counts };
      }

      return { ok: true };
    } catch (error) {
      console.error('[ACCOUNTS] Error checking references:', error);
      return { ok: false, references: ['Error al verificar referencias'] };
    }
  }

  /**
   * Enhanced delete account with cascade cleanup - Treasury v1.2
   * Implements complete cascade deletion as specified in problem statement
   */
  public async deleteAccount(id: number, confirmationAlias: string): Promise<void> {
    const account = this.accounts.find(acc => acc.id === id && !acc.deleted_at);
    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    // Verify confirmation alias matches
    if (account.alias !== confirmationAlias) {
      throw new Error('El alias de confirmación no coincide');
    }

    console.info(`${LOG_PREFIX} Starting cascade deletion for account ${id}: ${account.alias}`);

    try {
      // Step 1: Delete all movements and related data from IndexedDB
      const db = await initDB();
      
      // Get all movements for this account
      const allMovements = await db.getAll('movements');
      const accountMovements = allMovements.filter(m => m.account_id === id);
      
      console.info(`${LOG_PREFIX} Found ${accountMovements.length} movements to delete`);
      
      // Delete movements one by one to ensure proper cascade
      for (const movement of accountMovements) {
        if (movement.id) {
          await db.delete('movements', movement.id);
        }
      }
      
      // Step 2: Delete conciliations/reconciliations for this account
      try {
        const allReconciliations = await db.getAll('reconciliations');
        const accountReconciliations = allReconciliations.filter(r => 
          r.account_id === id || r.movement_account_id === id
        );
        
        for (const reconciliation of accountReconciliations) {
          if (reconciliation.id) {
            await db.delete('reconciliations', reconciliation.id);
          }
        }
        
        console.info(`${LOG_PREFIX} Deleted ${accountReconciliations.length} reconciliations`);
      } catch (error) {
        console.warn(`${LOG_PREFIX} No reconciliations table or error deleting:`, error);
      }
      
      // Step 3: Delete account-specific states and preferences
      try {
        const allStates = await db.getAll('accountStates');
        const accountStates = allStates.filter(s => s.account_id === id);
        
        for (const state of accountStates) {
          if (state.id) {
            await db.delete('accountStates', state.id);
          }
        }
        
        console.info(`${LOG_PREFIX} Deleted ${accountStates.length} account states`);
      } catch (error) {
        console.warn(`${LOG_PREFIX} No accountStates table or error deleting:`, error);
      }
      
      // Step 4: Clean localStorage/sessionStorage caches
      this.cleanAccountCaches(id);
      
      // Step 5: Remove account from treasury storage
      try {
        const treasuryAccounts = await db.getAll('accounts');
        const treasuryAccount = treasuryAccounts.find(acc => acc.id === id);
        if (treasuryAccount && treasuryAccount.id) {
          await db.delete('accounts', treasuryAccount.id);
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} Error deleting from treasury accounts:`, error);
      }
      
      // Step 6: Mark as deleted in main accounts service (soft delete for audit)
      account.deleted_at = new Date().toISOString();
      account.activa = false;
      account.isDefault = false;
      account.updatedAt = new Date().toISOString();

      this.saveAccounts();

      // Step 7: Create comprehensive audit log
      const auditLog = {
        action: 'ACCOUNT_CASCADE_DELETE',
        accountId: id,
        alias: account.alias,
        bankCode: account.banco?.code,
        movementsDeleted: accountMovements.length,
        timestamp: new Date().toISOString(),
        userConfirmation: confirmationAlias
      };

      // Store audit log
      try {
        const existingLogs = localStorage.getItem('atlas_audit_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push(auditLog);
        localStorage.setItem('atlas_audit_logs', JSON.stringify(logs));
      } catch (error) {
        console.error(`${LOG_PREFIX} Failed to save audit log:`, error);
      }

      // Step 8: Telemetry and logging
      console.info(`${LOG_PREFIX} Cascade deletion completed successfully`, {
        accountId: id,
        alias: account.alias,
        movementsDeleted: accountMovements.length,
        cleanupCompleted: true
      });

      this.emit('accounts:updated', { type: 'deleted', account });
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error during cascade deletion:`, error);
      throw new Error(`Error eliminando cuenta: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Clean all caches related to an account
   * Ensures no phantom data remains after deletion
   */
  private cleanAccountCaches(accountId: number): void {
    const LOG_PREFIX = '[TESO-CLEANUP]';
    
    try {
      // Clean localStorage entries
      const keysToCheck = [
        'atlas_treasury_cache',
        'atlas_movements_cache',
        'atlas_account_preferences',
        'atlas_calendar_cache',
        'atlas_reconciliation_cache'
      ];
      
      keysToCheck.forEach(key => {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored);
            
            // Remove account-specific entries
            if (Array.isArray(data)) {
              const filtered = data.filter(item => 
                item.account_id !== accountId && 
                item.accountId !== accountId &&
                item.cuentaId !== accountId
              );
              localStorage.setItem(key, JSON.stringify(filtered));
            } else if (typeof data === 'object' && data[accountId]) {
              delete data[accountId];
              localStorage.setItem(key, JSON.stringify(data));
            }
          }
        } catch (error) {
          console.warn(`${LOG_PREFIX} Error cleaning cache ${key}:`, error);
        }
      });
      
      // Clean sessionStorage
      const sessionKeys = [
        'current_account_view',
        'calendar_state',
        'movement_filters'
      ];
      
      sessionKeys.forEach(key => {
        try {
          const stored = sessionStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored);
            if (data.accountId === accountId) {
              sessionStorage.removeItem(key);
            }
          }
        } catch (error) {
          console.warn(`${LOG_PREFIX} Error cleaning session ${key}:`, error);
        }
      });
      
      console.info(`${LOG_PREFIX} Cache cleanup completed for account ${accountId}`);
      
    } catch (error) {
      console.error(`${LOG_PREFIX} Error during cache cleanup:`, error);
    }
  }

  /**
   * Get default account
   */
  public async getDefault(): Promise<Account | null> {
    return this.accounts.find(acc => acc.isDefault && acc.activa && !acc.deleted_at) || null;
  }

  /**
   * Generate unique ID for new accounts
   */
  private generateId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  /**
   * Clear all accounts (for testing/development)
   */
  public async clear(): Promise<void> {
    this.accounts = [];
    this.saveAccounts();
    this.emit('accounts:updated', { type: 'cleared' });
  }
}

export const cuentasService = new CuentasService();