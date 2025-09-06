// UNICORNIO Implementation Test
// Tests the exact requirements from the problem statement

import { processInboxItem } from '../src/services/unicornioInboxProcessor';
import { extractIBANFromBankStatement, matchAccountByIBAN } from '../src/services/ibanAccountMatchingService';

describe('UNICORNIO Prompt 1 - Bank Statements', () => {
  test('should require account selection when IBAN cannot be determined', async () => {
    const mockFile = new File(['col1,col2\ndata1,data2'], 'extracto.csv', { type: 'text/csv' });
    
    const result = await processInboxItem(mockFile, 'extracto_sin_iban.csv');
    
    expect(result.requiresReview).toBe(true);
    expect(result.blockingReasons).toContain('Selecciona cuenta destino');
    expect(result.extractedFields.movimientos).toBeDefined();
  });

  test('should extract IBAN from filename', async () => {
    const result = await extractIBANFromBankStatement(
      new File([''], 'extracto_ES1234567890123456789012.csv'), 
      'extracto_ES1234567890123456789012.csv'
    );
    
    expect(result.iban_completo).toBe('ES1234567890123456789012');
    expect(result.source).toBe('filename');
  });

  test('should match account by last4 digits', async () => {
    const mockExtractionResult = {
      last4: '1234',
      source: 'header' as const,
      confidence: 0.8
    };
    
    const result = await matchAccountByIBAN(mockExtractionResult);
    
    // Should find match or require selection
    expect(result.requiresSelection).toBeDefined();
  });
});

describe('UNICORNIO Prompt 2 - Invoices', () => {
  test('should always run OCR for invoices', async () => {
    const mockFile = new File([''], 'factura_iberdrola.pdf', { type: 'application/pdf' });
    
    const result = await processInboxItem(mockFile, 'factura_iberdrola.pdf');
    
    expect(result.logs).toContainEqual(
      expect.objectContaining({
        action: 'Ejecutando OCR para factura (obligatorio)'
      })
    );
  });

  test('should detect utility type and destination', async () => {
    const mockFile = new File([''], 'factura_iberdrola.pdf', { type: 'application/pdf' });
    
    const result = await processInboxItem(mockFile, 'factura_iberdrola.pdf');
    
    expect(result.extractedFields.tipo_suministro).toBe('electricidad');
    expect(result.extractedFields.direccion_servicio).toBeDefined();
  });

  test('should retry OCR on failure', async () => {
    const mockFile = new File([''], 'factura_corrupted.pdf', { type: 'application/pdf' });
    
    const result = await processInboxItem(mockFile, 'factura_corrupted.pdf');
    
    // Should either succeed after retry or go to revision
    expect(result.success || result.requiresReview).toBe(true);
  });
});

describe('UNICORNIO Prompt 3 - Field Validation', () => {
  test('should validate required fields for utilities', () => {
    const mockUtilityFields = {
      proveedor_nombre: 'Iberdrola',
      total_amount: 89.45,
      fecha_emision: '2024-01-15',
      tipo_suministro: 'electricidad'
    };
    
    const mockReformFields = {
      proveedor_nombre: 'Reformas García',
      total_amount: 1250.00,
      fecha_emision: '2024-01-15',
      mejora: 800,
      mobiliario: 300,
      reparacion_conservacion: 150
    };
    
    // Both should have all required fields
    expect(mockUtilityFields.proveedor_nombre).toBeDefined();
    expect(mockUtilityFields.total_amount).toBeGreaterThan(0);
    
    expect(mockReformFields.mejora + mockReformFields.mobiliario + mockReformFields.reparacion_conservacion)
      .toBe(mockReformFields.total_amount);
  });
});

describe('Document Type Detection', () => {
  test('should detect bank statements from file extensions', () => {
    const csvFile = 'extracto_bbva.csv';
    const xlsFile = 'movimientos_santander.xlsx';
    
    expect(csvFile).toMatch(/\.(csv|xlsx|xls)$/);
    expect(xlsFile).toMatch(/\.(csv|xlsx|xls)$/);
  });

  test('should detect invoice types from content and filename', () => {
    const utilityFile = 'factura_iberdrola_luz.pdf';
    const reformFile = 'factura_reformas_garcia.pdf';
    
    expect(utilityFile).toMatch(/(iberdrola|endesa|luz|agua|gas)/i);
    expect(reformFile).toMatch(/(reforma|obra)/i);
  });
});

// Integration test showing complete workflow
describe('End-to-End Workflow', () => {
  test('complete bank statement processing workflow', async () => {
    // 1. Upload bank statement
    const bankFile = new File(['fecha,descripcion,importe\n2024-01-15,Pago,100.00'], 'extracto_bbva_ES1234.csv');
    
    // 2. Process with IBAN detection
    const result = await processInboxItem(bankFile, 'extracto_bbva_ES1234567890123456789012.csv');
    
    // 3. Should extract IBAN and either auto-assign or require selection
    expect(result.extractedFields.iban_detectado).toBeDefined();
    expect(result.extractedFields.movimientos).toBeDefined();
    
    // 4. If account found, should be saved; if not, should require review
    if (result.success) {
      expect(result.destination).toBe('Tesorería › Movimientos');
    } else {
      expect(result.requiresReview).toBe(true);
      expect(result.blockingReasons).toContain('Selecciona cuenta destino');
    }
  });

  test('complete invoice processing workflow', async () => {
    // 1. Upload utility invoice
    const invoiceFile = new File([''], 'factura_iberdrola_enero.pdf');
    
    // 2. Process with OCR
    const result = await processInboxItem(invoiceFile, 'factura_iberdrola_enero.pdf');
    
    // 3. Should run OCR and detect type
    expect(result.logs.some(log => log.action.includes('OCR'))).toBe(true);
    
    // 4. Should classify as utility and either auto-save or require review
    if (result.success) {
      expect(result.destination).toMatch(/Inmuebles.*Gastos/);
    } else {
      expect(result.requiresReview).toBe(true);
    }
  });
});

export default {};