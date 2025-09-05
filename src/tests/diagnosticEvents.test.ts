import { telemetry } from '../services/telemetryService';
import { isAutoRouteEnabled, isAutoOCREnabled, isBankImportEnabled } from '../config/envFlags';

describe('Diagnostic Events System', () => {
  beforeEach(() => {
    // Clear any existing events - reset the telemetry service
    telemetry.clearEvents();
  });

  it('should emit PARSED event when document is processed', () => {
    const documentId = 'test-doc-1';
    const fileName = 'test-invoice.pdf';
    
    telemetry.emitParsedEvent(documentId, 'invoice', fileName, {
      confidence: 0.85,
      shouldSkipOCR: false
    });

    const events = telemetry.getDiagnosticEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('PARSED');
    expect(events[0].documentType).toBe('invoice');
    expect(events[0].fileName).toBe(fileName);
  });

  it('should emit ROUTED event when document is routed to destination', () => {
    const documentId = 'test-doc-2';
    const fileName = 'test-invoice.pdf';
    const destination = 'Inmuebles › Gastos › Suministros';
    
    telemetry.emitRoutedEvent(documentId, 'invoice', fileName, destination, {
      category: 'suministros',
      amount: 29.35,
      status: 'OK',
      visibilityHours: 72
    });

    const events = telemetry.getDiagnosticEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('ROUTED');
    expect(events[0].destination).toBe(destination);
    expect(events[0].metadata?.visibilityHours).toBe(72);
  });

  it('should emit OCR_DONE event when OCR processing completes', () => {
    const documentId = 'test-doc-3';
    const fileName = 'factura-wekiwi.pdf';
    
    telemetry.emitOCRDoneEvent(documentId, fileName, {
      status: 'completed',
      entitiesCount: 8,
      confidenceAvg: 0.87
    });

    const events = telemetry.getDiagnosticEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('OCR_DONE');
    expect(events[0].metadata?.entitiesCount).toBe(8);
  });

  it('should emit MOVEMENT_CREATED event when bank statement creates movements', () => {
    const documentId = 'test-doc-4';
    const fileName = 'movements-392025.xlsx';
    const movementsCount = 15;
    
    telemetry.emitMovementCreatedEvent(documentId, fileName, movementsCount, {
      bank: 'BBVA',
      accountId: 'ES1234567890123456789012'
    });

    const events = telemetry.getDiagnosticEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('MOVEMENT_CREATED');
    expect(events[0].metadata?.movementsCount).toBe(movementsCount);
    expect(events[0].metadata?.bank).toBe('BBVA');
  });

  it('should emit ERROR event when processing fails', () => {
    const documentId = 'test-doc-5';
    const fileName = 'invalid-file.txt';
    const error = 'Cabeceras no reconocidas';
    
    telemetry.emitErrorEvent(documentId, 'bank_statement', fileName, error, {
      needsManualMapping: true
    });

    const events = telemetry.getDiagnosticEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('ERROR');
    expect(events[0].metadata?.error).toBe(error);
  });

  it('should respect environment flags configuration', () => {
    // Test that flags are properly configured
    expect(typeof isAutoRouteEnabled()).toBe('boolean');
    expect(typeof isAutoOCREnabled()).toBe('boolean');
    expect(typeof isBankImportEnabled()).toBe('boolean');
    
    // Default values should be true for production readiness
    expect(isAutoRouteEnabled()).toBe(true);
    expect(isAutoOCREnabled()).toBe(true);
    expect(isBankImportEnabled()).toBe(true);
  });

  it('should provide events for 5-minute diagnostic checklist', () => {
    // Simulate complete document processing workflow
    const documentId = 'test-checklist-doc';
    const fileName = 'factura-suministro.pdf';
    
    // 1. Document parsed
    telemetry.emitParsedEvent(documentId, 'invoice', fileName);
    
    // 2. OCR completed
    telemetry.emitOCRDoneEvent(documentId, fileName, {
      status: 'completed',
      entitiesCount: 6,
      confidenceAvg: 0.90
    });
    
    // 3. Document routed
    telemetry.emitRoutedEvent(documentId, 'invoice', fileName, 'Inmuebles › Gastos › Suministros');
    
    // Get events and verify diagnostic flow
    const events = telemetry.getDiagnosticEvents(10);
    
    // Should have 3 events (most recent first)
    expect(events).toHaveLength(3);
    expect(events[0].event).toBe('ROUTED');
    expect(events[1].event).toBe('OCR_DONE');
    expect(events[2].event).toBe('PARSED');
    
    // All should be for the same document
    events.forEach(event => {
      expect(event.documentId).toBe(documentId);
      expect(event.fileName).toBe(fileName);
    });
  });

  it('should handle bank statement processing with correct events', () => {
    const documentId = 'bank-statement-test';
    const fileName = 'extracto-bbva-202501.xlsx';
    
    // 1. Document parsed as bank statement
    telemetry.emitParsedEvent(documentId, 'bank_statement', fileName, {
      confidence: 0.95,
      shouldSkipOCR: true
    });
    
    // 2. Movements created (no OCR for bank statements)
    telemetry.emitMovementCreatedEvent(documentId, fileName, 23, {
      bank: 'BBVA',
      totalRows: 25,
      duplicates: 2
    });
    
    // 3. Document routed to treasury
    telemetry.emitRoutedEvent(documentId, 'bank_statement', fileName, 'Tesorería › Movimientos', {
      movementsCreated: 23,
      status: 'OK',
      visibilityHours: 72
    });
    
    const events = telemetry.getDiagnosticEvents(10);
    
    // Should have 3 events, no OCR_DONE event for bank statements
    expect(events).toHaveLength(3);
    expect(events.map(e => e.event)).toEqual(['ROUTED', 'MOVEMENT_CREATED', 'PARSED']);
    expect(events.some(e => e.event === 'OCR_DONE')).toBe(false);
  });
});