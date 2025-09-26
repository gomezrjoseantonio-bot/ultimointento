// Enhanced Inbox with FEIN Support
// Integrates FEIN processing into the unified inbox experience

import React, { useState, useEffect } from 'react';
import InboxQueue from '../../components/documents/InboxQueue';
import FEINReviewDrawer from './FEINReviewDrawer';
import { inboxProcessingService } from '../../services/inboxProcessingService';
import { feinLoanCreationService } from '../../services/feinLoanCreationService';
import { InboxItem } from '../../types/inboxTypes';
import { FEINData } from '../../types/fein';
import toast from 'react-hot-toast';

const EnhancedInboxWithFEIN: React.FC = () => {
  const [documents, setDocuments] = useState<InboxItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<InboxItem | null>(null);
  const [feinDrawer, setFeinDrawer] = useState<{
    isOpen: boolean;
    document: InboxItem | null;
    readonly: boolean;
  }>({ isOpen: false, document: null, readonly: false });
  const [loading, setLoading] = useState(false);

  // Load documents on mount and set up refresh interval
  useEffect(() => {
    loadDocuments();
    
    // Refresh every 30 seconds to show processing updates
    const interval = setInterval(loadDocuments, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDocuments = () => {
    const items = inboxProcessingService.getItems();
    setDocuments(items);
  };

  const handleSelectDocument = (document: InboxItem) => {
    setSelectedDocument(document);
  };

  const handleDeleteDocument = (documentId: number | string) => {
    inboxProcessingService.deleteItem(String(documentId));
    toast.success('Documento eliminado');
    loadDocuments();
  };

  const handleViewFEINFields = (document: InboxItem) => {
    const isFEIN = document.documentType === 'fein' || document.subtype?.includes('fein');
    if (!isFEIN) {
      toast.error('Este documento no es una FEIN');
      return;
    }

    const isComplete = document.subtype === 'fein_completa';
    setFeinDrawer({
      isOpen: true,
      document,
      readonly: isComplete
    });
  };

  const handleOpenInFinanciacion = (loanId: string) => {
    // Navigate to Financiación module
    toast.success(`Abriendo préstamo ${loanId} en Financiación`);
    
    // In a real implementation, this would use React Router to navigate
    // For now, we'll show a success message
    console.log(`[Navigation] Opening loan ${loanId} in Financiación module`);
  };

  const handleFEINSave = async (updatedData: FEINData) => {
    if (!feinDrawer.document) return;

    try {
      setLoading(true);
      
      // Create loan draft from updated FEIN data
      const result = await feinLoanCreationService.createLoanFromFEIN(
        updatedData,
        {
          ambito: 'PERSONAL', // Default, user can change in Financiación
          cuentaCargoId: 'default_account' // Would be selected by user
        },
        feinDrawer.document.fileUrl
      );

      if (result.success) {
        // Update document status to completed
        const updatedDocument = { ...feinDrawer.document };
        updatedDocument.status = 'classified_ok';
        updatedDocument.subtype = 'fein_completa';
        updatedDocument.destRef = {
          kind: 'prestamo',
          id: result.loanId!,
          path: 'Financiación › Préstamos'
        };
        
        // Update the document in the processing service
        // Note: This would need to be implemented in the service
        
        toast.success('Borrador de préstamo creado correctamente');
        setFeinDrawer({ isOpen: false, document: null, readonly: false });
        loadDocuments();
      } else {
        toast.error(`Error: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Error creating loan from FEIN:', error);
      toast.error('Error interno al crear el préstamo');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseFEINDrawer = () => {
    setFeinDrawer({ isOpen: false, document: null, readonly: false });
  };

  // Get FEIN processing result from document
  const getFEINResult = (document: InboxItem) => {
    const feinData = document.ocr?.data?.metadata?.feinData;
    const processingResult = document.ocr?.data?.metadata?.processingResult;
    
    if (!feinData || !processingResult) {
      return {
        success: false,
        data: undefined,
        errors: ['No se encontraron datos de FEIN'],
        warnings: [],
        fieldsExtracted: [],
        fieldsMissing: ['datos FEIN']
      };
    }

    return processingResult;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="font-semibold tracking-[-0.01em] text-[24px] leading-[32px]"
            style={{ color: 'var(--hz-text)' }}
          >
              Bandeja de Entrada
            </h1>
            <p className="text-neutral-600 text-sm leading-5 font-normal mt-1">
              Documentos procesados automáticamente con soporte FEIN
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {documents.length} documentos
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <InboxQueue
            documents={documents}
            selectedId={selectedDocument?.id as any} // Type compatibility fix
            onSelectDocument={handleSelectDocument}
            onDeleteDocument={handleDeleteDocument}
            onViewFEINFields={handleViewFEINFields}
            onOpenInFinanciacion={handleOpenInFinanciacion}
            loading={loading}
          />
        </div>
      </div>

      {/* FEIN Review Drawer */}
      {feinDrawer.document && (
        <FEINReviewDrawer
          isOpen={feinDrawer.isOpen}
          onClose={handleCloseFEINDrawer}
          feinResult={getFEINResult(feinDrawer.document)}
          onSave={handleFEINSave}
          onOpenInFinanciacion={handleOpenInFinanciacion}
          readonly={feinDrawer.readonly}
          loanId={feinDrawer.document.destRef?.kind === 'prestamo' ? feinDrawer.document.destRef.id : undefined}
        />
      )}
    </div>
  );
};

export default EnhancedInboxWithFEIN;