// ATLAS Horizon - Comprehensive Data Models
// Following exact specifications from comprehensive OCR instructions

export interface InboxItem {
  id: string;
  filename: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png" | "text/csv" | "application/vnd.ms-excel" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  size_bytes: number;

  kind: "invoice" | "receipt" | "bank_statement" | "contract" | "other";

  // OCR / parsing
  ocr_status: "PENDING" | "PROCESSING" | "OK" | "REQUIRES_REVIEW" | "ERROR";
  ocr_payload?: object; // respuesta íntegra del OCR o del parser
  extracted?: {
    total_amount?: number | null;
    net_amount?: number | null;
    tax_amount?: number | null;
    invoice_date?: string | null; // ISO yyyy-mm-dd
    due_date?: string | null;
    supplier_name?: string | null;
    supplier_tax_id?: string | null;
    receiver_name?: string | null;
    service_address?: string | null;
    service_type?: "electricity" | "water" | "gas" | "internet" | null;
    iban_masked?: string | null;
  };

  // Clasificación
  scope: "PROPERTY" | "PERSONAL" | null; // requerido para archivar
  property_id?: string | null; // si scope=PROPERTY
  final_destination?: string | null; // ruta textual de destino p.ej. "Inmuebles > Gastos > Suministros" o "Tesorería > Movimientos"
  outcome: "SAVED" | "REVIEW" | "ERROR" | null;

  // Enlaces creados (sin duplicar)
  linked_expense_id?: string | null; // gasto en inmuebles
  linked_movement_ids?: string[] | null; // movimientos en tesorería (normalmente 1)
  linked_contract_id?: string | null;

  // Control duplicados
  content_hash?: string; // SHA-256 del archivo base64
  dedupe_key?: string; // p.ej. ${supplier_tax_id}|${invoice_id}|${invoice_date}|${total_amount}

  // Auditoría
  created_at: string; // ISO
  updated_at: string; // ISO
  logs: { ts: string; level: "info" | "warn" | "error"; msg: string }[];
}

export interface TreasuryMovement {
  id: string;
  account_id: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  counterparty: string;
  amount: number;
  balance_after?: number;
  source: "import" | "manual";
  attachment_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface PropertiesExpense {
  id: string;
  property_id: string;
  category: "Suministros" | "Mejora" | "Mobiliario" | "Reparación y Conservación" | "Seguro" | "Comunidad" | "IBI" | "Otros";
  date: string; // ISO yyyy-mm-dd
  amount: number;
  supplier_name?: string;
  supplier_tax_id?: string;
  document_id: string;
  status: "Pagado" | "Pendiente";
  iban_masked?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Service interfaces for the complete implementation
export interface OCRServiceInterface {
  processDocument(fileBase64: string, mimeType: string, filename?: string): Promise<{
    success: boolean;
    data?: InboxItem['extracted'];
    error?: string;
  }>;
}

export interface BankStatementParserInterface {
  parseFile(file: File): Promise<{
    success: boolean;
    movements: TreasuryMovement[];
    detectedAccount?: string;
    detectedIban?: string;
    error?: string;
  }>;
}

export interface InboxProcessorInterface {
  processInboxItem(item: InboxItem): Promise<InboxItem>;
  createExpenseFromInvoice(item: InboxItem): Promise<string>; // returns expense_id
  createMovementsFromStatement(item: InboxItem): Promise<string[]>; // returns movement_ids
  assignToProperty(item: InboxItem, propertyId: string): Promise<void>;
  markAsReview(item: InboxItem, reason: string): Promise<void>;
  cleanup72h(): Promise<number>; // returns number of items cleaned
}

// Utility types for the comprehensive implementation
export type DocumentDestination = 
  | "Inmuebles › Gastos › Suministros"
  | "Inmuebles › Gastos › Mejora" 
  | "Inmuebles › Gastos › Mobiliario"
  | "Inmuebles › Gastos › Reparación y Conservación"
  | "Inmuebles › Gastos › Otros"
  | "Tesorería › Movimientos"
  | "Revisión Manual"
  | "Error de Procesamiento";

export type UtilityType = "Luz" | "Agua" | "Gas" | "Internet";

export type AEATCategory = "Mejora" | "Mobiliario" | "Reparación y Conservación";

// Constants for the implementation
export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg', 
  'image/png',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
] as const;

export const SUPPORTED_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'heic', 'doc', 'docx', 'xlsx', 'xls', 'csv'
] as const;

export const AUTO_ARCHIVE_HOURS = 72;

export const UTILITY_DETECTION_PATTERNS = {
  Luz: ['iberdrola', 'endesa', 'electricidad', 'luz', 'electric', 'kwh', 'consumo eléctrico'],
  Agua: ['agua', 'aqualia', 'canal isabel', 'aguas', 'hidro', 'abastecimiento', 'm3'],
  Gas: ['gas natural', 'repsol', 'naturgy', 'gas', 'kwh gas', 'combustible'],
  Internet: ['movistar', 'vodafone', 'orange', 'telecomunicaciones', 'internet', 'fibra']
} as const;

export const REFORM_KEYWORDS = {
  Mejora: ['reforma', 'mejora', 'rehabilitación', 'ampliación', 'instalación'],
  Mobiliario: ['mobiliario', 'muebles', 'equipamiento', 'electrodomésticos'],
  'Reparación y Conservación': ['reparación', 'conservación', 'mantenimiento', 'arreglo', 'fontanería']
} as const;