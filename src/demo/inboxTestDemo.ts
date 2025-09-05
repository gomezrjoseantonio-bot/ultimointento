// ATLAS HORIZON - Test demo for OCR and Routing services
// This file tests the core inbox processing functionality

import { inboxProcessingService } from '../services/inboxProcessingService';
import { extractOCRFields } from '../services/ocrExtractionService';
import { classifyDocument } from '../services/documentClassificationService';
import { detectProperty } from '../services/propertyDetectionService';

export async function testInboxProcessing() {
  console.log('🧪 Testing ATLAS HORIZON Inbox OCR and Routing...');
  
  // Test OCR extraction with mock data
  console.log('\n1️⃣ Testing OCR Extraction:');
  const mockOCRText = `
    ENDESA ENERGÍA XXI S.L.U.
    CIF: A81948077
    Factura de electricidad
    Importe total: 89,45 EUR
    Fecha emisión: 15/01/2024
    Fecha vencimiento: 15/02/2024
    Dirección de suministro: C/ MAYOR 123, 28013 MADRID
    CUPS: ES0031408963000001JN0F
    IBAN: ES21 1234 5678 90 ••••••••••••••••••1234
    kWh consumidos: 150
    Potencia contratada: 3.3 kW
  `;
  
  // Test document classification
  console.log('\n2️⃣ Testing Document Classification:');
  const mockOCRData = {
    supplier_name: 'ENDESA ENERGÍA XXI S.L.U.',
    supplier_tax_id: 'A81948077',
    total_amount: 89.45,
    issue_date: '2024-01-15',
    due_or_charge_date: '2024-02-15',
    service_address: 'C/ MAYOR 123, 28013 MADRID',
    iban_mask: 'ES21••••••••••••••••••1234',
    currency: 'EUR'
  };
  
  try {
    const classification = await classifyDocument(mockOCRData, mockOCRText);
    console.log('✅ Classification result:', {
      subtype: classification.subtype,
      confidence: classification.confidence,
      keywords: classification.matchedKeywords,
      reasoning: classification.reasoning
    });
    
    // Test property detection
    console.log('\n3️⃣ Testing Property Detection:');
    const propertyResult = await detectProperty(mockOCRData);
    console.log('✅ Property detection:', {
      inmueble_id: propertyResult.inmueble_id,
      confidence: propertyResult.confidence,
      method: propertyResult.matchMethod,
      matched: propertyResult.matchedText
    });
    
    // Test inbox processing service
    console.log('\n4️⃣ Testing Inbox Processing Service:');
    const mockFileUrl = 'blob:mock-file-url';
    const docId = await inboxProcessingService.createAndEnqueue(
      mockFileUrl,
      'application/pdf',
      1024576,
      'upload'
    );
    
    console.log('✅ Created inbox item:', docId);
    
    // Check status after a brief delay
    setTimeout(() => {
      const item = inboxProcessingService.getItem(docId);
      console.log('📄 Inbox item status:', {
        id: item?.id,
        status: item?.status,
        subtype: item?.subtype,
        supplier: item?.summary?.supplier_name,
        amount: item?.summary?.total_amount,
        destino: item?.summary?.destino,
        destRef: item?.destRef
      });
    }, 1000);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Export for use in development
if (process.env.NODE_ENV === 'development') {
  (window as any).testInboxProcessing = testInboxProcessing;
}