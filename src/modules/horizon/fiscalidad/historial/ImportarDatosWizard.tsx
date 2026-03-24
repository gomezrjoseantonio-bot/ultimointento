import React, { useState } from 'react';
import { FileText, Image, Edit3 } from 'lucide-react';
import ImportarDeclaracionWizard from '../historico/ImportarDeclaracionWizard';
import ImportarDatosFiscalesWizard from './ImportarDatosFiscalesWizard';

type TipoImportacion = 'pdf' | 'capturas' | 'manual' | null;

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1200,
  background: 'rgba(255,255,255,0.8)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid var(--n-200)',
  borderRadius: 'var(--r-xl, 20px)',
  padding: '2rem',
  maxWidth: '640px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--n-200)',
  borderRadius: 'var(--r-lg, 16px)',
  padding: '1.25rem',
  cursor: 'pointer',
  background: 'white',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '1rem',
  transition: 'border-color 0.15s',
};

const cards: Array<{ tipo: TipoImportacion; icon: React.ReactNode; title: string; description: string }> = [
  {
    tipo: 'pdf',
    icon: <FileText size={24} color="var(--n-500)" />,
    title: 'Declaración IRPF',
    description: 'PDF del Modelo 100 (rentas 2020–2025)',
  },
  {
    tipo: 'capturas',
    icon: <Image size={24} color="var(--n-500)" />,
    title: 'Datos fiscales AEAT',
    description: 'Capturas de la web de Hacienda (PNG/JPG)',
  },
  {
    tipo: 'manual',
    icon: <Edit3 size={24} color="var(--n-500)" />,
    title: 'Formulario manual',
    description: 'Introduce las casillas clave directamente',
  },
];

const subtitles: Record<string, string> = {
  pdf: 'PDF del Modelo 100',
  capturas: 'Capturas de la web de Hacienda',
  manual: 'Introduce las casillas clave directamente',
};

const ImportarDatosWizard: React.FC<Props> = ({ onClose, onImported }) => {
  const [tipo, setTipo] = useState<TipoImportacion>(null);

  const handleBack = () => setTipo(null);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h1 style={{
          margin: '0 0 0.25rem',
          fontSize: 'var(--t-lg, 1.125rem)',
          fontWeight: 500,
          color: 'var(--n-900)',
          fontFamily: 'IBM Plex Sans, sans-serif',
        }}>
          Importar datos fiscales
        </h1>
        <p style={{
          margin: '0 0 1.5rem',
          fontSize: 'var(--t-sm, 0.875rem)',
          color: 'var(--n-500)',
        }}>
          {tipo ? subtitles[tipo] : '¿Qué quieres importar?'}
        </p>

        {/* ── Type selection ──────────────────────────────── */}
        {!tipo && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {cards.map((card) => (
              <button
                key={card.tipo}
                type="button"
                onClick={() => setTipo(card.tipo)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--n-300)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--n-200)'; }}
                style={cardStyle}
              >
                <div style={{ flexShrink: 0, marginTop: '2px' }}>{card.icon}</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{
                    fontWeight: 600, fontSize: 'var(--t-sm, 0.875rem)',
                    color: 'var(--n-900)',
                  }}>
                    {card.title}
                  </div>
                  <div style={{
                    fontSize: 'var(--t-xs, 0.75rem)',
                    color: 'var(--n-500)', marginTop: '0.25rem',
                  }}>
                    {card.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Sub-wizard: PDF declaration ─────────────────── */}
        {tipo === 'pdf' && (
          <ImportarDeclaracionWizard
            embedded
            defaultMethod="pdf"
            onClose={onClose}
            onImported={onImported}
            onBack={handleBack}
          />
        )}

        {/* ── Sub-wizard: AEAT screenshots ────────────────── */}
        {tipo === 'capturas' && (
          <ImportarDatosFiscalesWizard
            embedded
            onClose={onClose}
            onImported={onImported}
            onBack={handleBack}
          />
        )}

        {/* ── Sub-wizard: Manual form ─────────────────────── */}
        {tipo === 'manual' && (
          <ImportarDeclaracionWizard
            embedded
            defaultMethod="formulario"
            onClose={onClose}
            onImported={onImported}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default ImportarDatosWizard;
