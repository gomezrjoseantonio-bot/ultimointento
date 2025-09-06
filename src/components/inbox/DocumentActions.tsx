// Document Actions Component for Bandeja de entrada
// Provides Ver, Asignar/Reasignar, Eliminar (with confirmation), Descargar actions

import React, { useState } from 'react';
import { Eye, FolderOpen, Trash2, Download, AlertTriangle } from 'lucide-react';

interface DocumentActionsProps {
  document: any;
  onView?: (document: any) => void;
  onAssign?: (document: any) => void;
  onDelete?: (documentId: number) => void;
  onDownload?: (document: any) => void;
  className?: string;
}

const DocumentActions: React.FC<DocumentActionsProps> = ({
  document,
  onView,
  onAssign,
  onDelete,
  onDownload,
  className = ''
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleView = () => {
    if (onView) {
      onView(document);
    }
  };

  const handleAssign = () => {
    if (onAssign) {
      onAssign(document);
    }
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload(document);
      return;
    }

    // Default download implementation
    try {
      let blob: Blob;
      
      if (document.content instanceof ArrayBuffer) {
        blob = new Blob([document.content], { type: document.type });
      } else if (document.content instanceof Blob) {
        blob = document.content;
      } else {
        // Fallback for other content types
        blob = new Blob([document.content], { type: document.type || 'application/octet-stream' });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = document.filename || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const handleDeleteConfirm = () => {
    if (onDelete) {
      onDelete(document.id);
    }
    setShowDeleteConfirm(false);
  };

  const isAssigned = document.metadata?.inmuebleId || document.metadata?.isPersonal;
  const assignButtonText = isAssigned ? 'Reasignar' : 'Asignar';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Ver */}
      <button
        onClick={handleView}
        className="p-1.5 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
        title="Ver documento"
      >
        <Eye className="w-4 h-4" />
      </button>

      {/* Asignar/Reasignar */}
      <button
        onClick={handleAssign}
        className={`p-1.5 rounded-lg transition-colors ${
          isAssigned 
            ? 'text-primary-600 hover:text-primary-800 hover:bg-primary-50' 
            : 'text-warning-600 hover:text-orange-800 hover:bg-orange-50'
        }`}
        title={`${assignButtonText} a inmueble o personal`}
      >
        <FolderOpen className="w-4 h-4" />
      </button>

      {/* Descargar */}
      <button
        onClick={handleDownload}
        className="p-1.5 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
        title="Descargar documento"
      >
        <Download className="w-4 h-4" />
      </button>

      {/* Eliminar */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-1.5 text-error-600 hover:text-error-800 hover:bg-error-50 rounded-lg transition-colors"
          title="Eliminar documento"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <div className="flex items-center gap-1 bg-error-50 rounded-lg p-1">
          <AlertTriangle className="w-3 h-3 text-error-600" />
          <button
            onClick={handleDeleteConfirm}
            className="px-2 py-1 text-xs bg-error-600 text-white rounded hover:bg-error-700 transition-colors"
          >
            Confirmar
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-2 py-1 text-xs text-error-600 hover:bg-error-100 rounded transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentActions;