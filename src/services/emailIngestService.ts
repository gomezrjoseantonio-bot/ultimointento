// Email Ingestion Service - H3 Implementation
// Handles email processing, alias generation, and document creation

import { initDB } from './db';
import { generateMovementHash } from '../utils/duplicateDetection';
import JSZip from 'jszip';

// Issue 1: Email alias generation with tenant tokens
export interface EmailAlias {
  id: string;
  email: string;
  type: 'global' | 'property' | 'personal';
  target?: string; // property ID for property aliases
  tenantToken: string; // Required for all aliases - not guessable
  isActive: boolean;
  lastUsed?: Date;
  created: Date;
}

// Issue 2: Email security validation results
export interface EmailSecurityValidation {
  spf: 'pass' | 'fail' | 'neutral' | 'none';
  dkim: 'pass' | 'fail' | 'neutral' | 'none';
  dmarc: 'pass' | 'fail' | 'neutral' | 'none';
  isWhitelisted: boolean;
  senderEmail: string;
}

// Issue 3: Email processing results
export interface EmailProcessingResult {
  id: string;
  date: Date;
  from: string;
  subject: string;
  alias: string;
  attachmentCount: number;
  status: 'procesado' | 'sin-adjuntos' | 'rechazado';
  reason?: string;
  documentsCreated: number;
  documentsIgnored: number;
  documentsDuplicated: number;
  securityValidation?: EmailSecurityValidation;
}

// Issue 3: Supported attachment types
export const SUPPORTED_ATTACHMENT_TYPES = {
  PDF: ['application/pdf'],
  IMAGES: ['image/jpeg', 'image/png', 'image/jpg'],
  ZIP: ['application/zip', 'application/x-zip-compressed'],
  EML: ['message/rfc822', 'text/plain'], // .eml files
  SPREADSHEETS: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
};

// Issue 2: File size and count limits
export const EMAIL_LIMITS = {
  MAX_ATTACHMENTS: 10,
  MAX_ATTACHMENT_SIZE: 15 * 1024 * 1024, // 15MB
  MAX_TOTAL_SIZE: 100 * 1024 * 1024 // 100MB total
};

class EmailIngestService {
  private tenantToken: string;
  private whitelist: string[] = [];
  private whitelistEnabled: boolean = false;

  constructor() {
    // Generate a unique tenant token (in real implementation, this would come from backend)
    this.tenantToken = this.generateTenantToken();
  }

  // Issue 1: Generate unique tenant token (not guessable)
  private generateTenantToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  // Issue 1: Generate email aliases with tenant tokens
  generateGlobalAlias(): string {
    return `inbox+${this.tenantToken}@atlas.mail`;
  }

  generatePropertyAlias(propertySlug: string): string {
    return `inbox+${this.tenantToken}.${propertySlug}@atlas.mail`;
  }

  generatePersonalAlias(): string {
    return `inbox+${this.tenantToken}.personal@atlas.mail`;
  }

  // Issue 2: Validate email security
  async validateEmailSecurity(
    senderEmail: string,
    emailHeaders: Record<string, string>
  ): Promise<EmailSecurityValidation> {
    // In real implementation, these would be actual validations
    // For now, simulate the validation process
    const validation: EmailSecurityValidation = {
      spf: 'pass', // Simulate SPF validation
      dkim: 'pass', // Simulate DKIM validation  
      dmarc: 'pass', // Simulate DMARC validation
      isWhitelisted: this.isWhitelisted(senderEmail),
      senderEmail
    };

    // Log validation results (Issue 2 requirement)
    console.log('Email Security Validation:', {
      sender: senderEmail,
      spf: validation.spf,
      dkim: validation.dkim,
      dmarc: validation.dmarc,
      whitelisted: validation.isWhitelisted
    });

    return validation;
  }

  // Issue 2: Check if sender is whitelisted
  private isWhitelisted(senderEmail: string): boolean {
    if (!this.whitelistEnabled) return true;
    return this.whitelist.some(email => 
      senderEmail.toLowerCase().includes(email.toLowerCase())
    );
  }

  // Issue 2: Whitelist management
  setWhitelist(emails: string[], enabled: boolean = true): void {
    this.whitelist = emails;
    this.whitelistEnabled = enabled;
  }

  // Issue 3: Process email and create documents
  async processEmail(
    emailData: {
      from: string;
      subject: string;
      alias: string;
      attachments: File[];
      headers: Record<string, string>;
    }
  ): Promise<EmailProcessingResult> {
    const startTime = Date.now();
    
    // Issue 2: Validate security first
    const securityValidation = await this.validateEmailSecurity(
      emailData.from,
      emailData.headers
    );

    // Issue 2: Check whitelist if enabled
    if (this.whitelistEnabled && !securityValidation.isWhitelisted) {
      return {
        id: `email-${startTime}`,
        date: new Date(),
        from: emailData.from,
        subject: emailData.subject,
        alias: emailData.alias,
        attachmentCount: emailData.attachments.length,
        status: 'rechazado',
        reason: 'remitente no autorizado',
        documentsCreated: 0,
        documentsIgnored: 0,
        documentsDuplicated: 0,
        securityValidation
      };
    }

    // Issue 2: Check attachment limits
    if (emailData.attachments.length > EMAIL_LIMITS.MAX_ATTACHMENTS) {
      return {
        id: `email-${startTime}`,
        date: new Date(),
        from: emailData.from,
        subject: emailData.subject,
        alias: emailData.alias,
        attachmentCount: emailData.attachments.length,
        status: 'rechazado',
        reason: `demasiados adjuntos (máximo ${EMAIL_LIMITS.MAX_ATTACHMENTS})`,
        documentsCreated: 0,
        documentsIgnored: 0,
        documentsDuplicated: 0,
        securityValidation
      };
    }

    const totalSize = emailData.attachments.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > EMAIL_LIMITS.MAX_TOTAL_SIZE) {
      return {
        id: `email-${startTime}`,
        date: new Date(),
        from: emailData.from,
        subject: emailData.subject,
        alias: emailData.alias,
        attachmentCount: emailData.attachments.length,
        status: 'rechazado',
        reason: 'tamaño total excesivo',
        documentsCreated: 0,
        documentsIgnored: 0,
        documentsDuplicated: 0,
        securityValidation
      };
    }

    // Issue 3: Process attachments
    const documents = await this.processAttachments(
      emailData.attachments,
      emailData.from,
      emailData.alias,
      `email-${startTime}`
    );

    // Issue 4: Determine routing based on alias
    const routing = this.determineRouting(emailData.alias);

    // Issue 3: Create documents in database
    let documentsCreated = 0;
    let documentsIgnored = 0;
    let documentsDuplicated = 0;

    const db = await initDB();
    
    for (const doc of documents) {
      try {
        // Issue 6: Check for duplicates
        const isDuplicate = await this.checkDuplicate(doc);
        
        if (isDuplicate) {
          documentsDuplicated++;
          doc.metadata.status = 'Duplicado';
        } else {
          // Apply routing
          doc.metadata = { ...doc.metadata, ...routing };
          doc.metadata.origen = 'email';
          doc.metadata.emailLogId = `email-${startTime}`;
          
          await db.add('documents', doc);
          documentsCreated++;
        }
      } catch (error) {
        console.error('Error creating document:', error);
        documentsIgnored++;
      }
    }

    return {
      id: `email-${startTime}`,
      date: new Date(),
      from: emailData.from,
      subject: emailData.subject,
      alias: emailData.alias,
      attachmentCount: emailData.attachments.length,
      status: documentsCreated > 0 ? 'procesado' : 'sin-adjuntos',
      documentsCreated,
      documentsIgnored,
      documentsDuplicated,
      securityValidation
    };
  }

  // Issue 4: Determine routing based on alias type
  private determineRouting(alias: string): any {
    if (alias.includes('.personal@')) {
      return {
        destino: 'Personal',
        entityType: 'personal',
        entityId: undefined
      };
    }
    
    // Extract property slug from alias
    const propertyMatch = alias.match(/inbox\+\w+\.([^@]+)@/);
    if (propertyMatch && propertyMatch[1] !== 'personal') {
      const propertySlug = propertyMatch[1];
      return {
        destino: `Inmueble-${propertySlug}`,
        entityType: 'property',
        entityId: propertySlug
      };
    }
    
    // Global alias - try to infer destination
    return {
      destino: 'Pendiente',
      entityType: undefined,
      entityId: undefined,
      status: 'Pendiente',
      notas: 'Asignar destino - recibido por alias global'
    };
  }

  // Issue 3: Process different attachment types
  private async processAttachments(
    attachments: File[],
    senderEmail: string,
    alias: string,
    emailLogId: string
  ): Promise<any[]> {
    const documents: any[] = [];

    for (const attachment of attachments) {
      // Issue 2: Check individual file size
      if (attachment.size > EMAIL_LIMITS.MAX_ATTACHMENT_SIZE) {
        continue; // Skip oversized files
      }

      if (this.isZipFile(attachment)) {
        // Issue 3: Process ZIP files - extract contents
        const zipDocs = await this.processZipFile(attachment, senderEmail, alias, emailLogId);
        documents.push(...zipDocs);
      } else if (this.isEmlFile(attachment)) {
        // Issue 3: Process EML files - parse email
        const emlDocs = await this.processEmlFile(attachment, senderEmail, alias, emailLogId);
        documents.push(...emlDocs);
      } else if (this.isSupportedFile(attachment)) {
        // Issue 3: Process regular supported files
        const doc = await this.createDocumentFromAttachment(
          attachment,
          senderEmail,
          alias,
          emailLogId
        );
        documents.push(doc);
      }
    }

    return documents;
  }

  // Issue 3: Process ZIP files
  private async processZipFile(
    zipFile: File,
    senderEmail: string,
    alias: string,
    emailLogId: string
  ): Promise<any[]> {
    const documents: any[] = [];
    
    try {
      const zip = await JSZip.loadAsync(zipFile);
      
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir && this.isSupportedFileName(filename)) {
          const content = await zipEntry.async('blob');
          const file = new File([content], filename, { type: this.getMimeType(filename) });
          
          const doc = await this.createDocumentFromAttachment(
            file,
            senderEmail,
            alias,
            emailLogId,
            'ZIP'
          );
          documents.push(doc);
        }
      }
    } catch (error) {
      console.error('Error processing ZIP file:', error);
    }

    return documents;
  }

  // Issue 3: Process EML files
  private async processEmlFile(
    emlFile: File,
    senderEmail: string,
    alias: string,
    emailLogId: string
  ): Promise<any[]> {
    // For now, treat EML as a document itself
    // In a full implementation, this would parse the EML and extract attachments
    const doc = await this.createDocumentFromAttachment(
      emlFile,
      senderEmail,
      alias,
      emailLogId,
      'EML'
    );
    return [doc];
  }

  // Issue 3: Create document from attachment
  private async createDocumentFromAttachment(
    file: File,
    senderEmail: string,
    alias: string,
    emailLogId: string,
    badge?: string
  ): Promise<any> {
    const documentType = this.classifyDocument(file);
    
    return {
      id: Date.now() + Math.random(),
      filename: file.name,
      type: file.type,
      size: file.size,
      lastModified: Date.now(),
      uploadDate: new Date().toISOString(),
      content: file,
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: `Documento procesado desde email: ${senderEmail}`,
        tags: ['email', badge].filter(Boolean),
        proveedor: senderEmail,
        tipo: documentType.tipo,
        categoria: documentType.categoria,
        status: 'Nuevo',
        origen: 'email',
        emailLogId,
        notas: `Recibido por email en alias: ${alias}`,
        badge
      }
    };
  }

  // Issue 3: Classify document type
  private classifyDocument(file: File): { tipo: string; categoria: string } {
    const filename = file.name.toLowerCase();
    const type = file.type.toLowerCase();

    if (type.includes('pdf') || filename.includes('factura')) {
      return { tipo: 'Factura', categoria: 'Gastos' };
    }
    
    if (type.includes('csv') || type.includes('excel') || filename.includes('extracto')) {
      return { tipo: 'Extracto', categoria: 'Movimientos' };
    }
    
    if (filename.includes('contrato')) {
      return { tipo: 'Contrato', categoria: 'Contratos' };
    }
    
    return { tipo: 'Documento', categoria: 'Referencias' };
  }

  // Issue 6: Check for duplicate documents
  private async checkDuplicate(document: any): Promise<boolean> {
    try {
      const db = await initDB();
      const existingDocs = await db.getAll('documents');
      
      // Generate hash for this document
      const documentHash = generateMovementHash({
        date: new Date(document.uploadDate),
        amount: document.size, // Use file size as amount proxy
        description: document.filename
      } as any);

      // Check if hash exists
      return existingDocs.some(doc => 
        doc.metadata?.duplicateHash === documentHash ||
        (doc.filename === document.filename && doc.size === document.size)
      );
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return false;
    }
  }

  // File type checking utilities
  private isZipFile(file: File): boolean {
    return SUPPORTED_ATTACHMENT_TYPES.ZIP.includes(file.type) || 
           file.name.toLowerCase().endsWith('.zip');
  }

  private isEmlFile(file: File): boolean {
    return SUPPORTED_ATTACHMENT_TYPES.EML.includes(file.type) ||
           file.name.toLowerCase().endsWith('.eml');
  }

  private isSupportedFile(file: File): boolean {
    const allTypes = Object.values(SUPPORTED_ATTACHMENT_TYPES).flat();
    return allTypes.includes(file.type) || this.isSupportedFileName(file.name);
  }

  private isSupportedFileName(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ['pdf', 'jpg', 'jpeg', 'png', 'csv', 'xls', 'xlsx', 'zip', 'eml'].includes(ext || '');
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'csv': 'text/csv',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip': 'application/zip',
      'eml': 'message/rfc822'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  // Issue 7: Send rejection email (mock implementation)
  async sendRejectionEmail(to: string, reason: string): Promise<void> {
    console.log(`Sending rejection email to ${to}: ${reason}`);
    // In real implementation, this would send an actual email
  }
}

// Export singleton instance
export const emailIngestService = new EmailIngestService();