/**
 * Infallible Sign Derivation Service
 * Derives transaction sign from column structure, never from text descriptions
 */

import { NumberLocale, ParsedAmount } from './localeDetector';
import { parseAmountToCents } from './localeAmount';

export interface SignDerivationResult {
  amount: number;
  confidence: number;
  method: 'debit_credit' | 'signed_amount' | 'amount_only';
  originalValues: {
    debit?: number;
    credit?: number;
    amount?: number;
  };
}

export interface ColumnValues {
  debit?: string | number;      // Débito / Debe / Cargo
  credit?: string | number;     // Crédito / Haber / Abono
  amount?: string | number;
  // Additional Spanish column names support
  debe?: string | number;       // Alternative for debit
  haber?: string | number;      // Alternative for credit  
  cargo?: string | number;      // Alternative for debit
  abono?: string | number;      // Alternative for credit
  debito?: string | number;     // Alternative for debit
  credito?: string | number;    // Alternative for credit
}

export class SignDerivationService {
  
  /**
   * Derive signed amount from column values
   * Priority: 1) Debit/Credit columns 2) Signed amount column 3) Amount only
   */
  deriveSignedAmount(
    values: ColumnValues,
    locale: NumberLocale
  ): SignDerivationResult {
    
    // Method 1: Separate debit/credit columns (most reliable)
    // Check for any debit-type column (debit, debe, cargo, débito)
    const debitValue = values.debit || values.debe || values.cargo || values.debito;
    // Check for any credit-type column (credit, haber, abono, crédito)
    const creditValue = values.credit || values.haber || values.abono || values.credito;
    
    if (debitValue !== undefined || creditValue !== undefined) {
      return this.deriveFromDebitCredit({
        debit: debitValue,
        credit: creditValue
      }, locale);
    }
    
    // Method 2: Single signed amount column
    if (values.amount !== undefined) {
      return this.deriveFromSignedAmount(values, locale);
    }
    
    // No valid amount data
    return {
      amount: 0,
      confidence: 0,
      method: 'amount_only',
      originalValues: {}
    };
  }

  /**
   * Derive amount from separate debit/credit columns
   */
  private deriveFromDebitCredit(
    values: ColumnValues,
    locale: NumberLocale
  ): SignDerivationResult {
    let debitValue = 0;
    let creditValue = 0;
    let confidence = 0.95; // High confidence for explicit debit/credit

    // Parse debit value
    if (values.debit !== undefined && values.debit !== null && values.debit !== '') {
      const debitStr = values.debit.toString().trim();
      if (debitStr) {
        const parsed = this.parseNumber(debitStr, locale);
        if (parsed.confidence > 0.5) {
          debitValue = Math.abs(parsed.value); // Always positive for debit amount
        } else {
          confidence *= 0.8; // Reduce confidence for parse errors
        }
      }
    }

    // Parse credit value
    if (values.credit !== undefined && values.credit !== null && values.credit !== '') {
      const creditStr = values.credit.toString().trim();
      if (creditStr) {
        const parsed = this.parseNumber(creditStr, locale);
        if (parsed.confidence > 0.5) {
          creditValue = Math.abs(parsed.value); // Always positive for credit amount
        } else {
          confidence *= 0.8; // Reduce confidence for parse errors
        }
      }
    }

    // Validate: should have exactly one non-zero value
    const hasDebit = debitValue > 0;
    const hasCredit = creditValue > 0;

    if (hasDebit && hasCredit) {
      // Both values present - unusual but take the larger one
      confidence *= 0.6;
      if (debitValue >= creditValue) {
        return {
          amount: -debitValue, // Debit is negative
          confidence,
          method: 'debit_credit',
          originalValues: { debit: debitValue, credit: creditValue }
        };
      } else {
        return {
          amount: creditValue, // Credit is positive
          confidence,
          method: 'debit_credit', 
          originalValues: { debit: debitValue, credit: creditValue }
        };
      }
    }

    if (hasDebit) {
      return {
        amount: -debitValue, // Debit is negative (expense/outgoing)
        confidence,
        method: 'debit_credit',
        originalValues: { debit: debitValue }
      };
    }

    if (hasCredit) {
      return {
        amount: creditValue, // Credit is positive (income/incoming)
        confidence,
        method: 'debit_credit',
        originalValues: { credit: creditValue }
      };
    }

    // No values in either column
    return {
      amount: 0,
      confidence: 0.1,
      method: 'debit_credit',
      originalValues: { debit: 0, credit: 0 }
    };
  }

  /**
   * Derive amount from single signed amount column
   */
  private deriveFromSignedAmount(
    values: ColumnValues,
    locale: NumberLocale
  ): SignDerivationResult {
    if (values.amount === undefined || values.amount === null || values.amount === '') {
      return {
        amount: 0,
        confidence: 0,
        method: 'signed_amount',
        originalValues: {}
      };
    }

    const amountStr = values.amount.toString().trim();
    if (!amountStr) {
      return {
        amount: 0,
        confidence: 0,
        method: 'signed_amount',
        originalValues: {}
      };
    }

    const parsed = this.parseNumber(amountStr, locale);
    
    return {
      amount: parsed.value, // Keep original sign from data
      confidence: Math.min(parsed.confidence, 0.9), // Slightly lower than debit/credit
      method: 'signed_amount',
      originalValues: { amount: parsed.value }
    };
  }

  /**
   * Parse number with locale awareness - Enhanced with parseAmountToCents
   * Handles: 1.234,56 (EU), 1,234.56 (EN), -38,69, +25,00, (38,69), €, EUR
   * Returns: amount in euros (decimal)
   * Note: Handles high precision decimals (>2) by preserving them as floats
   */
  private parseNumber(str: string, locale: NumberLocale): { value: number; confidence: number } {
    try {
      // First try parseAmountToCents for robust parsing
      const result = parseAmountToCents(str);
      
      if (!result.ok) {
        return { value: 0, confidence: 0 };
      }
      
      // Convert cents to euros
      const euros = result.cents / 100;
      
      // Check if original had more than 2 decimal places
      // If so, re-parse to preserve precision beyond cents
      const cleaned = str.replace(/\s|\u00A0|€|EUR|CR|DR/gi, '').replace(/[()]/g, '').replace(/^[-+]|-$/g, '').trim();
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      
      let decimalDigits = 0;
      if (lastComma > lastDot && lastComma > -1) {
        decimalDigits = cleaned.substring(lastComma + 1).length;
      } else if (lastDot > lastComma && lastDot > -1) {
        decimalDigits = cleaned.substring(lastDot + 1).length;
      }
      
      // If high precision (>2 decimals), parse directly to preserve precision
      if (decimalDigits > 2) {
        let normalized = cleaned;
        let isNegative = str.includes('-') || str.includes('(') || /\bDR\b/i.test(str);
        
        if (locale.decimalSep === ',') {
          // Spanish: remove dots (thousands), replace comma with dot
          normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else {
          // Anglo: remove commas (thousands)
          normalized = normalized.replace(/,/g, '');
        }
        
        const highPrecValue = parseFloat(normalized);
        if (!isNaN(highPrecValue)) {
          return {
            value: isNegative ? -Math.abs(highPrecValue) : Math.abs(highPrecValue),
            confidence: 0.9
          };
        }
      }
      
      return {
        value: euros,
        confidence: 0.9
      };
      
    } catch (error) {
      return { value: 0, confidence: 0 };
    }
  }

  /**
   * Validate sign derivation result
   */
  validateSignDerivation(result: SignDerivationResult): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let isValid = true;

    // Check confidence
    if (result.confidence < 0.5) {
      warnings.push('Low confidence in amount parsing');
      isValid = false;
    }

    // Check for zero amounts in financial context
    if (result.amount === 0) {
      warnings.push('Zero amount detected');
    }

    // Check for unreasonable amounts
    if (Math.abs(result.amount) > 1000000) {
      warnings.push('Very large amount detected, please verify');
    }

    // Method-specific validations
    if (result.method === 'debit_credit') {
      const { debit, credit } = result.originalValues;
      if (debit && credit && debit > 0 && credit > 0) {
        warnings.push('Both debit and credit values present');
      }
    }

    return { isValid, warnings };
  }
}

export const signDerivationService = new SignDerivationService();