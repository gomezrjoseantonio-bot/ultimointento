// UNICORNIO PROMPT 1 - IBAN and Account Matching Service
// Implements exact IBAN extraction and account matching logic as specified

import { Account } from './db';
import { treasuryAPI } from './treasuryApiService';
import { safeMatch } from '../utils/safe';

export interface IBANExtractionResult {
  iban_completo?: string;     // Full IBAN if found
  iban_mask?: string;         // Masked IBAN (ES12 **** **** 1234)
  last4?: string;             // Last 4 digits for matching
  source: 'column' | 'header' | 'filename' | 'none';
  confidence: number;
}

export interface AccountMatchResult {
  cuenta_id?: number;
  matches: Array<{
    cuenta_id: number;
    account_name: string;
    iban?: string;
    last4: string;
    confidence: number;
  }>;
  requiresSelection: boolean;
  blockingReason?: string;
}

/**
 * Extract IBAN from bank statement file following exact specification
 */
export async function extractIBANFromBankStatement(
  file: File,
  filename: string
): Promise<IBANExtractionResult> {
  
  try {
    // 1. Try to read file content for CSV/XLS analysis
    const fileContent = await file.text();
    const lines = fileContent.split('\n').map(line => line.trim()).filter(Boolean);
    
    // 2. Look for IBAN in column headers (first few lines)
    const headerLines = lines.slice(0, 5);
    for (const line of headerLines) {
      const ibanFromHeader = extractIBANFromText(line);
      if (ibanFromHeader.iban_completo || ibanFromHeader.iban_mask) {
        return {
          ...ibanFromHeader,
          source: 'header',
          confidence: 0.9
        };
      }
    }
    
    // 3. Look for typical column names and extract from data
    const potentialIBANColumns = findIBANColumns(lines);
    if (potentialIBANColumns.length > 0) {
      const ibanFromColumn = extractIBANFromText(potentialIBANColumns[0]);
      if (ibanFromColumn.iban_completo || ibanFromColumn.iban_mask) {
        return {
          ...ibanFromColumn,
          source: 'column',
          confidence: 0.8
        };
      }
    }
    
    // 4. Try filename
    const ibanFromFilename = extractIBANFromText(filename);
    if (ibanFromFilename.iban_completo || ibanFromFilename.iban_mask) {
      return {
        ...ibanFromFilename,
        source: 'filename',
        confidence: 0.7
      };
    }
    
    return {
      source: 'none',
      confidence: 0
    };
    
  } catch (error) {
    console.error('Error extracting IBAN:', error);
    return {
      source: 'none',
      confidence: 0
    };
  }
}

/**
 * Extract IBAN patterns from text using regex
 */
function extractIBANFromText(text: string): Omit<IBANExtractionResult, 'source' | 'confidence'> {
  if (!text) return {};
  
  // ES IBAN regex patterns
  const maskedIbanRegex = /ES[0-9]{2}[\s*x•-]{0,4}[*x•\s\d]{8,}[\s\d]*([0-9]{4})/gi;
  
  // Look for complete IBAN
  const completeMatch = safeMatch(text, /ES[0-9]{2}[0-9]{20}/gi);
  if (completeMatch && completeMatch[0]) {
    const iban = completeMatch[0].replace(/\s/g, '');
    return {
      iban_completo: iban,
      iban_mask: maskIBAN(iban),
      last4: iban.slice(-4)
    };
  }
  
  // Look for masked IBAN with last 4 digits visible
  const maskedMatch = safeMatch(text, maskedIbanRegex);
  if (maskedMatch && maskedMatch[0]) {
    const fullMatch = maskedMatch[0];
    const last4Match = safeMatch(fullMatch, /([0-9]{4})$/);
    if (last4Match) {
      const last4 = last4Match[1];
      const normalizedMask = normalizeIBANMask(fullMatch);
      return {
        iban_mask: normalizedMask,
        last4: last4
      };
    }
  }
  
  // Look for just last 4 digits patterns
  const last4Regex = /\b[0-9]{4}\b/g;
  const last4Matches = safeMatch(text, last4Regex);
  if (last4Matches && last4Matches.length === 1) {
    // Only if there's exactly one 4-digit number, assume it's account last4
    return {
      last4: last4Matches[0]
    };
  }
  
  return {};
}

/**
 * Find potential IBAN columns in CSV data
 */
function findIBANColumns(lines: string[]): string[] {
  const ibanColumnNames = [
    'iban', 'cuenta', 'account', 'iban cuenta', 'número de cuenta', 
    'numero de cuenta', 'num cuenta', 'nº cuenta'
  ];
  
  if (lines.length === 0) return [];
  
  // Check header line
  const headerLine = lines[0].toLowerCase();
  const columns = headerLine.split(/[,;\t]/);
  
  const ibanColumnIndex = columns.findIndex(col => 
    ibanColumnNames.some(name => col.includes(name))
  );
  
  if (ibanColumnIndex >= 0 && lines.length > 1) {
    // Return values from that column
    return lines.slice(1).map(line => {
      const values = line.split(/[,;\t]/);
      return values[ibanColumnIndex] || '';
    }).filter(Boolean);
  }
  
  return [];
}

/**
 * Mask a complete IBAN: ES12 **** **** 1234
 */
export function maskIBAN(iban: string): string {
  if (iban.length < 8) return iban;
  return `${iban.substring(0, 4)} **** **** ${iban.substring(iban.length - 4)}`;
}

/**
 * Normalize masked IBAN format
 */
function normalizeIBANMask(masked: string): string {
  // Clean and standardize format
  const cleaned = masked.replace(/\s+/g, ' ').trim();
  
  // Extract ES prefix and last 4 digits
  const esMatch = safeMatch(cleaned, /^ES\d{2}/);
  const last4Match = safeMatch(cleaned, /(\d{4})$/);
  
  if (esMatch && last4Match) {
    return `${esMatch[0]} **** **** ${last4Match[1]}`;
  }
  
  return cleaned;
}

/**
 * Match extracted IBAN against registered accounts
 */
export async function matchAccountByIBAN(
  ibanData: IBANExtractionResult
): Promise<AccountMatchResult> {
  
  try {
    const accounts = await treasuryAPI.accounts.getAccounts();
    const matches: AccountMatchResult['matches'] = [];
    
    // 1. Try exact IBAN match first
    if (ibanData.iban_completo) {
      const exactMatch = accounts.find(acc => 
        acc.iban === ibanData.iban_completo
      );
      
      if (exactMatch) {
        return {
          cuenta_id: exactMatch.id,
          matches: [{
            cuenta_id: exactMatch.id!,
            account_name: exactMatch.name || `${exactMatch.bank} - ${exactMatch.iban.slice(-4)}`,
            iban: exactMatch.iban,
            last4: exactMatch.iban?.slice(-4) || '',
            confidence: 0.95
          }],
          requiresSelection: false
        };
      }
    }
    
    // 2. Try last4 matching if no exact match
    if (ibanData.last4) {
      const last4Matches = accounts.filter(acc => 
        acc.iban?.slice(-4) === ibanData.last4
      );
      
      for (const account of last4Matches) {
        matches.push({
          cuenta_id: account.id!,
          account_name: account.name || `${account.bank} - ${account.iban.slice(-4)}`,
          iban: account.iban,
          last4: account.iban?.slice(-4) || '',
          confidence: 0.7
        });
      }
      
      // Return result based on number of matches
      if (matches.length === 1) {
        return {
          cuenta_id: matches[0].cuenta_id,
          matches,
          requiresSelection: false
        };
      } else if (matches.length > 1) {
        return {
          matches,
          requiresSelection: true,
          blockingReason: `Múltiples cuentas coinciden con últimos 4 dígitos: ${ibanData.last4}`
        };
      }
    }
    
    // 3. No matches found
    return {
      matches: [],
      requiresSelection: true,
      blockingReason: ibanData.source === 'none' 
        ? 'No se pudo detectar IBAN en el archivo'
        : 'No se encontró cuenta registrada que coincida con el IBAN detectado'
    };
    
  } catch (error) {
    console.error('Error matching account by IBAN:', error);
    return {
      matches: [],
      requiresSelection: true,
      blockingReason: 'Error al buscar cuentas registradas'
    };
  }
}

/**
 * Classify account usage for destination display
 */
export function getAccountUsageDisplay(account: Account): string {
  // This would ideally come from account.usage field
  // For now, infer from account name/type
  const name = (account.name || account.bank || 'account').toLowerCase();
  
  if (name.includes('personal') || name.includes('particular')) {
    return 'Personal';
  } else if (name.includes('inmueble') || name.includes('propiedad') || name.includes('alquiler')) {
    return 'Inmuebles';
  } else {
    return 'Ambos';
  }
}