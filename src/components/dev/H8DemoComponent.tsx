// H8: Integration Demo Component for testing H8 functionality
import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { detectDocumentType, shouldAutoOCR } from '../../services/documentTypeDetectionService';
import { enqueueOCR, getOCRMetrics } from '../../services/ocrQueueService';
import { getAutoSaveConfig, setAutoSaveConfig } from '../../services/autoSaveService';
import { parseEsNumber, formatEsCurrency } from '../../utils/numberUtils';

const H8DemoComponent: React.FC = () => {
  const [testResults, setTestResults] = useState<any>({});
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);

  useEffect(() => {
    // Subscribe to OCR queue metrics
    const interval = setInterval(() => {
      const newMetrics = getOCRMetrics();
      setMetrics(newMetrics);
    }, 2000);

    // Get autosave config
    const config = getAutoSaveConfig();
    setAutoSaveEnabled(config.enabled);

    return () => clearInterval(interval);
  }, []);

  const runH8Tests = async () => {
    setIsRunning(true);
    const results: any = {};

    try {
      // Test 1: Document Type Detection
      console.log('Testing document type detection...');
      
      // Test bank statement
      const csvFile = new File(['account,date,amount'], 'extracto-bbva.csv', { type: 'text/csv' });
      const bankResult = await detectDocumentType(csvFile);
      
      // Test invoice
      const pdfFile = new File([''], 'factura-endesa.pdf', { type: 'application/pdf' });
      const invoiceResult = await detectDocumentType(pdfFile);
      
      results.documentDetection = {
        bank: bankResult,
        invoice: invoiceResult,
        success: bankResult.shouldSkipOCR && !invoiceResult.shouldSkipOCR
      };

      // Test 2: Spanish Number Parsing
      console.log('Testing Spanish number parsing...');
      const testAmounts = ['49,10', '1.234,56', '156,78 €'];
      const parsingResults = testAmounts.map(amount => {
        const parsed = parseEsNumber(amount);
        return {
          input: amount,
          output: parsed.value,
          formatted: parsed.value ? formatEsCurrency(parsed.value) : null,
          success: parsed.value !== null
        };
      });
      
      results.numberParsing = {
        tests: parsingResults,
        success: parsingResults.every(r => r.success)
      };

      // Test 3: Auto-OCR Queueing
      console.log('Testing OCR queue...');
      if (shouldAutoOCR(invoiceResult)) {
        const pdfBlob = new Blob(['test content'], { type: 'application/pdf' });
        const jobId = enqueueOCR(Date.now(), 'test-demo.pdf', pdfBlob);
        results.ocrQueue = {
          jobId,
          success: !!jobId
        };
      }

      // Test 4: Self-test endpoint
      console.log('Testing self-test endpoint...');
      try {
        const response = await fetch('/.netlify/functions/ocr-selftest');
        const selfTestResult = await response.json();
        results.selfTest = {
          response: selfTestResult,
          success: response.ok
        };
      } catch (error) {
        results.selfTest = {
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        };
      }

      // Test 5: AutoSave Configuration
      console.log('Testing autosave configuration...');
      const currentConfig = getAutoSaveConfig();
      setAutoSaveConfig({ enabled: !currentConfig.enabled });
      const toggledConfig = getAutoSaveConfig();
      setAutoSaveConfig({ enabled: currentConfig.enabled }); // Restore
      
      results.autoSaveConfig = {
        original: currentConfig.enabled,
        toggled: toggledConfig.enabled,
        success: currentConfig.enabled !== toggledConfig.enabled
      };

      setTestResults(results);
      
    } catch (error) {
      console.error('H8 test error:', error);
      results.error = error instanceof Error ? error.message : 'Unknown error';
      setTestResults(results);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleAutoSave = () => {
    const config = getAutoSaveConfig();
    setAutoSaveConfig({ enabled: !config.enabled });
    setAutoSaveEnabled(!config.enabled);
  };

  const getTestIcon = (success: boolean | undefined) => {
    if (success === undefined) return <Clock className="w-4 h-4 text-gray-400" />;
    return success 
      ? <CheckCircle className="w-4 h-4 text-success-500" />
      : <XCircle className="w-4 h-4 text-error-500" />;
  };

  return (
    <div className="p-6 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">H8 — Auto-OCR Demo</h3>
        <button
          onClick={runH8Tests}
          disabled={isRunning}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          <span>{isRunning ? 'Running Tests...' : 'Run H8 Tests'}</span>
        </button>
      </div>

      {/* AutoSave Toggle */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">AutoSave Status</span>
          <button
            onClick={toggleAutoSave}
            className={`px-3 py-1 text-xs rounded-full ${
              autoSaveEnabled 
                ? 'bg-success-100 text-success-800' 
                : 'bg-warning-100 text-yellow-800'
            }`}
          >
            {autoSaveEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* OCR Queue Metrics */}
      {metrics && (
        <div className="mb-4 p-3 bg-primary-50 rounded">
          <h4 className="text-sm font-medium mb-2">OCR Queue Status</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Pending: {metrics.pending}</div>
            <div>Processing: {metrics.processing}</div>
            <div>Completed: {metrics.completed}</div>
            <div>Failed: {metrics.failed}</div>
          </div>
        </div>
      )}

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Test Results</h4>
          
          {/* Document Detection Test */}
          {testResults.documentDetection && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">Document Type Detection</span>
              <div className="flex items-center space-x-2">
                {getTestIcon(testResults.documentDetection.success)}
                <span className="text-xs text-gray-600">
                  Bank: {testResults.documentDetection.bank?.tipo}, 
                  Invoice: {testResults.documentDetection.invoice?.tipo}
                </span>
              </div>
            </div>
          )}

          {/* Number Parsing Test */}
          {testResults.numberParsing && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">Spanish Number Parsing</span>
              <div className="flex items-center space-x-2">
                {getTestIcon(testResults.numberParsing.success)}
                <span className="text-xs text-gray-600">
                  {testResults.numberParsing.tests.filter((t: any) => t.success).length}/
                  {testResults.numberParsing.tests.length} passed
                </span>
              </div>
            </div>
          )}

          {/* OCR Queue Test */}
          {testResults.ocrQueue && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">OCR Queue</span>
              <div className="flex items-center space-x-2">
                {getTestIcon(testResults.ocrQueue.success)}
                <span className="text-xs text-gray-600">
                  Job ID: {testResults.ocrQueue.jobId?.slice(0, 8)}...
                </span>
              </div>
            </div>
          )}

          {/* Self-test */}
          {testResults.selfTest && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">OCR Self-test</span>
              <div className="flex items-center space-x-2">
                {getTestIcon(testResults.selfTest.success)}
                <span className="text-xs text-gray-600">
                  {testResults.selfTest.success ? 'Config OK' : 'Config Error'}
                </span>
              </div>
            </div>
          )}

          {/* AutoSave Config Test */}
          {testResults.autoSaveConfig && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">AutoSave Toggle</span>
              <div className="flex items-center space-x-2">
                {getTestIcon(testResults.autoSaveConfig.success)}
                <span className="text-xs text-gray-600">
                  Toggle test passed
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {testResults.error && (
            <div className="p-2 bg-error-50 border border-error-200 rounded">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-error-500" />
                <span className="text-sm text-error-700">Error: {testResults.error}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-warning-50 border border-yellow-200 rounded">
        <h4 className="text-sm font-medium text-yellow-800 mb-1">H8 QA Checklist</h4>
        <ul className="text-xs text-warning-700 space-y-1">
          <li>• Upload PDF factura → should auto-enqueue for OCR</li>
          <li>• Upload CSV extracto → should skip OCR, go to bank parser</li>
          <li>• Test "49,10 €" parsing → should become 49.10</li>
          <li>• Toggle AutoSave ON/OFF → changes behavior</li>
          <li>• Check self-test endpoint → validates config</li>
        </ul>
      </div>
    </div>
  );
};

export default H8DemoComponent;