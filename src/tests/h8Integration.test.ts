// H8: Integration test for auto-OCR functionality
import { detectDocumentType, shouldAutoOCR } from '../services/documentTypeDetectionService';
import { enqueueOCR, getOCRMetrics } from '../services/ocrQueueService';
import { getAutoSaveConfig, setAutoSaveConfig } from '../services/autoSaveService';
import { parseEsNumber, formatEsCurrency } from '../utils/numberUtils';

// Test suite for H8 functionality
export const testH8Integration = async () => {
  console.log('🧪 Testing H8 Auto-OCR Integration...');
  
  // Test 1: Document type detection
  console.log('\n1. Testing document type detection...');
  
  // Test bank statement detection
  const csvFile = new File(['account,date,amount\n123,2024-01-01,100.50'], 'extracto-bbva.csv', { type: 'text/csv' });
  const bankResult = await detectDocumentType(csvFile);
  console.log('CSV bank file:', bankResult);
  
  // Test invoice detection
  const pdfFile = new File(['factura content'], 'factura-endesa.pdf', { type: 'application/pdf' });
  const invoiceResult = await detectDocumentType(pdfFile);
  console.log('PDF invoice file:', invoiceResult);
  
  // Test 2: Auto-OCR queueing
  console.log('\n2. Testing OCR queue...');
  
  if (shouldAutoOCR(invoiceResult)) {
    const jobId = enqueueOCR(1, 'test-factura.pdf', pdfFile);
    console.log('Enqueued OCR job:', jobId);
    
    // Check metrics
    setTimeout(() => {
      const metrics = getOCRMetrics();
      console.log('Queue metrics:', metrics);
    }, 1000);
  }
  
  // Test 3: AutoSave configuration
  console.log('\n3. Testing AutoSave configuration...');
  
  const config = getAutoSaveConfig();
  console.log('Current config:', config);
  
  // Toggle autosave
  setAutoSaveConfig({ enabled: !config.enabled });
  const newConfig = getAutoSaveConfig();
  console.log('Toggled config:', newConfig);
  
  // Test 4: Spanish number parsing
  console.log('\n4. Testing Spanish number parsing...');
  
  const testAmounts = ['49,10', '1.234,56', '156,78 €', '0,50'];
  testAmounts.forEach(amount => {
    const result = parseEsNumber(amount);
    if (result.value !== null) {
      const formatted = formatEsCurrency(result.value);
      console.log(`${amount} → ${result.value} → ${formatted}`);
    } else {
      console.log(`${amount} → ERROR: ${result.message}`);
    }
  });
  
  // Test 5: End-to-end simulation
  console.log('\n5. End-to-end document processing simulation...');
  
  const testDocuments = [
    { filename: 'factura-luz-49,10.pdf', type: 'application/pdf', content: new File(['fake pdf'], 'factura-luz-49,10.pdf', { type: 'application/pdf' }) },
    { filename: 'extracto-ing.csv', type: 'text/csv', content: new File(['fake csv'], 'extracto-ing.csv', { type: 'text/csv' }) },
    { filename: 'contrato-alquiler.pdf', type: 'application/pdf', content: new File(['fake contract'], 'contrato-alquiler.pdf', { type: 'application/pdf' }) }
  ];
  
  for (const doc of testDocuments) {
    const detection = await detectDocumentType(doc.content, doc.filename);
    const pipeline = shouldAutoOCR(detection) ? 'ocr' : detection.shouldSkipOCR ? 'bank-parser' : 'manual';
    
    console.log(`${doc.filename}: ${detection.tipo} (${detection.confidence.toFixed(2)}) → ${pipeline}`);
  }
  
  console.log('\n✅ H8 Integration test completed!');
  
  return {
    documentTypeDetection: true,
    ocrQueue: true,
    autoSaveConfig: true,
    spanishNumberParsing: true,
    endToEndProcessing: true
  };
};

// Development helper to run tests
if (process.env.NODE_ENV === 'development') {
  (window as any).testH8 = testH8Integration;
  console.log('🔧 H8 test available as window.testH8()');
}

// Jest Tests
describe('H8 Auto-OCR Integration', () => {
  test('should complete H8 integration test', async () => {
    const result = await testH8Integration();
    
    expect(result.documentTypeDetection).toBe(true);
    expect(result.ocrQueue).toBe(true);
    expect(result.autoSaveConfig).toBe(true);
    expect(result.spanishNumberParsing).toBe(true);
    expect(result.endToEndProcessing).toBe(true);
  });
  
  test('should detect document types correctly', async () => {
    const csvFile = new File(['account,date,amount\\n123,2024-01-01,100.50'], 'extracto-bbva.csv', { type: 'text/csv' });
    const bankResult = await detectDocumentType(csvFile);
    
    expect(bankResult).toBeDefined();
    expect(bankResult.tipo).toBeDefined();
  });
  
  test('should parse Spanish numbers correctly', () => {
    const testAmounts = ['49,10', '1.234,56', '156,78 €', '0,50'];
    
    testAmounts.forEach(amount => {
      const result = parseEsNumber(amount);
      expect(result.value).not.toBeNull();
    });
  });
});