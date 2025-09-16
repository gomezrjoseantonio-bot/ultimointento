/**
 * ATLAS Cuentas Service
 * Stable service for account management with strong validations
 */

import { Account } from '../services/db';
import { validateIbanEs, normalizeIban, detectBankByIBAN } from '../utils/accountHelpers';

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
      activa: true,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.accounts.push(newAccount);
    this.saveAccounts();

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
   * Deactivate account (soft delete)
   */
  public async deactivate(id: number): Promise<void> {
    const accountIndex = this.accounts.findIndex(acc => acc.id === id && !acc.deleted_at);
    if (accountIndex === -1) {
      throw new Error('Cuenta no encontrada');
    }

    const account = this.accounts[accountIndex];
    account.activa = false;
    account.updatedAt = new Date().toISOString();
    
    // If it was the default account, unmark it
    if (account.isDefault) {
      account.isDefault = false;
    }

    this.saveAccounts();

    // Telemetry (dev-only, no PII)
    if (process.env.NODE_ENV === 'development') {
      console.info('[ACCOUNTS] deactivate', { id });
    }

    this.emit('accounts:updated', { type: 'deactivated', account });
  }

  /**
   * Reactivate account (opposite of deactivate)
   */
  public async reactivate(id: number): Promise<void> {
    const accountIndex = this.accounts.findIndex(acc => acc.id === id && !acc.deleted_at);
    if (accountIndex === -1) {
      throw new Error('Cuenta no encontrada');
    }

    const account = this.accounts[accountIndex];
    account.activa = true;
    account.updatedAt = new Date().toISOString();

    this.saveAccounts();

    // Telemetry (dev-only, no PII)
    if (process.env.NODE_ENV === 'development') {
      console.info('[ACCOUNTS] reactivate', { id });
    }

    this.emit('accounts:updated', { type: 'reactivated', account });
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
      // Check prestamos (loans) - would normally query actual database
      const prestamosData = localStorage.getItem('atlas_prestamos');
      if (prestamosData) {
        const prestamos = JSON.parse(prestamosData);
        const prestamosCount = prestamos.filter((p: any) => p.cuentaId === id && !p.deleted_at).length;
        if (prestamosCount > 0) {
          references.push('Préstamos');
          counts['Préstamos'] = prestamosCount;
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
   * Hard delete account with audit log
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

    // Check if it can be deleted
    const canDeleteResult = await this.canDelete(id);
    if (!canDeleteResult.ok) {
      throw new Error('No se puede eliminar la cuenta: tiene referencias activas');
    }

    // Mark as deleted (soft delete for audit trail)
    account.deleted_at = new Date().toISOString();
    account.activa = false;
    account.isDefault = false;
    account.updatedAt = new Date().toISOString();

    this.saveAccounts();

    // Audit log (without full IBAN for security)
    const auditLog = {
      action: 'ACCOUNT_DELETE',
      accountId: id,
      alias: account.alias,
      bankCode: account.banco?.code,
      ts: Date.now()
    };

    // Store audit log
    try {
      const existingLogs = localStorage.getItem('atlas_audit_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(auditLog);
      localStorage.setItem('atlas_audit_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('[ACCOUNTS] Failed to save audit log:', error);
    }

    // Telemetry (dev-only, no PII)
    if (process.env.NODE_ENV === 'development') {
      console.info('[ACCOUNTS] delete', { 
        id, 
        alias: account.alias,
        bankCode: account.banco?.code 
      });
    }

    this.emit('accounts:updated', { type: 'deleted', account });
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