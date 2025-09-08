/**
 * Account utilities for Treasury - FIX PACK v1.0
 * Handles account sorting, filtering, and display
 */

import { Account } from '../services/db';

/**
 * Sort accounts according to FIX PACK v1.0 requirements:
 * - Mixed first, then real estate, then personal
 * - Within each group, sort by name ascending
 */
export function sortAccountsByTypeAndAlias(accounts: Account[]): Account[] {
  return accounts.sort((a, b) => {
    // Define sort order for usage_scope
    const scopeOrder = { 'mixto': 0, 'inmuebles': 1, 'personal': 2 };
    
    const aScopeOrder = scopeOrder[a.usage_scope as keyof typeof scopeOrder] ?? 3;
    const bScopeOrder = scopeOrder[b.usage_scope as keyof typeof scopeOrder] ?? 3;
    
    // First sort by usage_scope
    if (aScopeOrder !== bScopeOrder) {
      return aScopeOrder - bScopeOrder;
    }
    
    // Then sort by name alphabetically (Account uses 'name' not 'alias')
    return (a.name || '').localeCompare(b.name || '', 'es-ES');
  });
}

/**
 * Get only active accounts (is_active = true and deleted_at is null)
 */
export function getActiveAccounts(accounts: Account[]): Account[] {
  return accounts.filter(account => 
    account.isActive && !account.deleted_at
  );
}

/**
 * Generate account display name
 */
export function getAccountDisplayName(account: Account): string {
  const name = account.name || 'Cuenta sin nombre';
  const bank = account.bank ? ` (${account.bank})` : '';
  return `${name}${bank}`;
}

/**
 * Get account initials for display when no logo is available
 */
export function getAccountInitials(account: Account): string {
  const name = account.name || 'C';
  return name
    .split(' ')
    .map((word: string) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Check if an account logo URL is valid
 */
export function hasValidLogo(account: Account): boolean {
  return !!(account.logo_url && 
    (account.logo_url.endsWith('.jpg') || 
     account.logo_url.endsWith('.jpeg') || 
     account.logo_url.endsWith('.png')));
}

/**
 * Get account info for display in movement list
 */
export function getAccountInfo(accountId: number, accounts: Account[]) {
  const account = accounts.find(acc => acc.id === accountId);
  
  if (!account) {
    return {
      name: 'Cuenta desconocida',
      bank: '',
      logo: '/placeholder-bank.png',
      initials: 'CD',
      isActive: false
    };
  }
  
  return {
    name: account.name || 'Cuenta sin nombre',
    bank: account.bank || '',
    logo: hasValidLogo(account) ? account.logo_url! : '/placeholder-bank.png',
    initials: getAccountInitials(account),
    isActive: account.isActive
  };
}

/**
 * Log account loading for debugging (development only)
 */
export function logAccountLoading(accounts: Account[], includeInactive: boolean): void {
  if (process.env.NODE_ENV === 'development') {
    const activeCount = accounts.filter(acc => acc.isActive).length;
    const inactiveCount = accounts.length - activeCount;
    console.log('AccountsLoaded:', {
      total: accounts.length,
      active: activeCount,
      inactive: inactiveCount,
      includeInactive,
      byType: {
        mixto: accounts.filter(acc => acc.usage_scope === 'mixto').length,
        inmuebles: accounts.filter(acc => acc.usage_scope === 'inmuebles').length,
        personal: accounts.filter(acc => acc.usage_scope === 'personal').length
      }
    });
  }
}