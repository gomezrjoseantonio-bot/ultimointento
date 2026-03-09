// ATLAS HORIZON - Email Integration for Inbox Processing
// Handles email attachments and triggers OCR processing

import { inboxProcessingService } from './inboxProcessingService';

/**
 * Process email attachments for automatic OCR and routing
 * Called when emails are received with PDF/JPG/PNG attachments
 */
export async function processEmailWithAttachments(
  emailData: {
    id: string;
    from: string;
    subject: string;
    date: string;
    attachments: File[];
  }
): Promise<{
  processed: number;
  skipped: number;
  error: number;
}> {
  
  console.log(`[EmailIntegration] Processing email from ${emailData.from} with ${emailData.attachments.length} attachments`);
  
  let processed = 0;
  let skipped = 0;
  let error = 0;
  
  for (const attachment of emailData.attachments) {
    try {
      // Check if file type triggers OCR processing
      if (['application/pdf', 'image/jpeg', 'image/png'].includes(attachment.type)) {
        
        // Create file URL (in real implementation, this would upload to cloud storage)
        const fileUrl = URL.createObjectURL(attachment);
        
        // Create InboxItem and enqueue for processing
        const docId = await inboxProcessingService.createAndEnqueue(
          fileUrl,
          attachment.name || 'email-attachment',
          attachment.type,
          attachment.size,
          'email',
          {
            from: emailData.from,
            subject: emailData.subject,
            date: emailData.date
          }
        );
        
        console.log(`[EmailIntegration] Created inbox item ${docId} for attachment: ${attachment.name}`);
        processed++;
        
      } else {
        console.log(`[EmailIntegration] Skipped non-OCR attachment: ${attachment.name} (${attachment.type})`);
        skipped++;
      }
      
    } catch (err) {
      console.error(`[EmailIntegration] Error processing attachment ${attachment.name}:`, err);
      error++;
    }
  }
  
  console.log(`[EmailIntegration] Email processing complete: ${processed} processed, ${skipped} skipped, ${error} errors`);
  
  return { processed, skipped, error };
}

/**
 * Register email webhook handler
 * In real implementation, this would be called by the email service webhook
 */
export function setupEmailWebhookHandler() {
  console.log('[EmailIntegration] Email webhook handler registered');
  
  // Mock webhook endpoint
  if (process.env.NODE_ENV === 'development') {
    (window as any).handleIncomingEmail = async (emailData: any) => {
      console.log('[EmailIntegration] Mock incoming email:', emailData);
      return await processEmailWithAttachments(emailData);
    };
  }
}

/**
 * Check if file type should trigger inbox processing
 */
export function shouldProcessFileType(mimeType: string): boolean {
  return ['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType);
}

/**
 * Extract email metadata for inbox summary
 */
export function extractEmailMetadata(
  from: string,
  subject: string,
  date: string
) {
  return {
    email_from: from,
    email_subject: subject,
    email_date: date,
    source_description: `Email de ${from}: ${subject}`
  };
}