import React from 'react';

interface InboxDocumentListProps {
  documents: any[];
  selectedId?: number;
  onSelect: (doc: any) => void;
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

const InboxV3DocumentList: React.FC<InboxDocumentListProps> = ({ documents, selectedId, onSelect }) => {
  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--surface-card)' }}>
      {documents.map((doc) => {
        const type = normalizeType(doc);
        const status = normalizeStatus(doc);
        const isSelected = doc.id === selectedId;

        return (
          <button
            key={doc.id}
            type="button"
            onClick={() => onSelect(doc)}
            className="w-full text-left px-4 py-3 border-b"
            style={{
              borderColor: 'var(--n-100)',
              background: isSelected ? 'var(--n-100)' : 'var(--white)',
              fontFamily: 'var(--font-base)'
            }}
          >
            <p className="text-sm font-medium truncate" style={{ color: 'var(--n-900)' }}>
              {doc.filename}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={typeChipClass[type]}>{type}</span>
              <span className={statusChipClass[status]}>{status}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default InboxV3DocumentList;
