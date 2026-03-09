// ATLAS HORIZON - Field Validation Service
// Implements exact validation rules from problem statement

import { OCRExtractionResult, FieldValidationResult } from '../types/inboxTypes';

/**
 * Validate OCR fields according to exact requirements:
 * 
 * Critical fields (for marking OK):
 * - total_amount, supplier_name, issue_date
 * - due_date if exists; if not, mark —
 * 
 * Optional fields (don't block):
 * - supplier_tax_id, net_amount, tax_amount, service_address, iban_mask, line_items
 * 
 * Key rule: if net_amount or tax_amount missing/don't match, don't block. Trust total_amount.
 */
export class FieldValidationService {

  /**
   * Validate fields for general documents (factura, otros)
   */
  validateGeneralDocument(ocrData: OCRExtractionResult): FieldValidationResult {
    const criticalFieldsMissing: string[] = [];
    const confidence = this.calculateFieldConfidence(ocrData);

    // Critical field checks
    if (!ocrData.total_amount || ocrData.total_amount <= 0) {
      criticalFieldsMissing.push('total_amount');
    }
    
    if (!ocrData.supplier_name || ocrData.supplier_name.trim().length === 0) {
      criticalFieldsMissing.push('supplier_name');
    }
    
    if (!ocrData.issue_date) {
      criticalFieldsMissing.push('issue_date');
    }

    // due_date is critical if it exists, but not required to exist
    // (no action needed - handled in display logic)

    const isValid = criticalFieldsMissing.length === 0;
    const reviewRequired = !isValid;

    return {
      isValid,
      criticalFieldsMissing,
      confidence,
      reviewRequired,
      reviewReason: reviewRequired ? `Faltan campos críticos: ${criticalFieldsMissing.join(', ')}` : undefined
    };
  }

  /**
   * Validate fields for SEPA receipts (recibo_sepa)
   * Different rules: don't require base/IVA; only supplier_name, total_amount, charge_date, iban_mask
   */
  validateReciboSepa(ocrData: OCRExtractionResult): FieldValidationResult {
    const criticalFieldsMissing: string[] = [];
    const confidence = this.calculateFieldConfidence(ocrData);

    // For SEPA receipts, only require supplier_name and total_amount
    if (!ocrData.total_amount || ocrData.total_amount <= 0) {
      criticalFieldsMissing.push('total_amount');
    }
    
    if (!ocrData.supplier_name || ocrData.supplier_name.trim().length === 0) {
      criticalFieldsMissing.push('supplier_name');
    }

    // charge_date and iban_mask are nice to have but not critical for SEPA receipts
    
    const isValid = criticalFieldsMissing.length === 0;

    return {
      isValid,
      criticalFieldsMissing,
      confidence,
      reviewRequired: !isValid,
      reviewReason: !isValid ? `Recibo SEPA - faltan campos: ${criticalFieldsMissing.join(', ')}` : undefined
    };
  }

  /**
   * Calculate confidence scores for extracted fields
   * Green (≥85%) / Amber (70–84%) / Red (<70%)
   */
  private calculateFieldConfidence(ocrData: OCRExtractionResult): { global: number; fields: { [fieldName: string]: number } } {
    const fields: { [fieldName: string]: number } = {};
    const scores: number[] = [];

    // Use confidence scores from OCR if available
    if (ocrData.confidenceScores) {
      Object.assign(fields, ocrData.confidenceScores);
      scores.push(...Object.values(ocrData.confidenceScores));
    } else {
      // Estimate confidence based on field presence and quality
      
      // Critical fields
      if (ocrData.total_amount !== undefined) {
        const amountConfidence = this.estimateAmountConfidence(ocrData.total_amount);
        fields.total_amount = amountConfidence;
        scores.push(amountConfidence);
      }

      if (ocrData.supplier_name !== undefined) {
        const supplierConfidence = this.estimateSupplierConfidence(ocrData.supplier_name);
        fields.supplier_name = supplierConfidence;
        scores.push(supplierConfidence);
      }

      if (ocrData.issue_date !== undefined) {
        const dateConfidence = this.estimateDateConfidence(ocrData.issue_date);
        fields.issue_date = dateConfidence;
        scores.push(dateConfidence);
      }

      // Optional fields
      if (ocrData.supplier_tax_id !== undefined) {
        fields.supplier_tax_id = this.estimateTaxIdConfidence(ocrData.supplier_tax_id);
      }

      if (ocrData.due_date !== undefined) {
        fields.due_date = this.estimateDateConfidence(ocrData.due_date);
      }

      if (ocrData.service_address !== undefined) {
        fields.service_address = this.estimateAddressConfidence(ocrData.service_address);
      }

      if (ocrData.iban_mask !== undefined) {
        fields.iban_mask = this.estimateIbanConfidence(ocrData.iban_mask);
      }
    }

    const globalConfidence = scores.length > 0 
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;

    return {
      global: globalConfidence,
      fields
    };
  }

  /**
   * Get confidence color/level for UI display
   */
  getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 85) return 'high';    // Green
    if (confidence >= 70) return 'medium';  // Amber  
    return 'low';                           // Red
  }

  /**
   * Get confidence color for UI
   */
  getConfidenceColor(confidence: number): string {
    const level = this.getConfidenceLevel(confidence);
    switch (level) {
      case 'high': return 'var(--hz-success)';    // Atlas success green
      case 'medium': return 'var(--hz-warning)';  // Atlas warning yellow
      case 'low': return 'var(--hz-error)';       // Atlas error red
    }
  }

  /**
   * Check if base + tax amounts match total (for display, but don't block)
   * Key rule: if net_amount or tax_amount missing/don't match, don't block
   */
  checkAmountConsistency(ocrData: OCRExtractionResult): { 
    isConsistent: boolean; 
    warning?: string;
    shouldShowWarning: boolean;
  } {
    const { total_amount, net_amount, tax_amount } = ocrData;

    // If any amount is missing, don't show warnings
    if (!total_amount || !net_amount || !tax_amount) {
      return {
        isConsistent: true,
        shouldShowWarning: false
      };
    }

    const calculatedTotal = net_amount + tax_amount;
    const difference = Math.abs(total_amount - calculatedTotal);
    const tolerance = 0.02; // 2 cents tolerance

    if (difference > tolerance) {
      return {
        isConsistent: false,
        warning: `Base (${net_amount.toFixed(2)}) + IVA (${tax_amount.toFixed(2)}) = ${calculatedTotal.toFixed(2)} ≠ Total (${total_amount.toFixed(2)})`,
        shouldShowWarning: false // Don't show for recibo_sepa, configurable for facturas
      };
    }

    return {
      isConsistent: true,
      shouldShowWarning: false
    };
  }

  // Private estimation methods
  private estimateAmountConfidence(amount: number): number {
    if (amount <= 0) return 0;
    if (amount > 0 && amount < 999999) return 85; // Reasonable range
    return 70; // Very high amounts might be OCR errors
  }

  private estimateSupplierConfidence(supplier: string): number {
    if (!supplier || supplier.trim().length === 0) return 0;
    if (supplier.length < 3) return 60; // Very short names are suspicious
    if (supplier.length >= 3 && supplier.length <= 50) return 85; // Reasonable length
    return 70; // Very long names might have OCR artifacts
  }

  private estimateDateConfidence(date: string): number {
    if (!date) return 0;
    
    // Try to parse the date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return 50; // Invalid date format
    
    const currentYear = new Date().getFullYear();
    const dateYear = parsedDate.getFullYear();
    
    // Reasonable date range (last 5 years to next 2 years)
    if (dateYear >= (currentYear - 5) && dateYear <= (currentYear + 2)) {
      return 90;
    }
    
    return 60; // Date outside reasonable range
  }

  private estimateTaxIdConfidence(taxId: string): number {
    if (!taxId) return 0;
    
    // Spanish NIF/CIF pattern check (basic)
    const nifPattern = /^[0-9]{8}[A-Z]$/;
    const cifPattern = /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/;
    
    if (nifPattern.test(taxId) || cifPattern.test(taxId)) {
      return 90;
    }
    
    // Basic format check (letters and numbers)
    if (/^[A-Z0-9]{6,12}$/.test(taxId)) {
      return 75;
    }
    
    return 60; // Present but doesn't match expected format
  }

  private estimateAddressConfidence(address: string): number {
    if (!address || address.length < 5) return 50;
    if (address.length >= 10) return 80;
    return 65;
  }

  private estimateIbanConfidence(iban: string): number {
    if (!iban) return 0;
    
    // Check if it looks like a masked IBAN
    if (/\*{4}/.test(iban) && iban.length >= 8) {
      return 85; // Properly masked IBAN
    }
    
    // Basic IBAN pattern
    if (/^[A-Z]{2}[0-9]{2}/.test(iban)) {
      return 90;
    }
    
    return 60; // Present but doesn't look like IBAN
  }
}

// Export singleton instance
export const fieldValidationService = new FieldValidationService();