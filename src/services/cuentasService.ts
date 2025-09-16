/**
 * ATLAS Cuentas Service
 * Stable service for account management with strong validations
 */

import { Account } from '../services/db';
import { validateIbanEs, normalizeIban, inferBank, loadBanksCatalog, BankInfo } from '../utils/accountHelpers';

export interface CreateAccountData {
  alias: string;
  iban: string;
  tipo?: 'CORRIENTE' | 'AHORRO' | 'OTRA';
  titular?: { nombre?: string; nif?: string; };
}

export interface UpdateAccountData {
  alias?: string;
  isDefault?: boolean;
  activa?: boolean;
  titular?: { nombre?: string; nif?: string; };
}

class CuentasService {
  private accounts: Account[] = [];
  private banksCatalog: Record<string, BankInfo> = {};
  private eventListeners: ((event: string, data?: any) => void)[] = [];

  constructor() {
    this.loadInitialData();
  }

  /**
   * Initialize service with data from localStorage and load banks catalog
   */
  private async loadInitialData(): Promise<void> {
    try {
      // Load accounts from localStorage
      const stored = localStorage.getItem('atlas_accounts');
      if (stored) {
        this.accounts = JSON.parse(stored);
      }

      // Load banks catalog
      this.banksCatalog = await loadBanksCatalog();
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
    // Validate alias
    const alias = data.alias.trim();
    if (!alias || alias.length === 0) {
      throw new Error('El alias es requerido');
    }
    if (alias.length > 40) {
      throw new Error('El alias no puede superar 40 caracteres');
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

    // Infer bank information
    const bankInfo = inferBank(normalizedIban, this.banksCatalog);

    // Create new account
    const newAccount: Account = {
      id: this.generateId(),
      alias,
      iban: normalizedIban,
      banco: bankInfo || undefined,
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
        alias: newAccount.alias, 
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

    // Validate alias if provided
    if (data.alias !== undefined) {
      const alias = data.alias.trim();
      if (!alias || alias.length === 0) {
        throw new Error('El alias es requerido');
      }
      if (alias.length > 40) {
        throw new Error('El alias no puede superar 40 caracteres');
      }
      account.alias = alias;
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