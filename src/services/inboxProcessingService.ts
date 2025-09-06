// ATLAS HORIZON - Enhanced Inbox Processing Service
// Handles OCR queue and document processing pipeline with exact requirements

import { InboxItem, InboxProcessingTask, OCRExtractionResult, ClassificationResult, PropertyDetectionResult, RoutingDestinationResult, InboxLogEntry } from '../types/inboxTypes';
import { enhancedOCRService } from './enhancedOcrService';
import { detectDocumentType } from './newDocumentTypeDetectionService';
import { fieldValidationService } from './fieldValidationService';
import { classifyDocument } from './documentClassificationService';
import { detectProperty } from './propertyDetectionService';
import { routeInboxDocument } from './documentRoutingService';

class InboxProcessingService {
  private queue: InboxProcessingTask[] = [];
  private processing = false;
  private items: Map<string, InboxItem> = new Map();

  /**
   * Create InboxItem and enqueue for processing
   * Following state machine: received → ocr_running → ocr_ok | ocr_failed | ocr_timeout → classified_ok | needs_review → archived | deleted
   */
  async createAndEnqueue(
    fileUrl: string,
    filename: string,
    mime: string,
    size: number,
    source: 'upload' | 'email',
    emailMetadata?: { from: string; subject: string; date: string }
  ): Promise<string> {
    // Create InboxItem with proper initial state
    const item: InboxItem = {
      id: this.generateId(),
      fileUrl,
      filename,
      mime,
      size,
      source,
      createdAt: new Date(),
      status: 'received', // Start with received state
      documentType: 'otros', // Will be determined during processing
      ocr: {
        status: 'queued',
        timestamp: new Date().toISOString()
      },
      logs: [{
        timestamp: new Date().toISOString(),
        code: 'INBOX_RECEIVED',
        message: `Document received: ${filename}`,
        meta: { 
          fileSize: size,
          mimeType: mime,
          source,
          ...emailMetadata
        }
      }]
    };

    // Store item
    this.items.set(item.id, item);

    // Enqueue processing task
    const task: InboxProcessingTask = {
      docId: item.id,
      priority: 'normal',
      retryCount: 0,
      createdAt: new Date()
    };

    this.queue.push(task);
    console.log(`[Inbox] Created item ${item.id} and enqueued for processing`);

    // Start processing if not already running
    this.processQueue();

    return item.id;
  }

  /**
   * Process queue - main processing pipeline
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    console.log(`[Inbox] Starting queue processing, ${this.queue.length} items`);

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      const item = this.items.get(task.docId);

      if (!item) {
        console.warn(`[Inbox] Item ${task.docId} not found, skipping`);
        continue;
      }

      try {
        await this.processItem(item);
      } catch (error) {
        console.error(`[Inbox] Error processing ${item.id}:`, error);
        
        // Handle retry logic
        if (task.retryCount < 3) {
          task.retryCount++;
          this.queue.push(task);
          console.log(`[Inbox] Retrying ${item.id}, attempt ${task.retryCount}`);
        } else {
          // Mark as error after 3 retries
          item.status = 'ocr_failed';
          item.errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          item.logs.push({
            timestamp: new Date().toISOString(),
            code: 'OCR_FAILED',
            message: `Max retries reached: ${item.errorMessage}`,
            meta: { retryCount: task.retryCount }
          });
          this.items.set(item.id, item);
          console.error(`[Inbox] Max retries reached for ${item.id}, marked as error`);
        }
      }
    }

    this.processing = false;
    console.log('[Inbox] Queue processing completed');
  }

  /**
   * Process individual item through enhanced OCR → Classification → Routing pipeline
   * Following exact state machine: received → ocr_running → ocr_ok | ocr_failed | ocr_timeout → classified_ok | needs_review → archived | deleted
   */
  private async processItem(item: InboxItem): Promise<void> {
    console.log(`[Inbox] Processing item ${item.id}: ${item.mime}`);

    try {
      // Step 1: Document Type Detection
      const typeDetection = await detectDocumentType(
        new File([], item.filename), 
        item.filename
      );
      
      item.documentType = typeDetection.documentType;
      item.logs.push({
        timestamp: new Date().toISOString(),
        code: 'CLASSIFICATION_OK',
        message: `Document type detected: ${typeDetection.documentType}`,
        meta: { 
          confidence: typeDetection.confidence,
          triggers: typeDetection.triggers,
          shouldSkipOCR: typeDetection.shouldSkipOCR
        }
      });

      // Step 2: Skip OCR for bank statements
      if (typeDetection.shouldSkipOCR && typeDetection.documentType === 'extracto_banco') {
        item.status = 'classified_ok';
        item.summary = {
          destino: 'Tesorería › Movimientos (importación automática)'
        };
        item.logs.push({
          timestamp: new Date().toISOString(),
          code: 'ARCHIVED_TO',
          message: 'Bank statement routed to automatic import',
          meta: { destination: 'tesoreria_movimientos' }
        });
        this.items.set(item.id, item);
        return;
      }

      // Step 3: OCR Processing (for factura, recibo_sepa, otros)
      item.status = 'ocr_running';
      item.ocr.status = 'running';
      this.items.set(item.id, item);

      const ocrResult = await enhancedOCRService.processDocument(
        new Blob(), // In real implementation, would get blob from fileUrl
        item.filename,
        item.documentType
      );

      // Update OCR results
      item.ocr = {
        job_id: ocrResult.job_id,
        status: ocrResult.status,
        timestamp: new Date().toISOString(),
        data: ocrResult.data,
        confidence: ocrResult.confidence,
        error: ocrResult.error
      };

      // Add OCR logs
      item.logs.push(...ocrResult.logs);

      if (ocrResult.status !== 'succeeded' || !ocrResult.data) {
        item.status = ocrResult.status === 'timeout' ? 'ocr_timeout' : 'ocr_failed';
        item.errorMessage = ocrResult.error || 'OCR processing failed';
        this.items.set(item.id, item);
        return;
      }

      // OCR succeeded
      item.status = 'ocr_ok';
      const ocrData = ocrResult.data;

      // Step 4: Field Validation
      const validation = item.documentType === 'recibo_sepa' 
        ? fieldValidationService.validateReciboSepa(ocrData)
        : fieldValidationService.validateGeneralDocument(ocrData);

      item.validation = validation;

      // Step 5: Update summary with extracted data
      item.summary = {
        supplier_name: ocrData.supplier_name,
        supplier_tax_id: ocrData.supplier_tax_id,
        total_amount: ocrData.total_amount,
        issue_date: ocrData.issue_date,
        due_or_charge_date: ocrData.due_date, // Map due_date to due_or_charge_date
        service_address: ocrData.service_address,
        iban_mask: ocrData.iban_mask
      };

      // Step 6: Classification and property detection (if needed)
      if (ocrData.fullText) {
        const classification = await this.classifyDocument(ocrData, item.fileUrl);
        item.subtype = classification.subtype;

        const propertyDetection = await this.detectProperty(ocrData);
        if (propertyDetection.inmueble_id) {
          item.summary.inmueble_id = propertyDetection.inmueble_id;
        }
      }

      // Step 7: Determine final status
      if (validation.reviewRequired) {
        item.status = 'needs_review';
        item.logs.push({
          timestamp: new Date().toISOString(),
          code: 'CLASSIFICATION_NEEDS_REVIEW',
          message: validation.reviewReason || 'Manual review required',
          meta: { 
            criticalFieldsMissing: validation.criticalFieldsMissing,
            confidence: validation.confidence.global
          }
        });
      } else {
        item.status = 'classified_ok';
        item.logs.push({
          timestamp: new Date().toISOString(),
          code: 'CLASSIFICATION_OK',
          message: 'Document processed successfully',
          meta: { 
            confidence: validation.confidence.global,
            fieldsExtracted: Object.keys(ocrData).length
          }
        });

        // Set expiration for auto-purge (72h)
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 72);
        item.expiresAt = expirationTime.toISOString();
      }

      this.items.set(item.id, item);
      console.log(`[Inbox] Completed processing ${item.id}: status=${item.status}, confidence=${validation.confidence.global}%`);

    } catch (error) {
      console.error(`[Inbox] Error processing ${item.id}:`, error);
      item.status = 'ocr_failed';
      item.errorMessage = error instanceof Error ? error.message : 'Processing error';
      item.logs.push({
        timestamp: new Date().toISOString(),
        code: 'OCR_FAILED',
        message: `Processing failed: ${item.errorMessage}`,
        meta: { error: error instanceof Error ? error.stack : String(error) }
      });
      this.items.set(item.id, item);
    }
  }

  /**
   * Extract OCR data from document (legacy wrapper)
   */
  private async extractOCRData(fileUrl: string, mime: string): Promise<OCRExtractionResult | null> {
    try {
      // Use enhanced OCR service
      const blob = new Blob(); // In real implementation, would fetch from fileUrl
      const filename = fileUrl.split('/').pop() || 'document';
      
      const result = await enhancedOCRService.processDocument(blob, filename, 'factura');
      
      return result.data || null;
    } catch (error) {
      console.error('[Inbox] OCR extraction failed:', error);
      
      if (error instanceof Error && error.message === 'file_unreadable') {
        throw error; // Preserve specific errors
      }
      
      return null;
    }
  }

  /**
   * Classify document based on OCR text
   */
  private async classifyDocument(ocrData: OCRExtractionResult, fileUrl: string): Promise<ClassificationResult> {
    // Get full OCR text (this would need to be extracted from the OCR result)
    const fullText = this.extractFullTextFromOCR(ocrData);
    
    return await classifyDocument(ocrData, fullText);
  }

  /**
   * Detect property by address or CUPS
   */
  private async detectProperty(ocrData: OCRExtractionResult): Promise<PropertyDetectionResult> {
    return await detectProperty(ocrData);
  }

  /**
   * Route document to appropriate destination
   */
  private async routeDocument(
    item: InboxItem,
    ocrData: OCRExtractionResult,
    classification: ClassificationResult,
    propertyDetection: PropertyDetectionResult
  ): Promise<RoutingDestinationResult> {
    return await routeInboxDocument(item, ocrData, classification, propertyDetection);
  }

  /**
   * Extract full text from OCR data for classification
   */
  private extractFullTextFromOCR(ocrData: OCRExtractionResult): string {
    // Combine all available text fields
    const textParts = [
      ocrData.supplier_name,
      ocrData.service_address,
      Object.values(ocrData.metadata || {}).join(' ')
    ].filter(Boolean);
    
    return textParts.join(' ');
  }

  /**
   * Get all inbox items
   */
  getItems(): InboxItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get item by ID
   */
  getItem(id: string): InboxItem | undefined {
    return this.items.get(id);
  }

  /**
   * Reprocess item (re-queue)
   */
  reprocessItem(id: string): void {
    const item = this.items.get(id);
    if (!item) return;

    item.status = 'received'; // Reset to initial state
    delete item.errorMessage;
    item.ocr = {
      status: 'queued',
      timestamp: new Date().toISOString()
    };
    item.logs.push({
      timestamp: new Date().toISOString(),
      code: 'INBOX_RECEIVED',
      message: 'Document reprocessing requested',
      meta: { previousStatus: item.status }
    });
    this.items.set(id, item);

    const task: InboxProcessingTask = {
      docId: id,
      priority: 'high',
      retryCount: 0,
      createdAt: new Date()
    };

    this.queue.unshift(task); // Add to front for high priority
    this.processQueue();
  }

  /**
   * Delete item
   */
  deleteItem(id: string): void {
    this.items.delete(id);
    // Note: doesn't delete the created gasto/movimiento if it exists
  }

  /**
   * Auto-purge expired items (72h retention for 'classified_ok' status)
   */
  purgeExpiredItems(): void {
    const now = new Date();
    let purgedCount = 0;

    const itemsArray = Array.from(this.items.entries());
    for (const [id, item] of itemsArray) {
      if (item.status === 'classified_ok' && item.expiresAt) {
        const expiresAt = new Date(item.expiresAt);
        if (expiresAt <= now) {
          this.items.delete(id);
          purgedCount++;
        }
      }
    }

    if (purgedCount > 0) {
      console.log(`[Inbox] Auto-purged ${purgedCount} expired items`);
    }
  }

  private generateId(): string {
    return 'inbox_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Export singleton instance
export const inboxProcessingService = new InboxProcessingService();

// Start auto-purge every hour
setInterval(() => {
  inboxProcessingService.purgeExpiredItems();
}, 60 * 60 * 1000);