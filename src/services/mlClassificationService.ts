// ATLAS HORIZON - ML Classification Service
// Handles document classification using ML backend service

import { ClassificationResult, OCRExtractionResult } from '../types/inboxTypes';

// Configuration for ML backend service
interface MLServiceConfig {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  timeout: number;
}

// Default configuration - can be overridden by environment variables
const defaultConfig: MLServiceConfig = {
  enabled: process.env.REACT_APP_ML_SERVICE_ENABLED === 'true',
  endpoint: process.env.REACT_APP_ML_SERVICE_ENDPOINT || 'http://localhost:8080/api/classify',
  apiKey: process.env.REACT_APP_ML_SERVICE_API_KEY,
  timeout: parseInt(process.env.REACT_APP_ML_SERVICE_TIMEOUT || '5000')
};

// ML service request interface
interface MLClassificationRequest {
  ocrData: OCRExtractionResult;
  fullText: string;
  version: string;
}

// ML service response interface  
interface MLClassificationResponse {
  success: boolean;
  result?: ClassificationResult;
  error?: string;
  processingTime?: number;
}

class MLClassificationService {
  private config: MLServiceConfig;

  constructor(config?: Partial<MLServiceConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Classify document using ML backend service
   * Falls back to local classification if ML service is unavailable
   */
  async classifyDocument(
    ocrData: OCRExtractionResult,
    fullText: string,
    fallbackClassifier?: (ocrData: OCRExtractionResult, fullText: string) => Promise<ClassificationResult>
  ): Promise<ClassificationResult> {
    // If ML service is disabled, use fallback immediately
    if (!this.config.enabled || !fallbackClassifier) {
      console.log('[ML Classification] ML service disabled, using fallback');
      return fallbackClassifier ? await fallbackClassifier(ocrData, fullText) : this.getDefaultClassification();
    }

    try {
      const startTime = Date.now();
      console.log('[ML Classification] Calling ML backend service:', this.config.endpoint);

      const request: MLClassificationRequest = {
        ocrData,
        fullText,
        version: '1.0'
      };

      const response = await this.callMLService(request);
      
      if (response.success && response.result) {
        const processingTime = Date.now() - startTime;
        console.log(`[ML Classification] Success in ${processingTime}ms:`, response.result);
        return response.result;
      } else {
        console.warn('[ML Classification] ML service returned error:', response.error);
        throw new Error(response.error || 'ML service failed');
      }

    } catch (error) {
      console.error('[ML Classification] ML service failed, using fallback:', error);
      
      // Use fallback classification
      if (fallbackClassifier) {
        return await fallbackClassifier(ocrData, fullText);
      } else {
        return this.getDefaultClassification();
      }
    }
  }

  /**
   * Call ML backend service with proper error handling and timeout
   */
  private async callMLService(request: MLClassificationRequest): Promise<MLClassificationResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as MLClassificationResponse;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`ML service timeout after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Get default classification when all else fails
   */
  private getDefaultClassification(): ClassificationResult {
    return {
      documentType: 'factura',
      subtype: 'factura_generica',
      confidence: 0.1,
      matchedKeywords: [],
      reasoning: 'Clasificación por defecto - ML service no disponible'
    };
  }

  /**
   * Test ML service connectivity
   */
  async testConnection(): Promise<{ connected: boolean; latency?: number; error?: string }> {
    if (!this.config.enabled) {
      return { connected: false, error: 'ML service disabled' };
    }

    try {
      const startTime = Date.now();
      
      // Send a minimal test request
      const testRequest = {
        ocrData: { total_amount: 100 },
        fullText: 'test',
        version: '1.0'
      };

      await this.callMLService(testRequest);
      
      const latency = Date.now() - startTime;
      return { connected: true, latency };

    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<MLServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[ML Classification] Configuration updated:', this.config);
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<MLServiceConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}

// Export singleton instance
export const mlClassificationService = new MLClassificationService();

// Export class for testing
export { MLClassificationService };