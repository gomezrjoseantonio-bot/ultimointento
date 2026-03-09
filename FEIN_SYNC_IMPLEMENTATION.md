# FEIN OCR Synchronous Implementation

This document describes the new synchronous FEIN OCR implementation that replaces the previous job-based asynchronous system.

## Overview

The FEIN OCR endpoint has been refactored to provide purely synchronous processing:
- No more job storage or background processing
- No more Netlify Blobs/KV dependencies  
- No more GET polling endpoints
- Direct 200 response with extracted data or error response

## Backend Changes

### Endpoint: `/.netlify/functions/ocr-fein`

**Supported Methods:**
- `POST` - Process PDF document
- `OPTIONS` - CORS preflight
- `GET` - Returns 405 (Method Not Allowed)

**Request Format:**
```http
POST /.netlify/functions/ocr-fein
Content-Type: application/octet-stream
X-File-Name: document.pdf
X-File-Type: application/pdf

[PDF binary data]
```

**Response Formats:**

**Success (200):**
```json
{
  "success": true,
  "providerUsed": "docai",
  "fields": {
    "capital_inicial": "150000",
    "plazoMeses": "240", 
    "tin": "3.25",
    "tae": "3.89",
    "cuota": "1250.50",
    "sistemaAmortizacion": "FRANCES",
    "indice": "EURIBOR_12M",
    "diferencial": "2.10",
    "cuentaCargo": "ES12 3456 7890 1234 5678 9012",
    "vinculaciones": ["seguros", "nomina"],
    "comisiones": {"apertura": "1.0", "amortizacion": "0.5"},
    "gastos": {"tasacion": "300", "notaria": "500"},
    "fechaOferta": "2024-01-15",
    "validez": "30"
  },
  "pending": ["diferencial", "comisiones"],
  "confidenceGlobal": 0.85
}
```

**Document Too Large (413):**
```json
{
  "success": false,
  "code": "DOC_TOO_LARGE_SYNC", 
  "status": 413,
  "message": "El documento excede el límite de 15 páginas para procesamiento directo. Sube una versión más corta o introdúcelo manualmente."
}
```

**Other Errors (400/403/404/500):**
```json
{
  "success": false,
  "code": "INVALID_ARGUMENT|PERMISSION_DENIED|NOT_FOUND|INTERNAL_ERROR",
  "message": "Error description"
}
```

### Error Handling

The backend maps Document AI errors to appropriate HTTP status codes:

- **413** - Document exceeds 15 pages limit
- **403** - Permission denied (DocAI access issues)
- **404** - Service not found (DocAI endpoint issues)  
- **400** - Invalid file format or corrupt PDF
- **500** - Internal server errors

## Frontend Changes

### Service Usage

```typescript
import { feinOcrService } from '../services/feinOcrService';

// Simple synchronous processing
const result = await feinOcrService.processFEINDocumentNew(file, (progress) => {
  console.log(progress.message); // "Preparando documento...", "Procesando FEIN...", "Procesamiento completado"
});

if (result.success && result.loanDraft) {
  // Apply to form
  onFEINDraftReady(result.loanDraft);
} else {
  // Handle errors
  showError(result.errors[0]);
}
```

### Form Field Mapping

The service provides static methods for form integration:

```typescript
// Direct field mapping (converts ES format numbers)
const draft = FEINOCRService.mapFieldsToLoanDraft(fields, pending);

// Apply to form with deep merge (preserves user input)
FEINOCRService.applyFeinToForm(result, setFormValues);
```

### UI Changes

- **Single loading state** - No more background progress modals
- **Immediate feedback** - 200 response with data or error message
- **No polling** - Eliminated all network polling logic
- **Simplified UX** - One loader during the fetch operation

## Testing

A test page is available at `/test-fein-sync.html` that demonstrates:

1. **Successful processing** - Upload ≤15 page PDF
2. **Size limit handling** - Test >15 page rejection (413)
3. **Method validation** - GET request returns 405

## Migration Notes

### Breaking Changes

1. **No more 202 responses** - All processing is synchronous
2. **No more job IDs** - Eliminated background job system
3. **No more GET polling** - Removed `?jobId=` endpoint
4. **15-page limit** - Documents >15 pages return 413 error

### Compatibility

- **Form mapping** - Existing `FeinLoanDraft` format preserved
- **Error handling** - Consistent error message format
- **File upload** - Same multipart/form-data and binary support

## Performance

- **Faster small documents** - No job overhead for ≤15 pages
- **Predictable response times** - No background processing variability
- **Reduced complexity** - Eliminated storage dependencies
- **Better error reporting** - Immediate feedback on issues

## Monitoring

Key metrics to monitor:

- **Response times** - Should be <30 seconds for typical FEINs
- **413 error rate** - Documents exceeding page limit
- **Success rate** - Percentage of successful extractions
- **Field extraction quality** - Confidence scores and pending fields

## Configuration

Environment variables required:

```
DOC_AI_SA_JSON_B64=<base64-encoded-service-account>
DOC_AI_PROJECT_ID=<google-cloud-project-id>
DOC_AI_LOCATION=<processor-location>
DOC_AI_PROCESSOR_ID=<document-ai-processor-id>
```