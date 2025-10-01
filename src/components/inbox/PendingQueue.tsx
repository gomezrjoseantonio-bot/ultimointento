import React, { useState } from 'react';
import { 
  FileText, AlertCircle, CheckCircle, Clock, 
  Building, CreditCard, Eye, Trash2, Edit, 
  ChevronRight, Search, ArrowUpDown
} from 'lucide-react';

interface BlockingReason {
  type: 'error' | 'warning' | 'info';
  message: string;
  action?: string;
}

interface PendingDocument {
  id: number;
  filename: string;
  type: string;
  size: number;
  uploadDate: string;
  documentType: string;
  amount?: number;
  date?: string;
  provider?: string;
  inmueble?: string;
  account?: string;
  ocrConfidence?: number;
  blockingReasons: BlockingReason[];
  isReadyToPublish: boolean;
  thumbnail?: string;
}

interface PendingQueueProps {
  documents: PendingDocument[];
  onSelectDocument: (doc: PendingDocument) => void;
  onPublishDocument: (doc: PendingDocument) => void;
  onPublishBatch: (docs: PendingDocument[]) => void;
  onAssignInmueble: (docs: PendingDocument[]) => void;
  onAssignAccount: (docs: PendingDocument[]) => void;
  onChooseCategory: (docs: PendingDocument[]) => void;
  onAdjustAmounts: (docs: PendingDocument[]) => void;
  onSplitReform: (doc: PendingDocument) => void;
  onMapColumns: (doc: PendingDocument) => void;
  onDiscard: (docs: PendingDocument[]) => void;
  loading?: boolean;
}

const PendingQueue: React.FC<PendingQueueProps> = ({
  documents,
  onSelectDocument,
  onPublishDocument,
  onPublishBatch,
  onAssignInmueble,
  onAssignAccount,
  onChooseCategory,
  onAdjustAmounts,
  onSplitReform,
  onMapColumns,
  onDiscard,
  loading = false
}) => {
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'amount'>('date');

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(doc => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!doc.filename.toLowerCase().includes(searchLower) &&
            !doc.provider?.toLowerCase().includes(searchLower) &&
            !doc.documentType.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Type filter
      if (filterType !== 'all' && doc.documentType.toLowerCase() !== filterType) {
        return false;
      }

      // Status filter
      if (filterStatus === 'ready' && !doc.isReadyToPublish) return false;
      if (filterStatus === 'blocked' && doc.isReadyToPublish) return false;
      if (filterStatus === 'errors' && !doc.blockingReasons.some(r => r.type === 'error')) return false;

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
        case 'type':
          return a.documentType.localeCompare(b.documentType);
        case 'amount':
          return (b.amount || 0) - (a.amount || 0);
        default:
          return 0;
      }
    });

  const selectedDocuments = filteredDocuments.filter(doc => selectedDocs.includes(doc.id));
  const readyToPublishCount = selectedDocuments.filter(doc => doc.isReadyToPublish).length;

  const getDocumentIcon = (docType: string) => {
    switch (docType.toLowerCase()) {
      case 'factura':
      case 'recibo':
        return <FileText className="w-5 h-5 text-navy-700" />;
      case 'contrato':
        return <FileText className="w-5 h-5 text-success-600" />;
      case 'extracto bancario':
        return <CreditCard className="w-5 h-5 text-purple-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusIcon = (doc: PendingDocument) => {
    if (doc.isReadyToPublish) {
      return <CheckCircle className="w-4 h-4 text-success-600" />;
    }
    
    const hasErrors = doc.blockingReasons.some(r => r.type === 'error');
    if (hasErrors) {
      return <AlertCircle className="w-4 h-4 text-error-600" />;
    }
    
    return <Clock className="w-4 h-4 text-warning-600" />;
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return '';
    return amount.toLocaleString('es-ES', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES');
  };

  const handleSelectDocument = (docId: number, selected: boolean) => {
    if (selected) {
      setSelectedDocs(prev => [...prev, docId]);
    } else {
      setSelectedDocs(prev => prev.filter(id => id !== docId));
    }
  };

  const handleSelectAll = () => {
    if (selectedDocs.length === filteredDocuments.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(filteredDocuments.map(doc => doc.id));
    }
  };

  return (
    <div className="bg-white border border-neutral-200 shadow-sm">
      {/* Header with search and filters */}
      <div className="p-4 border-b border-neutral-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Bandeja Pendientes
          </h2>
          <div className="text-sm text-slate-600">
            {filteredDocuments.length} documentos · {filteredDocuments.filter(d => d.isReadyToPublish).length} listos para publicar
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, proveedor o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-neutral-200 focus:border-navy-600 focus:ring-2 focus:ring-navy-200"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-neutral-200 focus:border-navy-600"
          >
            <option value="all">Todos los tipos</option>
            <option value="factura">Facturas</option>
            <option value="recibo">Recibos</option>
            <option value="contrato">Contratos</option>
            <option value="extracto bancario">Extractos</option>
            <option value="otros">Otros</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-neutral-200 focus:border-navy-600"
          >
            <option value="all">Todos los estados</option>
            <option value="ready">Listo para publicar</option>
            <option value="blocked">Con bloqueos</option>
            <option value="errors">Con errores</option>
          </select>

          <button
            onClick={() => {
              setSortBy(sortBy === 'date' ? 'type' : sortBy === 'type' ? 'amount' : 'date');
            }}
            className="p-2 border border-neutral-200"
            title="Cambiar ordenación"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedDocs.length > 0 && (
        <div className="p-4 bg-navy-50 border-b border-navy-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-navy-900">
              {selectedDocs.length} seleccionados · {readyToPublishCount} listos
            </span>
            <button
              onClick={() => setSelectedDocs([])}
              className="text-xs text-navy-700 hover:text-navy-900"
            >
              Limpiar selección
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onAssignInmueble(selectedDocuments)}
              className="px-3 py-1 bg-white border border-navy-200 text-navy-700 text-xs"
            >
              <Building className="w-3 h-3 inline mr-1" />
              Asignar Inmueble
            </button>
            
            <button
              onClick={() => onAssignAccount(selectedDocuments)}
              className="px-3 py-1 bg-white border border-navy-200 text-navy-700 text-xs"
            >
              <CreditCard className="w-3 h-3 inline mr-1" />
              Asignar Cuenta
            </button>
            
            <button
              onClick={() => onChooseCategory(selectedDocuments)}
              className="px-3 py-1 bg-white border border-navy-200 text-navy-700 text-xs"
            >
              Elegir Categoría
            </button>
            
            <button
              onClick={() => onAdjustAmounts(selectedDocuments)}
              className="px-3 py-1 bg-white border border-navy-200 text-navy-700 text-xs"
            >
              Ajustar totales/IVA
            </button>
            
            {readyToPublishCount > 0 && (
              <button
                onClick={() => onPublishBatch(selectedDocuments.filter(d => d.isReadyToPublish))}
                className="px-3 py-1 bg-navy-700 text-xs font-medium"
              >
                Publicar selección ({readyToPublishCount})
              </button>
            )}
            
            <button
              onClick={() => onDiscard(selectedDocuments)}
              className="atlas-atlas-atlas-atlas-btn-destructive px-3 py-1 bg-error-100 text-error-700 hover: text-xs"
            >
              <Trash2 className="w-3 h-3 inline mr-1" />
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="divide-y divide-neutral-200">
        {/* Select all header */}
        <div className="p-3 bg-neutral-50 border-b border-neutral-200">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filteredDocuments.length > 0 && selectedDocs.length === filteredDocuments.length}
              onChange={handleSelectAll}
              className="mr-3 h-4 w-4 text-navy-700 border-neutral-300 rounded focus:ring-navy-600"
            />
            <span className="text-sm text-neutral-700">
              Seleccionar todos ({filteredDocuments.length})
            </span>
          </label>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-navy-700 mx-auto"></div>
            <p className="mt-2 text-sm text-neutral-600">Cargando documentos...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-600">No hay documentos pendientes</p>
            <p className="text-sm text-neutral-500 mt-1">
              Los documentos aparecerán aquí cuando el autoguardado esté desactivado
            </p>
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="p-4 cursor-pointer"
              onClick={() => onSelectDocument(doc)}
            >
              <div className="flex items-start gap-4">
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  checked={selectedDocs.includes(doc.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleSelectDocument(doc.id, e.target.checked);
                  }}
                  className="mt-1 h-4 w-4 text-navy-700 border-neutral-300 rounded focus:ring-navy-600"
                />

                {/* Document thumbnail/icon */}
                <div className="flex-shrink-0">
                  {doc.thumbnail ? (
                    <img 
                      src={doc.thumbnail} 
                      alt={doc.filename}
                      className="w-12 h-12 object-cover border border-neutral-200"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                      {getDocumentIcon(doc.documentType)}
                    </div>
                  )}
                </div>

                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc)}
                        <h3 className="text-sm font-medium text-neutral-900 truncate">
                          {doc.filename}
                        </h3>
                        <span className="text-xs text-neutral-500">
                          {doc.documentType}
                        </span>
                      </div>
                      
                      <div className="mt-1 flex items-center gap-4 text-xs text-neutral-600">
                        {doc.amount && (
                          <span className="font-medium text-neutral-900">
                            {formatAmount(doc.amount)}
                          </span>
                        )}
                        {doc.date && (
                          <span>{formatDate(doc.date)}</span>
                        )}
                        {doc.provider && (
                          <span>{doc.provider}</span>
                        )}
                        {doc.inmueble && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {doc.inmueble}
                          </span>
                        )}
                        {doc.account && (
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            {doc.account}
                          </span>
                        )}
                      </div>

                      {/* Blocking reasons chips */}
                      {doc.blockingReasons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {doc.blockingReasons.map((reason, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center px-2 py-1 text-xs font-medium ${
                                reason.type === 'error'
                                  ? 'bg-error-100 text-error-800'
                                  : reason.type === 'warning'
                                  ? 'bg-warning-100 text-yellow-800'
                                  : 'bg-navy-100 text-navy-800'
                              }`}
                            >
                              {reason.message}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1 ml-4">
                      {doc.documentType === 'Extracto bancario' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMapColumns(doc);
                          }}
                          className="p-1 text-neutral-400 hover:text-neutral-600"
                          title="Mapear columnas"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      
                      {doc.documentType === 'Factura' && doc.blockingReasons.some(r => r.message.includes('reforma')) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSplitReform(doc);
                          }}
                          className="p-1 text-neutral-400 hover:text-neutral-600"
                          title="Dividir reforma"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDocument(doc);
                        }}
                        className="p-1 text-neutral-400 hover:text-neutral-600"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {doc.isReadyToPublish && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPublishDocument(doc);
                          }}
                          className="p-1 text-success-600 hover:text-success-700 font-medium"
                          title="Publicar ahora"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PendingQueue;