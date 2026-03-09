// src/pages/account/migracion/ImportarMovimientos.tsx
// ATLAS HORIZON: Stub for bank movements importer

import React from 'react';
import { Banknote, ArrowLeft, Clock } from 'lucide-react';

interface ImportarMovimientosProps {
  onComplete: () => void;
  onBack: () => void;
}

const ImportarMovimientos: React.FC<ImportarMovimientosProps> = ({ onBack }) => (
  <div style={{ fontFamily: 'var(--font-inter)' }}>
    <button
      onClick={onBack}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--atlas-blue)',
        fontSize: '0.875rem',
        fontWeight: 500,
        padding: '0',
        marginBottom: '20px',
        fontFamily: 'var(--font-inter)',
      }}
    >
      <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
      Volver a Migración de Datos
    </button>

    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: 'var(--ok-light, #E8F8EF)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Banknote size={20} strokeWidth={1.5} style={{ color: 'var(--ok)' }} aria-hidden="true" />
      </div>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
          Importar movimientos bancarios
        </h2>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
          Importa movimientos históricos desde CSV o Excel
        </p>
      </div>
    </div>

    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '48px 24px',
        border: '1px dashed var(--hz-neutral-300)',
        borderRadius: '12px',
        color: 'var(--text-gray)',
        textAlign: 'center',
      }}
    >
      <Clock size={40} strokeWidth={1.5} style={{ color: 'var(--hz-neutral-300)' }} aria-hidden="true" />
      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
        Próximamente
      </p>
      <p style={{ margin: 0, fontSize: '0.875rem' }}>
        El importador de movimientos bancarios estará disponible en la próxima versión.
      </p>
    </div>
  </div>
);

export default ImportarMovimientos;
