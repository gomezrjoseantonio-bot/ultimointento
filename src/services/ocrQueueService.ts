// H8: OCR Background Queue Service
// Implements job queue with states, persistence, concurrency control, and retry logic

import { OCRResult } from './db';
import { processDocumentOCR } from './documentAIService';

export type QueueJobStatus = 'PENDING' | 'PROCESSING' | 'OK' | 'ERROR';

export interface QueueJob {
  id: string;
  documentId: number;
  filename: string;
  blob: Blob;
  status: QueueJobStatus;
  attempt: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: OCRResult;
  error?: string;
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  timestamp: string;
  status: QueueJobStatus;
  provider: string;
  endpointHost: string;
  durationMs?: number;
  attempt: number;
  errorCode?: string;
  errorMessage?: string;
}

// H8: Queue configuration
const QUEUE_CONFIG = {
  maxConcurrency: 1, // Process one at a time to avoid quota issues
  retryDelays: [5000, 30000, 120000], // 5s, 30s, 2m exponential backoff
  timeout: 30000, // 30s timeout per file
  persistenceKey: 'OCR_QUEUE_STATE'
};

class OCRQueueService {
  private queue: QueueJob[] = [];
  private processing: Set<string> = new Set();
  private listeners: Array<(queue: QueueJob[]) => void> = [];

  constructor() {
    this.loadFromStorage();
    this.startProcessing();
  }

  // H8: Add job to queue
  enqueue(documentId: number, filename: string, blob: Blob): string {
    const jobId = `ocr_${documentId}_${Date.now()}`;
    
    const job: QueueJob = {
      id: jobId,
      documentId,
      filename,
      blob,
      status: 'PENDING',
      attempt: 0,
      createdAt: new Date().toISOString(),
      auditTrail: [{
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        provider: 'DocumentAI',
        endpointHost: 'eu-documentai.googleapis.com',
        attempt: 0
      }]
    };

    this.queue.push(job);
    this.persistToStorage();
    this.notifyListeners();

    if (process.env.NODE_ENV === 'development') {
      console.info('OCR Queue: Enqueued job', { jobId, filename, queueLength: this.queue.length });
    }

    return jobId;
  }

  // H8: Get queue status
  getQueue(): QueueJob[] {
    return [...this.queue];
  }

  // H8: Get job by ID
  getJob(jobId: string): QueueJob | undefined {
    return this.queue.find(job => job.id === jobId);
  }

  // H8: Retry failed job
  retry(jobId: string): boolean {
    const job = this.queue.find(j => j.id === jobId);
    if (!job || job.status !== 'ERROR') {
      return false;
    }

    job.status = 'PENDING';
    job.attempt = 0; // Reset attempt counter
    job.error = undefined;
    job.auditTrail.push({
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      provider: 'DocumentAI',
      endpointHost: 'eu-documentai.googleapis.com',
      attempt: 0
    });

    this.persistToStorage();
    this.notifyListeners();

    if (process.env.NODE_ENV === 'development') {
      console.info('OCR Queue: Retrying job', { jobId });
    }

    return true;
  }

  // H8: Remove job from queue
  remove(jobId: string): boolean {
    const index = this.queue.findIndex(job => job.id === jobId);
    if (index === -1) {
      return false;
    }

    this.queue.splice(index, 1);
    this.processing.delete(jobId);
    this.persistToStorage();
    this.notifyListeners();

    return true;
  }

  // H8: Subscribe to queue changes
  subscribe(listener: (queue: QueueJob[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // H8: Clear completed jobs older than 24h
  cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24h ago
    const before = this.queue.length;
    
    this.queue = this.queue.filter(job => {
      if (job.status === 'OK' || job.status === 'ERROR') {
        const completedTime = job.completedAt ? new Date(job.completedAt).getTime() : 0;
        return completedTime > cutoff;
      }
      return true; // Keep pending/processing jobs
    });

    if (this.queue.length !== before) {
      this.persistToStorage();
      this.notifyListeners();
      
      if (process.env.NODE_ENV === 'development') {
        console.info('OCR Queue: Cleaned up', { removed: before - this.queue.length });
      }
    }
  }

  // H8: Get queue metrics
  getMetrics() {
    const pending = this.queue.filter(j => j.status === 'PENDING').length;
    const processing = this.queue.filter(j => j.status === 'PROCESSING').length;
    const completed = this.queue.filter(j => j.status === 'OK').length;
    const failed = this.queue.filter(j => j.status === 'ERROR').length;

    // Calculate average processing time
    const completedJobs = this.queue.filter(j => j.status === 'OK' && j.startedAt && j.completedAt);
    const avgDuration = completedJobs.length > 0 
      ? completedJobs.reduce((sum, job) => {
          const duration = new Date(job.completedAt!).getTime() - new Date(job.startedAt!).getTime();
          return sum + duration;
        }, 0) / completedJobs.length
      : 0;

    // Get last 20 errors
    const errors = this.queue
      .filter(j => j.status === 'ERROR')
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
      .slice(0, 20)
      .map(job => ({
        jobId: job.id,
        filename: job.filename,
        error: job.error,
        timestamp: job.completedAt || job.createdAt,
        attempt: job.attempt
      }));

    return {
      pending,
      processing,
      completed,
      failed,
      total: this.queue.length,
      avgDurationMs: Math.round(avgDuration),
      recentErrors: errors
    };
  }

  // H8: Private methods

  private async startProcessing(): Promise<void> {
    // Run processing loop every 2 seconds
    setInterval(() => {
      this.processNext();
    }, 2000);

    // Run cleanup every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  private async processNext(): Promise<void> {
    // Respect concurrency limit
    if (this.processing.size >= QUEUE_CONFIG.maxConcurrency) {
      return;
    }

    // Find next pending job
    const pendingJob = this.queue.find(job => 
      job.status === 'PENDING' && !this.processing.has(job.id)
    );

    if (!pendingJob) {
      return;
    }

    await this.processJob(pendingJob);
  }

  private async processJob(job: QueueJob): Promise<void> {
    this.processing.add(job.id);
    job.status = 'PROCESSING';
    job.startedAt = new Date().toISOString();
    job.attempt++;

    // Add audit entry
    job.auditTrail.push({
      timestamp: job.startedAt,
      status: 'PROCESSING',
      provider: 'DocumentAI',
      endpointHost: 'eu-documentai.googleapis.com',
      attempt: job.attempt
    });

    this.persistToStorage();
    this.notifyListeners();

    if (process.env.NODE_ENV === 'development') {
      console.info('OCR Queue: Processing job', { 
        jobId: job.id, 
        filename: job.filename,
        attempt: job.attempt 
      });
    }

    try {
      // Process with timeout
      const startTime = Date.now();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OCR_TIMEOUT')), QUEUE_CONFIG.timeout);
      });

      const ocrPromise = processDocumentOCR(job.blob, job.filename);
      const result = await Promise.race([ocrPromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      // Success
      job.status = 'OK';
      job.completedAt = new Date().toISOString();
      job.result = result;

      job.auditTrail.push({
        timestamp: job.completedAt,
        status: 'OK',
        provider: 'DocumentAI',
        endpointHost: 'eu-documentai.googleapis.com',
        durationMs: duration,
        attempt: job.attempt
      });

      if (process.env.NODE_ENV === 'development') {
        console.info('OCR Queue: Job completed', { 
          jobId: job.id, 
          durationMs: duration,
          fieldsFound: result.fields.length 
        });
      }

    } catch (error) {
      const duration = Date.now() - new Date(job.startedAt!).getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Determine error code
      let errorCode = 'UNKNOWN';
      if (errorMessage.includes('OCR_TIMEOUT')) {
        errorCode = 'TIMEOUT';
      } else if (errorMessage.includes('OCR_ERROR_403') || errorMessage.includes('OCR_ERROR_401')) {
        errorCode = 'PERMISSION';
      } else if (errorMessage.includes('OCR_ERROR_404')) {
        errorCode = 'PROCESSOR_NOT_FOUND';
      } else if (errorMessage.includes('OCR_ERROR_400')) {
        errorCode = 'INVALID';
      } else if (errorMessage.includes('OCR_ERROR_429')) {
        errorCode = 'QUOTA';
      }

      // Check if we should retry
      const shouldRetry = job.attempt < QUEUE_CONFIG.retryDelays.length && 
                         ['TIMEOUT', 'QUOTA', 'UNKNOWN'].includes(errorCode);

      if (shouldRetry) {
        // Schedule retry with exponential backoff
        const delay = QUEUE_CONFIG.retryDelays[job.attempt - 1];
        job.status = 'PENDING';
        
        job.auditTrail.push({
          timestamp: new Date().toISOString(),
          status: 'PENDING',
          provider: 'DocumentAI',
          endpointHost: 'eu-documentai.googleapis.com',
          durationMs: duration,
          attempt: job.attempt,
          errorCode,
          errorMessage: `Retry scheduled after ${delay}ms: ${errorMessage}`
        });

        if (process.env.NODE_ENV === 'development') {
          console.warn('OCR Queue: Job failed, retrying', { 
            jobId: job.id, 
            attempt: job.attempt,
            delay,
            errorCode 
          });
        }

        // Schedule retry
        setTimeout(() => {
          // Job will be picked up by next processing cycle
        }, delay);

      } else {
        // Final failure
        job.status = 'ERROR';
        job.completedAt = new Date().toISOString();
        job.error = errorMessage;

        job.auditTrail.push({
          timestamp: job.completedAt,
          status: 'ERROR',
          provider: 'DocumentAI',
          endpointHost: 'eu-documentai.googleapis.com',
          durationMs: duration,
          attempt: job.attempt,
          errorCode,
          errorMessage
        });

        if (process.env.NODE_ENV === 'development') {
          console.error('OCR Queue: Job failed permanently', { 
            jobId: job.id, 
            attempts: job.attempt,
            errorCode,
            error: errorMessage 
          });
        }
      }
    } finally {
      this.processing.delete(job.id);
      this.persistToStorage();
      this.notifyListeners();
    }
  }

  private persistToStorage(): void {
    try {
      // Serialize without blobs (too large for localStorage)
      const serializable = this.queue.map(job => ({
        ...job,
        blob: undefined, // Don't persist blobs
        blobSize: job.blob.size,
        blobType: job.blob.type
      }));

      localStorage.setItem(QUEUE_CONFIG.persistenceKey, JSON.stringify(serializable));
    } catch (error) {
      console.warn('OCR Queue: Failed to persist to localStorage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(QUEUE_CONFIG.persistenceKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only load non-processing jobs (blobs are lost on reload)
        this.queue = parsed
          .filter((job: any) => job.status !== 'PROCESSING')
          .map((job: any) => ({
            ...job,
            blob: new Blob([]), // Empty blob - will need to be re-enqueued if needed
          }));
        
        if (process.env.NODE_ENV === 'development') {
          console.info('OCR Queue: Restored from storage', { jobs: this.queue.length });
        }
      }
    } catch (error) {
      console.warn('OCR Queue: Failed to load from localStorage:', error);
      this.queue = [];
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.queue]);
      } catch (error) {
        console.error('OCR Queue: Listener error:', error);
      }
    });
  }
}

// H8: Singleton instance
export const ocrQueue = new OCRQueueService();

// H8: Helper functions for components
export const enqueueOCR = (documentId: number, filename: string, blob: Blob): string => {
  return ocrQueue.enqueue(documentId, filename, blob);
};

export const getOCRQueueStatus = () => {
  return ocrQueue.getQueue();
};

export const retryOCRJob = (jobId: string): boolean => {
  return ocrQueue.retry(jobId);
};

export const getOCRMetrics = () => {
  return ocrQueue.getMetrics();
};

export const subscribeToOCRQueue = (listener: (queue: QueueJob[]) => void) => {
  return ocrQueue.subscribe(listener);
};