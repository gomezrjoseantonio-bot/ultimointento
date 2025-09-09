/**
 * Account Validation Service
 * 
 * Provides validation and filtering functions for accounts to prevent
 * demo data and ensure only valid accounts are shown in UI components.
 */

import { Account } from './db';
import { isDemoModeEnabled } from '../config/envFlags';

/**
 * Check if an account is considered a demo account
 */
export function isDemoAccount(account: Account): boolean {
  if (!account) return false;

  // Check for demo patterns in account data
  const demoPatterns = ['demo', 'test', 'sample', 'ejemplo'];
  const demoIbanPatterns = ['9999', '0000', '1111']; // Common demo IBAN patterns
  
  const accountName = (account.name || '').toLowerCase();
  const bankName = (account.bank || '').toLowerCase();
  const iban = (account.iban || '').toLowerCase();

  // Check text patterns
  const hasTextPattern = demoPatterns.some(pattern => 
    accountName.includes(pattern) || 
    bankName.includes(pattern) || 
    iban.includes(pattern)
  );

  // Check IBAN demo patterns
  const hasIbanPattern = demoIbanPatterns.some(pattern => 
    iban.includes(pattern)
  );

  return hasTextPattern || hasIbanPattern;
}

/**
 * Check if an account is valid for production use
 */
export function isValidAccount(account: Account): boolean {
  if (!account) return false;

  // Account must be active
  if (!account.isActive) return false;

  // Account must not be deleted
  if (account.deleted_at) return false;

  // Account must have required fields
  if (!account.bank || !account.iban) return false;

  // Reject demo accounts unless demo mode is enabled
  if (!isDemoModeEnabled() && isDemoAccount(account)) return false;

  return true;
}

/**
 * Filter accounts for UI display
 * Returns only valid, non-demo accounts unless demo mode is enabled
 */
export function filterAccountsForUI(accounts: Account[], options: {
  includeInactive?: boolean;
  includeDeleted?: boolean;
} = {}): Account[] {
  return accounts.filter(account => {
    // Check if deleted
    if (account.deleted_at && !options.includeDeleted) {
      return false;
    }

    // Check if active
    if (!account.isActive && !options.includeInactive) {
      return false;
    }

    // Check demo status
    if (!isDemoModeEnabled() && isDemoAccount(account)) {
      return false;
    }

    // Must have required fields
    if (!account.bank || !account.iban) {
      return false;
    }

    return true;
  });
}

/**
 * Get account display name for UI
 */
export function getAccountDisplayName(account: Account): string {
  if (!account) return 'Unknown Account';
  
  const name = account.name || account.bank;
  const lastFour = account.iban ? account.iban.slice(-4) : '';
  
  return lastFour ? `${name} (*${lastFour})` : name;
}

/**
 * Validate account for creating movements
 */
export function validateAccountForMovements(account: Account): {
  valid: boolean;
  error?: string;
} {
  if (!account) {
    return { valid: false, error: 'Cuenta no encontrada' };
  }

  if (!account.isActive) {
    return { valid: false, error: 'La cuenta está desactivada' };
  }

  if (account.deleted_at) {
    return { valid: false, error: 'La cuenta ha sido eliminada' };
  }

  if (!isDemoModeEnabled() && isDemoAccount(account)) {
    return { valid: false, error: 'No se permiten cuentas demo en producción' };
  }

  if (!account.iban) {
    return { valid: false, error: 'La cuenta no tiene IBAN configurado' };
  }

  return { valid: true };
}

/**
 * Get safe account list for account selectors in UI
 */
export async function getSafeAccountList(
  accounts: Account[],
  options: {
    includeInactive?: boolean;
    showInactiveToggle?: boolean;
  } = {}
): Promise<{
  accounts: Account[];
  hasInactive: boolean;
  hasDemo: boolean;
  totalFiltered: number;
}> {
  const allValidAccounts = accounts.filter(acc => acc.bank && acc.iban);
  const filteredAccounts = filterAccountsForUI(allValidAccounts, options);
  
  const hasInactive = allValidAccounts.some(acc => !acc.isActive || acc.deleted_at);
  const hasDemo = isDemoModeEnabled() ? false : allValidAccounts.some(isDemoAccount);
  const totalFiltered = allValidAccounts.length - filteredAccounts.length;

  return {
    accounts: filteredAccounts,
    hasInactive,
    hasDemo,
    totalFiltered
  };
}