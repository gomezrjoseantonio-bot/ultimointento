/**
 * ATLAS Accounts Utilities
 * Shared functions for account management, IBAN validation and formatting
 */

export interface BankInfo {
  code?: string;
  name?: string;
  logoUrl?: string;
  color?: string;
}

/**
 * Format IBAN with spaces every 4 characters
 * @param iban - Raw IBAN string
 * @returns Formatted IBAN: "ES91 0049 1500 0512 3456 7892"
 */
export function formatIban(iban: string): string {
  if (!iban) return '';
  const clean = iban.replace(/\s/g, '').toUpperCase();
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Mask IBAN for display purposes - ATLAS format
 * @param iban - Raw IBAN string
 * @returns Masked IBAN: "ES91 **** **** **** 2715" (show first 8 and last 4)
 */
export function maskIban(iban: string): string {
  if (!iban) return '';
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (clean.length < 12) return formatIban(iban); // If too short, just format
  
  const prefix = clean.substring(0, 8); // ES91 0049
  const suffix = clean.substring(clean.length - 4); // last 4 digits
  const maskedMiddle = '*'.repeat(Math.max(0, clean.length - 12)); // mask middle part
  
  const masked = prefix + maskedMiddle + suffix;
  return formatIban(masked);
}

/**
 * Validate Spanish IBAN using mod-97 algorithm
 * @param iban - IBAN string to validate
 * @returns Validation result with success flag and error message
 */
export function validateIbanEs(iban: string): { ok: boolean; message?: string } {
  if (!iban) {
    return { ok: false, message: 'IBAN es requerido' };
  }

  const clean = iban.replace(/\s/g, '').toUpperCase();
  
  // Check length and format
  if (clean.length !== 24) {
    return { ok: false, message: 'IBAN español debe tener 24 caracteres' };
  }
  
  if (!clean.startsWith('ES')) {
    return { ok: false, message: 'IBAN debe comenzar con ES' };
  }
  
  if (!/^ES\d{22}$/.test(clean)) {
    return { ok: false, message: 'Formato de IBAN inválido' };
  }
  
  // Mod-97 validation
  const rearranged = clean.substring(4) + clean.substring(0, 4);
  const numericString = rearranged.replace(/[A-Z]/g, (char) => 
    (char.charCodeAt(0) - 55).toString()
  );
  
  let remainder = 0;
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i])) % 97;
  }
  
  if (remainder !== 1) {
    return { ok: false, message: 'IBAN no es válido (fallo verificación mod-97)' };
  }
  
  return { ok: true };
}

/**
 * Detect bank information by IBAN (enhanced version of inferBank)
 * @param normalizedIban - Normalized IBAN string
 * @returns Bank information with code, name, and brand details
 */
export function detectBankByIBAN(normalizedIban: string): { code?: string; name?: string; brand?: { logoUrl?: string; color?: string } } | null {
  if (!normalizedIban || !normalizedIban.startsWith('ES') || normalizedIban.length < 8) {
    return null;
  }

  const bankCode = normalizedIban.substring(4, 8); // Extract positions 5-8
  
  // Spanish bank codes catalog (basic implementation)
  const spanishBanks: Record<string, { name: string; brand?: { logoUrl?: string; color?: string } }> = {
    '0049': { 
      name: 'Banco Santander', 
      brand: { 
        logoUrl: '/assets/banks/santander-logo.png',
        color: '#EC0000'
      } 
    },
    '0182': { 
      name: 'BBVA', 
      brand: { 
        logoUrl: '/assets/banks/bbva-logo.png',
        color: '#004481'
      } 
    },
    '0081': { 
      name: 'Banco de Sabadell', 
      brand: { 
        logoUrl: '/assets/banks/sabadell-logo.png',
        color: '#0066CC'
      } 
    },
    '2100': { 
      name: 'CaixaBank', 
      brand: { 
        logoUrl: '/assets/banks/caixabank-logo.png',
        color: '#0063B2'
      } 
    },
    '0128': { 
      name: 'Bankinter', 
      brand: { 
        logoUrl: '/assets/banks/bankinter-logo.png',
        color: '#FF6600'
      } 
    },
    '0030': { 
      name: 'Banco Español de Crédito (Banesto)', 
      brand: { 
        logoUrl: '/assets/banks/banesto-logo.png',
        color: '#00A000'
      } 
    }
  };

  const bankInfo = spanishBanks[bankCode];
  
  if (bankInfo) {
    return {
      code: bankCode,
      name: bankInfo.name,
      brand: bankInfo.brand
    };
  }
  
  return { code: bankCode, name: `Banco ${bankCode}` };
}

/**
 * Infer bank information from IBAN
 * @param iban - IBAN string
 * @param catalog - Bank catalog object
 * @returns Bank information or null if not found
 */
export function inferBank(iban: string, catalog: Record<string, BankInfo>): BankInfo | null {
  if (!iban) return null;
  
  const clean = iban.replace(/\s/g, '').toUpperCase();
  if (clean.length < 8 || !clean.startsWith('ES')) return null;
  
  const bankCode = clean.substring(4, 8); // Extract positions 5-8
  const bankInfo = catalog[bankCode];
  
  if (bankInfo) {
    return {
      code: bankCode,
      name: bankInfo.name,
      logoUrl: bankInfo.logoUrl,
      color: bankInfo.color
    };
  }
  
  return { code: bankCode };
}

/**
 * Generate a hash-based color from a string
 * @param str - Input string
 * @returns CSS color value
 */
export function generateHashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 50%)`;
}

/**
 * Get initial letter for avatar fallback
 * @param alias - Account alias
 * @returns First letter in uppercase
 */
export function getAvatarInitial(alias: string): string {
  return alias ? alias.charAt(0).toUpperCase() : '?';
}

/**
 * Normalize IBAN for storage (remove spaces, uppercase)
 * @param iban - Raw IBAN input
 * @returns Normalized IBAN string
 */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s/g, '').toUpperCase();
}

/**
 * Load banks catalog from public assets
 * @returns Promise with bank catalog
 */
export async function loadBanksCatalog(): Promise<Record<string, BankInfo>> {
  try {
    const response = await fetch('/assets/banks.catalog.json');
    if (!response.ok) {
      console.warn('[ACCOUNTS] Banks catalog not found, using empty catalog');
      return {};
    }
    return await response.json();
  } catch (error) {
    console.warn('[ACCOUNTS] Failed to load banks catalog:', error);
    return {};
  }
}