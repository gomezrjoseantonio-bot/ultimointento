// Test script for ML Classification Service
// Demonstrates both ML backend integration and fallback functionality

import { mlClassificationService } from '../services/mlClassificationService';
import { classifyDocument } from '../services/documentClassificationService';

/**
 * Test ML classification service functionality
 */
export async function testMLClassificationService() {
  console.log('🧪 Testing ML Classification Service...');
  
  // Test data
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

  console.log('\n1️⃣ Testing ML Service Configuration:');
  const config = mlClassificationService.getConfig();
  console.log('ML Service Config:', config);

  console.log('\n2️⃣ Testing ML Service Connectivity:');
  try {
    const connectionTest = await mlClassificationService.testConnection();
    console.log('Connection Test Result:', connectionTest);
  } catch (error) {
    console.log('Connection Test Failed (expected if no ML service running):', error);
  }

  console.log('\n3️⃣ Testing Document Classification (with ML service integration):');
  try {
    const startTime = Date.now();
    const classification = await classifyDocument(mockOCRData, mockOCRText);
    const processingTime = Date.now() - startTime;
    
    console.log('✅ Classification result:', {
      subtype: classification.subtype,
      confidence: classification.confidence,
      keywords: classification.matchedKeywords,
      reasoning: classification.reasoning,
      processingTime: `${processingTime}ms`
    });
    
    // Verify it's working correctly
    if (classification.subtype === 'suministro') {
      console.log('✅ Classification is correct - detected as utility bill');
    } else {
      console.log('⚠️ Unexpected classification result');
    }

  } catch (error) {
    console.error('❌ Classification failed:', error);
  }

  console.log('\n4️⃣ Testing ML Service with Different Configuration:');
  // Test with ML service disabled
  mlClassificationService.updateConfig({ enabled: false });
  try {
    const classification = await classifyDocument(mockOCRData, mockOCRText);
    console.log('✅ Fallback classification (ML disabled):', {
      subtype: classification.subtype,
      confidence: classification.confidence,
      reasoning: classification.reasoning
    });
  } catch (error) {
    console.error('❌ Fallback classification failed:', error);
  }

  // Reset to original configuration
  mlClassificationService.updateConfig({ enabled: process.env.REACT_APP_ML_SERVICE_ENABLED === 'true' });
  
  console.log('\n✨ ML Classification Service testing completed!');
}

// Export for use in development
if (process.env.NODE_ENV === 'development') {
  (window as any).testMLClassificationService = testMLClassificationService;
}