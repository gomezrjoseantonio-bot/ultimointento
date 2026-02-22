// src/pages/account/migracion/ImportarValoraciones.tsx
// ATLAS HORIZON: Excel importer for historical valuations

import React, { useCallback, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, TrendingUp, ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { valoracionesService } from '../../../services/valoracionesService';

interface ImportarValoracionesProps {
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewRow {
  fecha: string;
  tipo_activo: string;
  activo_nombre: string;
  valor: number;
}

const PREVIEW_ROW_LIMIT = 10;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const TIPO_COLORS: Record<string, string> = {
  inmueble: 'var(--atlas-blue)',
  inversion: 'var(--ok)',
};

const ImportarValoraciones: React.FC<ImportarValoracionesProps> = ({ onComplete, onBack }) => {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ───────────────────────────────────────────────────────

  const handleDescargarPlantilla = () => {
    const datos = [
      { fecha: '2024-01', tipo_activo: 'inmueble', activo_nombre: 'Piso Madrid', valor: 250000 },
      { fecha: '2024-01', tipo_activo: 'inversion', activo_nombre: 'Fondo Indexado', valor: 15000 },
      { fecha: '2024-02', tipo_activo: 'inmueble', activo_nombre: 'Piso Madrid', valor: 252000 },
      { fecha: '2024-02', tipo_activo: 'inversion', activo_nombre: 'Fondo Indexado', valor: 15500 },
    ];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Valoraciones');
    XLSX.writeFile(wb, 'plantilla-valoraciones-atlas.xlsx');
    toast.success('Plantilla descargada correctamente');
  };

  // ── File parsing ────────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Formato no válido. Usa .xlsx o .xls');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        // Validate structure
        if (!rows.length) {
          toast.error('El archivo está vacío');
          return;
        }

        const required = ['fecha', 'tipo_activo', 'activo_nombre', 'valor'];
        const keys = Object.keys(rows[0] || {});
        const missing = required.filter((r) => !keys.includes(r));
        if (missing.length) {
          toast.error(`Columnas requeridas: ${missing.join(', ')}`);
          return;
        }

        const parsed: PreviewRow[] = rows.map((row) => ({
          fecha: String(row.fecha || '').trim(),
          tipo_activo: String(row.tipo_activo || '').trim().toLowerCase(),
          activo_nombre: String(row.activo_nombre || '').trim(),
          valor: Number(row.valor) || 0,
        }));

        setPreview(parsed);
      } catch (err) {
        console.error('Error parsing file:', err);
        toast.error('Error al leer el archivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImportar = async () => {
    if (!preview?.length) return;
    setImporting(true);
    try {
      const validRows = preview.filter(
        (r) =>
          r.fecha &&
          (r.tipo_activo === 'inmueble' || r.tipo_activo === 'inversion') &&
          r.activo_nombre &&
          r.valor > 0
      );

      if (!validRows.length) {
        toast.error('No hay filas válidas para importar');
        return;
      }

      const importados = await valoracionesService.importarHistorico(
        validRows.map((r) => ({
          fecha: r.fecha,
          tipo_activo: r.tipo_activo as 'inmueble' | 'inversion',
          activo_nombre: r.activo_nombre,
          valor: r.valor,
        }))
      );

      toast.success(`${importados} valoraciones importadas correctamente`);
      setPreview(null);
      onComplete();
    } catch (err) {
      console.error('Error importing:', err);
      toast.error('Error al importar las valoraciones');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Back button */}
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

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--atlas-blue-light, #EBF3FF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TrendingUp size={20} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
            Importar valoraciones históricas
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Importa el histórico de valoraciones mensuales desde Excel
          </p>
        </div>
      </div>

      {/* Step 1: Download template */}
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
          Usa nuestra plantilla con el formato correcto: fecha (YYYY-MM), tipo_activo, activo_nombre, valor.
        </p>
        <button
          onClick={handleDescargarPlantilla}
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

      {/* Step 2: Upload */}
      {!preview && (
        <div
          style={{
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
            2. Sube tu archivo
          </h3>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Subir archivo Excel"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)'}`,
              borderRadius: '10px',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              backgroundColor: dragging ? 'var(--atlas-blue-light, #EBF3FF)' : 'var(--bg)',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            <Upload size={32} strokeWidth={1.5} style={{ color: dragging ? 'var(--atlas-blue)' : 'var(--text-gray)' }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--atlas-navy-1)' }}>
              Arrastra tu archivo aquí o{' '}
              <span style={{ color: 'var(--atlas-blue)', textDecoration: 'underline' }}>haz clic para seleccionar</span>
            </p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
              Formatos admitidos: .xlsx, .xls
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Step 3: Preview */}
      {preview && (
        <div
          style={{
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              3. Vista previa ({preview.length} filas)
            </h3>
            <button
              onClick={() => setPreview(null)}
              aria-label="Cancelar importación"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-gray)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-inter)',
              }}
            >
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
              Cancelar
            </button>
          </div>

          {/* Validation warning */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: 'var(--atlas-blue-light, #EBF3FF)',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)', flexShrink: 0 }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>
              Solo se importarán filas donde el nombre del activo coincida exactamente con los activos registrados en ATLAS.
            </p>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {['Fecha', 'Tipo', 'Activo', 'Valor'].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: 'var(--text-gray)',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--hz-neutral-300)',
                      backgroundColor: i % 2 === 0 ? 'var(--bg)' : 'var(--atlas-blue-light, #f9fafb)',
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.fecha}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: `${TIPO_COLORS[row.tipo_activo] || 'var(--text-gray)'}20`,
                          color: TIPO_COLORS[row.tipo_activo] || 'var(--text-gray)',
                        }}
                      >
                        {row.tipo_activo}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>{row.activo_nombre}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {formatCurrency(row.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > PREVIEW_ROW_LIMIT && (
              <p style={{ padding: '8px 12px', margin: 0, fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                ... y {preview.length - PREVIEW_ROW_LIMIT} filas más
              </p>
            )}
          </div>

          {/* Import button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={handleImportar}
              disabled={importing}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: importing ? 'var(--hz-neutral-300)' : 'var(--atlas-blue)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: importing ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-inter)',
              }}
            >
              {importing ? 'Importando...' : `Importar ${preview.length} valoraciones`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarValoraciones;
