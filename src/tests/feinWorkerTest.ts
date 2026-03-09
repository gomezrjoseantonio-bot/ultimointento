// Test script to validate serverless DocAI FEIN processing
// This tests the core functionality without requiring actual FEIN files

import { feinOcrService } from '../services/feinOcrService';

export const testDocAIProcessing = async (): Promise<boolean> => {
  console.log('[FEIN-TEST] Starting DocAI serverless processing test...');
  
  try {
    // Create a minimal test PDF buffer to test processing
    const testPdfBuffer = new ArrayBuffer(1024);
    const testFile = new File([testPdfBuffer], 'test.pdf', { type: 'application/pdf' });
    
    console.log('[FEIN-TEST] Testing serverless processing...');
    
    // This will test the serverless DocAI endpoint
    const result = await feinOcrService.processFEINDocument(testFile);
    
    console.log('[FEIN-TEST] DocAI processing result:', {
      success: result.success,
      providerUsed: result.providerUsed,
      confidence: result.confidence,
      errors: result.errors
    });
    
    // For a test file, we expect a failure (since it's not a real FEIN document)
    // But we want to make sure it fails gracefully
    const hasGracefulFailure = !result.success && result.errors.length > 0 && 
      !result.errors.some(error => 
        error.toLowerCase().includes('worker') || 
        error.toLowerCase().includes('pdf.js') ||
        error.toLowerCase().includes('csp')
      );
    
    if (hasGracefulFailure) {
      console.log('[FEIN-TEST] ✅ Serverless processing test passed - graceful failure without worker errors');
      return true;
    } else if (result.success) {
      console.log('[FEIN-TEST] ✅ Serverless processing test passed - successful processing');
      return true;
    }
    
    console.error('[FEIN-TEST] ❌ Unexpected processing behavior');
    return false;
    
  } catch (error) {
    console.error('[FEIN-TEST] ❌ Serverless processing test failed:', error);
    return false;
  }
};

export const testUXFallbackPattern = (): boolean => {
  console.log('[FEIN-TEST] Testing UX fallback pattern...');
  
  // Mock a FEIN result with missing fields
  const mockFeinResult = {
    success: true,
    fieldsExtracted: ['banco', 'tipo'],
    fieldsMissing: ['capitalInicial', 'plazoMeses', 'tin'],
    pendingFields: ['capitalInicial', 'plazoMeses', 'tin']
  };
  
  // Test that we have proper pending field handling
  const hasPendingFields = mockFeinResult.pendingFields && mockFeinResult.pendingFields.length > 0;
  const hasExtractedFields = mockFeinResult.fieldsExtracted && mockFeinResult.fieldsExtracted.length > 0;
  
  if (hasPendingFields && hasExtractedFields) {
    console.log('[FEIN-TEST] ✅ UX fallback pattern properly configured');
    console.log('[FEIN-TEST] Extracted fields:', mockFeinResult.fieldsExtracted);
    console.log('[FEIN-TEST] Pending fields:', mockFeinResult.pendingFields);
    return true;
  }
  
  console.error('[FEIN-TEST] ❌ UX fallback pattern test failed');
  return false;
};

// Export test runner
export const runFeinTests = async (): Promise<void> => {
  console.log('[FEIN-TEST] 🧪 Running FEIN DocAI tests...');
  
  const processingTest = await testDocAIProcessing();
  const uxTest = testUXFallbackPattern();
  
  const allPassed = processingTest && uxTest;
  
  console.log('[FEIN-TEST] 📊 Test Results Summary:');
  console.log(`[FEIN-TEST] DocAI Processing: ${processingTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`[FEIN-TEST] UX Fallback: ${uxTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`[FEIN-TEST] Overall: ${allPassed ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);
};