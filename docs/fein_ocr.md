# FEIN OCR - Chunk-based Processing Implementation

## Overview

This document describes the implementation of chunk-based FEIN (Ficha Europea de Información Normalizada) OCR processing to resolve ResponseSizeTooLarge errors and provide compact JSON responses.

## Problem Statement

The original FEIN OCR implementation processed entire PDF documents in a single request, causing:
- ResponseSizeTooLarge errors (~6MB limit exceeded)
- Large PDF processing failures
- Inefficient resource usage
- Poor user experience for large documents

## Solution Architecture

### 1. Chunk-based Processing Pipeline

```
PDF Input → Page Extraction → Chunk Division → OCR Processing → Server Aggregation → Compact JSON
```

#### Components:

1. **OCR Configuration** (`src/config/ocr.config.ts`)
   - Configurable chunk size (default: 4 pages)
   - Retry logic with exponential backoff
   - Response size limits (800KB soft limit)
   - Processing timeouts and concurrency controls

2. **FEIN Normalizer** (`src/services/ocr/feinNormalizer.ts`)
   - Field extraction from OCR text chunks
   - Spanish number/percentage parsing
   - Data aggregation and deduplication
   - Compact response generation

3. **Serverless Endpoint** (`functions/ocr-fein.ts`)
   - Async job-based processing
   - PDF page extraction simulation
   - Chunk processing with retry logic
   - Progress tracking and status reporting

4. **Updated FEIN Service** (`src/services/feinOcrService.ts`)
   - New chunked processing methods
   - Legacy compatibility maintained
   - Progress polling and job management

5. **Enhanced UI** (`src/components/financiacion/FEINUploader.tsx`)
   - Real-time progress tracking
   - Detailed processing stages
   - Error handling with Spanish messages

## Key Features

### Chunk Processing
- **Configurable chunk size**: Default 4 pages per chunk (3-5 recommended)
- **Concurrency control**: Maximum 3 concurrent chunks
- **Retry logic**: Up to 2 retries per chunk with exponential backoff
- **Progress tracking**: Real-time updates of pages processed

### Data Extraction
- **Spanish format support**: Amounts (250.000,00 €) and percentages (3,45 %)
- **Field prioritization**: Later chunks override earlier ones for conflicts
- **Bonification detection**: Automatic detection of common loan bonifications
- **Bank name normalization**: Standardized bank names

### Response Optimization
- **Compact JSON**: Only essential fields for loan creation
- **Size limits**: Soft limit of 800KB, hard limit under 1MB
- **Field filtering**: Null/undefined values excluded
- **Warning limitation**: Maximum 3 warnings in response

## API Interface

### FeinLoanDraft Response Format

```typescript
interface FeinLoanDraft {
  metadata: {
    sourceFileName: string;
    pagesTotal: number;
    pagesProcessed: number;
    ocrProvider: 'google' | 'tesseract' | 'azure' | string;
    processedAt: string; // ISO timestamp
    warnings?: string[];
  };
  prestamo: {
    aliasSugerido?: string;
    tipo: 'FIJO' | 'VARIABLE' | 'MIXTO' | null;
    capitalInicial?: number;           // €
    plazoMeses?: number;               // months
    periodicidadCuota?: 'MENSUAL' | 'TRIMESTRAL' | null;
    revisionMeses?: 6 | 12 | null;     // only variable/mixed
    indiceReferencia?: 'EURIBOR' | 'IRPH' | null;
    valorIndiceActual?: number | null; // %
    diferencial?: number | null;       // %
    tinFijo?: number | null;           // % for fixed portion
    comisionAperturaPct?: number | null;
    comisionMantenimientoMes?: number | null; // €
    amortizacionAnticipadaPct?: number | null;
    fechaFirmaPrevista?: string | null; // ISO date
    banco?: string | null;
    ibanCargoParcial?: string | null;   // last 4 digits
  };
  bonificaciones?: Array<{
    id: string;               // slug identifier
    etiqueta: string;         // display label
    descuentoPuntos?: number; // percentage points
    criterio?: string;        // requirement text
  }>;
}
```

### Job-based Processing

1. **Start Processing** (POST `/api/ocr-fein`)
   ```javascript
   const response = await fetch('/.netlify/functions/ocr-fein', {
     method: 'POST',
     headers: { 'Content-Type': 'application/octet-stream' },
     body: pdfArrayBuffer
   });
   // Returns: { success: true, jobId, pagesTotal, totalChunks }
   ```

2. **Check Status** (GET `/api/ocr-fein?jobId=xxx`)
   ```javascript
   const status = await fetch(`/.netlify/functions/ocr-fein?jobId=${jobId}`);
   // Returns: { success: true, job: { status, progress, result?, error? } }
   ```

## Configuration Options

```typescript
export const OCR_CONFIG = {
  pagesPerChunk: 4,         // Pages per processing chunk
  maxRetriesPerChunk: 2,    // Retry attempts per chunk
  retryBackoffMs: 600,      // Base backoff time (exponential)
  tempStoreTtlMinutes: 10,  // Cleanup interval
  responseSizeSoftLimitBytes: 800_000,  // Response size limit
  maxProcessingTimeSeconds: 15,         // Target processing time
  maxConcurrentChunks: 3,              // Concurrency limit
  maxPdfSizeBytes: 20 * 1024 * 1024,  // 20MB PDF limit
};
```

## Error Handling

### Client-side Errors
- File type validation (PDF only)
- File size limits (20MB maximum)
- Processing timeout handling
- Network error recovery

### Server-side Errors
- Chunk processing failures with retry
- Job timeout and cleanup
- Response size overflow protection
- Spanish error messages

## Testing

### Unit Tests
- FEIN field extraction validation
- Spanish number/percentage parsing
- Chunk aggregation logic
- Response compacting functionality

### Test Examples
```typescript
// Test Spanish amount parsing
expect(extractCapital('Capital: 250.000,00 €')).toBe(250000);

// Test percentage parsing  
expect(extractTIN('TIN: 3,45% anual')).toBe(3.45);

// Test bonification detection
expect(extractBonifications('nómina: -0,10 puntos')).toContain({
  id: 'nomina',
  descuentoPuntos: 0.1
});
```

## Performance Characteristics

### Target Metrics
- **Processing time**: ≤15 seconds for typical PDFs (10-20 pages)
- **Response size**: <800KB (soft limit), <1MB (hard limit)
- **Success rate**: >95% for valid FEIN documents
- **Concurrent processing**: Up to 3 chunks simultaneously

### Scalability
- In-memory job storage (demo implementation)
- Production: Redis/Database for job persistence
- Horizontal scaling via serverless functions
- Cleanup of temporary data (10-minute TTL)

## Usage Examples

### Frontend Integration
```typescript
// Start processing
const result = await feinOcrService.processFEINDocumentChunked(file);
if (result.success) {
  // Poll for progress
  const checkStatus = async () => {
    const status = await feinOcrService.checkFEINJobStatus(result.jobId);
    if (status.job?.status === 'completed') {
      handleFEINReady(status.job.result);
    }
  };
}
```

### Loan Form Pre-filling
```typescript
const handleFEINReady = (draft: FeinLoanDraft) => {
  // Pre-fill loan creation form
  setFormData({
    alias: draft.prestamo.aliasSugerido || generateAlias(draft.prestamo.banco),
    capital: draft.prestamo.capitalInicial,
    plazoMeses: draft.prestamo.plazoMeses,
    tipo: draft.prestamo.tipo,
    banco: draft.prestamo.banco,
    // ... other fields
  });
};
```

## Migration Notes

### Backward Compatibility
- Legacy `processFEINDocument()` method preserved
- Existing interfaces maintained
- Gradual migration path available

### Breaking Changes
- New `FeinLoanDraft` interface for compact responses
- Job-based async processing model
- Updated progress tracking UI

## Future Enhancements

1. **PDF.js Integration**: Real PDF page extraction instead of simulation
2. **ML-based Extraction**: Improved field detection accuracy
3. **Multi-provider OCR**: Support for Azure, Tesseract fallbacks
4. **Caching**: Persistent job storage and result caching
5. **Analytics**: Processing metrics and optimization insights

## Troubleshooting

### Common Issues

1. **Large PDF Failures**
   - Increase chunk size for faster processing
   - Reduce concurrent chunks to avoid memory issues
   - Check PDF page count estimation accuracy

2. **Field Extraction Gaps**
   - Review FEIN document format variations
   - Update regex patterns for new bank formats
   - Improve confidence scoring thresholds

3. **Response Size Exceeded**
   - Verify compacting logic effectiveness
   - Check for unexpectedly large extracted text
   - Adjust soft limit configuration

### Debug Information
- Enable detailed logging with `NODE_ENV=development`
- Check job status for chunk-level errors
- Monitor processing time per chunk
- Validate response JSON size before sending

---

## Conclusion

The chunk-based FEIN OCR implementation successfully resolves the ResponseSizeTooLarge error while providing a robust, scalable solution for processing large FEIN documents. The compact JSON response format ensures efficient data transfer while maintaining all necessary information for loan creation workflows.