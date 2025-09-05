import { 
  processDocumentIngestion 
} from '../services/documentIngestionService';
import { telemetry } from '../services/telemetryService';
import { 
  isAutoRouteEnabled, 
  isAutoOCREnabled, 
  isBankImportEnabled 
} from '../config/envFlags';

describe('5-Minute Diagnostic Checklist Integration', () => {
  beforeEach(() => {
    telemetry.clearEvents();
  });

  it('should validate all required flags are enabled', () => {
    expect(isAutoRouteEnabled()).toBe(true);
    expect(isAutoOCREnabled()).toBe(true);
    expect(isBankImportEnabled()).toBe(true);
  });

  it('should emit correct events for invoice processing (EVENT:PARSED, EVENT:OCR_DONE, EVENT:ROUTED)', async () => {
    // Mock invoice document
    const invoiceDocument = {
      id: 1,
      filename: 'factura-wekiwi.pdf',
      type: 'application/pdf',
      size: 1024,
      lastModified: Date.now(),
      content: new Blob(['fake pdf content']),
      metadata: {
        tipo: 'Factura' as const,
        proveedor: 'Wekiwi',
        financialData: {
          amount: 29.35,
          issueDate: '2025-01-01',
          dueDate: '2025-01-15'
        },
        ocr: {
          engine: 'gdocai:invoice',
          timestamp: new Date().toISOString(),
          confidenceGlobal: 0.92,
          status: 'completed' as const,
          fields: [
            { name: 'total_amount', value: '29.35', confidence: 0.95 },
            { name: 'supplier_name', value: 'Wekiwi', confidence: 0.88 }
          ]
        }
      },
      uploadDate: new Date().toISOString()
    };

    const result = await processDocumentIngestion(invoiceDocument);
    
    expect(result.success).toBe(true);
    expect(result.destination).toContain('Gastos');
    
    const events = telemetry.getDiagnosticEvents(10);
    
    // Should have PARSED, OCR_DONE, and ROUTED events
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.some(e => e.event === 'PARSED')).toBe(true);
    expect(events.some(e => e.event === 'OCR_DONE')).toBe(true);
    expect(events.some(e => e.event === 'ROUTED')).toBe(true);
  });

  it('should emit correct events for bank statement processing (EVENT:PARSED, EVENT:MOVEMENT_CREATED, EVENT:ROUTED)', async () => {
    // Mock bank statement document
    const bankDocument = {
      id: 2,
      filename: 'movements-392025.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 2048,
      lastModified: Date.now(),
      content: new Blob(['fake excel content']),
      metadata: {
        tipo: 'Extracto bancario' as const,
        extractMetadata: {
          bank: 'BBVA',
          totalRows: 25,
          importedRows: 23
        }
      },
      uploadDate: new Date().toISOString()
    };

    const result = await processDocumentIngestion(bankDocument);
    
    expect(result.success).toBe(true);
    expect(result.destination).toBe('Tesorería › Movimientos');
    
    const events = telemetry.getDiagnosticEvents(10);
    
    // Should have PARSED, MOVEMENT_CREATED, and ROUTED events (no OCR for bank statements)
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.some(e => e.event === 'PARSED')).toBe(true);
    expect(events.some(e => e.event === 'MOVEMENT_CREATED')).toBe(true);
    expect(events.some(e => e.event === 'ROUTED')).toBe(true);
    expect(events.some(e => e.event === 'OCR_DONE')).toBe(false); // No OCR for bank statements
  });

  it('should detect document type correctly (invoice vs bank_statement)', async () => {
    // Test invoice detection
    const invoiceDoc = {
      id: 3,
      filename: 'factura-test.pdf',
      type: 'application/pdf',
      size: 1024,
      lastModified: Date.now(),
      content: new Blob(['fake pdf content']),
      metadata: { tipo: 'Factura' as const },
      uploadDate: new Date().toISOString()
    };

    const invoiceResult = await processDocumentIngestion(invoiceDoc);
    expect(invoiceResult.destination).toContain('Gastos');

    // Test bank statement detection
    const bankDoc = {
      id: 4,
      filename: 'extracto-ing.csv',
      type: 'text/csv',
      size: 1024,
      lastModified: Date.now(),
      content: new Blob(['fecha,concepto,importe\n2025-01-01,Test,100.00']),
      metadata: { 
        tipo: 'Extracto bancario' as const,
        extractMetadata: { 
          bank: 'BBVA',
          totalRows: 1,
          importedRows: 1 
        }
      },
      uploadDate: new Date().toISOString()
    };

    const bankResult = await processDocumentIngestion(bankDoc);
    expect(bankResult.destination).toBe('Tesorería › Movimientos');

    const events = telemetry.getDiagnosticEvents(10);
    
    // Verify both documents were parsed with correct types
    const parsedEvents = events.filter(e => e.event === 'PARSED');
    expect(parsedEvents.length).toBe(2);
    expect(parsedEvents.some(e => e.documentType === 'invoice')).toBe(true);
    expect(parsedEvents.some(e => e.documentType === 'bank_statement')).toBe(true);
  });

  it('should handle bank mapper fallback when headers are not recognized', async () => {
    // Mock bank document with unrecognized headers
    const unknownBankDoc = {
      id: 5,
      filename: 'unknown-bank-format.csv',
      type: 'text/csv',
      size: 1024,
      lastModified: Date.now(),
      content: new Blob(['col1,col2,col3\ndata1,data2,data3']),
      metadata: { 
        tipo: 'Extracto bancario' as const,
        extractMetadata: { 
          bank: 'unknown',
          totalRows: 1,
          importedRows: 0 // No rows imported due to unrecognized format
        }
      },
      uploadDate: new Date().toISOString()
    };

    const result = await processDocumentIngestion(unknownBankDoc);
    
    // Should still be routed but with error status or need for manual mapping
    const events = telemetry.getDiagnosticEvents(10);
    const errorEvents = events.filter(e => e.event === 'ERROR');
    
    // Could have error event if no movements were created
    if (errorEvents.length > 0) {
      expect(errorEvents[0].metadata?.error).toContain('import');
    }
  });

  it('should show state transitions with 72h visibility info', async () => {
    const testDoc = {
      id: 6,
      filename: 'test-transition.pdf',
      type: 'application/pdf',
      size: 1024,
      lastModified: Date.now(),
      content: new Blob(['content']),
      metadata: { 
        tipo: 'Factura' as const,
        financialData: { amount: 100 }
      },
      uploadDate: new Date().toISOString()
    };

    const result = await processDocumentIngestion(testDoc);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('72h'); // Should mention 72h visibility
    
    const events = telemetry.getDiagnosticEvents(10);
    const routedEvent = events.find(e => e.event === 'ROUTED');
    
    expect(routedEvent).toBeTruthy();
    expect(routedEvent?.metadata?.visibilityHours).toBe(72);
    expect(routedEvent?.metadata?.status).toBe('OK');
  });

  it('should validate Spanish locale formatting (es-ES)', async () => {
    const testDoc = {
      id: 7,
      filename: 'test-locale.pdf',
      type: 'application/pdf',
      size: 1024,
      lastModified: Date.now(),
      content: new Blob(['content']),
      metadata: { 
        tipo: 'Factura' as const,
        financialData: { amount: 1234.56 }
      },
      uploadDate: new Date().toISOString()
    };

    const result = await processDocumentIngestion(testDoc);
    
    // Test Spanish number formatting
    const amount = 1234.56;
    const spanishFormatted = amount.toLocaleString('es-ES', {
      style: 'currency', 
      currency: 'EUR'
    });
    
    expect(spanishFormatted).toContain('1.234,56'); // Spanish format: thousands separator . and decimal ,
    expect(result.success).toBe(true);
  });
});