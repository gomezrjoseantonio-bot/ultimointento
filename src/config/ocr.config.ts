// OCR Configuration for FEIN chunk processing
// Implements requirements from problem statement

export const OCR_CONFIG = {
  // Chunking configuration
  pagesPerChunk: 4,         // Configurable chunk size (3-5 pages recommended)
  maxRetriesPerChunk: 2,    // Maximum retries per chunk
  retryBackoffMs: 600,      // Base backoff time (exponential: *2)
  
  // Storage and cleanup
  tempStoreTtlMinutes: 10,  // Clean up temporary files after 10 minutes
  
  // Response size limits
  responseSizeSoftLimitBytes: 800_000,  // 800KB soft limit (< 1MB hard limit)
  
  // Processing limits
  maxProcessingTimeSeconds: 15,  // Target processing time for typical PDFs
  maxConcurrentChunks: 3,       // Concurrency limit for chunk processing
  
  // PDF size limits
  maxPdfSizeBytes: 20 * 1024 * 1024,  // 20MB maximum PDF size
  estimatedKbPerPage: 100,             // Rough estimate for page counting
} as const;

// Types for configuration
export type OCRConfig = typeof OCR_CONFIG;

// Validation helper
export const validateOCRConfig = (): boolean => {
  return (
    OCR_CONFIG.pagesPerChunk > 0 &&
    OCR_CONFIG.pagesPerChunk <= 10 &&
    OCR_CONFIG.maxRetriesPerChunk >= 0 &&
    OCR_CONFIG.responseSizeSoftLimitBytes < 1024 * 1024 &&
    OCR_CONFIG.maxProcessingTimeSeconds > 0
  );
};