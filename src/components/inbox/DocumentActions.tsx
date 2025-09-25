// Document Actions Component for Bandeja de entrada
// Provides Ver, Asignar/Reasignar, Eliminar (with confirmation), Descargar actions

import React, { useState } from 'react';
import { Eye, FolderOpen, Trash2, Download, AlertTriangle, FileText, ExternalLink } from 'lucide-react';

interface DocumentActionsProps {
  document: any;
  onView?: (document: any) => void;
  onAssign?: (document: any) => void;
  onDelete?: (documentId: number) => void;
  onDownload?: (document: any) => void;
  onViewFEINFields?: (document: any) => void;
  onOpenInFinanciacion?: (loanId: string) => void;
  className?: string;
}

const DocumentActions: React.FC<DocumentActionsProps> = ({
  document,
  onView,
  onAssign,
  onDelete,
  onDownload,
  onViewFEINFields,
  onOpenInFinanciacion,
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

  const isAssigned = document.metadata?.inmuebleId || document.metadata?.isPersonal || document.destRef;
  const assignButtonText = isAssigned ? 'Reasignar' : 'Asignar';
  const isFEINDocument = document.documentType === 'fein' || document.subtype?.includes('fein');
  const isCompleteFEIN = document.subtype === 'fein_completa';
  const hasLoanId = document.destRef?.kind === 'prestamo' && document.destRef?.id;

  const handleViewFEINFields = () => {
    if (onViewFEINFields) {
      onViewFEINFields(document);
    }
  };

  const handleOpenInFinanciacion = () => {
    if (onOpenInFinanciacion && hasLoanId) {
      onOpenInFinanciacion(document.destRef.id);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Ver */}
      <button
        onClick={handleView}
        className="p-1.5 text-neutral-600 hover:text-neutral-800"
            title="Ver documento"
          >
        <Eye className="w-4 h-4" />
      </button>

      {/* Asignar/Reasignar - Hide for completed FEIN documents */}
      {!isCompleteFEIN && (
        <button
          onClick={handleAssign}
          className={`p-1.5 ${
            isAssigned 
              ? 'text-primary-600 hover:text-primary-800 
              : 'text-warning-600 hover:text-orange-800'          }`}
          title={`${assignButtonText} a inmueble o personal`}
        >
          <FolderOpen className="w-4 h-4" />
        </button>
      )}

      {/* FEIN-specific actions */}
      {isFEINDocument && (
        <>
          {/* Ver campos FEIN */}
          <button
            onClick={handleViewFEINFields}
            className="btn-primary-horizon p-1.5 text-blue-600 hover:text-blue-800 hover:"
            title="Ver campos extraídos de la FEIN"
          >
            <FileText className="w-4 h-4" />
          </button>
          
          {/* Abrir en Financiación - Only for completed FEIN with loan */}
          {hasLoanId && (
            <button
              onClick={handleOpenInFinanciacion}
              className="btn-accent-horizon p-1.5 text-green-600 hover:text-green-800 hover:"
            title="Abrir préstamo en Financiación"
          >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </>
      )}

      {/* Descargar */}
      <button
        onClick={handleDownload}
        className="p-1.5 text-neutral-600 hover:text-neutral-800"
            title="Descargar documento"
          >
        <Download className="w-4 h-4" />
      </button>

      {/* Eliminar */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-1.5 text-error-600 hover:text-error-800"
            title="Eliminar documento"
          >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <div className="flex items-center gap-1 bg-error-50 p-1">
          <AlertTriangle className="w-3 h-3 text-error-600" />
          <button
            onClick={handleDeleteConfirm}
            className="px-2 py-1 text-xs bg-error-600 rounded"
          >
            Confirmar
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-2 py-1 text-xs text-error-600 rounded"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentActions;