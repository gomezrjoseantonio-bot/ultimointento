// H8: CSV Parser Service for Bank Extracts
import { Movement } from './db';

export interface BankMapping {
  dateField: string;
  valueDateField?: string;
  amountField: string;
  descriptionField: string;
  counterpartyField?: string;
  referenceField?: string;
  dateFormat: string;
  decimalSeparator: ',' | '.';
  skipRows?: number;
}

export interface CSVRow {
  [key: string]: string;
}

export interface ParsedMovement {
  date: string;
  valueDate?: string;
  amount: number;
  description: string;
  counterparty?: string;
  reference?: string;
  rawData: CSVRow;
}

export interface CSVParseResult {
  movements: ParsedMovement[];
  totalRows: number;
  errors: string[];
  detectedBank: string;
  preview: ParsedMovement[];
}

// Bank-specific mappings (as specified in requirements)
const BANK_MAPPINGS: Record<string, BankMapping> = {
  bbva: {
    dateField: 'Fecha',
    valueDateField: 'Fecha valor',
    amountField: 'Importe',
    descriptionField: 'Concepto',
    counterpartyField: 'Oficina / Cajero',
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: ',',
    skipRows: 0
  },
  santander: {
    dateField: 'Fecha',
    valueDateField: 'Fecha valor',
    amountField: 'Importe',
    descriptionField: 'Concepto',
    counterpartyField: 'Beneficiario/Ordenante',
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: ',',
    skipRows: 0
  },
  caixa: {
    dateField: 'Data',
    valueDateField: 'Data valor',
    amountField: 'Import',
    descriptionField: 'Concepte',
    counterpartyField: 'Contraparte',
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: ',',
    skipRows: 0
  },
  ing: {
    dateField: 'Fecha',
    valueDateField: 'Fecha efectiva',
    amountField: 'Cantidad',
    descriptionField: 'Descripción',
    counterpartyField: 'Cuenta contraparte',
    dateFormat: 'DD-MM-YYYY',
    decimalSeparator: ',',
    skipRows: 0
  },
  generic: {
    dateField: 'fecha',
    valueDateField: 'fecha_valor',
    amountField: 'importe',
    descriptionField: 'descripcion',
    counterpartyField: 'contraparte',
    dateFormat: 'YYYY-MM-DD',
    decimalSeparator: '.',
    skipRows: 0
  }
};

// Detect CSV separator
function detectSeparator(csvText: string): ',' | ';' {
  const firstLine = csvText.split('\n')[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

// Detect bank from CSV headers
function detectBank(headers: string[]): string {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // BBVA detection
  if (normalizedHeaders.includes('fecha') && normalizedHeaders.includes('concepto') && 
      normalizedHeaders.some(h => h.includes('oficina'))) {
    return 'bbva';
  }
  
  // Santander detection
  if (normalizedHeaders.includes('fecha') && normalizedHeaders.includes('concepto') && 
      normalizedHeaders.some(h => h.includes('beneficiario') || h.includes('ordenante'))) {
    return 'santander';
  }
  
  // CaixaBank detection
  if (normalizedHeaders.includes('data') && normalizedHeaders.includes('concepte')) {
    return 'caixa';
  }
  
  // ING detection
  if (normalizedHeaders.includes('fecha') && normalizedHeaders.includes('descripción') && 
      normalizedHeaders.some(h => h.includes('efectiva'))) {
    return 'ing';
  }
  
  return 'generic';
}

// Parse date according to format
function parseDate(dateStr: string, format: string): string {
  if (!dateStr) return '';
  
  const cleanDate = dateStr.trim();
  
  try {
    if (format === 'DD/MM/YYYY' || format === 'DD-MM-YYYY') {
      const parts = cleanDate.split(/[/\-]/);  // eslint-disable-line no-useless-escape
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    } else if (format === 'YYYY-MM-DD') {
      return cleanDate; // Already in correct format
    }
  } catch (error) {
    console.warn('Date parsing error:', error);
  }
  
  return cleanDate;
}

// Parse amount according to decimal separator
function parseAmount(amountStr: string, decimalSeparator: ',' | '.'): number {
  if (!amountStr) return 0;
  
  let cleanAmount = amountStr.trim();
  
  // Remove currency symbols and spaces
  cleanAmount = cleanAmount.replace(/[€$£¥]/g, '').replace(/\s/g, '');
  
  // Handle European format (1.234,56) vs US format (1,234.56)
  if (decimalSeparator === ',') {
    // European format: remove thousand separators (.), replace decimal separator
    cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: remove thousand separators (,)
    cleanAmount = cleanAmount.replace(/,(?=\d{3})/g, '');
  }
  
  const amount = parseFloat(cleanAmount);
  return isNaN(amount) ? 0 : amount;
}

// Parse CSV text to rows
function parseCSVText(csvText: string): CSVRow[] {
  const separator = detectSeparator(csvText);
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
    const row: CSVRow = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }
  
  return rows;
}

// Main CSV parsing function
export function parseCSV(csvText: string): CSVParseResult {
  const errors: string[] = [];
  
  try {
    // Parse CSV into rows
    const rows = parseCSVText(csvText);
    
    if (rows.length === 0) {
      return {
        movements: [],
        totalRows: 0,
        errors: ['El archivo CSV está vacío o no tiene el formato correcto'],
        detectedBank: 'generic',
        preview: []
      };
    }
    
    // Detect bank and get mapping
    const headers = Object.keys(rows[0]);
    const detectedBank = detectBank(headers);
    const mapping = BANK_MAPPINGS[detectedBank];
    
    // Parse movements
    const movements: ParsedMovement[] = [];
    
    for (let i = (mapping.skipRows || 0); i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Find the mapped fields (case-insensitive)
        const findField = (fieldName: string): string => {
          const field = headers.find(h => 
            h.toLowerCase().trim() === fieldName.toLowerCase().trim()
          );
          return field ? row[field] : '';
        };
        
        const dateStr = findField(mapping.dateField);
        const valueDateStr = mapping.valueDateField ? findField(mapping.valueDateField) : '';
        const amountStr = findField(mapping.amountField);
        const description = findField(mapping.descriptionField);
        const counterparty = mapping.counterpartyField ? findField(mapping.counterpartyField) : '';
        const reference = mapping.referenceField ? findField(mapping.referenceField) : '';
        
        if (!dateStr || !amountStr || !description) {
          errors.push(`Fila ${i + 1}: Faltan campos obligatorios (fecha, importe, descripción)`);
          continue;
        }
        
        const parsedDate = parseDate(dateStr, mapping.dateFormat);
        const parsedValueDate = valueDateStr ? parseDate(valueDateStr, mapping.dateFormat) : undefined;
        const parsedAmount = parseAmount(amountStr, mapping.decimalSeparator);
        
        if (!parsedDate) {
          errors.push(`Fila ${i + 1}: Fecha inválida: ${dateStr}`);
          continue;
        }
        
        if (parsedAmount === 0 && amountStr !== '0' && amountStr !== '0,00') {
          errors.push(`Fila ${i + 1}: Importe inválido: ${amountStr}`);
          continue;
        }
        
        movements.push({
          date: parsedDate,
          valueDate: parsedValueDate,
          amount: parsedAmount,
          description: description.trim(),
          counterparty: counterparty ? counterparty.trim() : undefined,
          reference: reference ? reference.trim() : undefined,
          rawData: row
        });
        
      } catch (error) {
        errors.push(`Fila ${i + 1}: Error de procesamiento: ${error}`);
      }
    }
    
    return {
      movements,
      totalRows: rows.length,
      errors,
      detectedBank,
      preview: movements.slice(0, 20) // First 20 rows for preview
    };
    
  } catch (error) {
    return {
      movements: [],
      totalRows: 0,
      errors: [`Error general de procesamiento: ${error}`],
      detectedBank: 'generic',
      preview: []
    };
  }
}

// Check for duplicate movements
export function findDuplicateMovements(
  newMovements: ParsedMovement[],
  existingMovements: Movement[]
): ParsedMovement[] {
  return newMovements.filter(newMov => {
    return existingMovements.some(existing => 
      existing.date === newMov.date &&
      existing.amount === newMov.amount &&
      existing.description === newMov.description
    );
  });
}

// Generate import batch ID
export function generateImportBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}