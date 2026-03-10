import React from 'react';
import { Trash2 } from 'lucide-react';

interface InboxDocumentListProps {
  documents: any[];
  selectedId?: number;
  onSelect: (doc: any) => void;
  onDelete?: (doc: any) => void;
}

const typeChipClass: Record<string, string> = {
  invoice: 'atlas-chip-active',
  recibo: 'atlas-chip-neutral',
  contrato: 'atlas-chip-default'
};

const statusChipClass: Record<string, string> = {
  pendiente: 'atlas-chip-warning',
  procesado: 'atlas-chip-positive',
  error: 'atlas-chip-negative'
};

const normalizeType = (doc: any): 'invoice' | 'recibo' | 'contrato' => {
  const rawType = (doc.metadata?.tipo || '').toLowerCase();
  if (rawType.includes('contrato')) return 'contrato';
  if (rawType.includes('recibo')) return 'recibo';
  return 'invoice';
};

const normalizeStatus = (doc: any): 'pendiente' | 'procesado' | 'error' => {
  const rawStatus = (doc.metadata?.queueStatus || '').toLowerCase();
  if (rawStatus.includes('error')) return 'error';
  if (rawStatus.includes('procesado')) return 'procesado';
  return 'pendiente';
};

const InboxV3DocumentList: React.FC<InboxDocumentListProps> = ({ documents, selectedId, onSelect, onDelete }) => {
  return (
    <div
      className="h-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ background: 'var(--surface-card)' }}
    >
      {documents.map((doc) => {
        const type = normalizeType(doc);
        const status = normalizeStatus(doc);
        const isSelected = doc.id === selectedId;

        return (
          <div
            key={doc.id}
            className="w-full px-4 py-3 border-b"
            style={{
              borderColor: 'var(--n-100)',
              background: isSelected ? 'var(--n-100)' : 'var(--white)',
              fontFamily: 'var(--font-base)'
            }}
          >
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => onSelect(doc)} className="flex-1 text-left min-w-0">
                <p className="text-base font-semibold truncate" style={{ color: 'var(--n-900)' }}>
                  {doc.filename}
                </p>
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(doc)}
                  className="p-1"
                  style={{ color: 'var(--n-500)' }}
                  title="Eliminar documento"
                  aria-label="Eliminar documento"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={typeChipClass[type]}>{type}</span>
              <span className={statusChipClass[status]}>{status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InboxV3DocumentList;
