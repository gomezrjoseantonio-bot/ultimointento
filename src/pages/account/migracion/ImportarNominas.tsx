// src/pages/account/migracion/ImportarNominas.tsx
// ATLAS HORIZON: Excel importer for payroll engine configuration

import React, { useCallback, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, Receipt, ArrowLeft, AlertCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { nominaService } from '../../../services/nominaService';
import { initDB } from '../../../services/db';
import { getBaseMaxima, getSSDefaults } from '../../../constants/cotizacionSS';

interface ImportarNominasProps {
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewRow {
  nombre: string;
  titular: string;
  salario_bruto_anual: number;
  irpf_porcentaje: number;
  distribucion_pagas: number;
  activa: boolean;
  // Keep raw row for import
  _raw: Record<string, unknown>;
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

type BeneficioTipo = 'seguro-vida' | 'seguro-medico' | 'cheque-guarderia'
  | 'gasolina' | 'vehiculo-empresa' | 'telefono' | 'formacion'
  | 'conciliacion' | 'otro';

const uid = (): string => crypto.randomUUID();

const mapBeneficioTipo = (raw: string): BeneficioTipo => {
  const map: Record<string, BeneficioTipo> = {
    seguro_medico: 'seguro-medico',
    guarderia: 'cheque-guarderia',
    vehiculo: 'vehiculo-empresa',
    otros: 'otro',
  };
  return map[raw] || 'otro';
};

const buildNominaFromRow = (byKey: Record<string, unknown>) => {
  const currentYear = new Date().getFullYear();
  const ssConfig = getSSDefaults(currentYear);

  const variables = [1, 2, 3].flatMap(n => {
    const nombre = String(byKey[`variable_${n}_nombre`] || '').trim();
    const importe = parseNumber(byKey[`variable_${n}_importe`]);
    if (!nombre || !importe) return [];
    const mesesRaw = String(byKey[`variable_${n}_meses`] || 'todos').trim().toLowerCase();
    const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const meses = mesesRaw === 'todos'
      ? ALL_MONTHS
      : [...new Set(mesesRaw.split(',').map(Number).filter(m => m >= 1 && m <= 12))];
    if (!meses.length) return [];
    return [{
      id: uid(),
      nombre,
      tipo: 'importe' as const,
      valor: importe,
      distribucionMeses: meses.map(mes => ({ mes, porcentaje: 100 / meses.length })),
    }];
  });

  const bonus = [1, 2].flatMap(n => {
    const descripcion = String(byKey[`bonus_${n}_descripcion`] || '').trim();
    const importe = parseNumber(byKey[`bonus_${n}_importe`]);
    const mes = Number(byKey[`bonus_${n}_mes`]) || 0;
    if (!descripcion || !importe || !mes) return [];
    return [{ id: uid(), descripcion, importe, mes }];
  });

  const beneficiosSociales = [1, 2].flatMap(n => {
    const tipo = String(byKey[`beneficio_${n}_tipo`] || '').trim();
    const importe = parseNumber(byKey[`beneficio_${n}_importe`]);
    if (!tipo || !importe) return [];
    const tipoMapped = mapBeneficioTipo(tipo);
    return [{
      id: uid(),
      concepto: tipo.replace(/_/g, ' '),
      tipo: tipoMapped,
      importeMensual: importe,
      incrementaBaseIRPF: tipoMapped !== 'cheque-guarderia',
    }];
  });

  const deduccionesAdicionales = [1, 2].flatMap(n => {
    const concepto = String(byKey[`deduccion_${n}_concepto`] || '').trim();
    const importe = parseNumber(byKey[`deduccion_${n}_importe`]);
    if (!concepto || !importe) return [];
    return [{
      id: uid(),
      concepto,
      importeMensual: importe,
      esRecurrente: String(byKey[`deduccion_${n}_recurrente`] || 'TRUE').toUpperCase() !== 'FALSE',
    }];
  });

  const pensionesEmpresa = parseNumber(byKey.plan_pensiones_empresa_importe);
  const pensionesEmpleado = parseNumber(byKey.plan_pensiones_empleado_importe);
  const planPensiones = (pensionesEmpresa !== 0 || pensionesEmpleado !== 0) ? {
    aportacionEmpresa: {
      tipo: 'importe' as const,
      valor: pensionesEmpresa,
    },
    aportacionEmpleado: {
      tipo: 'importe' as const,
      valor: pensionesEmpleado,
    },
  } : undefined;

  const distPagasRaw = Number(byKey.distribucion_pagas) || 12;
  const distPagas = distPagasRaw === 14 ? 14 : 12;

  return {
    personalDataId: 1,
    nombre: String(byKey.nombre || '').trim(),
    titular: (String(byKey.titular || 'yo').trim().toLowerCase() === 'pareja' ? 'pareja' : 'yo') as 'yo' | 'pareja',
    salarioBrutoAnual: parseNumber(byKey.salario_bruto_anual),
    distribucion: {
      tipo: (distPagas === 14 ? 'catorce' : 'doce') as 'doce' | 'catorce',
      meses: distPagas,
    },
    fechaAntiguedad: String(byKey.fecha_antiguedad || new Date().toISOString().split('T')[0]).trim(),
    retencion: {
      irpfPorcentaje: parseNumber(byKey.irpf_porcentaje),
      ss: {
        baseCotizacionMensual: getBaseMaxima(currentYear),
        contingenciasComunes: ssConfig.contingenciasComunes.trabajador,
        desempleo: ssConfig.desempleo.trabajador,
        formacionProfesional: ssConfig.formacionProfesional.trabajador,
        mei: ssConfig.mei.trabajador,
        overrideManual: false,
      },
    },
    variables,
    bonus,
    beneficiosSociales,
    planPensiones,
    deduccionesAdicionales,
    cuentaAbono: 0,
    reglaCobroDia: { tipo: 'ultimo-habil' as const },
    activa: String(byKey.activa || 'TRUE').toUpperCase() !== 'FALSE',
  };
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
        nombre: 'Orange España',
        titular: 'yo',
        salario_bruto_anual: 42000,
        distribucion_pagas: 14,
        fecha_antiguedad: '2018-03-01',
        variable_1_nombre: 'Comisiones',
        variable_1_importe: 3000,
        variable_1_meses: 'todos',
        variable_2_nombre: '',
        variable_2_importe: '',
        variable_2_meses: '',
        variable_3_nombre: '',
        variable_3_importe: '',
        variable_3_meses: '',
        bonus_1_descripcion: 'Paga extra navidad',
        bonus_1_importe: 1500,
        bonus_1_mes: 12,
        bonus_2_descripcion: '',
        bonus_2_importe: '',
        bonus_2_mes: '',
        beneficio_1_tipo: 'seguro_medico',
        beneficio_1_importe: 600,
        beneficio_2_tipo: '',
        beneficio_2_importe: '',
        irpf_porcentaje: 18,
        plan_pensiones_empresa_importe: 1200,
        plan_pensiones_empleado_importe: 600,
        deduccion_1_concepto: '',
        deduccion_1_importe: '',
        deduccion_1_recurrente: '',
        deduccion_2_concepto: '',
        deduccion_2_importe: '',
        deduccion_2_recurrente: '',
        activa: 'TRUE',
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
        const required = ['nombre', 'salario_bruto_anual', 'titular'];
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
            nombre: String(byKey.nombre || '').trim(),
            titular: String(byKey.titular || 'yo').trim().toLowerCase(),
            salario_bruto_anual: parseNumber(byKey.salario_bruto_anual),
            irpf_porcentaje: parseNumber(byKey.irpf_porcentaje),
            distribucion_pagas: Number(byKey.distribucion_pagas) || 12,
            activa: String(byKey.activa || 'TRUE').toUpperCase() !== 'FALSE',
            _raw: byKey,
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
        (r) => r.nombre && r.salario_bruto_anual > 0
      );

      if (!validRows.length) {
        toast.error('No hay filas válidas para importar');
        return;
      }

      // Resolve default account for cuentaAbono
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      const defaultCuentaAbono = allAccounts[0]?.id ? Number(allAccounts[0].id) : 0;

      let importados = 0;

      for (const row of validRows) {
        const nomina = buildNominaFromRow(row._raw);
        nomina.cuentaAbono = defaultCuentaAbono;
        await nominaService.saveNomina(nomina);
        importados++;
      }

      toast.success(`${importados} nómina${importados !== 1 ? 's' : ''} importada${importados !== 1 ? 's' : ''} correctamente`);
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
            Importa la configuración de tu nómina para el motor de cálculo. Incluye salario, variables, bonus y retenciones.
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
          Usa nuestra plantilla con el formato correcto: nombre, salario_bruto_anual, titular y campos opcionales de configuración.
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
              3. Vista previa ({preview.length} {preview.length === 1 ? 'nómina' : 'nóminas'})
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

          {/* Validation info */}
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
              Se creará una configuración de nómina por cada fila. Los campos opcionales no rellenados se ignorarán.
            </p>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {['Nombre', 'Titular', 'Salario bruto anual', 'IRPF %', 'Pagas', 'Activa'].map((col) => (
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
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>
                      {row.nombre}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--atlas-blue-light, #EBF3FF)',
                          color: 'var(--atlas-navy-1)',
                        }}
                      >
                        {row.titular === 'pareja' ? 'Pareja' : 'Yo'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {formatCurrency(row.salario_bruto_anual)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {row.irpf_porcentaje ? `${row.irpf_porcentaje}%` : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                      {row.distribucion_pagas}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {row.activa ? (
                        <Check size={16} strokeWidth={2} style={{ color: 'var(--atlas-blue)' }} aria-label="Activa" />
                      ) : (
                        <X size={16} strokeWidth={2} style={{ color: 'var(--text-gray)' }} aria-label="Inactiva" />
                      )}
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
              {importing ? 'Importando...' : `Importar ${preview.length} nómina${preview.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarNominas;
