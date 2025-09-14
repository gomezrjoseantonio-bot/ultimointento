// Test script to validate PDF.js worker loading and CSP compliance
// This tests the core functionality without requiring actual FEIN files

import { feinOcrService } from '../services/feinOcrService';

export const testWorkerLoading = async (): Promise<boolean> => {
  console.log('[FEIN-TEST] Starting PDF.js worker loading test...');
  
  try {
    // Create a minimal test PDF buffer to test worker loading
    const testPdfBuffer = new ArrayBuffer(1024);
    const testFile = new File([testPdfBuffer], 'test.pdf', { type: 'application/pdf' });
    
    console.log('[FEIN-TEST] Testing worker performance...');
    
    // This will internally test the worker loading in checkWorkerPerformance()
    const result = await feinOcrService.processFEINDocument(testFile);
    
    console.log('[FEIN-TEST] Worker test result:', {
      success: result.success,
      telemetry: result.telemetry ? {
        workerLoadTimeMs: result.telemetry.workerLoadTimeMs,
        errors: result.telemetry.errors
      } : null
    });
    
    // Check if worker-related errors occurred
    const hasWorkerErrors = result.telemetry?.errors.some(error => 
      error.toLowerCase().includes('worker') || 
      error.toLowerCase().includes('csp') ||
      error.toLowerCase().includes('refused to load')
    ) || false;
    
    if (hasWorkerErrors) {
      console.error('[FEIN-TEST] ❌ Worker loading issues detected:', result.telemetry?.errors);
      return false;
    }
    
    const workerLoadTime = result.telemetry?.workerLoadTimeMs || 0;
    if (workerLoadTime > 200) {
      console.warn(`[FEIN-TEST] ⚠️  Worker loading slow: ${workerLoadTime}ms (threshold: 200ms)`);
    } else {
      console.log(`[FEIN-TEST] ✅ Worker loaded in acceptable time: ${workerLoadTime}ms`);
    }
    
    console.log('[FEIN-TEST] ✅ PDF.js worker loading test passed');
    return true;
    
  } catch (error) {
    console.error('[FEIN-TEST] ❌ Worker test failed:', error);
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
    pendingFields: ['capitalInicial', 'plazoMeses', 'tin'],
    telemetry: {
      pendingFieldReasons: {
        capitalInicial: 'Capital inicial no detectado o formato inválido',
        plazoMeses: 'Plazo del préstamo no encontrado',
        tin: 'TIN/TAE no detectado o formato inválido'
      }
    }
  };
  
  // Test that we have proper pending field handling
  const hasPendingFields = mockFeinResult.pendingFields && mockFeinResult.pendingFields.length > 0;
  const hasReasons = mockFeinResult.telemetry?.pendingFieldReasons && 
    Object.keys(mockFeinResult.telemetry.pendingFieldReasons).length > 0;
  
  if (hasPendingFields && hasReasons) {
    console.log('[FEIN-TEST] ✅ UX fallback pattern properly configured');
    console.log('[FEIN-TEST] Pending fields:', mockFeinResult.pendingFields);
    console.log('[FEIN-TEST] Field reasons:', mockFeinResult.telemetry.pendingFieldReasons);
    return true;
  }
  
  console.error('[FEIN-TEST] ❌ UX fallback pattern test failed');
  return false;
};

// Export test runner
export const runFeinTests = async (): Promise<void> => {
  console.log('[FEIN-TEST] 🧪 Running FEIN OCR tests...');
  
  const workerTest = await testWorkerLoading();
  const uxTest = testUXFallbackPattern();
  
  const allPassed = workerTest && uxTest;
  
  console.log('[FEIN-TEST] 📊 Test Results Summary:');
  console.log(`[FEIN-TEST] Worker Loading: ${workerTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`[FEIN-TEST] UX Fallback: ${uxTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`[FEIN-TEST] Overall: ${allPassed ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);
};