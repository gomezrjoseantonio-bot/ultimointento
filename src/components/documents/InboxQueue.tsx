import React from 'react';
import { FileText, Image, Archive, Eye, AlertCircle, CheckCircle, MoreHorizontal, Mail, Upload } from 'lucide-react';
import { alignDocumentAI } from '../../features/inbox/ocr/alignDocumentAI';

interface InboxQueueProps {
  documents: any[];
  selectedId?: number;
  onSelectDocument: (document: any) => void;
  loading: boolean;
  selectedDocuments?: number[];
  onToggleDocumentSelection?: (docId: number) => void;
  showBulkActions?: boolean;
}

const InboxQueue: React.FC<InboxQueueProps> = ({ 
  documents, 
  selectedId, 
  onSelectDocument, 
  loading,
  selectedDocuments = [],
  onToggleDocumentSelection,
  showBulkActions = false
}) => {
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string, type: string) => {
    if (type?.startsWith('image/') || filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/)) {
      return <Image className="w-4 h-4 text-blue-500" />;
    }
    if (type === 'application/pdf' || filename?.toLowerCase().endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-red-500" />;
    }
    if (type === 'application/zip' || filename?.toLowerCase().endsWith('.zip')) {
      return <Archive className="w-4 h-4 text-orange-500" />;
    }
    return <FileText className="w-4 h-4 text-neutral-500" />;
  };

  // H3: Get document status with new states (Pendiente, Incompleto, Importado, Error, Duplicado)
  const getStatusChip = (doc: any) => {
    const status = doc.metadata?.queueStatus || doc.metadata?.status || 'Pendiente';
    
    switch (status.toLowerCase()) {
      case 'pendiente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">
            <Eye className="w-3 h-3" />
            Pendiente
          </span>
        );
      case 'procesado':
      case 'procesado_ocr':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Procesado (OCR)
          </span>
        );
      case 'incompleto':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Incompleto
          </span>
        );
      case 'importado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Importado
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Error
          </span>
        );
      case 'duplicado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Duplicado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">
            <Eye className="w-3 h-3" />
            Pendiente
          </span>
        );
    }
  };

  // H3: Get origin indicator (Upload/Email)
  const getOriginChip = (doc: any) => {
    const isFromEmail = doc.metadata?.emailLogId;
    
    if (isFromEmail) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
          <Mail className="w-3 h-3" />
          Email
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded-full">
        <Upload className="w-3 h-3" />
        Upload
      </span>
    );
  };

  // Extract amount from document (OCR or metadata)
  const getDocumentAmount = (doc: any) => {
    try {
      if (doc.metadata?.ocr?.status === 'completed') {
        const aligned = alignDocumentAI(doc.metadata.ocr);
        if (aligned?.invoice?.total?.value > 0) {
          return `€${aligned.invoice.total.value.toFixed(2)}`;
        }
      }
    } catch (error) {
      // Fallback to metadata amount if any
    }
    
    if (doc.metadata?.amount) {
      return `€${doc.metadata.amount}`;
    }
    
    return '-';
  };

  // Extract supplier/bank from document
  const getSupplierOrBank = (doc: any) => {
    try {
      if (doc.metadata?.ocr?.status === 'completed') {
        const aligned = alignDocumentAI(doc.metadata.ocr);
        if (aligned?.supplier?.name) {
          return aligned.supplier.name;
        }
      }
    } catch (error) {
      // Fallback
    }
    
    return doc.metadata?.proveedor || doc.metadata?.bank || '-';
  };

  // Extract document date
  const getDocumentDate = (doc: any) => {
    try {
      if (doc.metadata?.ocr?.status === 'completed') {
        const aligned = alignDocumentAI(doc.metadata.ocr);
        if (aligned?.invoice?.date) {
          return new Date(aligned.invoice.date).toLocaleDateString('es-ES');
        }
      }
    } catch (error) {
      // Fallback
    }
    
    if (doc.metadata?.documentDate) {
      return new Date(doc.metadata.documentDate).toLocaleDateString('es-ES');
    }
    
    return new Date(doc.uploadDate || Date.now()).toLocaleDateString('es-ES');
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-neutral-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-neutral-400 mb-2">No hay documentos en la cola</div>
        <div className="text-sm text-neutral-500">Sube documentos o configura email entrante</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            {showBulkActions && (
              <th className="text-left py-3 px-4 w-8">
                <input
                  type="checkbox"
                  checked={selectedDocuments.length === documents.length && documents.length > 0}
                  onChange={() => {
                    if (selectedDocuments.length === documents.length) {
                      // Deselect all
                      documents.forEach(doc => onToggleDocumentSelection?.(doc.id));
                    } else {
                      // Select all
                      documents.forEach(doc => {
                        if (!selectedDocuments.includes(doc.id)) {
                          onToggleDocumentSelection?.(doc.id);
                        }
                      });
                    }
                  }}
                  className="rounded border-neutral-300"
                />
              </th>
            )}
            <th className="text-left py-3 px-4 font-medium text-neutral-700">Documento</th>
            <th className="text-left py-3 px-4 font-medium text-neutral-700">Tipo</th>
            <th className="text-left py-3 px-4 font-medium text-neutral-700">Estado</th>
            <th className="text-left py-3 px-4 font-medium text-neutral-700">Proveedor/Banco</th>
            <th className="text-left py-3 px-4 font-medium text-neutral-700">Importe</th>
            <th className="text-left py-3 px-4 font-medium text-neutral-700">Fecha doc</th>
            <th className="text-left py-3 px-4 font-medium text-neutral-700">Origen</th>
            <th className="text-left py-3 px-4 font-medium text-neutral-700">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, index) => {
            const isSelected = selectedId === doc.id;
            const isChecked = selectedDocuments.includes(doc.id);
            
            return (
              <tr
                key={doc.id || index}
                className={`border-b border-neutral-100 transition-colors cursor-pointer ${
                  isSelected 
                    ? 'bg-blue-50' 
                    : 'hover:bg-neutral-50'
                }`}
                onClick={() => onSelectDocument(doc)}
              >
                {showBulkActions && (
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleDocumentSelection?.(doc.id)}
                      className="rounded border-neutral-300"
                    />
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {getFileIcon(doc.filename, doc.type)}
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900 text-sm truncate">
                        {doc.filename || doc.name || `Documento ${index + 1}`}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatFileSize(doc.size)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-neutral-600">
                  {doc.metadata?.tipo || 'Otros'}
                </td>
                <td className="py-3 px-4">
                  {getStatusChip(doc)}
                </td>
                <td className="py-3 px-4 text-sm text-neutral-600">
                  {getSupplierOrBank(doc)}
                </td>
                <td className="py-3 px-4 text-sm text-neutral-600 font-mono">
                  {getDocumentAmount(doc)}
                </td>
                <td className="py-3 px-4 text-sm text-neutral-600">
                  {getDocumentDate(doc)}
                </td>
                <td className="py-3 px-4">
                  {getOriginChip(doc)}
                </td>
                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  <button className="p-1 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default InboxQueue;