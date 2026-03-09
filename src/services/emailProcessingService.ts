// Enhanced Email Processing Service for Bandeja de entrada
// Handles email ingestion with proper headers and ZIP processing

import { processZipFile } from './zipProcessingService';
import { detectDocumentType } from './documentTypeDetectionService';

export interface EmailDocument {
  id: number;
  filename: string;
  content: ArrayBuffer;
  type: string;
  size: number;
  uploadDate: string;
  metadata: {
    emailLogId: string;
    emailSubject: string;
    emailSender: string;
    emailDate: string;
    origen: 'email';
    queueStatus: 'pendiente' | 'procesado' | 'importado' | 'error';
    tipo?: string;
    detection?: any;
    isEmailHeader?: boolean;
  };
}

export interface EmailProcessingResult {
  documents: EmailDocument[];
  zipPackages?: any[];
  summary: {
    totalAttachments: number;
    validDocuments: number;
    zipFiles: number;
    skippedFiles: number;
    failedFiles: number;
  };
}

/**
 * Process email with attachments for Bandeja de entrada
 */
export async function processEmailAttachments(
  emailData: {
    id: string;
    subject: string;
    sender: string;
    date: string;
    attachments: File[];
  }
): Promise<EmailProcessingResult> {
  const documents: EmailDocument[] = [];
  const zipPackages: any[] = [];
  const summary = {
    totalAttachments: emailData.attachments.length,
    validDocuments: 0,
    zipFiles: 0,
    skippedFiles: 0,
    failedFiles: 0
  };

  // Create email header document
  const emailHeader: EmailDocument = {
    id: Date.now(),
    filename: `Email_${emailData.subject}_${emailData.date}.txt`,
    content: new TextEncoder().encode(createEmailHeaderText(emailData)),
    type: 'text/plain',
    size: 0,
    uploadDate: new Date().toISOString(),
    metadata: {
      emailLogId: emailData.id,
      emailSubject: emailData.subject,
      emailSender: emailData.sender,
      emailDate: emailData.date,
      origen: 'email',
      queueStatus: 'importado',
      tipo: 'otros',
      isEmailHeader: true
    }
  };
  
  emailHeader.size = emailHeader.content.byteLength;
  documents.push(emailHeader);

  // Process each attachment
  for (const attachment of emailData.attachments) {
    try {
      // Check if it's a ZIP file
      if (attachment.type === 'application/zip' || attachment.name.toLowerCase().endsWith('.zip')) {
        try {
          // Process ZIP file
          const zipResult = await processZipFile(attachment, emailData.id);
          
          // Convert ZIP children to email documents
          const zipDocuments = zipResult.children.map(child => ({
            id: child.id,
            filename: child.filename,
            content: child.content,
            type: child.type,
            size: child.size,
            uploadDate: child.uploadDate,
            metadata: {
              ...child.metadata,
              emailLogId: emailData.id,
              emailSubject: emailData.subject,
              emailSender: emailData.sender,
              emailDate: emailData.date,
              origen: 'email' as const,
              zipPackageId: zipResult.package.id,
              originalPath: child.originalPath
            }
          }));

          // Add package document
          const packageDocument = {
            id: zipResult.package.id,
            filename: zipResult.package.filename,
            content: await zipResult.package.originalZip.arrayBuffer(),
            type: 'application/zip',
            size: zipResult.package.originalZip.size,
            uploadDate: zipResult.package.uploadDate,
            metadata: {
              ...zipResult.package.metadata,
              emailLogId: emailData.id,
              emailSubject: emailData.subject,
              emailSender: emailData.sender,
              emailDate: emailData.date,
              queueStatus: 'importado' as const,
              isZipPackage: true,
              childCount: zipResult.children.length
            }
          };

          documents.push(packageDocument as EmailDocument, ...zipDocuments as EmailDocument[]);
          zipPackages.push(zipResult);
          summary.zipFiles++;
          summary.validDocuments += zipDocuments.length + 1;

        } catch (error) {
          console.error('Failed to process ZIP from email:', error);
          summary.failedFiles++;
        }
        
      } else {
        // Process regular attachment
        const content = await attachment.arrayBuffer();
        
        const document: EmailDocument = {
          id: Date.now() + Math.random() * 1000,
          filename: attachment.name,
          content,
          type: attachment.type,
          size: attachment.size,
          uploadDate: new Date().toISOString(),
          metadata: {
            emailLogId: emailData.id,
            emailSubject: emailData.subject,
            emailSender: emailData.sender,
            emailDate: emailData.date,
            origen: 'email',
            queueStatus: 'pendiente'
          }
        };

        // Detect document type
        try {
          const detection = await detectDocumentType(attachment, attachment.name);
          document.metadata.detection = detection;
          document.metadata.tipo = detection.tipo;
        } catch (error) {
          console.warn('Document type detection failed for email attachment:', attachment.name, error);
          document.metadata.tipo = 'otros';
        }

        documents.push(document);
        summary.validDocuments++;
      }

    } catch (error) {
      console.error('Failed to process email attachment:', attachment.name, error);
      summary.failedFiles++;
    }
  }

  return {
    documents,
    zipPackages,
    summary
  };
}

/**
 * Create email header text for audit purposes
 */
function createEmailHeaderText(emailData: {
  id: string;
  subject: string;
  sender: string;
  date: string;
  attachments: File[];
}): string {
  return `ORIGEN: Email ${emailData.id}

De: ${emailData.sender}
Asunto: ${emailData.subject}
Fecha: ${emailData.date}
Adjuntos: ${emailData.attachments.length}

Archivos procesados:
${emailData.attachments.map(file => `- ${file.name} (${file.size} bytes)`).join('\n')}

Procesado por Bandeja de entrada el ${new Date().toLocaleString('es-ES')}
`;
}

/**
 * Generate email alias for property or global inbox
 */
export function generateEmailAlias(type: 'global' | 'property' | 'personal', targetId?: string): string {
  const baseAlias = 'bandeja';
  const domain = '@atlas-horizon.com'; // Replace with actual domain
  
  switch (type) {
    case 'global':
      return `${baseAlias}${domain}`;
    case 'property':
      return `${baseAlias}-inmueble-${targetId}${domain}`;
    case 'personal':
      return `${baseAlias}-personal-${targetId}${domain}`;
    default:
      return `${baseAlias}${domain}`;
  }
}

/**
 * Validate email security (SPF, DKIM, DMARC)
 */
export function validateEmailSecurity(emailHeaders: Record<string, string>): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check SPF
  const spf = emailHeaders['Authentication-Results']?.includes('spf=pass');
  if (!spf) {
    warnings.push('SPF validation failed');
  }
  
  // Check DKIM
  const dkim = emailHeaders['Authentication-Results']?.includes('dkim=pass');
  if (!dkim) {
    warnings.push('DKIM validation failed');
  }
  
  // Check DMARC
  const dmarc = emailHeaders['Authentication-Results']?.includes('dmarc=pass');
  if (!dmarc) {
    warnings.push('DMARC validation failed');
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  };
}