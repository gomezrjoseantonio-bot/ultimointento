// ATLAS HORIZON - OCR Extraction Service
// Implements OCR extraction following exact requirements

import { OCRExtractionResult } from '../types/inboxTypes';
import { processDocumentOCR } from './documentAIService';

/**
 * Extract required fields from document using OCR
 * Following exact requirements: extraer lo imprescindible y NO bloquear por IVA
 */
export async function extractOCRFields(fileUrl: string, mime: string): Promise<OCRExtractionResult | null> {
  try {
    // Fetch document content
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('file_unreadable');
    }

    const blob = await response.blob();
    const filename = extractFilenameFromUrl(fileUrl);

    // Call existing OCR service
    const ocrResult = await processDocumentOCR(blob, filename);

    if (ocrResult.status === 'error') {
      throw new Error(ocrResult.error || 'OCR failed');
    }

    // Extract required fields from OCR result
    const extractedData: OCRExtractionResult = {
      metadata: {}
    };

    // Process OCR fields
    for (const field of ocrResult.fields || []) {
      switch (field.name) {
        case 'supplier_name':
          extractedData.supplier_name = cleanText(field.value);
          break;
        case 'supplier_tax_id':
          extractedData.supplier_tax_id = cleanTaxId(field.value);
          break;
        case 'total_amount':
          extractedData.total_amount = parseAmount(field.value);
          break;
        case 'invoice_date':
        case 'issue_date':
          extractedData.issue_date = formatDateToISO(field.value);
          break;
        case 'due_date':
        case 'due_or_charge_date':
          extractedData.due_date = formatDateToISO(field.value);
          break;
        case 'service_address':
        case 'receiver_address':
          if (!extractedData.service_address) {
            extractedData.service_address = cleanText(field.value);
          }
          break;
        case 'currency':
          extractedData.currency = field.value?.toUpperCase() || 'EUR';
          break;
        // Store optional base/tax data as metadata
        case 'net_amount':
        case 'subtotal':
        case 'tax_amount':
          if (extractedData.metadata) {
            extractedData.metadata[field.name] = parseAmount(field.value);
          }
          break;
      }
    }

    // Extract IBAN mask from full OCR text if not found in structured fields
    if (!extractedData.iban_mask) {
      extractedData.iban_mask = extractIBANMask(ocrResult.fields?.map(f => f.raw).join(' ') || '');
    }

    // Validate mandatory field: total_amount
    if (!extractedData.total_amount || extractedData.total_amount <= 0) {
      console.warn('[OCR] Missing or invalid total_amount:', extractedData.total_amount);
      return null; // This will trigger 'review' status
    }

    // Set default currency if not detected
    if (!extractedData.currency) {
      extractedData.currency = 'EUR';
    }

    console.log('[OCR] Extracted fields:', {
      supplier_name: extractedData.supplier_name,
      supplier_tax_id: extractedData.supplier_tax_id,
      total_amount: extractedData.total_amount,
      issue_date: extractedData.issue_date,
      service_address: extractedData.service_address?.substring(0, 50) + '...',
      iban_mask: extractedData.iban_mask,
      currency: extractedData.currency
    });

    return extractedData;

  } catch (error) {
    console.error('[OCR] Extraction error:', error);
    
    if (error instanceof Error && error.message === 'file_unreadable') {
      throw error; // Preserve specific error for proper handling
    }
    
    throw new Error('OCR processing failed');
  }
}

/**
 * Extract IBAN mask using flexible regex as specified
 */
function extractIBANMask(text: string): string | undefined {
  // Ejemplo ES: ES\d{2}[\s-]?([X•]{2,8}|[*X•\s\d]{8,})[\s\d]+
  const ibanRegex = /ES\d{2}[\s-]?([X•*]{2,8}|[*X•\s\d]{8,})[\s\d]*/gi;
  const matches = text.match(ibanRegex);
  
  if (matches && matches.length > 0) {
    // Return the first match, cleaned up
    let iban = matches[0].replace(/\s+/g, '');
    
    // Ensure we have asterisks/masks, not plain numbers
    if (iban.includes('*') || iban.includes('•') || iban.includes('X')) {
      return iban;
    }
    
    // If it's a plain IBAN, mask it
    if (iban.length >= 10) {
      return iban.substring(0, 4) + '••••••••••••••••••' + iban.substring(iban.length - 4);
    }
  }

  // Try other patterns for other countries or generic patterns
  const genericIbanRegex = /[A-Z]{2}\d{2}[\s-]?[*•X\d\s]{10,}/gi;
  const genericMatches = text.match(genericIbanRegex);
  
  if (genericMatches && genericMatches.length > 0) {
    let iban = genericMatches[0].replace(/\s+/g, '');
    if (iban.includes('*') || iban.includes('•') || iban.includes('X')) {
      return iban;
    }
  }

  return undefined;
}

/**
 * Clean and normalize text fields
 */
function cleanText(value: any): string | undefined {
  if (!value) return undefined;
  
  const cleaned = String(value).trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Clean and validate tax ID (CIF/NIF)
 */
function cleanTaxId(value: any): string | undefined {
  if (!value) return undefined;
  
  let cleaned = String(value).trim().toUpperCase();
  
  // Remove common OCR artifacts
  cleaned = cleaned.replace(/[^\w\d]/g, '');
  
  // Validate basic Spanish tax ID format
  if (cleaned.match(/^[A-Z]\d{8}$/) || cleaned.match(/^\d{8}[A-Z]$/)) {
    return cleaned;
  }
  
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Parse amount from various formats
 */
function parseAmount(value: any): number | undefined {
  if (!value) return undefined;
  
  if (typeof value === 'number') {
    return value > 0 ? value : undefined;
  }
  
  let amountStr = String(value).trim();
  
  // Remove currency symbols and normalize
  amountStr = amountStr.replace(/[€$£¥]/g, '');
  amountStr = amountStr.replace(/[^\d,.-]/g, '');
  
  // Handle European format (1.234,56) vs US format (1,234.56)
  if (amountStr.includes(',') && amountStr.includes('.')) {
    // Check which is the decimal separator
    const lastComma = amountStr.lastIndexOf(',');
    const lastDot = amountStr.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // European format: 1.234,56
      amountStr = amountStr.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      amountStr = amountStr.replace(/,/g, '');
    }
  } else if (amountStr.includes(',')) {
    // Only comma - could be thousands separator or decimal
    const commaCount = (amountStr.match(/,/g) || []).length;
    if (commaCount === 1 && amountStr.indexOf(',') > amountStr.length - 4) {
      // Likely decimal: 123,45
      amountStr = amountStr.replace(',', '.');
    } else {
      // Likely thousands: 1,234 or 1,234,567
      amountStr = amountStr.replace(/,/g, '');
    }
  }
  
  const parsed = parseFloat(amountStr);
  return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Format date to ISO string
 */
function formatDateToISO(value: any): string | undefined {
  if (!value) return undefined;
  
  const dateStr = String(value).trim();
  
  // Try various date formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // 2024-01-15
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // 15/01/2024
    /^(\d{2})-(\d{2})-(\d{4})$/, // 15-01-2024
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // 5/1/2024
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      
      if (format === formats[0]) {
        // Already in ISO format
        [, year, month, day] = match;
      } else {
        // European format: day/month/year
        [, day, month, year] = match;
      }
      
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Return just YYYY-MM-DD
      }
    }
  }
  
  // Try to parse as natural date
  const naturalDate = new Date(dateStr);
  if (!isNaN(naturalDate.getTime())) {
    return naturalDate.toISOString().split('T')[0];
  }
  
  return undefined;
}

/**
 * Extract filename from URL
 */
function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'document';
    return filename;
  } catch {
    return 'document.pdf';
  }
}