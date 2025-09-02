import React from 'react';
import { CheckSquare, Square, FileText, Image, Archive, Eye, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface DocumentListProps {
  documents: any[];
  selectedId?: number;
  onSelectDocument: (document: any) => void;
  loading: boolean;
  selectedDocuments?: number[];
  onToggleDocumentSelection?: (docId: number) => void;
  showBulkActions?: boolean;
}

const DocumentList: React.FC<DocumentListProps> = ({ 
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

  // H-OCR: Get OCR status chip
  const getOCRChip = (doc: any) => {
    const ocrStatus = doc.metadata?.ocr?.status || 'pending';
    const fieldsCount = doc.metadata?.ocr?.fields?.length || 0;
    
    switch (ocrStatus) {
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" />
            OCR
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" />
            OCR · {fieldsCount} campos
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full" title={doc.metadata?.ocr?.error || 'Error de procesamiento'}>
            <AlertCircle className="w-3 h-3" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-neutral-100 text-neutral-600 rounded-full">
            <Eye className="w-3 h-3" />
            Pendiente
          </span>
        );
    }
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
        <div className="text-neutral-400 mb-2">No se encontraron documentos</div>
        <div className="text-sm text-neutral-500">Intenta cambiar los filtros o sube documentos nuevos</div>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2 overflow-y-auto max-h-96">
      {documents.map((doc, index) => {
        const isSelected = selectedId === doc.id;
        const isChecked = selectedDocuments.includes(doc.id);
        
        return (
          <div
            key={doc.id || index}
            className={`p-3 rounded-lg transition-colors border ${
              isSelected 
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-white border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {showBulkActions && onToggleDocumentSelection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleDocumentSelection(doc.id);
                  }}
                  className="mt-1 text-neutral-400 hover:text-neutral-600"
                >
                  {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
              )}
              
              <div className="flex-shrink-0 mt-1">
                {getFileIcon(doc.filename, doc.type)}
              </div>
              
              <div 
                className="flex-1 cursor-pointer"
                onClick={() => onSelectDocument(doc)}
              >
                <p className="font-medium text-neutral-900 text-sm line-clamp-2">
                  {doc.filename || doc.name || `Documento ${index + 1}`}
                </p>
                
                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                  <span>{new Date(doc.uploadDate || Date.now()).toLocaleDateString('es-ES')}</span>
                  {doc.size && (
                    <>
                      <span>•</span>
                      <span>{formatFileSize(doc.size)}</span>
                    </>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      doc.metadata?.status === 'Asignado' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {doc.metadata?.status || 'Nuevo'}
                    </span>
                    
                    {/* H-OCR: OCR status chip */}
                    {getOCRChip(doc)}
                  </div>
                  
                  {doc.metadata?.proveedor && (
                    <span className="text-xs text-neutral-400 truncate max-w-20">
                      {doc.metadata.proveedor}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DocumentList;