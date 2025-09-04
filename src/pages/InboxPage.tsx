import React, { useState, useEffect } from 'react';
import { initDB, deleteDocumentAndBlob, getDocumentBlob } from '../services/db';
import { Search, SortAsc, SortDesc, Trash2, FolderOpen, Info } from 'lucide-react';
import DocumentViewer from '../components/documents/DocumentViewer';
import DocumentUploader from '../components/documents/DocumentUploader';
import InboxQueue from '../components/documents/InboxQueue';
import DocumentClassificationPanel from '../components/documents/DocumentClassificationPanel';
import BankStatementModal from '../components/inbox/BankStatementModal';
import QADashboard from '../components/dev/QADashboard';
import H8DemoComponent from '../components/dev/H8DemoComponent';
import AutoSaveToggle from '../components/documents/AutoSaveToggle';
import { getOCRConfig } from '../services/ocrService';
import { getAutoSaveConfig, classifyDocument, autoSaveDocument } from '../services/autoSaveService';
import { processDocumentOCR } from '../services/documentAIService';
import { detectDocumentType } from '../services/documentTypeDetectionService';
import { showError } from '../services/toastService';
import { ZipProcessingResult } from '../services/zipProcessingService';
import toast from 'react-hot-toast';

const InboxPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  // Bandeja de entrada filters: Todos, Facturas, Contratos, Extractos, Otros, Pendientes
  const [inboxFilter, setInboxFilter] = useState('todos');
  const [queueStatusFilter, setQueueStatusFilter] = useState('all');
  const [origenFilter, setOrigenFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  // H3 requirement - email log filter
  const [emailLogFilter, setEmailLogFilter] = useState<string>('');
  // ATLAS HOTFIX: QA Dashboard for development
  const [showQADashboard, setShowQADashboard] = useState(false);
  // H8: Demo component for development
  const [showH8Demo, setShowH8Demo] = useState(false);
  // Bank statement modal for detected extracts
  const [showBankStatementModal, setShowBankStatementModal] = useState(false);
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);

  useEffect(() => {
    // H3 requirement - check URL parameters for email log filter
    const urlParams = new URLSearchParams(window.location.search);
    const emailLogParam = urlParams.get('emailLog');
    if (emailLogParam) {
      setEmailLogFilter(emailLogParam);
    }
    
    // ATLAS HOTFIX: Check for QA dashboard query parameter
    const qaDashboard = urlParams.get('qa') === 'true';
    if (qaDashboard && process.env.NODE_ENV === 'development') {
      setShowQADashboard(true);
    }
    
    // H8: Check for H8 demo query parameter
    const h8Demo = urlParams.get('h8') === 'true';
    if (h8Demo && process.env.NODE_ENV === 'development') {
      setShowH8Demo(true);
    }
  }, []);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      
      try {
        const db = await initDB();
        const docs = await db.getAll('documents');
        const props = await db.getAll('properties');
        
        // Load all documents from inbox - both assigned and unassigned
        const inboxDocs = docs; // Show all documents, not just unassigned ones
        setDocuments(inboxDocs);
        setProperties(props);
      } catch (error) {
        // Fallback to localStorage if IndexedDB fails
        const storedDocs = localStorage.getItem('atlas-inbox-documents');
        if (storedDocs) {
          const parsedDocs = JSON.parse(storedDocs);
          setDocuments(parsedDocs);
        }
      }
      
      setLoading(false);
    };
    
    loadDocuments();
  }, []);

  // Handle ZIP processing completion
  const handleZipProcessed = (result: ZipProcessingResult) => {
    console.log('ZIP processed:', result);
    // Additional ZIP-specific processing can be added here
    // The documents are already added via onUploadComplete
  };

  const handleDocumentUpload = async (newDocuments: any[]) => {
    // Enhanced auto-processing with document type detection
    for (const doc of newDocuments) {
      try {
        // Create a File object from the document to check
        const blob = new Blob([doc.content], { type: doc.type });
        const file = new File([blob], doc.filename, { type: doc.type });
        
        // Detect document type using enhanced detection service
        const detection = await detectDocumentType(file, doc.filename);
        
        // Check if it's a bank statement that should be auto-imported
        if (detection.shouldSkipOCR && detection.tipo === 'Extracto bancario') {
          const autoSaveConfig = getAutoSaveConfig();
          
          if (autoSaveConfig.enabled) {
            // Auto-import bank statement
            setBankStatementFile(file);
            setShowBankStatementModal(true);
            
            // Update document status to processing
            doc.metadata = {
              ...doc.metadata,
              queueStatus: 'importado',
              detection,
              processedAt: new Date().toISOString()
            };
          } else {
            // Show mini-wizard for account selection (manual)
            setBankStatementFile(file);
            setShowBankStatementModal(true);
            
            // Keep as pending for manual processing
            doc.metadata = {
              ...doc.metadata,
              queueStatus: 'pendiente',
              detection,
              reason: 'Bank statement detected - needs account selection'
            };
          }
          continue; // Don't process as regular document
        }
        
        // Set initial document metadata with detection results
        doc.metadata = {
          ...doc.metadata,
          detection,
          queueStatus: 'pendiente',
          tipo: detection.tipo
        };
        
      } catch (error) {
        console.warn('Document type detection failed for file:', doc.filename, error);
        
        // Set error status
        doc.metadata = {
          ...doc.metadata,
          queueStatus: 'error',
          error: 'Document type detection failed'
        };
      }
    }
    
    // Add documents to state
    const updatedDocuments = [...documents, ...newDocuments];
    setDocuments(updatedDocuments);
    
    // Persist to localStorage as backup
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
    
    // Try to persist to IndexedDB
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      
      for (const doc of newDocuments) {
        await tx.store.add(doc);
      }
      
      await tx.done;
    } catch (error) {
      console.warn('Failed to save to IndexedDB, using localStorage only:', error);
    }

    // Auto-processing based on configuration and document type
    const autoSaveConfig = getAutoSaveConfig();
    const ocrConfig = getOCRConfig();

    for (const doc of newDocuments) {
      const detection = doc.metadata?.detection;
      
      if (!detection) continue;
      
      // Skip documents that are already processed (bank statements)
      if (doc.metadata?.queueStatus === 'importado') continue;
      
      // Auto-OCR for invoices/contracts if enabled
      if (detection.tipo === 'Factura' || detection.tipo === 'Contrato') {
        if (ocrConfig.autoRun && autoSaveConfig.enabled) {
          handleAutoOCR(doc);
          // Auto-save will be handled after OCR completes
        } else if (ocrConfig.autoRun) {
          handleAutoOCR(doc);
          // Manual save mode - OCR but don't auto-save
        } else {
          // Process auto-save immediately for non-OCR documents
          await handleAutoSaveDocument(doc);
        }
      } else {
        // Other document types - process immediately
        await handleAutoSaveDocument(doc);
      }
    }

    // Show summary toast for auto-save OFF mode
    if (!autoSaveConfig.enabled && newDocuments.length > 1) {
      // Count final results after processing
      setTimeout(() => {
        // Calculate counts for this batch
        let batchArchived = 0;
        let batchPending = 0; 
        let batchError = 0;
        
        newDocuments.forEach(doc => {
          const currentDoc = documents.find(d => d.id === doc.id);
          const status = currentDoc?.metadata?.queueStatus || 'pendiente';
          
          if (status === 'importado') batchArchived++;
          else if (status === 'error') batchError++;
          else batchPending++;
        });
        
        // Show summary in the required format
        toast(`${batchArchived} archivados · ${batchPending} pendientes · ${batchError} errores`, {
          duration: 6000,
          icon: 'ℹ️'
        });
      }, 2000); // Wait for processing to complete
    }
  };

  // H3: Auto-save document processing with enhanced duplicate detection
  const handleAutoSaveDocument = async (document: any) => {
    try {
      // Classify the document with duplicate detection
      const classification = await classifyDocument(document, documents);
      
      // H6: Check if document is a duplicate
      if (classification.metadata?.duplicateDetected) {
        // Update document status to duplicate
        const updatedDoc = {
          ...document,
          metadata: {
            ...document.metadata,
            queueStatus: 'duplicado',
            classification: classification,
            processedAt: new Date().toISOString()
          }
        };
        
        // Update document in state
        setDocuments(prev => prev.map(doc => 
          doc.id === document.id ? updatedDoc : doc
        ));
        
        showError(`Documento duplicado: ${document.filename}`, 'Verifica si es una versión diferente o elimina uno de los archivos');
        return;
      }
      
      // Apply auto-save logic
      const result = await autoSaveDocument(document, classification);
      
      // Update document status and metadata
      const updatedDoc = {
        ...document,
        metadata: {
          ...document.metadata,
          queueStatus: result.newStatus,
          classification: classification,
          autoSaveResult: result,
          processedAt: new Date().toISOString()
        }
      };
      
      // Update document in state
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? updatedDoc : doc
      ));
      
      // Show appropriate toast
      if (result.success) {
        toast.success(result.message, { duration: 3000 });
        
        // H3: Remove from inbox if successfully archived (auto-save ON or clear in OFF mode)
        if (result.newStatus === 'importado') {
          setTimeout(() => {
            setDocuments(prev => prev.filter(doc => doc.id !== document.id));
            const updatedList = documents.filter(doc => doc.id !== document.id);
            localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedList));
          }, 2000); // Show success message for 2 seconds before removing
        }
      } else {
        if (result.newStatus === 'error') {
          toast.error(result.message);
        } else {
          // For pending/incomplete, don't show error toast, just update status
          console.log('Document pending:', result.message);
        }
      }
      
    } catch (error) {
      console.error('Error in auto-save processing:', error);
      toast.error('Error procesando documento');
    }
  };

  // H-OCR: Auto-OCR processing function
  const handleAutoOCR = async (document: any) => {
    try {
      // Set processing status
      const processingDoc = {
        ...document,
        metadata: {
          ...document.metadata,
          ocr: {
            engine: 'gdocai:invoice',
            timestamp: new Date().toISOString(),
            confidenceGlobal: 0,
            fields: [],
            status: 'processing' as const
          }
        }
      };

      // Update local state
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? processingDoc : doc
      ));

      // Process OCR
      const ocrResult = await processDocumentOCR(document.content, document.filename);
      
      // Update with results and set status as processed
      const updatedDoc = {
        ...processingDoc,
        metadata: {
          ...processingDoc.metadata,
          ocr: ocrResult,
          queueStatus: 'procesado_ocr', // Set status to indicate OCR completed
          processedAt: new Date().toISOString()
        }
      };

      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? updatedDoc : doc
      ));

      // Update in database
      try {
        const db = await initDB();
        await db.put('documents', updatedDoc);
      } catch (error) {
        console.warn('Failed to update OCR in IndexedDB:', error);
      }

      toast.success(`OCR completado para ${document.filename}: ${ocrResult.fields.length} campos`);
      
      // Auto-save after OCR completion (if auto-save is enabled)
      const autoSaveConfig = getAutoSaveConfig();
      if (autoSaveConfig.enabled) {
        await handleAutoSaveDocument(updatedDoc);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      // Update with error status
      const errorDoc = {
        ...document,
        metadata: {
          ...document.metadata,
          ocr: {
            engine: 'gdocai:invoice',
            timestamp: new Date().toISOString(),
            confidenceGlobal: 0,
            fields: [],
            status: 'error' as const,
            error: errorMessage
          }
        }
      };

      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? errorDoc : doc
      ));

      console.warn(`Auto-OCR failed for ${document.filename}:`, error);
    }
  };

  // H-OCR: Manual OCR processing function
  const handleManualOCR = async (document: any) => {
    try {
      // Get the blob from IndexedDB/BlobStore or document.content
      let blob: Blob | null = null;
      
      if (document?.id) {
        blob = await getDocumentBlob(document.id);
      }
      
      if (!blob && document?.content) {
        blob = new Blob([document.content], { type: document.type });
      }
      
      if (!blob) {
        toast.error('No se pudo encontrar el archivo para procesar');
        return;
      }

      // DEV telemetry: Log start of OCR processing
      if (process.env.NODE_ENV === 'development') {
        const sizeKB = Math.round(blob.size / 1024);
        console.info('OCR ▶ calling /.netlify/functions/ocr-documentai', { sizeKB });
      }

      // Set processing status
      const processingDoc = {
        ...document,
        metadata: {
          ...document.metadata,
          ocr: {
            engine: 'gdocai:invoice',
            timestamp: new Date().toISOString(),
            confidenceGlobal: 0,
            fields: [],
            status: 'processing' as const
          }
        }
      };

      // Update local state
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? processingDoc : doc
      ));

      // Process OCR using Document AI service 
      const ocrResult = await processDocumentOCR(blob, document.filename);
      
      // DEV telemetry: Log response
      if (process.env.NODE_ENV === 'development') {
        console.info('OCR ▶ response', { 
          fields: ocrResult.fields?.length || 0,
          confidence: ocrResult.confidenceGlobal,
          status: ocrResult.status 
        });
      }
      
      // Update with results
      const updatedDoc = {
        ...processingDoc,
        metadata: {
          ...processingDoc.metadata,
          ocr: ocrResult
        }
      };

      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? updatedDoc : doc
      ));

      // Update in database
      try {
        const db = await initDB();
        await db.put('documents', updatedDoc);
      } catch (error) {
        console.warn('Failed to update OCR in IndexedDB:', error);
      }

      const entityCount = ocrResult.fields.length;
      toast.success(`OCR completado para ${document.filename}: ${entityCount} entidades detectadas`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      // Handle specific OCR error codes from the backend
      let displayMessage = `Error OCR: ${errorMessage}`;
      let showErrorBanner = false;
      
      if (errorMessage.startsWith('OCR_ERROR_')) {
        const [, errorCode, errorDetail] = errorMessage.match(/OCR_ERROR_([^:]+):\s*(.+)/) || [];
        
        switch (errorCode) {
          case 'CONFIG':
            displayMessage = 'OCR no configurado correctamente. Contacta al administrador.';
            showErrorBanner = true;
            break;
          case '403':
            displayMessage = 'Sin permisos para procesar OCR. Verifica la configuración.';
            showErrorBanner = true;
            break;
          case '404':
            displayMessage = 'Servicio OCR no encontrado. Verifica la configuración.';
            showErrorBanner = true;
            break;
          case '429':
            displayMessage = 'Límite de procesamiento OCR excedido. Inténtalo más tarde.';
            break;
          default:
            displayMessage = errorDetail || errorMessage;
        }
      } else if (errorMessage.includes('CONFIG')) {
        displayMessage = 'OCR no configurado correctamente';
        showErrorBanner = true;
      } else if (errorMessage.includes('403')) {
        displayMessage = 'Sin permisos para OCR';
        showErrorBanner = true;
      } else if (errorMessage.includes('404')) {
        displayMessage = 'Servicio OCR no encontrado';
        showErrorBanner = true;
      } else if (errorMessage.includes('429')) {
        displayMessage = 'Límite de OCR excedido';
      }
      
      // Show appropriate notification
      if (showErrorBanner) {
        toast.error(displayMessage, {
          duration: 8000,
          position: 'top-center',
          style: {
            background: '#fee2e2',
            color: '#dc2626',
            border: '1px solid #fca5a5',
          },
        });
      } else {
        toast.error(displayMessage);
      }
      
      // Update with error status
      const errorDoc = {
        ...document,
        metadata: {
          ...document.metadata,
          ocr: {
            engine: 'gdocai:invoice',
            timestamp: new Date().toISOString(),
            confidenceGlobal: 0,
            fields: [],
            status: 'error' as const,
            error: errorMessage
          }
        }
      };

      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? errorDoc : doc
      ));

      console.warn(`Manual OCR failed for ${document.filename}:`, error);
    }
  };

  // Handle bank statement import completion
  const handleBankStatementImportComplete = (summary: {
    inserted: number;
    duplicates: number;
    failed: number;
    reconciled?: number;
    pendingReview?: number;
  }) => {
    // Close the modal
    setShowBankStatementModal(false);
    setBankStatementFile(null);
    
    // Show comprehensive summary
    const message = `Extracto importado: ${summary.inserted} movimientos`;
    const details = [];
    if (summary.duplicates > 0) details.push(`${summary.duplicates} duplicados`);
    if (summary.reconciled && summary.reconciled > 0) details.push(`${summary.reconciled} conciliados`);
    if (summary.pendingReview && summary.pendingReview > 0) details.push(`${summary.pendingReview} pendientes`);
    
    toast.success(details.length > 0 ? `${message} • ${details.join(' • ')}` : message, {
      duration: 5000
    });
    
    // The file doesn't get added to Inbox since it was processed directly
  };

  const handleAssignDocument = async (docId: number, metadata: any) => {
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      const doc = await tx.store.get(docId);
      
      if (doc) {
        doc.metadata = { ...doc.metadata, ...metadata };
        await tx.store.put(doc);
      }
      
      await tx.done;
    } catch (error) {
      console.warn('Failed to update in IndexedDB:', error);
    }
    
    // Update document in local state instead of removing it
    const updatedDocuments = documents.map(d => 
      d.id === docId ? { ...d, metadata: { ...d.metadata, ...metadata } } : d
    );
    setDocuments(updatedDocuments);
    
    // Update localStorage
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
    
    // Update selected document if it's the one being assigned
    if (selectedDocument && selectedDocument.id === docId) {
      setSelectedDocument({ ...selectedDocument, metadata: { ...selectedDocument.metadata, ...metadata } });
    }
  };

  const handleUpdateDocument = async (docId: number, updates: any) => {
    try {
      const db = await initDB();
      const tx = db.transaction('documents', 'readwrite');
      const doc = await tx.store.get(docId);
      
      if (doc) {
        Object.assign(doc, updates);
        await tx.store.put(doc);
      }
      
      await tx.done;
    } catch (error) {
      console.warn('Failed to update in IndexedDB:', error);
    }
    
    // Update local state
    const updatedDocuments = documents.map(d => 
      d.id === docId ? { ...d, ...updates } : d
    );
    setDocuments(updatedDocuments);
    
    // Update localStorage
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
    
    // Update selected document if it's the one being updated
    if (selectedDocument && selectedDocument.id === docId) {
      setSelectedDocument({ ...selectedDocument, ...updates });
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      // Use the new utility function that properly deletes the blob
      await deleteDocumentAndBlob(docId);
    } catch (error) {
      console.warn('Failed to delete from IndexedDB:', error);
    }
    
    // Remove from inbox list
    const updatedDocuments = documents.filter(d => d.id !== docId);
    setDocuments(updatedDocuments);
    
    // Update localStorage
    localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
    
    // If it was selected, deselect it
    if (selectedDocument && selectedDocument.id === docId) {
      setSelectedDocument(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.length === 0) return;
    
    try {
      for (const docId of selectedDocuments) {
        await deleteDocumentAndBlob(docId);
      }
      
      const updatedDocuments = documents.filter(d => !selectedDocuments.includes(d.id));
      setDocuments(updatedDocuments);
      localStorage.setItem('atlas-inbox-documents', JSON.stringify(updatedDocuments));
      
      setSelectedDocuments([]);
      if (selectedDocument && selectedDocuments.includes(selectedDocument.id)) {
        setSelectedDocument(null);
      }
      
      toast.success(`${selectedDocuments.length} documento(s) eliminado(s)`);
    } catch (error) {
      toast.error('Error al eliminar documentos');
    }
  };

  const handleBulkReassign = () => {
    // This would open a modal to reassign multiple documents
    toast('Función de reasignación en lote próximamente', { icon: 'ℹ️' });
  };

  const toggleDocumentSelection = (docId: number) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const toggleAllDocuments = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  };

  const sortDocuments = (docs: any[]) => {
    return [...docs].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        const dateA = new Date(a.uploadDate || 0).getTime();
        const dateB = new Date(b.uploadDate || 0).getTime();
        comparison = dateA - dateB;
      } else {
        comparison = (a.filename || '').localeCompare(b.filename || '');
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const filteredDocuments = sortDocuments(documents.filter(doc => {
    // Bandeja de entrada filters: Todos, Facturas, Contratos, Extractos, Otros, Pendientes
    
    // Main filter categories
    if (inboxFilter !== 'todos') {
      const docTipo = (doc.metadata?.tipo || 'otros').toLowerCase();
      
      if (inboxFilter === 'facturas' && !['factura', 'recibo', 'mejora', 'mobiliario'].includes(docTipo)) return false;
      if (inboxFilter === 'contratos' && docTipo !== 'contrato') return false;
      if (inboxFilter === 'extractos' && docTipo !== 'extracto bancario') return false;
      if (inboxFilter === 'otros' && ['factura', 'recibo', 'mejora', 'mobiliario', 'contrato', 'extracto bancario'].includes(docTipo)) return false;
      if (inboxFilter === 'pendientes') {
        const status = (doc.metadata?.queueStatus || 'pendiente').toLowerCase();
        if (!['pendiente', 'incompleto', 'error'].includes(status)) return false;
      }
    }
    
    // Estado filter (Pendiente, Incompleto, Importado, Error, Duplicado)
    if (queueStatusFilter !== 'all') {
      const docStatus = (doc.metadata?.queueStatus || doc.metadata?.status || 'pendiente').toLowerCase();
      if (docStatus !== queueStatusFilter.toLowerCase()) return false;
    }
    
    // Origen filter (Upload/Email)
    if (origenFilter !== 'all') {
      const isFromEmail = !!doc.metadata?.emailLogId;
      if (origenFilter === 'email' && !isFromEmail) return false;
      if (origenFilter === 'upload' && isFromEmail) return false;
    }
    
    // Apply search term (search in filename, provider, and notes)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const filename = (doc.filename || '').toLowerCase();
      const provider = (doc.metadata?.proveedor || '').toLowerCase();
      const notes = (doc.metadata?.notas || '').toLowerCase();
      
      if (!filename.includes(searchLower) && 
          !provider.includes(searchLower) && 
          !notes.includes(searchLower)) {
        return false;
      }
    }

    // H3 requirement - apply email log filter
    if (emailLogFilter) {
      if (doc.metadata?.emailLogId !== emailLogFilter) return false;
    }
    
    return true;
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-neutral-900">Bandeja de entrada</h1>
          {/* Inbox info tooltip */}
          <div className="relative group">
            <Info className="w-5 h-5 text-neutral-400 hover:text-neutral-600 cursor-help" />
            <div className="absolute left-0 top-6 w-80 p-3 bg-neutral-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Cola de entrada única para documentos con clasificación automática y archivado inteligente.
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="mr-4">
            <AutoSaveToggle />
          </div>
          <button
            onClick={() => setShowBulkActions(!showBulkActions)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              showBulkActions 
                ? 'bg-neutral-100 border-neutral-300 text-neutral-700' 
                : 'border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            Selección múltiple
          </button>
        </div>
      </div>
      
      {/* H3 requirement - Email log filter notice */}
      {emailLogFilter && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-900">
                Mostrando documentos del email: {emailLogFilter.replace('mock-', 'MOCK-')}
              </span>
            </div>
            <button
              onClick={() => {
                setEmailLogFilter('');
                window.history.replaceState({}, '', '/inbox');
              }}
              className="text-xs text-neutral-600 hover:text-neutral-800 px-2 py-1 rounded-lg hover:bg-neutral-100"
            >
              Mostrar todos los documentos
            </button>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b">
          <DocumentUploader 
            onUploadComplete={handleDocumentUpload} 
            onZipProcessed={handleZipProcessed}
            existingDocuments={documents}
          />
        </div>
        
        <div className="flex flex-col lg:flex-row">
          {/* Enhanced sidebar with filters */}
          <div className="w-full lg:w-80 lg:flex-shrink-0 border-r border-neutral-200">
            {/* Bulk Actions */}
            {showBulkActions && selectedDocuments.length > 0 && (
              <div className="p-4 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedDocuments.length} seleccionado(s)
                  </span>
                  <button
                    onClick={() => setSelectedDocuments([])}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Limpiar
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar
                  </button>
                  <button
                    onClick={handleBulkReassign}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <FolderOpen className="w-3 h-3" />
                    Reasignar
                  </button>
                </div>
              </div>
            )}

            {/* Bandeja de entrada main filters */}
            <div className="p-4 border-b border-neutral-200">
              <h4 className="text-sm font-medium text-neutral-700 mb-3">Filtros</h4>
              <div className="space-y-3">
                {/* Main category filter */}
                <div>
                  <label className="block text-xs text-neutral-600 mb-1">Categoría</label>
                  <select
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                    value={inboxFilter}
                    onChange={(e) => setInboxFilter(e.target.value)}
                  >
                    <option value="todos">Todos</option>
                    <option value="facturas">Facturas</option>
                    <option value="contratos">Contratos</option>
                    <option value="extractos">Extractos</option>
                    <option value="otros">Otros</option>
                    <option value="pendientes">Pendientes</option>
                  </select>
                </div>
                
                {/* Estado filter */}
                <div>
                  <label className="block text-xs text-neutral-600 mb-1">Estado</label>
                  <select
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                    value={queueStatusFilter}
                    onChange={(e) => setQueueStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="procesado">Procesado (OCR)</option>
                    <option value="incompleto">Incompleto</option>
                    <option value="importado">Importado</option>
                    <option value="error">Error</option>
                    <option value="duplicado">Duplicado</option>
                  </select>
                </div>
                
                {/* Origen filter */}
                <div>
                  <label className="block text-xs text-neutral-600 mb-1">Origen</label>
                  <select
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                    value={origenFilter}
                    onChange={(e) => setOrigenFilter(e.target.value)}
                  >
                    <option value="all">Todos los orígenes</option>
                    <option value="upload">Upload</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Enhanced search and filters */}
            <div className="p-4 border-b border-neutral-200">
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar documentos..."
                    className="w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-lg focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 focus:ring-opacity-50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Sorting controls */}
            <div className="p-4 border-b border-neutral-200">
              <h4 className="text-sm font-medium text-neutral-700 mb-3">Ordenar</h4>
              <div className="flex gap-2">
                <select
                  className="flex-1 text-sm border border-neutral-200 rounded-lg px-2 py-1"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
                >
                  <option value="date">Fecha</option>
                  <option value="name">Nombre</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Document count and bulk selection */}
            <div className="p-4">
              <div className="flex items-center justify-between text-sm text-neutral-600">
                <span>{filteredDocuments.length} documento(s)</span>
                {showBulkActions && (
                  <button
                    onClick={toggleAllDocuments}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {selectedDocuments.length === filteredDocuments.length ? 'Deseleccionar' : 'Seleccionar'} todos
                  </button>
                )}
              </div>
            </div>
            
            {/* H8: Single queue view - no legacy document list */}
            <div className="flex-1 p-4">
              <InboxQueue 
                documents={filteredDocuments}
                selectedId={selectedDocument?.id}
                onSelectDocument={setSelectedDocument}
                loading={loading}
                selectedDocuments={selectedDocuments}
                onToggleDocumentSelection={showBulkActions ? toggleDocumentSelection : undefined}
                showBulkActions={showBulkActions}
              />
            </div>
          </div>
          
          {/* Main content area - flexible width */}
          <div className="flex-1 min-w-0">
            {selectedDocument ? (
              <div className="flex h-full">
                {/* Document Viewer - Left side */}
                <div className="flex-1 border-r border-neutral-200">
                  <div className="p-6">
                    <DocumentViewer 
                      document={selectedDocument}
                      onAssign={handleAssignDocument}
                      onDelete={handleDeleteDocument}
                      onUpdate={handleUpdateDocument}
                      onProcessOCR={handleManualOCR}
                    />
                  </div>
                </div>
                
                {/* Classification Panel - Right side */}
                <div className="w-96 bg-gray-50 border-l border-neutral-200 overflow-y-auto">
                  <DocumentClassificationPanel
                    document={selectedDocument}
                    properties={properties}
                    onUpdate={(updates) => {
                      const updatedDoc = { ...selectedDocument, ...updates };
                      setSelectedDocument(updatedDoc);
                      // Update in the documents list as well
                      setDocuments(prev => prev.map(doc => 
                        doc.id === selectedDocument.id ? updatedDoc : doc
                      ));
                    }}
                    onSave={async () => {
                      await handleUpdateDocument(selectedDocument.id, selectedDocument);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-neutral-500 bg-white border border-neutral-200 m-6 rounded-lg">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 text-neutral-400">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-neutral-600">Selecciona un documento para ver</p>
                  {filteredDocuments.length === 0 && !loading && (
                    <p className="text-sm text-neutral-500 mt-2">
                      No hay documentos que coincidan con los filtros
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* H8: Demo Component - Development only */}
      {process.env.NODE_ENV === 'development' && showH8Demo && (
        <H8DemoComponent />
      )}

      {/* Bank Statement Import Modal */}
      <BankStatementModal
        isOpen={showBankStatementModal}
        onClose={() => {
          setShowBankStatementModal(false);
          setBankStatementFile(null);
        }}
        file={bankStatementFile}
        onImportComplete={handleBankStatementImportComplete}
      />
      
      {/* ATLAS HOTFIX: QA Dashboard - Development only */}
      {process.env.NODE_ENV === 'development' && (
        <QADashboard
          isVisible={showQADashboard}
          onClose={() => setShowQADashboard(false)}
        />
      )}
    </div>
  );
};

export default InboxPage;