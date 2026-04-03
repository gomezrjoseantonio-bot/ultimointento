// src/pages/account/migracion/ImportarNominas.tsx
// ATLAS HORIZON: Excel importer for payroll records

import React, { useCallback, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, Receipt, ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { nominaService } from '../../../services/nominaService';
import { initDB } from '../../../services/db';
import { getBaseMaxima, getSSDefaults } from '../../../constants/cotizacionSS';

interface ImportarNominasProps {
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewRow {
  ano: number;
  mes: number;
  empresa: string;
  nif_empresa: string;
  salario_bruto: number;
  complementos: number;
  horas_extra: number;
  retencion_irpf: number;
  cotizacion_ss_trabajador: number;
  cotizacion_ss_empresa: number;
  salario_neto: number;
}

const PREVIEW_ROW_LIMIT = 10;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const normalizeHeader = (header: string): string =>
  header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  const normalized = String(value || '')
    .replace(/€/g, '')
    .replace(/%/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MESES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

const ImportarNominas: React.FC<ImportarNominasProps> = ({ onComplete, onBack }) => {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ───────────────────────────────────────────────────────

  const handleDescargarPlantilla = () => {
    const datos = [
      {
        año: 2024,
        mes: 1,
        empresa: 'Empresa ABC S.L.',
        nif_empresa: 'B12345678',
        salario_bruto: 2800,
        complementos: 200,
        horas_extra: 0,
        retencion_irpf: 15,
        cotizacion_ss_trabajador: 178.50,
        cotizacion_ss_empresa: 850,
        salario_neto: 2201.50,
      },
      {
        año: 2024,
        mes: 2,
        empresa: 'Empresa ABC S.L.',
        nif_empresa: 'B12345678',
        salario_bruto: 2800,
        complementos: 200,
        horas_extra: 150,
        retencion_irpf: 15,
        cotizacion_ss_trabajador: 178.50,
        cotizacion_ss_empresa: 850,
        salario_neto: 2328.50,
      },
      {
        año: 2024,
        mes: 3,
        empresa: 'Empresa ABC S.L.',
        nif_empresa: 'B12345678',
        salario_bruto: 2800,
        complementos: 200,
        horas_extra: 0,
        retencion_irpf: 15,
        cotizacion_ss_trabajador: 178.50,
        cotizacion_ss_empresa: 850,
        salario_neto: 2201.50,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nominas');
    XLSX.writeFile(wb, 'plantilla-nominas-atlas.xlsx');
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
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) {
          toast.error('El archivo está vacío');
          return;
        }

        const keys = Object.keys(rows[0]).map(normalizeHeader);
        const required = ['ano', 'mes', 'salario_bruto'];
        // Also accept "año" → normalized to "ano"
        const missing = required.filter((r) => !keys.includes(r));
        if (missing.length) {
          toast.error(`Columnas requeridas: ${missing.join(', ')}`);
          return;
        }

        const parsed: PreviewRow[] = rows.map((row) => {
          const byKey = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])
          );
          return {
            ano: Number(byKey.ano) || 0,
            mes: Number(byKey.mes) || 0,
            empresa: String(byKey.empresa || '').trim(),
            nif_empresa: String(byKey.nif_empresa || '').trim(),
            salario_bruto: parseNumber(byKey.salario_bruto),
            complementos: parseNumber(byKey.complementos),
            horas_extra: parseNumber(byKey.horas_extra),
            retencion_irpf: parseNumber(byKey.retencion_irpf),
            cotizacion_ss_trabajador: parseNumber(byKey.cotizacion_ss_trabajador),
            cotizacion_ss_empresa: parseNumber(byKey.cotizacion_ss_empresa),
            salario_neto: parseNumber(byKey.salario_neto),
          };
        });

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
        (r) => r.ano > 0 && r.mes >= 1 && r.mes <= 12 && r.salario_bruto > 0
      );

      if (!validRows.length) {
        toast.error('No hay filas válidas para importar');
        return;
      }

      // Resolve default account for cuentaAbono
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      const defaultCuentaAbono = allAccounts[0]?.id ? Number(allAccounts[0].id) : 0;

      // Group by empresa+nif+año to create one Nomina per employer-year combination
      const groups = new Map<string, PreviewRow[]>();
      for (const row of validRows) {
        const empresaKey = row.empresa || 'Sin empresa';
        const nifKey = row.nif_empresa || 'Sin NIF';
        const key = `${empresaKey}__${nifKey}__${row.ano}`;
        const existing = groups.get(key) || [];
        existing.push(row);
        groups.set(key, existing);
      }

      let importados = 0;

      for (const [, rows] of groups) {
        const first = rows[0];
        // Include complementos + horas_extra in the total bruto calculation
        const avgBrutoMensual = rows.reduce((sum, r) => sum + r.salario_bruto + r.complementos + r.horas_extra, 0) / rows.length;
        const salarioBrutoAnual = avgBrutoMensual * 12;
        const irpfPct = rows.reduce((sum, r) => sum + r.retencion_irpf, 0) / rows.length;

        const currentYear = first.ano || new Date().getFullYear();
        const ssConfig = getSSDefaults(currentYear);

        await nominaService.saveNomina({
          personalDataId: 1,
          titular: 'yo',
          nombre: first.empresa || 'Empresa importada',
          fechaAntiguedad: `${first.ano}-01-01`,
          salarioBrutoAnual,
          distribucion: { tipo: 'doce', meses: 12 },
          variables: [],
          bonus: [],
          beneficiosSociales: [],
          retencion: {
            irpfPorcentaje: Number.isFinite(irpfPct) ? irpfPct : 15,
            ss: {
              baseCotizacionMensual: getBaseMaxima(currentYear),
              contingenciasComunes: ssConfig.contingenciasComunes.trabajador,
              desempleo: ssConfig.desempleo.trabajador,
              formacionProfesional: ssConfig.formacionProfesional.trabajador,
              mei: ssConfig.mei.trabajador,
              overrideManual: false,
            },
          },
          deduccionesAdicionales: [],
          cuentaAbono: defaultCuentaAbono,
          reglaCobroDia: { tipo: 'ultimo-habil' },
          activa: true,
        });

        importados++;
      }

      toast.success(`${importados} nóminas importadas correctamente`);
      setPreview(null);
      onComplete();
    } catch (err) {
      console.error('Error importing:', err);
      toast.error('Error al importar las nóminas');
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
            backgroundColor: 'var(--navy-700-light, #E8EAF0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Receipt size={20} strokeWidth={1.5} style={{ color: 'var(--navy-700, var(--atlas-navy-1))' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
            Importar nóminas
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Importa el histórico de nóminas desde Excel
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
          Usa nuestra plantilla con el formato correcto: año, mes, salario_bruto y campos opcionales de retenciones.
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
              Las filas se agruparán por empresa y año. Se creará una configuración de nómina por cada combinación empresa-año.
            </p>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {['Año', 'Mes', 'Empresa', 'Bruto', 'IRPF', 'Neto'].map((col) => (
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
                      {row.ano}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>
                      {MESES[row.mes] || row.mes}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>
                      {row.empresa || '-'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {formatCurrency(row.salario_bruto)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {row.retencion_irpf}%
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {formatCurrency(row.salario_neto)}
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
              {importing ? 'Importando...' : `Importar ${preview.length} nóminas`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarNominas;
