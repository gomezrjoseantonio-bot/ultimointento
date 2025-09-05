// ATLAS HORIZON - Inbox Processing Service
// Handles OCR queue and document processing pipeline

import { InboxItem, InboxProcessingTask, OCRExtractionResult, ClassificationResult, PropertyDetectionResult, RoutingDestinationResult } from '../types/inboxTypes';
import { extractOCRFields } from './ocrExtractionService';
import { classifyDocument } from './documentClassificationService';
import { detectProperty } from './propertyDetectionService';
import { routeInboxDocument } from './documentRoutingService';

class InboxProcessingService {
  private queue: InboxProcessingTask[] = [];
  private processing = false;
  private items: Map<string, InboxItem> = new Map();

  /**
   * Create InboxItem and enqueue for processing
   * Called automatically when PDF/JPG/PNG is uploaded or received via email
   */
  async createAndEnqueue(
    fileUrl: string,
    mime: string,
    size: number,
    source: 'upload' | 'email',
    emailMetadata?: { from: string; subject: string; date: string }
  ): Promise<string> {
    // Create InboxItem
    const item: InboxItem = {
      id: this.generateId(),
      fileUrl,
      mime,
      size,
      source,
      createdAt: new Date(),
      status: 'processing',
      summary: emailMetadata ? {
        destino: 'Procesando...'
      } : undefined
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
          item.status = 'error';
          item.errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          this.items.set(item.id, item);
          console.error(`[Inbox] Max retries reached for ${item.id}, marked as error`);
        }
      }
    }

    this.processing = false;
    console.log('[Inbox] Queue processing completed');
  }

  /**
   * Process individual item through OCR → Classification → Routing pipeline
   */
  private async processItem(item: InboxItem): Promise<void> {
    console.log(`[Inbox] Processing item ${item.id}: ${item.mime}`);

    // Step 1: OCR Extraction
    item.status = 'processing';
    this.items.set(item.id, item);

    const ocrResult = await this.extractOCRData(item.fileUrl, item.mime);
    if (!ocrResult || !ocrResult.total_amount) {
      item.status = 'review';
      item.errorMessage = 'Falta importe total';
      item.summary = { destino: 'Revisión requerida - Falta importe total' };
      this.items.set(item.id, item);
      return;
    }

    // Step 2: Classification
    const classification = await this.classifyDocument(ocrResult, item.fileUrl);
    
    // Step 3: Property Detection
    const propertyDetection = await this.detectProperty(ocrResult);

    // Step 4: Update summary with extracted data
    item.summary = {
      supplier_name: ocrResult.supplier_name,
      supplier_tax_id: ocrResult.supplier_tax_id,
      total_amount: ocrResult.total_amount,
      issue_date: ocrResult.issue_date,
      due_or_charge_date: ocrResult.due_or_charge_date,
      service_address: ocrResult.service_address,
      iban_mask: ocrResult.iban_mask,
      inmueble_id: propertyDetection.inmueble_id,
      destino: 'Procesando ruteo...'
    };
    item.subtype = classification.subtype;

    // Step 5: Automatic Routing
    const routingResult = await this.routeDocument(item, ocrResult, classification, propertyDetection);

    if (routingResult.requiresReview) {
      item.status = 'review';
      item.summary.destino = routingResult.reviewReason || 'Revisión requerida';
    } else if (routingResult.success) {
      item.status = 'ok';
      item.destRef = routingResult.destRef;
      item.summary.destino = routingResult.destRef?.path || 'Guardado';
      
      // Set expiration for auto-purge (72h)
      const expirationTime = new Date();
      expirationTime.setHours(expirationTime.getHours() + 72);
      (item as any).expiresAt = expirationTime.toISOString();
    } else {
      item.status = 'error';
      item.errorMessage = routingResult.errorMessage || 'Error en ruteo automático';
      item.summary.destino = 'Error';
    }

    this.items.set(item.id, item);
    console.log(`[Inbox] Completed processing ${item.id}: status=${item.status}, subtype=${item.subtype}`);
  }

  /**
   * Extract OCR data from document
   */
  private async extractOCRData(fileUrl: string, mime: string): Promise<OCRExtractionResult | null> {
    try {
      return await extractOCRFields(fileUrl, mime);
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

    item.status = 'processing';
    delete item.errorMessage;
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
   * Auto-purge expired items (72h retention for 'ok' status)
   */
  purgeExpiredItems(): void {
    const now = new Date();
    let purgedCount = 0;

    const itemsArray = Array.from(this.items.entries());
    for (const [id, item] of itemsArray) {
      if (item.status === 'ok' && (item as any).expiresAt) {
        const expiresAt = new Date((item as any).expiresAt);
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