import React from 'react';
import { Link2, CheckCircle, XCircle } from 'lucide-react';
import CollapsibleSection from '../CollapsibleSection';

export interface ConciliacionCandidate {
  movimientoId: string;
  importe: number;
  fecha: string;
  concepto: string;
  confianza: 'alta' | 'media' | 'baja';
  cuotaNumero: number;
}

interface ConciliacionSectionProps {
  prestamoId: string;
  candidates: ConciliacionCandidate[];
  onConfirm: (candidato: ConciliacionCandidate) => void;
  onReject: (candidato: ConciliacionCandidate) => void;
}

const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const confianzaStyle = (c: ConciliacionCandidate['confianza']): React.CSSProperties => ({
  color: c === 'alta' ? 'var(--ok)' : c === 'media' ? 'var(--warn)' : 'var(--error)',
});

const ConciliacionSection: React.FC<ConciliacionSectionProps> = ({
  candidates,
  onConfirm,
  onReject,
}) => {
  if (candidates.length === 0) return null;

  const badge = (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: 'rgba(255,193,7,0.15)', color: 'var(--warn)' }}>
      {candidates.length} pendiente{candidates.length !== 1 ? 's' : ''}
    </span>
  );

  return (
    <CollapsibleSection title="Conciliación de movimientos" icon={Link2} badge={badge}>
      <div className="p-6 space-y-3">
        {candidates.map(c => (
          <div key={c.movimientoId}
            className="flex items-center justify-between p-3 border border-gray-100 rounded text-sm gap-3 flex-wrap"
            style={{ backgroundColor: 'var(--bg)' }}>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <div className="font-medium truncate" style={{ color: 'var(--atlas-navy-1)' }}>
                {c.concepto}
              </div>
              <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-gray)' }}>
                <span>{new Date(c.fecha).toLocaleDateString('es-ES')}</span>
                <span>·</span>
                <span>{fmt(c.importe)} €</span>
                <span>·</span>
                <span>Cuota {c.cuotaNumero}</span>
                <span>·</span>
                <span style={confianzaStyle(c.confianza)}>
                  Confianza {c.confianza}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onConfirm(c)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded border"
                style={{ borderColor: 'var(--ok)', color: 'var(--ok)', backgroundColor: 'rgba(40,167,69,0.05)' }}
              >
                <CheckCircle className="h-3 w-3" />
                Confirmar
              </button>
              <button
                onClick={() => onReject(c)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded border"
                style={{ borderColor: 'var(--error)', color: 'var(--error)', backgroundColor: 'rgba(220,53,69,0.05)' }}
              >
                <XCircle className="h-3 w-3" />
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
};

export default ConciliacionSection;
