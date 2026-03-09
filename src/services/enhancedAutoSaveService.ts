/**
 * Enhanced Auto-Save Service
 * 
 * Implements 72h auto-save logic with proper expiration handling
 * for documents processed in the inbox.
 */

import { createTreasuryMovementFromOCR } from './enhancedTreasuryCreationService';
import toast from 'react-hot-toast';

export interface AutoSaveDocument {
  id: string;
  filename: string;
  documentType: string;
  extractedFields: Record<string, any>;
  status: 'Guardado' | 'Revisión' | 'Error';
  savedAt: string;
  expiresAt: string;
  treasuryRecordId?: number;
  treasuryRecordType?: 'ingreso' | 'gasto' | 'capex' | 'movement';
  autoSaveComplete: boolean;
}

const AUTO_SAVE_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Auto-saves a document with 72h expiration
 */
export const autoSaveDocument = async (
  documentId: string,
  filename: string,
  documentType: string,
  extractedFields: Record<string, any>
): Promise<{
  success: boolean;
  expiresAt: string;
  treasuryResult?: any;
  message: string;
}> => {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AUTO_SAVE_DURATION_MS);
    
    // Try to create treasury movement
    const treasuryResult = await createTreasuryMovementFromOCR(
      documentId,
      documentType as any,
      extractedFields,
      filename
    );

    // Store auto-save record
    const autoSaveDoc: AutoSaveDocument = {
      id: documentId,
      filename,
      documentType,
      extractedFields,
      status: treasuryResult.success ? 'Guardado' : 'Error',
      savedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      treasuryRecordId: treasuryResult.recordId,
      treasuryRecordType: treasuryResult.recordType,
      autoSaveComplete: treasuryResult.success
    };

    // Store in localStorage for now (could be moved to IndexedDB)
    const autoSaveDocs = getAutoSaveDocuments();
    autoSaveDocs[documentId] = autoSaveDoc;
    localStorage.setItem('unicornio_autosave_docs', JSON.stringify(autoSaveDocs));

    return {
      success: true,
      expiresAt: expiresAt.toISOString(),
      treasuryResult,
      message: treasuryResult.success 
        ? `Documento auto-guardado. Se eliminará automáticamente en 72h.`
        : `Documento guardado temporalmente. Error en tesorería: ${treasuryResult.message}`
    };

  } catch (error) {
    console.error('Error auto-saving document:', error);
    return {
      success: false,
      expiresAt: '',
      message: `Error al guardar automáticamente: ${error}`
    };
  }
};

/**
 * Gets all auto-save documents
 */
export const getAutoSaveDocuments = (): Record<string, AutoSaveDocument> => {
  try {
    const stored = localStorage.getItem('unicornio_autosave_docs');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading auto-save documents:', error);
    return {};
  }
};

/**
 * Gets a specific auto-save document
 */
export const getAutoSaveDocument = (documentId: string): AutoSaveDocument | null => {
  const autoSaveDocs = getAutoSaveDocuments();
  return autoSaveDocs[documentId] || null;
};

/**
 * Updates an auto-save document
 */
export const updateAutoSaveDocument = (documentId: string, updates: Partial<AutoSaveDocument>): void => {
  const autoSaveDocs = getAutoSaveDocuments();
  if (autoSaveDocs[documentId]) {
    autoSaveDocs[documentId] = { ...autoSaveDocs[documentId], ...updates };
    localStorage.setItem('unicornio_autosave_docs', JSON.stringify(autoSaveDocs));
  }
};

/**
 * Removes an auto-save document
 */
export const removeAutoSaveDocument = (documentId: string): void => {
  const autoSaveDocs = getAutoSaveDocuments();
  delete autoSaveDocs[documentId];
  localStorage.setItem('unicornio_autosave_docs', JSON.stringify(autoSaveDocs));
};

/**
 * Cleanup expired documents
 */
export const cleanupExpiredDocuments = async (): Promise<{
  expiredCount: number;
  cleanedDocuments: string[];
}> => {
  try {
    const autoSaveDocs = getAutoSaveDocuments();
    const now = new Date();
    const expired: string[] = [];

    for (const [documentId, doc] of Object.entries(autoSaveDocs)) {
      if (new Date(doc.expiresAt) <= now && doc.status === 'Guardado') {
        expired.push(documentId);
      }
    }

    // Remove expired documents
    expired.forEach(documentId => {
      delete autoSaveDocs[documentId];
    });

    if (expired.length > 0) {
      localStorage.setItem('unicornio_autosave_docs', JSON.stringify(autoSaveDocs));
    }

    return {
      expiredCount: expired.length,
      cleanedDocuments: expired
    };

  } catch (error) {
    console.error('Error cleaning up expired documents:', error);
    return {
      expiredCount: 0,
      cleanedDocuments: []
    };
  }
};

/**
 * Gets documents expiring soon (within next 24h)
 */
export const getDocumentsExpiringSoon = (): AutoSaveDocument[] => {
  const autoSaveDocs = getAutoSaveDocuments();
  const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  return Object.values(autoSaveDocs).filter(doc => 
    doc.status === 'Guardado' && 
    new Date(doc.expiresAt) <= in24Hours &&
    new Date(doc.expiresAt) > new Date()
  );
};

/**
 * Extends expiration time for a document
 */
export const extendDocumentExpiration = async (
  documentId: string,
  additionalHours: number = 72
): Promise<{ success: boolean; newExpiresAt?: string; message: string }> => {
  try {
    const autoSaveDoc = getAutoSaveDocument(documentId);
    if (!autoSaveDoc) {
      return {
        success: false,
        message: 'Documento no encontrado en auto-guardado'
      };
    }

    const newExpiresAt = new Date(
      Date.now() + (additionalHours * 60 * 60 * 1000)
    ).toISOString();

    updateAutoSaveDocument(documentId, {
      expiresAt: newExpiresAt
    });

    return {
      success: true,
      newExpiresAt,
      message: `Expiración extendida ${additionalHours}h. Nueva fecha: ${new Date(newExpiresAt).toLocaleString('es-ES')}`
    };

  } catch (error) {
    console.error('Error extending document expiration:', error);
    return {
      success: false,
      message: `Error al extender expiración: ${error}`
    };
  }
};

/**
 * Converts auto-saved document to permanent archive
 */
export const convertToPermanentArchive = async (
  documentId: string,
  userConfirmedData?: Record<string, any>
): Promise<{ success: boolean; message: string }> => {
  try {
    const autoSaveDoc = getAutoSaveDocument(documentId);
    if (!autoSaveDoc) {
      return {
        success: false,
        message: 'Documento no encontrado en auto-guardado'
      };
    }

    // If user provided corrections, create new treasury record
    if (userConfirmedData && Object.keys(userConfirmedData).length > 0) {
      const treasuryResult = await createTreasuryMovementFromOCR(
        documentId,
        autoSaveDoc.documentType as any,
        { ...autoSaveDoc.extractedFields, ...userConfirmedData },
        autoSaveDoc.filename
      );

      if (!treasuryResult.success) {
        return {
          success: false,
          message: `Error al crear registro permanente: ${treasuryResult.message}`
        };
      }

      // Update auto-save record
      updateAutoSaveDocument(documentId, {
        status: 'Guardado',
        autoSaveComplete: true,
        treasuryRecordId: treasuryResult.recordId,
        treasuryRecordType: treasuryResult.recordType,
        extractedFields: { ...autoSaveDoc.extractedFields, ...userConfirmedData }
      });
    }

    // Remove from auto-save (now permanently archived)
    removeAutoSaveDocument(documentId);

    return {
      success: true,
      message: 'Documento archivado permanentemente'
    };

  } catch (error) {
    console.error('Error converting to permanent archive:', error);
    return {
      success: false,
      message: `Error al archivar permanentemente: ${error}`
    };
  }
};

/**
 * Gets time remaining until expiration
 */
export const getTimeUntilExpiration = (expiresAt: string): {
  expired: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  formattedTimeRemaining: string;
} => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      expired: true,
      hoursRemaining: 0,
      minutesRemaining: 0,
      formattedTimeRemaining: 'Expirado'
    };
  }

  const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let formatted = '';
  if (hoursRemaining > 0) {
    formatted = `${hoursRemaining}h ${minutesRemaining}m`;
  } else {
    formatted = `${minutesRemaining}m`;
  }

  return {
    expired: false,
    hoursRemaining,
    minutesRemaining,
    formattedTimeRemaining: formatted
  };
};

/**
 * Schedules cleanup check (call this on app startup)
 */
export const scheduleCleanupCheck = (): void => {
  // Run cleanup immediately
  cleanupExpiredDocuments().then(result => {
    if (result.expiredCount > 0) {
      console.log(`Cleaned up ${result.expiredCount} expired documents`);
    }
  });

  // Schedule cleanup every 30 minutes
  setInterval(() => {
    cleanupExpiredDocuments().then(result => {
      if (result.expiredCount > 0) {
        console.log(`Cleaned up ${result.expiredCount} expired documents`);
        toast.success(`${result.expiredCount} documentos expirados eliminados automáticamente`);
      }
    });
  }, 30 * 60 * 1000); // 30 minutes
};