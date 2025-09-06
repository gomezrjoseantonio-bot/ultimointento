// Unified Document Processing Service
// Implements exact requirements from problem statement

import { unifiedOcrService, OCRResponse } from './unifiedOcrService';
import { bankStatementParser, BankStatementParseResult } from './bankStatementParser';
import toast from 'react-hot-toast';

export type DocumentStatus = 'guardado_automatico' | 'revision_requerida' | 'error';

export interface ProcessedDocument {
  id: string;
  filename: string;
  type: string;
  size: number;
  uploadDate: string;
  status: DocumentStatus;
  
  // Classification
  documentType: 'factura' | 'extracto_bancario';
  utilityType?: 'Luz' | 'Agua' | 'Gas' | 'Internet';
  
  // Extracted fields
  supplier?: string;
  supplierTaxId?: string;
  amount?: number;
  issueDate?: string;
  dueDate?: string;
  serviceAddress?: string;
  iban?: string;
  
  // Destination info
  destination: string;
  destinationPath: 'Inmuebles › Gastos' | 'Tesorería › Movimientos' | 'Revisión' | 'Error';
  
  // Category (for reforms)
  categories?: {
    mejora?: number;
    mobiliario?: number;
    reparacion_conservacion?: number;
  };
  
  // Bank statement specific
  movementsCount?: number;
  detectedAccount?: string;
  
  // Metadata
  logs: Array<{
    timestamp: string;
    action: string;
  }>;
  
  blockingReasons?: string[];
  expiresAt?: string; // For 72h retention
  originalFile?: File;
}

export class UnifiedDocumentProcessor {
  private static instance: UnifiedDocumentProcessor;
  private documents: Map<string, ProcessedDocument> = new Map();
  
  static getInstance(): UnifiedDocumentProcessor {
    if (!UnifiedDocumentProcessor.instance) {
      UnifiedDocumentProcessor.instance = new UnifiedDocumentProcessor();
    }
    return UnifiedDocumentProcessor.instance;
  }

  /**
   * Process uploaded file according to requirements
   */
  async processFile(file: File): Promise<ProcessedDocument> {
    const docId = this.generateDocumentId();
    
    // Create initial document
    const doc: ProcessedDocument = {
      id: docId,
      filename: file.name,
      type: file.type,
      size: file.size,
      uploadDate: new Date().toISOString(),
      status: 'revision_requerida',
      documentType: this.detectDocumentType(file),
      destination: 'Procesando...',
      destinationPath: 'Revisión',
      logs: [
        { timestamp: new Date().toISOString(), action: 'Documento cargado' }
      ],
      originalFile: file
    };

    this.documents.set(docId, doc);

    // Route based on document type
    if (doc.documentType === 'extracto_bancario') {
      await this.processBankStatement(doc);
    } else {
      await this.processOCRDocument(doc);
    }

    return doc;
  }

  private detectDocumentType(file: File): 'factura' | 'extracto_bancario' {
    const extension = file.name.toLowerCase().split('.').pop();
    const ocrExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'doc', 'docx'];
    const bankExtensions = ['xls', 'xlsx', 'csv'];

    if (bankExtensions.includes(extension || '')) {
      return 'extracto_bancario';
    }
    
    return 'factura'; // Default for PDF/images/Word
  }

  private async processBankStatement(doc: ProcessedDocument): Promise<void> {
    try {
      if (!doc.originalFile) {
        throw new Error('Archivo no disponible');
      }

      toast.loading('📊 Procesando extracto bancario...', { id: doc.id });

      this.addLog(doc, 'Iniciando análisis de extracto bancario');

      const result = await bankStatementParser.parseFile(doc.originalFile);

      if (!result.success) {
        doc.status = 'error';
        doc.destinationPath = 'Error';
        doc.destination = 'Error en procesamiento';
        doc.blockingReasons = [result.error || 'Error desconocido'];
        
        this.addLog(doc, `Error: ${result.error}`);
        toast.error('⛔ Error procesando extracto', { id: doc.id });
        return;
      }

      if (result.requiresMapping) {
        doc.status = 'revision_requerida';
        doc.destinationPath = 'Revisión';
        doc.destination = 'Mapeo de columnas requerido';
        doc.blockingReasons = ['Falta mapear columnas: fecha, concepto, importe'];
        
        this.addLog(doc, 'Requiere mapeo manual de columnas');
        toast.error('⚠️ Falta mapear columnas', { id: doc.id });
        return;
      }

      if (!result.detectedAccount && !result.detectedIban) {
        doc.status = 'revision_requerida';
        doc.destinationPath = 'Revisión';
        doc.destination = 'Asignar cuenta bancaria';
        doc.blockingReasons = ['No se detectó IBAN/cuenta: seleccionar manualmente'];
        
        this.addLog(doc, 'No se detectó cuenta bancaria');
        toast.error('⚠️ Revisión necesaria - Asignar cuenta', { id: doc.id });
        return;
      }

      // Success case
      doc.status = 'guardado_automatico';
      doc.destinationPath = 'Tesorería › Movimientos';
      doc.destination = `Guardado en Tesorería`;
      doc.movementsCount = result.totalMovements;
      doc.detectedAccount = result.detectedAccount || result.detectedIban;
      doc.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      this.addLog(doc, `${result.totalMovements} movimientos creados en Tesorería`);
      toast.success(`✅ Movimientos guardados: ${result.totalMovements}`, { id: doc.id });

    } catch (error) {
      doc.status = 'error';
      doc.destinationPath = 'Error';
      doc.destination = 'Error en procesamiento';
      doc.blockingReasons = [error instanceof Error ? error.message : 'Error desconocido'];
      
      this.addLog(doc, `Error: ${error}`);
      toast.error('⛔ Error procesando extracto', { id: doc.id });
    }
  }

  private async processOCRDocument(doc: ProcessedDocument): Promise<void> {
    try {
      if (!doc.originalFile) {
        throw new Error('Archivo no disponible');
      }

      toast.loading('📤 Enviando a OCR...', { id: doc.id });

      this.addLog(doc, 'Enviando a OCR');

      const ocrResult = await unifiedOcrService.processDocument(doc.originalFile);

      if (!ocrResult.success) {
        doc.status = 'error';
        doc.destinationPath = 'Error';
        doc.destination = 'Error de OCR';
        doc.blockingReasons = [ocrResult.error || 'Error en OCR'];
        
        this.addLog(doc, `Error OCR: ${ocrResult.error}`);
        toast.error('⛔ Error de OCR', { id: doc.id });
        return;
      }

      // Extract data from OCR
      const ocrData = ocrResult.data;
      if (ocrData) {
        doc.supplier = ocrData.supplier_name;
        doc.supplierTaxId = ocrData.supplier_tax_id;
        doc.amount = ocrData.total_amount;
        doc.issueDate = ocrData.issue_date;
        doc.dueDate = ocrData.due_date;
        doc.serviceAddress = ocrData.service_address;
        doc.iban = ocrData.iban_mask;
        doc.utilityType = ocrData.utility_type;
        doc.categories = ocrData.categories;
      }

      this.addLog(doc, 'OCR completado');

      // Validate extracted data
      const validation = this.validateExtractedData(doc);

      if (!validation.isValid) {
        doc.status = 'revision_requerida';
        doc.destinationPath = 'Revisión';
        doc.destination = 'Revisión manual requerida';
        doc.blockingReasons = validation.missingFields;
        
        this.addLog(doc, 'Requiere revisión manual');
        toast.error('⚠️ Revisión necesaria', { id: doc.id });
        return;
      }

      // Classify and route
      await this.classifyAndRoute(doc);

    } catch (error) {
      doc.status = 'error';
      doc.destinationPath = 'Error';
      doc.destination = 'Error en procesamiento';
      doc.blockingReasons = [error instanceof Error ? error.message : 'Error desconocido'];
      
      this.addLog(doc, `Error: ${error}`);
      toast.error('⛔ Error de OCR', { id: doc.id });
    }
  }

  private validateExtractedData(doc: ProcessedDocument): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    if (!doc.supplier) missingFields.push('Proveedor');
    if (!doc.amount) missingFields.push('Importe total');
    if (!doc.issueDate) missingFields.push('Fecha de emisión');

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  private async classifyAndRoute(doc: ProcessedDocument): Promise<void> {
    // Determine if it's a utility bill
    if (doc.utilityType) {
      doc.destinationPath = 'Inmuebles › Gastos';
      doc.destination = `Enviado a: Inmuebles › Gastos › ${doc.utilityType}`;
      doc.status = 'guardado_automatico';
      doc.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      
      this.addLog(doc, `Clasificado como suministro de ${doc.utilityType}`);
      this.addLog(doc, 'Archivado automáticamente en Inmuebles › Gastos');
      
      toast.success('✅ OCR procesado', { id: doc.id });
      return;
    }

    // Check if it needs category breakdown (reform/construction)
    const filename = doc.filename.toLowerCase();
    const reformKeywords = ['reforma', 'obra', 'construccion', 'mejora', 'mobiliario', 'reparacion'];
    
    if (reformKeywords.some(keyword => filename.includes(keyword))) {
      // This is a reform/construction invoice - needs categorization
      doc.status = 'revision_requerida';
      doc.destinationPath = 'Revisión';
      doc.destination = 'Categorización fiscal requerida';
      doc.blockingReasons = ['Categoría fiscal requerida: Mejora/Mobiliario/Reparación y Conservación'];
      
      this.addLog(doc, 'Clasificado como reforma - requiere categorización');
      toast.error('⚠️ Revisión necesaria', { id: doc.id });
      return;
    }

    // Default: generic invoice
    doc.destinationPath = 'Inmuebles › Gastos';
    doc.destination = 'Enviado a: Inmuebles › Gastos › Otros';
    doc.status = 'guardado_automatico';
    doc.expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    
    this.addLog(doc, 'Clasificado como factura genérica');
    this.addLog(doc, 'Archivado automáticamente en Inmuebles › Gastos');
    
    toast.success('✅ OCR procesado', { id: doc.id });
  }

  /**
   * Reprocess OCR for a document (no duplicates)
   */
  async reprocessOCR(docId: string): Promise<void> {
    const doc = this.documents.get(docId);
    if (!doc || !doc.originalFile) {
      throw new Error('Documento no encontrado');
    }

    // Reset status but keep same ID
    doc.status = 'revision_requerida';
    doc.logs.push({
      timestamp: new Date().toISOString(),
      action: 'Reprocesando OCR'
    });

    await this.processOCRDocument(doc);
  }

  /**
   * Get all documents
   */
  getDocuments(): ProcessedDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): ProcessedDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Remove expired documents (72h cleanup)
   */
  cleanupExpiredDocuments(): void {
    const now = new Date();
    const toRemove: string[] = [];

    this.documents.forEach((doc, id) => {
      if (doc.status === 'guardado_automatico' && doc.expiresAt) {
        if (new Date(doc.expiresAt) < now) {
          toRemove.push(id);
        }
      }
    });

    toRemove.forEach(id => {
      this.documents.delete(id);
    });

    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} expired documents`);
    }
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addLog(doc: ProcessedDocument, action: string): void {
    doc.logs.push({
      timestamp: new Date().toISOString(),
      action
    });
  }
}

export const unifiedDocumentProcessor = UnifiedDocumentProcessor.getInstance();