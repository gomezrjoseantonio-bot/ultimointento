// src/pages/account/migracion/ImportarMovimientos.tsx
// TAREA 17 sub-task 17.4: this stub previously rendered a "Próximamente"
// message. The real importer now lives at /tesoreria/importar
// (BankStatementUploadPage). This component just redirects users to it from
// the Migración de Datos sub-tab.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, ArrowLeft, ExternalLink } from 'lucide-react';

interface ImportarMovimientosProps {
  onComplete: () => void;
  onBack: () => void;
}

const ImportarMovimientos: React.FC<ImportarMovimientosProps> = ({ onBack }) => {
  const navigate = useNavigate();

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--navy-900)',
          fontSize: 'var(--t-sm, 0.8125rem)',
          fontWeight: 500,
          padding: 0,
          marginBottom: 20,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        Volver a Migración de Datos
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Banknote size={20} strokeWidth={1.5} color="var(--navy-900)" aria-hidden="true" />
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--t-lg, 1rem)',
              fontWeight: 700,
              color: 'var(--grey-900)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}
          >
            Importar movimientos bancarios
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--t-sm, 0.8125rem)',
              color: 'var(--grey-500)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}
          >
            La importación de extractos vive ahora en Tesorería
          </p>
        </div>
      </div>

      <div
        style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderTop: '3px solid var(--navy-900)',
          borderRadius: 'var(--r-lg)',
          padding: '20px 24px',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}
      >
        <p
          style={{
            margin: 0,
            color: 'var(--grey-700)',
            fontSize: 'var(--t-base, 0.875rem)',
            lineHeight: 1.5,
          }}
        >
          La importación de extractos bancarios (CSV / Excel / Norma 43) se ha
          movido a su página dedicada en Tesorería, con detección automática
          del banco, deduplicación y matching contra previsiones.
        </p>
        <button
          onClick={() => navigate('/tesoreria/importar')}
          style={{
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            border: 'none',
            borderRadius: 'var(--r-md)',
            background: 'var(--navy-900)',
            color: 'var(--white)',
            fontSize: 'var(--t-base, 0.875rem)',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          Ir a Tesorería · Subir extracto
          <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default ImportarMovimientos;
