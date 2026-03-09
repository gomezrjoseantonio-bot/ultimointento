// ATLAS HOTFIX: Development Telemetry Service - Safe logging for debugging
// Extended with diagnostic events for 5-minute checklist
interface TelemetryEvent {
  type: 'bank_parse' | 'ocr_process' | 'manual_mapping' | 'error' | 'performance' | 'diagnostic';
  action: string;
  metadata?: Record<string, any>;
  timestamp: string;
  sessionId: string;
  isDev: boolean;
}

interface BankParseMetrics {
  fileName: string;
  fileSize: number;
  parseTimeMs: number;
  bankDetected: string | null;
  confidence: number;
  movementsCount: number;
  needsManualMapping: boolean;
  sheetsCount?: number;
  headerRow?: number;
  columnsDetected?: number;
}

interface OCRProcessMetrics {
  fileName: string;
  fileSize: number;
  processTimeMs: number;
  entitiesCount: number;
  confidenceAvg: number;
  criticalFieldsValid: boolean;
  errorMessage?: string;
}

interface DiagnosticEvent {
  documentId: string;
  documentType: string;
  fileName: string;
  event: 'PARSED' | 'ROUTED' | 'OCR_DONE' | 'MOVEMENT_CREATED' | 'ERROR';
  destination?: string;
  metadata?: Record<string, any>;
}

class TelemetryService {
  private sessionId: string;
  private isDev: boolean;
  private events: TelemetryEvent[] = [];

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isDev = process.env.NODE_ENV === 'development';
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(event: Omit<TelemetryEvent, 'timestamp' | 'sessionId' | 'isDev'>) {
    const telemetryEvent: TelemetryEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      isDev: this.isDev
    };

    this.events.push(telemetryEvent);

    // Only log in development mode with safe data
    if (this.isDev) {
      console.group(`🔧 ATLAS Telemetry: ${event.type.toUpperCase()}`);
      console.log('Action:', event.action);
      if (event.metadata) {
        console.log('Metadata:', this.sanitizeMetadata(event.metadata));
      }
      console.log('Session:', this.sessionId);
      console.log('Timestamp:', telemetryEvent.timestamp);
      console.groupEnd();
    }
  }

  // Remove sensitive data from metadata
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    
    // Remove or mask sensitive fields
    const sensitiveKeys = ['content', 'blob', 'token', 'key', 'password', 'secret'];
    
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        if (typeof sanitized[key] === 'string') {
          sanitized[key] = `[MASKED:${sanitized[key].length}chars]`;
        } else {
          sanitized[key] = '[MASKED:object]';
        }
      }
    }

    return sanitized;
  }

  // Bank parsing telemetry
  bankParseStart(fileName: string, fileSize: number): string {
    const operationId = `parse_${Date.now()}`;
    this.log({
      type: 'bank_parse',
      action: 'start',
      metadata: {
        operationId,
        fileName,
        fileSize,
        fileSizeKB: Math.round(fileSize / 1024)
      }
    });
    return operationId;
  }

  bankParseComplete(operationId: string, metrics: BankParseMetrics): void {
    this.log({
      type: 'bank_parse',
      action: 'complete',
      metadata: {
        operationId,
        ...metrics,
        fileSizeKB: Math.round(metrics.fileSize / 1024)
      }
    });
  }

  bankParseError(operationId: string, error: string, fileName?: string): void {
    this.log({
      type: 'error',
      action: 'bank_parse_failed',
      metadata: {
        operationId,
        fileName,
        error: error.substring(0, 200) // Limit error message length
      }
    });
  }

  // Manual mapping telemetry
  manualMappingStart(fileName: string, reason: string): string {
    const operationId = `mapping_${Date.now()}`;
    this.log({
      type: 'manual_mapping',
      action: 'start',
      metadata: {
        operationId,
        fileName,
        reason
      }
    });
    return operationId;
  }

  manualMappingComplete(operationId: string, columnsMapping: Record<string, number>): void {
    this.log({
      type: 'manual_mapping',
      action: 'complete',
      metadata: {
        operationId,
        columnsMapped: Object.keys(columnsMapping).length,
        mappingTypes: Object.keys(columnsMapping)
      }
    });
  }

  // OCR telemetry
  ocrProcessStart(fileName: string, fileSize: number): string {
    const operationId = `ocr_${Date.now()}`;
    this.log({
      type: 'ocr_process',
      action: 'start',
      metadata: {
        operationId,
        fileName,
        fileSize,
        fileSizeKB: Math.round(fileSize / 1024)
      }
    });
    return operationId;
  }

  ocrProcessComplete(operationId: string, metrics: OCRProcessMetrics): void {
    this.log({
      type: 'ocr_process',
      action: 'complete',
      metadata: {
        operationId,
        ...metrics,
        fileSizeKB: Math.round(metrics.fileSize / 1024)
      }
    });
  }

  ocrProcessError(operationId: string, error: string, fileName?: string): void {
    this.log({
      type: 'error',
      action: 'ocr_process_failed',
      metadata: {
        operationId,
        fileName,
        error: error.substring(0, 200)
      }
    });
  }

  // Performance telemetry
  measurePerformance(action: string, durationMs: number, metadata?: Record<string, any>): void {
    this.log({
      type: 'performance',
      action,
      metadata: {
        durationMs,
        durationSec: Math.round(durationMs / 1000 * 100) / 100,
        ...metadata
      }
    });
  }

  // QA Checklist tracking
  qaChecklistComplete(checklist: string, status: 'pass' | 'fail' | 'warning', details?: string): void {
    this.log({
      type: 'performance',
      action: 'qa_checklist',
      metadata: {
        checklist,
        status,
        details: details?.substring(0, 100)
      }
    });
  }

  // Diagnostic events for 5-minute checklist
  emitDiagnosticEvent(event: DiagnosticEvent): void {
    const eventName = `EVENT:${event.event}`;
    this.log({
      type: 'diagnostic',
      action: eventName,
      metadata: {
        ...event,
        timestamp: new Date().toISOString()
      }
    });
    
    // Also log to console for easy debugging
    if (this.isDev) {
      console.log(`🔍 ${eventName}`, {
        document: `${event.fileName} (${event.documentType})`,
        destination: event.destination,
        metadata: event.metadata
      });
    }
  }

  // Convenience methods for common diagnostic events
  emitParsedEvent(documentId: string, documentType: string, fileName: string, metadata?: Record<string, any>): void {
    this.emitDiagnosticEvent({
      documentId,
      documentType,
      fileName,
      event: 'PARSED',
      metadata
    });
  }

  emitRoutedEvent(documentId: string, documentType: string, fileName: string, destination: string, metadata?: Record<string, any>): void {
    this.emitDiagnosticEvent({
      documentId,
      documentType,
      fileName,
      event: 'ROUTED',
      destination,
      metadata
    });
  }

  emitOCRDoneEvent(documentId: string, fileName: string, metadata?: Record<string, any>): void {
    this.emitDiagnosticEvent({
      documentId,
      documentType: 'invoice', // OCR is primarily for invoices
      fileName,
      event: 'OCR_DONE',
      metadata
    });
  }

  emitMovementCreatedEvent(documentId: string, fileName: string, movementsCount: number, metadata?: Record<string, any>): void {
    this.emitDiagnosticEvent({
      documentId,
      documentType: 'bank_statement',
      fileName,
      event: 'MOVEMENT_CREATED',
      metadata: {
        ...metadata,
        movementsCount
      }
    });
  }

  emitErrorEvent(documentId: string, documentType: string, fileName: string, error: string, metadata?: Record<string, any>): void {
    this.emitDiagnosticEvent({
      documentId,
      documentType,
      fileName,
      event: 'ERROR',
      metadata: {
        ...metadata,
        error
      }
    });
  }

  // Get diagnostic events for dashboard
  getDiagnosticEvents(limit: number = 50): DiagnosticEvent[] {
    return this.events
      .filter(e => e.type === 'diagnostic')
      .slice(-limit)
      .map(e => e.metadata as DiagnosticEvent)
      .reverse(); // Most recent first
  }

  // Clear all events (for testing)
  clearEvents(): void {
    this.events = [];
  }

  // Get session summary for debugging
  getSessionSummary(): {
    sessionId: string;
    totalEvents: number;
    eventsByType: Record<string, number>;
    errors: number;
    isDev: boolean;
  } {
    const eventsByType: Record<string, number> = {};
    let errors = 0;

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      if (event.type === 'error') {
        errors++;
      }
    }

    return {
      sessionId: this.sessionId,
      totalEvents: this.events.length,
      eventsByType,
      errors,
      isDev: this.isDev
    };
  }

  // Export session data for debugging (dev only)
  exportSessionData(): TelemetryEvent[] | null {
    if (!this.isDev) {
      console.warn('Session data export only available in development mode');
      return null;
    }
    return [...this.events];
  }
}

// Global instance
export const telemetry = new TelemetryService();

// QA Checklist integration
export const qaChecklist = {
  // Bank parsing QA
  bankParsing: {
    fileSupport: (formats: string[]) => {
      const expected = ['csv', 'xls', 'xlsx'];
      const allSupported = expected.every(format => formats.includes(format));
      telemetry.qaChecklistComplete(
        'bank_file_support',
        allSupported ? 'pass' : 'fail',
        `Supports: ${formats.join(', ')}`
      );
      return allSupported;
    },
    
    headerDetection: (detected: boolean, confidence: number) => {
      const status = detected && confidence >= 0.5 ? 'pass' : 'warning';
      telemetry.qaChecklistComplete(
        'header_detection',
        status,
        `Detected: ${detected}, Confidence: ${confidence}`
      );
      return status === 'pass';
    },
    
    spanishNormalization: (dateFormat: string, amountFormat: string) => {
      const validDate = dateFormat.includes('dd/mm/yyyy');
      const validAmount = amountFormat.includes('1.234,56');
      const status = validDate && validAmount ? 'pass' : 'fail';
      telemetry.qaChecklistComplete(
        'spanish_normalization',
        status,
        `Date: ${dateFormat}, Amount: ${amountFormat}`
      );
      return status === 'pass';
    },
    
    fallbackMapping: (available: boolean, usable: boolean) => {
      const status = available && usable ? 'pass' : 'fail';
      telemetry.qaChecklistComplete(
        'fallback_mapping',
        status,
        `Available: ${available}, Usable: ${usable}`
      );
      return status === 'pass';
    }
  },

  // OCR processing QA
  ocrProcessing: {
    euEndpoint: (endpoint: string) => {
      const isEU = endpoint.includes('eu-documentai.googleapis.com');
      telemetry.qaChecklistComplete(
        'ocr_eu_endpoint',
        isEU ? 'pass' : 'fail',
        `Endpoint: ${endpoint}`
      );
      return isEU;
    },
    
    confidenceThreshold: (thresholdUsed: number, fieldsRespected: boolean) => {
      const correctThreshold = thresholdUsed === 0.80;
      const status = correctThreshold && fieldsRespected ? 'pass' : 'fail';
      telemetry.qaChecklistComplete(
        'ocr_confidence_threshold',
        status,
        `Threshold: ${thresholdUsed}, Respected: ${fieldsRespected}`
      );
      return status === 'pass';
    },
    
    noInvention: (fieldsWithLowConfidence: number, fieldsLeftEmpty: number) => {
      const noInvention = fieldsWithLowConfidence === fieldsLeftEmpty;
      telemetry.qaChecklistComplete(
        'ocr_no_invention',
        noInvention ? 'pass' : 'fail',
        `Low confidence: ${fieldsWithLowConfidence}, Left empty: ${fieldsLeftEmpty}`
      );
      return noInvention;
    }
  }
};