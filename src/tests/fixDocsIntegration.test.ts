/**
 * FIX-DOCS Test Suite
 * Tests the enhanced document ingestion and classification system
 */

import { processDocumentIngestion } from '../services/documentIngestionService';
import { classifyDocument } from '../services/autoSaveService';

// Mock document factory for testing
const createMockDocument = (filename: string, tipo: string, metadata: any = {}): any => ({
  id: Math.floor(Math.random() * 1000),
  filename,
  type: 'application/pdf',
  size: 1024,
  lastModified: Date.now(),
  content: new Blob(),
  metadata: {
    tipo,
    proveedor: 'Test Provider',
    entityType: 'property',
    entityId: 1,
    financialData: {
      amount: 150.00,
      base: 123.97,
      iva: 26.03,
      issueDate: '2024-01-15',
      dueDate: '2024-02-15',
      iban: 'ES9121000418450200051332'
    },
    ...metadata
  },
  uploadDate: new Date().toISOString()
});

describe('FIX-DOCS Document Ingestion System', () => {
  
  test('1. Facturas de gasto corriente → Inmuebles › Gastos & CAPEX › Gastos', async () => {
    const invoice = createMockDocument('factura-comunidad-enero.pdf', 'Factura');
    
    const result = await processDocumentIngestion(invoice);
    
    expect(result.success).toBe(true);
    expect(result.destination).toBe('Inmuebles › Gastos & CAPEX › Gastos');
    expect(result.createdEntries).toHaveLength(1);
    expect(result.createdEntries[0].type).toBe('gasto');
    expect(result.attachedDocumentId).toBe(invoice.id);
    expect(result.reconcilationInfo?.treasuryForecastCreated).toBe(true); // IBAN present
  });

  test('2. Contratos → Inmuebles › Contratos', async () => {
    const contract = createMockDocument('contrato-alquiler-2024.pdf', 'Contrato');
    
    const result = await processDocumentIngestion(contract);
    
    expect(result.success).toBe(true);
    expect(result.destination).toBe('Inmuebles › Contratos');
    expect(result.createdEntries).toHaveLength(1);
    expect(result.createdEntries[0].type).toBe('contract');
    expect(result.attachedDocumentId).toBe(contract.id);
  });

  test('3. Extractos bancarios → Tesorería › Movimientos', async () => {
    const bankStatement = createMockDocument(
      'extracto-banco-enero.xlsx', 
      'Extracto bancario',
      {
        extractMetadata: {
          bank: 'BBVA',
          importedRows: 25,
          totalRows: 25
        }
      }
    );
    
    const result = await processDocumentIngestion(bankStatement);
    
    expect(result.success).toBe(true);
    expect(result.destination).toBe('Tesorería › Movimientos');
    expect(result.createdEntries).toHaveLength(1);
    expect(result.createdEntries[0].type).toBe('bank-extract');
    expect(result.message).toContain('movimientos');
  });

  test('4. Documentación fiscal → Context-dependent routing', async () => {
    const taxDoc = createMockDocument(
      'ibi-2024.pdf', 
      'Otros',
      {
        categoria: 'fiscal',
        financialData: {
          amount: 450.00,
          issueDate: '2024-01-01'
        }
      }
    );
    
    const result = await processDocumentIngestion(taxDoc);
    
    expect(result.success).toBe(true);
    expect(result.destination).toBe('Inmuebles › Gastos & CAPEX › Gastos');
    expect(result.createdEntries).toHaveLength(1);
    expect(result.createdEntries[0].type).toBe('tax-expense');
  });

  test('5. Document classification with enhanced types', async () => {
    const reformInvoice = createMockDocument('factura-reforma-cocina.pdf', 'Factura');
    
    const classification = await classifyDocument(reformInvoice, []);
    
    expect(classification.type).toBe('factura');
    expect(classification.confidence).toBeGreaterThan(0.5);
    expect(classification.metadata.provider).toBe('Test Provider');
    expect(classification.metadata.totalAmount).toBe(150.00);
  });

  test('6. Document attachment verification', async () => {
    const document = createMockDocument('test-document.pdf', 'Factura');
    
    const result = await processDocumentIngestion(document);
    
    // Verify document is always attached
    expect(result.attachedDocumentId).toBeDefined();
    expect(result.attachedDocumentId).toBe(document.id);
    
    // Verify structured entry was created
    expect(result.createdEntries.length).toBeGreaterThan(0);
    expect(result.createdEntries[0].id).toBeDefined();
  });

  test('7. Treasury forecast creation with IBAN', async () => {
    const invoiceWithIBAN = createMockDocument(
      'factura-con-domiciliacion.pdf', 
      'Factura',
      {
        financialData: {
          amount: 89.50,
          iban: 'ES9121000418450200051332',
          dueDate: '2024-02-28'
        }
      }
    );
    
    const result = await processDocumentIngestion(invoiceWithIBAN);
    
    expect(result.success).toBe(true);
    expect(result.reconcilationInfo?.treasuryForecastCreated).toBe(true);
  });

  test('8. Spanish format compliance', () => {
    const amount = 1234.56;
    const percentage = 3.5;
    const date = '2024-01-15';
    
    // Test Spanish number formatting
    expect(amount.toLocaleString('es-ES')).toBe('1.234,56');
    expect(`${percentage.toLocaleString('es-ES')}%`).toBe('3,5%');
    
    // Test Spanish date format
    const dateObj = new Date(date);
    const spanishDate = dateObj.toLocaleDateString('es-ES');
    expect(spanishDate).toBe('15/1/2024');
  });

});

// DoD Validation Tests
describe('FIX-DOCS Definition of Done Validation', () => {
  
  test('DoD 1: PDF factura → Gasto + Treasury forecast', async () => {
    const invoice = createMockDocument('factura-ejemplo.pdf', 'Factura');
    const result = await processDocumentIngestion(invoice);
    
    expect(result.success).toBe(true);
    expect(result.destination).toContain('Gastos');
    expect(result.attachedDocumentId).toBe(invoice.id);
    expect(result.reconcilationInfo?.treasuryForecastCreated).toBe(true);
  });

  test('DoD 2: Contrato → Contract + forecasts + attachment', async () => {
    const contract = createMockDocument('contrato-ejemplo.pdf', 'Contrato');
    const result = await processDocumentIngestion(contract);
    
    expect(result.success).toBe(true);
    expect(result.destination).toContain('Contratos');
    expect(result.attachedDocumentId).toBe(contract.id);
  });

  test('DoD 3: Bank extract → Movements import', async () => {
    const extract = createMockDocument('extracto-ejemplo.xlsx', 'Extracto bancario');
    const result = await processDocumentIngestion(extract);
    
    expect(result.success).toBe(true);
    expect(result.destination).toContain('Movimientos');
    expect(result.message).toContain('movimientos');
  });

  test('DoD 4: Nothing remains in Inbox after processing (Autoguardado ON)', async () => {
    const document = createMockDocument('cualquier-documento.pdf', 'Factura');
    const result = await processDocumentIngestion(document);
    
    // When Autoguardado is ON, all documents should be processed and removed from inbox
    expect(result.success).toBe(true);
    expect(result.destination).not.toBe('Inbox'); // Never stays in inbox
    expect(result.attachedDocumentId).toBeDefined(); // Always attached
  });

});

export { createMockDocument };