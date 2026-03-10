import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, FileText, FileSpreadsheet, FileSignature } from 'lucide-react';

interface InboxDocumentListProps {
  documents: any[];
  selectedId?: number;
  onSelect: (doc: any) => void;
  onDelete?: (doc: any) => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

const typeChipClass: Record<string, string> = {
  invoice:  'atlas-chip-active',
  recibo:   'atlas-chip-neutral',
  contrato: 'atlas-chip-default',
};

const statusChipClass: Record<string, string> = {
  pendiente: 'atlas-chip-warning',
  procesado: 'atlas-chip-positive',
  error:     'atlas-chip-negative',
};

const typeLabel: Record<string, string> = {
  invoice:  'Factura',
  recibo:   'Recibo',
  contrato: 'Contrato',
};

const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const props = { size: 16, style: { color: 'var(--n-500)', flexShrink: 0 } } as const;
  if (type === 'contrato') return <FileSignature {...props} />;
  if (type === 'recibo')   return <FileSpreadsheet {...props} />;
  return <FileText {...props} />;
};

const normalizeType = (doc: any): 'invoice' | 'recibo' | 'contrato' => {
  const raw = (doc.metadata?.tipo || doc.type || '').toLowerCase();
  if (raw.includes('contrato')) return 'contrato';
  if (raw.includes('recibo'))   return 'recibo';
  return 'invoice';
};

const normalizeStatus = (doc: any): 'pendiente' | 'procesado' | 'error' => {
  const raw = (doc.metadata?.queueStatus || doc.status || '').toLowerCase();
  if (raw.includes('error'))     return 'error';
  if (raw.includes('procesado')) return 'procesado';
  return 'pendiente';
};

const formatBytes = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (raw?: string): string => {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return raw;
  }
};

const formatEuro = (value?: number | string): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!n || isNaN(n)) return '';
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
};

// ─── kebab menu ─────────────────────────────────────────────────────────────

interface KebabMenuProps {
  onDelete: () => void;
}

const KebabMenu: React.FC<KebabMenuProps> = ({ onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Más opciones"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 transition-colors"
        style={{ color: 'var(--n-500)', borderRadius: 'var(--r-sm)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--n-900)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--n-500)')}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 py-1"
          style={{
            top: 'calc(100% + 4px)',
            minWidth: 160,
            background: 'var(--white)',
            border: '1px solid var(--n-200)',
            borderRadius: 'var(--r-md)',
            boxShadow: '0 4px 12px rgba(0,0,0,.08)',
          }}
        >
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
            style={{ color: 'var(--s-neg)', fontFamily: 'var(--font-base)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--s-neg-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={14} />
            Eliminar documento
          </button>
        </div>
      )}
    </div>
  );
};

// ─── delete confirmation modal ───────────────────────────────────────────────

interface DeleteModalProps {
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ filename, onConfirm, onCancel }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ background: 'rgba(26,35,50,.45)' }}
    onClick={onCancel}
  >
    <div
      className="w-full max-w-sm mx-4 p-6"
      style={{
        background: 'var(--white)',
        borderRadius: 'var(--r-lg)',
        boxShadow: '0 16px 40px rgba(0,0,0,.18)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center w-10 h-10 mb-4"
        style={{ background: 'var(--s-neg-bg)', borderRadius: 'var(--r-md)' }}
      >
        <Trash2 size={20} style={{ color: 'var(--s-neg)' }} />
      </div>

      <p
        className="text-base font-semibold mb-1"
        style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)' }}
      >
        ¿Eliminar documento?
      </p>
      <p
        className="text-sm mb-6 truncate"
        style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}
        title={filename}
      >
        {filename}
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          className="atlas-btn-secondary flex-1"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="flex-1 px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: 'var(--s-neg)',
            color: 'var(--white)',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-base)',
          }}
          onClick={onConfirm}
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
);

// ─── main component ──────────────────────────────────────────────────────────

const InboxV3DocumentList: React.FC<InboxDocumentListProps> = ({
  documents,
  selectedId,
  onSelect,
  onDelete,
}) => {
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);

  const handleConfirmDelete = () => {
    if (pendingDelete && onDelete) {
      onDelete(pendingDelete);
    }
    setPendingDelete(null);
  };

  return (
    <>
      <div
        className="h-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: 'var(--surface-card)' }}
      >
        {documents.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center"
            style={{ color: 'var(--n-500)' }}
          >
            <FileText size={32} style={{ color: 'var(--n-300)' }} />
            <p className="text-sm" style={{ fontFamily: 'var(--font-base)' }}>
              No hay documentos
            </p>
          </div>
        )}

        {documents.map((doc) => {
          const type   = normalizeType(doc);
          const status = normalizeStatus(doc);
          const isSelected = doc.id === selectedId;

          // Metadata — try multiple paths
          const fecha   = formatDate(doc.metadata?.fecha || doc.createdAt || doc.uploadedAt);
          const importe = formatEuro(
            doc.metadata?.ocr?.data?.importe_total ||
            doc.metadata?.importe ||
            doc.amount
          );
          const size = formatBytes(doc.size || doc.metadata?.size);

          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => onSelect(doc)}
              className="w-full text-left px-4 py-3 border-b transition-colors"
              style={{
                borderColor: 'var(--n-100)',
                background: isSelected ? 'var(--n-100)' : 'var(--white)',
                fontFamily: 'var(--font-base)',
                cursor: 'pointer',
              }}
            >
              {/* Row: icon + content + kebab */}
              <div className="flex items-start gap-2">
                {/* File type icon */}
                <div className="mt-0.5 flex-shrink-0">
                  <TypeIcon type={type} />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {/* Filename */}
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--n-900)' }}
                    title={doc.filename}
                  >
                    {doc.filename}
                  </p>

                  {/* Metadata row */}
                  {(fecha || importe || size) && (
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: 'var(--n-500)' }}
                    >
                      {[fecha, importe, size].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {/* Chips */}
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className={typeChipClass[type]}>{typeLabel[type]}</span>
                    <span className={statusChipClass[status]}>{status}</span>
                  </div>
                </div>

                {/* Kebab */}
                {onDelete && (
                  <KebabMenu onDelete={() => setPendingDelete(doc)} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <DeleteModal
          filename={pendingDelete.filename}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
};

export default InboxV3DocumentList;
