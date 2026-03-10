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

  const handleDownload = async () => {
    if (onDownload) { onDownload(document); return; }
    try {
      let blob: Blob;
      if (document.content instanceof ArrayBuffer) blob = new Blob([document.content], { type: document.type });
      else if (document.content instanceof Blob) blob = document.content;
      else blob = new Blob([document.content], { type: document.type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = document.filename || 'document';
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch (error) { console.error('Error downloading document:', error); }
  };

  const isAssigned = document.metadata?.inmuebleId || document.metadata?.isPersonal || document.destRef;
  const assignButtonText = isAssigned ? 'Reasignar' : 'Asignar';
  const isFEINDocument = document.documentType === 'fein' || document.subtype?.includes('fein');
  const isCompleteFEIN = document.subtype === 'fein_completa';
  const hasLoanId = document.destRef?.kind === 'prestamo' && document.destRef?.id;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button onClick={() => onView?.(document)} className="p-1.5" style={{ color: 'var(--n-500)' }} title="Ver documento">
        <Eye className="w-4 h-4" />
      </button>

      {!isCompleteFEIN && (
        <button
          onClick={() => onAssign?.(document)}
          className="p-1.5"
          style={{ color: isAssigned ? 'var(--blue)' : 'var(--s-warn)' }}
          title={`${assignButtonText} a inmueble o personal`}
        >
          <FolderOpen className="w-4 h-4" />
        </button>
      )}

      {isFEINDocument && (
        <>
          <button onClick={() => onViewFEINFields?.(document)} className="p-1.5" style={{ color: 'var(--blue)' }} title="Ver campos extraídos de la FEIN">
            <FileText className="w-4 h-4" />
          </button>
          {hasLoanId && (
            <button onClick={() => onOpenInFinanciacion?.(document.destRef.id)} className="p-1.5" style={{ color: 'var(--s-pos)' }} title="Abrir préstamo en Financiación">
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </>
      )}

      <button onClick={handleDownload} className="p-1.5" style={{ color: 'var(--n-500)' }} title="Descargar documento">
        <Download className="w-4 h-4" />
      </button>

      {!showDeleteConfirm ? (
        <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5" style={{ color: 'var(--s-neg)' }} title="Eliminar documento">
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <div className="flex items-center gap-1 p-1" style={{ background: 'var(--s-neg-bg)', borderRadius: 'var(--r-sm)' }}>
          <AlertTriangle className="w-3 h-3" style={{ color: 'var(--s-neg)' }} />
          <button
            onClick={() => { onDelete?.(document.id); setShowDeleteConfirm(false); }}
            className="px-2 py-1 text-xs font-medium"
            style={{ background: 'var(--s-neg)', color: 'var(--white)', borderRadius: 'var(--r-sm)' }}
          >
            Confirmar
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-2 py-1 text-xs"
            style={{ color: 'var(--s-neg)' }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentActions;
