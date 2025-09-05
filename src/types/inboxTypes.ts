// ATLAS HORIZON - Inbox Types for OCR and Automatic Routing
// Following exact requirements from problem statement

export interface InboxItem {
  id: string;
  fileUrl: string;
  mime: string;
  size: number;
  source: 'upload' | 'email';
  createdAt: Date;
  status: 'ok' | 'review' | 'error' | 'processing';
  subtype?: 'suministro' | 'reforma' | 'recibo' | 'factura_generica';
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
  destRef?: {                   // adonde se guardó de verdad
    kind: 'gasto' | 'movimiento';
    id: string;                 // id del gasto o movimiento creado
    path: string;               // ej. "Inmuebles > Gastos > Suministros"
  } | null;
  errorMessage?: string;
}

// OCR Extraction Result
export interface OCRExtractionResult {
  supplier_name?: string;
  supplier_tax_id?: string;
  total_amount?: number;
  issue_date?: string;
  due_or_charge_date?: string;
  service_address?: string;
  iban_mask?: string;
  currency?: string;
  metadata?: Record<string, any>; // for optional base/tax data
}

// Document Classification Result
export interface ClassificationResult {
  subtype: 'suministro' | 'reforma' | 'recibo' | 'factura_generica';
  confidence: number;
  matchedKeywords: string[];
  reasoning: string;
}

// Property Detection Result
export interface PropertyDetectionResult {
  inmueble_id: string | null;
  confidence: number;
  matchMethod: 'address' | 'cups' | 'none';
  matchedText?: string;
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

// Queue Processing Task
export interface InboxProcessingTask {
  docId: string;
  priority: 'high' | 'normal';
  retryCount: number;
  createdAt: Date;
}