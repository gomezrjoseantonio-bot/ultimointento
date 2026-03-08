import React, { useCallback, useRef, useState } from 'react';
import { ArrowLeft, Download, TrendingUp, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  descargarPlantillaImportacionAportaciones,
  importarAportacionesHistoricasMasivas,
} from '../../../services/inversionesAportacionesImportService';

interface ImportarAportacionesProps {
  onComplete: () => void;
  onBack: () => void;
}

const ImportarAportaciones: React.FC<ImportarAportacionesProps> = ({ onComplete, onBack }) => {
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runImport = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const result = await importarAportacionesHistoricasMasivas(file);

      if (result.imported > 0) {
        toast.success(`Importadas ${result.imported} aportaciones históricas.`);
      }

      if (result.errors.length > 0) {
        toast(result.errors[0], { icon: '⚠️' });
      }

      if (result.imported === 0 && result.errors.length === 0) {
        toast('No se detectaron filas para importar.', { icon: 'ℹ️' });
      }

      if (result.imported > 0) onComplete();
    } catch (error) {
      console.error('Error importing aportaciones:', error);
      toast.error('Error al importar aportaciones históricas');
    } finally {
      setImporting(false);
    }
  }, [onComplete]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) runImport(file);
  }, [runImport]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) runImport(file);
    event.target.value = '';
  };

  return (
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
          padding: 0,
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
            backgroundColor: 'var(--n-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TrendingUp size={20} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
            Importar aportaciones históricas
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Migra aportaciones previas para cualquier posición financiera desde Excel.
          </p>
        </div>
      </div>

      <div
        style={{
          border: '1px solid var(--hz-neutral-300)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
          1. Descarga la plantilla
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: 'var(--text-gray)' }}>
          Incluye fecha e importe. Para plan de pensiones/empleo puedes usar importe_empresa y/o importe_individuo.
        </p>
        <button
          onClick={descargarPlantillaImportacionAportaciones}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: '1px solid var(--atlas-blue)',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            color: 'var(--atlas-blue)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-inter)',
          }}
        >
          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
          Descargar plantilla Excel
        </button>
      </div>

      <div
        style={{
          border: '1px solid var(--hz-neutral-300)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
          2. Sube tu archivo de migración
        </h3>
        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !importing && fileInputRef.current?.click()}
          role="button"
          aria-label="Subir archivo Excel de aportaciones"
          tabIndex={0}
          onKeyDown={(event) => event.key === 'Enter' && !importing && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)'}`,
            borderRadius: '10px',
            padding: '40px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            cursor: importing ? 'wait' : 'pointer',
            backgroundColor: dragging ? 'var(--n-100)' : 'var(--bg)',
            transition: 'all 150ms ease',
          }}
        >
          <Upload size={24} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--atlas-navy-1)', fontWeight: 500 }}>
            {importing ? 'Importando…' : 'Arrastra tu Excel aquí o haz clic para seleccionar'}
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-gray)' }}>
            Formatos soportados: .xlsx, .xls
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default ImportarAportaciones;
