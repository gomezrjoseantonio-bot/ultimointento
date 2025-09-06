// ATLAS HORIZON - Inbox Types for OCR and Automatic Routing
// Following exact requirements from problem statement

export interface InboxItem {
  id: string;
  fileUrl: string;
  filename: string;
  mime: string;
  size: number;
  source: 'upload' | 'email';
  createdAt: Date;
  // State machine: received → ocr_running → ocr_ok | ocr_failed | ocr_timeout → classified_ok | needs_review → archived | deleted
  status: 'received' | 'ocr_running' | 'ocr_ok' | 'ocr_failed' | 'ocr_timeout' | 'classified_ok' | 'needs_review' | 'archived' | 'deleted';
  
  // Document type detection
  documentType: 'factura' | 'recibo_sepa' | 'extracto_banco' | 'otros';
  subtype?: 'suministro' | 'reforma' | 'recibo' | 'factura_generica';
  
  // OCR data with confidence and job tracking
  ocr: {
    job_id?: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout';
    timestamp?: string;
    data?: OCRExtractionResult;
    confidence?: {
      global: number;
      fields: { [fieldName: string]: number };
    };
    error?: string;
  };
  
  // Extracted and validated fields  
  summary?: {
    supplier_name?: string;
    supplier_tax_id?: string;
    total_amount?: number;      // SIEMPRE el campo que manda
    issue_date?: string;        // ISO
    due_or_charge_date?: string;// ISO si se detecta
    service_address?: string;
    iban_mask?: string;         // con asteriscos
    inmueble_id?: string | null;// si se detecta
    destino?: string;           // texto de "Destino final" para la UI
  };
  
  // Auto-destination and routing result
  destRef?: {                   // adonde se guardó de verdad
    kind: 'gasto' | 'movimiento';
    id: string;                 // id del gasto o movimiento creado
    path: string;               // ej. "Inmuebles > Gastos > Suministros"
  } | null;
  
  // Validation and review
  validation?: {
    isValid: boolean;
    criticalFieldsMissing: string[];
    reviewReason?: string;
  };
  
  // Structured logs with codes
  logs: InboxLogEntry[];
  
  // 72h expiration for auto-archived items
  expiresAt?: string;
  errorMessage?: string;
}

// Structured log entry with specific codes
export interface InboxLogEntry {
  timestamp: string;
  code: 'INBOX_RECEIVED' | 'OCR_QUEUED' | 'OCR_STARTED' | 'OCR_SUCCEEDED' | 'OCR_FAILED' | 'OCR_TIMEOUT' | 
        'AUTO_DESTINATION_INFERRED' | 'CLASSIFICATION_OK' | 'CLASSIFICATION_NEEDS_REVIEW' | 'ARCHIVED_TO' | 'DELETE';
  message: string;
  meta?: Record<string, any>;
}

// OCR Extraction Result with confidence and optional fields
export interface OCRExtractionResult {
  // Critical fields (for marking OK)
  supplier_name?: string;
  total_amount?: number;
  issue_date?: string;
  due_date?: string; // if exists; if not, mark as —
  
  // Optional fields (don't block)
  supplier_tax_id?: string;
  net_amount?: number;
  tax_amount?: number;
  service_address?: string;
  iban_mask?: string;
  line_items?: any[];
  
  // CUPS detection for property matching
  cups?: string;
  
  // Currency and normalization
  currency?: string;
  
  // Field confidence scores (0-100)
  confidenceScores?: { [fieldName: string]: number };
  
  // Raw OCR text for classification
  fullText?: string;
  
  // Provider metadata
  metadata?: Record<string, any>;
}

// Document Classification Result
export interface ClassificationResult {
  documentType: 'factura' | 'recibo_sepa' | 'extracto_banco' | 'otros';
  subtype: 'suministro' | 'reforma' | 'recibo' | 'factura_generica';
  confidence: number;
  matchedKeywords: string[];
  reasoning: string;
  shouldSkipOCR?: boolean; // true for extracto_banco
}

// Property Detection Result with heuristics
export interface PropertyDetectionResult {
  inmueble_id: string | null;
  confidence: number;
  matchMethod: 'address' | 'cups' | 'none';
  matchedText?: string;
  normalizedAddress?: string; // for address matching with ≥ 0.9 similarity
}

// IBAN and Account Detection for reconciliation
export interface AccountDetectionResult {
  account_id: string | null;
  iban_mask?: string;
  confidence: number;
  matchMethod: 'iban_exact' | 'iban_partial' | 'none';
  pendingReconciliation?: boolean;
}

// Auto-destination inference result
export interface DestinationInferenceResult {
  preferredDestination: 'tesoreria_movimientos' | 'inmuebles_gastos' | 'personal_gastos' | 'archivo_documentos';
  priority: 'inmueble' | 'cuenta' | 'categoria' | 'default';
  reasoning: string;
  inmueble_id?: string;
  account_id?: string;
  category?: string;
}

// Routing Destination Result
export interface RoutingDestinationResult {
  success: boolean;
  requiresReview: boolean;
  destRef?: {
    kind: 'gasto' | 'movimiento';
    id: string;
    path: string;
  };
  errorMessage?: string;
  reviewReason?: string;
}

// Queue Processing Task with priority and retry logic
export interface InboxProcessingTask {
  docId: string;
  priority: 'high' | 'normal';
  retryCount: number;
  createdAt: Date;
  shouldSkipOCR?: boolean; // for extracto_banco
}

// ZIP processing result
export interface ZipProcessingResult {
  success: boolean;
  extractedFiles: Array<{
    filename: string;
    content: Blob;
    type: string;
    inboxItemId?: string;
  }>;
  errors: string[];
}

// Field validation result
export interface FieldValidationResult {
  isValid: boolean;
  criticalFieldsMissing: string[];
  confidence: {
    global: number;
    fields: { [fieldName: string]: number };
  };
  reviewRequired: boolean;
  reviewReason?: string;
}