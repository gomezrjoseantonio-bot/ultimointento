import React, { useState, useEffect } from 'react';
import { 
  Upload, Search, Eye, RotateCcw, CheckCircle, AlertTriangle, XCircle,
  FileText, Image, FileSpreadsheet, File, X, ChevronDown, ChevronUp, CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { unifiedDocumentProcessor, ProcessedDocument, DocumentStatus } from '../services/unifiedDocumentProcessor';
import { unifiedOcrService } from '../services/unifiedOcrService';
import AccountAssignmentModal from '../components/modals/AccountAssignmentModal';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-ES');

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const safeFormatDate = (value: string | number | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '';
  }
  return dateFormatter.format(date);
};

const safeFormatDateTime = (value: string | number | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '';
  }
  return dateTimeFormatter.format(date);
};

const UnifiedInboxPage: React.FC = () => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | DocumentStatus>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  const [isDev] = useState(process.env.NODE_ENV !== 'production');
  const [accountAssignmentModal, setAccountAssignmentModal] = useState<{
    isOpen: boolean;
    document: ProcessedDocument | null;
  }>({ isOpen: false, document: null });

  // Load documents and setup cleanup
  useEffect(() => {
    loadDocuments();
    
    // Clean up expired documents every minute
    const interval = setInterval(() => {
      unifiedDocumentProcessor.cleanupExpiredDocuments();
      loadDocuments();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDocuments = () => {
    setDocuments(unifiedDocumentProcessor.getDocuments());
  };

  const handleFileUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        // Validate file type
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/heic',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv'
        ];
        
        const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'doc', 'docx', 'xlsx', 'xls', 'csv'];
        const extension = file.name.toLowerCase().split('.').pop();
        
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension || '')) {
          toast.error(`Formato no soportado: ${file.name}`);
          continue;
        }

        // Check for duplicates (simple filename check for now)
        const existingDoc = documents.find(doc => doc.filename === file.name);
        if (existingDoc) {
          toast.error(`Archivo ya existe: ${file.name} (usar "Reprocesar OCR" si necesita actualizar)`);
          continue;
        }

        // Process file
        await unifiedDocumentProcessor.processFile(file);
        loadDocuments(); // Refresh list

      } catch (error) {
        console.error('Error processing file:', error);
        toast.error(`Error procesando ${file.name}: ${error}`);
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleReprocessOCR = async (docId: string) => {
    try {
      await unifiedDocumentProcessor.reprocessOCR(docId);
      loadDocuments();
      toast.success('OCR reprocesado');
    } catch (error) {
      toast.error(`Error reprocesando OCR: ${error}`);
    }
  };

  const handleAssignAccount = async (documentId: string, accountData: { iban?: string; accountNumber?: string; bankName?: string }) => {
    try {
      await unifiedDocumentProcessor.assignBankAccount(documentId, accountData);
      loadDocuments();
      toast.success('Cuenta bancaria asignada correctamente');
    } catch (error) {
      toast.error(`Error asignando cuenta: ${error}`);
    }
  };

  const openAccountAssignmentModal = (document: ProcessedDocument) => {
    setAccountAssignmentModal({ isOpen: true, document });
  };

  const closeAccountAssignmentModal = () => {
    setAccountAssignmentModal({ isOpen: false, document: null });
  };

  const handleTestOCR = async () => {
    if (!isDev) return;

    try {
      const result = await unifiedOcrService.testOCREndpoint();
      toast(`🧪 Test OCR: ${result.status} - ${result.message}`, {
        duration: 4000,
        icon: result.status === 200 ? '✅' : '❌'
      });
    } catch (error) {
      toast.error(`❌ Test OCR failed: ${error}`);
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'guardado_automatico':
        return <CheckCircle className="h-5 w-5" style={{ color: 'var(--ok)' }} />;
      case 'revision_requerida':
        return <AlertTriangle className="h-5 w-5" style={{ color: 'var(--warn)' }} />;
      case 'error':
        return <XCircle className="h-5 w-5" style={{ color: 'var(--error)' }} />;
      default:
        return <File className="h-5 w-5" style={{ color: 'var(--text-gray)' }} />;
    }
  };

  const getStatusText = (status: DocumentStatus) => {
    switch (status) {
      case 'guardado_automatico':
        return 'Auto-guardado';
      case 'revision_requerida':
        return 'Revisión';
      case 'error':
        return 'Error';
      default:
        return 'Desconocido';
    }
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (['pdf'].includes(extension || '')) {
      return <FileText className="h-6 w-6" style={{ color: 'var(--error)' }} />;
    }
    if (['jpg', 'jpeg', 'png', 'heic'].includes(extension || '')) {
      return <Image className="h-6 w-6" style={{ color: 'var(--horizon-primary)' }} />;
    }
    if (['xls', 'xlsx', 'csv'].includes(extension || '')) {
      return <FileSpreadsheet className="h-6 w-6" style={{ color: 'var(--ok)' }} />;
    }
    return <File className="h-6 w-6" style={{ color: 'var(--text-gray)' }} />;
  };

  const filteredDocuments = documents.filter(doc => {
    if (statusFilter !== 'todos' && doc.status !== statusFilter) return false;
    if (searchTerm && !doc.filename.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Group documents by status for display
  const autoSavedDocs = filteredDocuments.filter(doc => doc.status === 'guardado_automatico');
  const reviewDocs = filteredDocuments.filter(doc => doc.status === 'revision_requerida');
  const errorDocs = filteredDocuments.filter(doc => doc.status === 'error');

  const headerBorderStyle: React.CSSProperties = {
    borderColor: 'var(--hz-neutral-300)',
  };

  const focusableFieldClass = 'atlas-field';

  return (
    <div
      className="h-screen flex flex-col bg-gray-50"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="bg-white border-b px-4 sm:px-6 py-4" style={headerBorderStyle}>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-start sm:items-center">
          <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
            Bandeja de entrada
          </h1>
          <div className="flex gap-2">
            {/* File upload */}
            <div className="relative">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.heic,.docx,.xlsx,.xls,.csv"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="atlas-atlas-atlas-atlas-btn-primary shadow-sm text-sm font-medium cursor-pointer"
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir documentos
              </label>
            </div>

            {/* DEV Test button */}
            {isDev && (
              <button className="atlas-atlas-atlas-atlas-btn-secondary shadow-sm" onClick={handleTestOCR}>
                🧪 Probar OCR (DEV)
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar documentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${focusableFieldClass} pl-10 pr-4`}
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'todos' | DocumentStatus)}
            className={`${focusableFieldClass} sm:w-auto`}
          >
            <option value="todos">Todos los estados</option>
            <option value="guardado_automatico">Auto-guardado</option>
            <option value="revision_requerida">Revisión</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-4">
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-gray-400 transition-colors"
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay documentos</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Arrastra archivos aquí o sube documentos para comenzar
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Soporta: PDF, JPG, PNG, HEIC, DOC, DOCX, XLS, XLSX, CSV
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Auto-saved documents (72h) */}
                {autoSavedDocs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">
                      Auto-guardado (72h) - {autoSavedDocs.length} documentos
                    </h3>
                    <div className="space-y-3">
                      {autoSavedDocs.map(doc => (
                        <DocumentCard
                          key={doc.id}
                          document={doc}
                          onSelect={setSelectedDocument}
                          onReprocessOCR={handleReprocessOCR}
                          onAssignAccount={openAccountAssignmentModal}
                          getStatusIcon={getStatusIcon}
                          getFileIcon={getFileIcon}
                          getStatusText={getStatusText}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Review required */}
                {reviewDocs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">
                      Revisión requerida - {reviewDocs.length} documentos
                    </h3>
                    <div className="space-y-3">
                      {reviewDocs.map(doc => (
                        <DocumentCard
                          key={doc.id}
                          document={doc}
                          onSelect={setSelectedDocument}
                          onReprocessOCR={handleReprocessOCR}
                          onAssignAccount={openAccountAssignmentModal}
                          getStatusIcon={getStatusIcon}
                          getFileIcon={getFileIcon}
                          getStatusText={getStatusText}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {errorDocs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">
                      Error - {errorDocs.length} documentos
                    </h3>
                    <div className="space-y-3">
                      {errorDocs.map(doc => (
                        <DocumentCard
                          key={doc.id}
                          document={doc}
                          onSelect={setSelectedDocument}
                          onReprocessOCR={handleReprocessOCR}
                          onAssignAccount={openAccountAssignmentModal}
                          getStatusIcon={getStatusIcon}
                          getFileIcon={getFileIcon}
                          getStatusText={getStatusText}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Document Details Panel */}
          {selectedDocument && (
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Detalles del documento</h3>
                  <button className="atlas-atlas-atlas-atlas-btn-ghost" onClick={() => setSelectedDocument(null)} aria-label="Cerrar detalles">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <DocumentDetails
                  document={selectedDocument}
                  showLogs={showLogsPanel}
                  onToggleLogs={() => setShowLogsPanel(!showLogsPanel)}
                  onReprocessOCR={() => handleReprocessOCR(selectedDocument.id)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Assignment Modal */}
      {accountAssignmentModal.isOpen && accountAssignmentModal.document && (
        <AccountAssignmentModal
          isOpen={accountAssignmentModal.isOpen}
          onClose={closeAccountAssignmentModal}
          document={accountAssignmentModal.document}
          onAssignAccount={handleAssignAccount}
        />
      )}
    </div>
  );
};

// Document Card Component
interface DocumentCardProps {
  document: ProcessedDocument;
  onSelect: (doc: ProcessedDocument) => void;
  onReprocessOCR: (docId: string) => void;
  onAssignAccount: (document: ProcessedDocument) => void;
  getStatusIcon: (status: DocumentStatus) => React.ReactNode;
  getFileIcon: (filename: string) => React.ReactNode;
  getStatusText: (status: DocumentStatus) => string;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onSelect,
  onReprocessOCR,
  onAssignAccount,
  getStatusIcon,
  getFileIcon,
  getStatusText
}) => {
  return (
    <div className="atlas-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getFileIcon(document.filename)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {document.filename}
              </h4>
              {getStatusIcon(document.status)}
            </div>
            
            <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
              <span>{(document.size / 1024).toFixed(1)} KB</span>
              <span>{safeFormatDate(document.uploadDate)}</span>
            </div>

            {/* Status and destination */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-700">Estado:</span>
                <span className="text-xs text-gray-600">{getStatusText(document.status)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-700">Destino:</span>
                <span className="text-xs text-gray-600">{document.destination}</span>
              </div>
            </div>

            {/* Extracted info */}
            {document.supplier && (
              <div className="mt-2 text-xs text-gray-600">
                <span className="font-medium">Proveedor:</span> {document.supplier}
              </div>
            )}
            
            {typeof document.amount === 'number' && (
              <div className="text-xs text-gray-600">
                <span className="font-medium">Importe:</span> {currencyFormatter.format(document.amount)}
              </div>
            )}

            {document.movementsCount && (
              <div className="text-xs text-gray-600">
                <span className="font-medium">Movimientos:</span> {document.movementsCount}
              </div>
            )}

            {/* Blocking reasons */}
            {document.blockingReasons && document.blockingReasons.length > 0 && (
              <div className="mt-2">
                {document.blockingReasons.map((reason, index) => (
                  <div
                    key={index}
                    className="atlas-chip-warning text-xs block w-full"
                    style={{ color: 'var(--warn)' }}
                  >
                    {reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-2 ml-4">
          <button className="atlas-atlas-atlas-atlas-btn-ghost" onClick={() => onSelect(document)} title="Ver detalles">
            <Eye className="h-4 w-4" />
          </button>

          {document.documentType === 'factura' && (
            <button className="atlas-atlas-atlas-atlas-btn-ghost" onClick={() => onReprocessOCR(document.id)} title="Reprocesar OCR">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          {/* Bank account assignment button for CSV/XLS files requiring manual assignment */}
          {document.documentType === 'extracto_bancario' &&
           document.status === 'revision_requerida' &&
           document.blockingReasons?.some(reason => reason.includes('cuenta')) && (
            <button className="atlas-atlas-atlas-atlas-btn-ghost" onClick={() => onAssignAccount(document)} title="Asignar cuenta bancaria" style={{ color: 'var(--atlas-blue)' }}>
              <CreditCard className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Document Details Component
interface DocumentDetailsProps {
  document: ProcessedDocument;
  showLogs: boolean;
  onToggleLogs: () => void;
  onReprocessOCR: () => void;
}

const DocumentDetails: React.FC<DocumentDetailsProps> = ({
  document,
  showLogs,
  onToggleLogs,
  onReprocessOCR
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-900">Información básica</h4>
        <dl className="mt-2 space-y-2">
          <div>
            <dt className="text-xs text-gray-500">Archivo</dt>
            <dd className="text-sm text-gray-900">{document.filename}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Tipo</dt>
            <dd className="text-sm text-gray-900">{document.documentType}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Estado</dt>
            <dd className="text-sm text-gray-900">{document.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Destino</dt>
            <dd className="text-sm text-gray-900">{document.destination}</dd>
          </div>
        </dl>
      </div>

      {/* Extracted fields */}
      {(document.supplier || document.amount || document.issueDate) && (
        <div>
          <h4 className="text-sm font-medium text-gray-900">Datos extraídos</h4>
          <dl className="mt-2 space-y-2">
            {document.supplier && (
              <div>
                <dt className="text-xs text-gray-500">Proveedor</dt>
                <dd className="text-sm text-gray-900">{document.supplier}</dd>
              </div>
            )}
            {typeof document.amount === 'number' && (
              <div>
                <dt className="text-xs text-gray-500">Importe</dt>
                <dd className="text-sm text-gray-900">{currencyFormatter.format(document.amount)}</dd>
              </div>
            )}
            {document.issueDate && (
              <div>
                <dt className="text-xs text-gray-500">Fecha emisión</dt>
                <dd className="text-sm text-gray-900">{safeFormatDate(document.issueDate)}</dd>
              </div>
            )}
            {document.utilityType && (
              <div>
                <dt className="text-xs text-gray-500">Tipo suministro</dt>
                <dd className="text-sm text-gray-900">{document.utilityType}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {document.documentType === 'factura' && (
          <button className="atlas-atlas-atlas-atlas-btn-secondary w-full justify-center" onClick={onReprocessOCR}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reprocesar OCR
          </button>
        )}
      </div>

      {/* Logs */}
      <div>
        <button className="atlas-atlas-atlas-atlas-btn-ghost w-full justify-between text-sm font-medium" onClick={onToggleLogs}>
          <span>Registro de actividad</span>
          {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {showLogs && (
          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
            {document.logs.map((log, index) => (
              <div key={index} className="text-xs">
                <div className="text-gray-500">{safeFormatDateTime(log.timestamp)}</div>
                <div className="text-gray-900">{log.action}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedInboxPage;