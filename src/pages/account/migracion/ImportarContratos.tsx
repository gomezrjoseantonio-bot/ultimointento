import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Users, ArrowLeft, Upload, Download, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAvailableAccounts, importContractsFromRentilaRows, RentilaImportRow } from '../../../services/contractsImportService';
import { Account, initDB, Property } from '../../../services/db';

interface ImportarContratosProps {
  onComplete: () => void;
  onBack: () => void;
}

const PREVIEW_LIMIT = 12;

const normalizeHeader = (header: string): string =>
  header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseDate = (value: unknown): string => {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }

  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/\./g, '/').replace(/-/g, '/');
  const parts = normalized.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  return raw;
};

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  const normalized = String(value || '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ImportarContratos: React.FC<ImportarContratosProps> = ({ onBack, onComplete }) => {
  const [preview, setPreview] = useState<RentilaImportRow[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadContext = async () => {
      const [availableAccounts, db] = await Promise.all([getAvailableAccounts(), initDB()]);
      const allProperties = await db.getAll('properties');
      setAccounts(availableAccounts);
      setSelectedAccountId(availableAccounts[0]?.id || null);
      setProperties(allProperties);
    };

    loadContext().catch(() => {
      toast.error('No se pudo cargar la configuración para la importación');
    });
  }, []);

  const propiedadesDetectadas = useMemo(() => {
    if (!preview) return { ok: 0, missing: 0 };

    const normalizedDbNames = properties.map((p) => `${p.alias} ${p.address}`.toLowerCase());
    let ok = 0;

    preview.forEach((row) => {
      const target = row.propiedad.toLowerCase();
      const found = normalizedDbNames.some((candidate) => candidate.includes(target) || target.includes(candidate));
      if (found) ok += 1;
    });

    return { ok, missing: preview.length - ok };
  }, [preview, properties]);

  const handleDescargarPlantilla = () => {
    const rows = [
      {
        ID: 'RENT-001',
        Propiedad: 'Piso Centro Madrid',
        Tipo: 'Contrato de arrendamiento de vivienda',
        'Inicio de alquiler': '01/01/2024',
        'Fin de alquiler': '31/12/2028',
        'Nombre compañía': 'ANA GARCIA LOPEZ',
        Alquiler: 950,
        Fianza: 950,
        Comentarios: 'Importado desde Rentila',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
    XLSX.writeFile(wb, 'plantilla-contratos-rentila-atlas.xlsx');
    toast.success('Plantilla descargada correctamente');
  };

  const parseFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Formato no válido. Usa .xlsx o .xls');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (!rows.length) {
          toast.error('El archivo está vacío');
          return;
        }

        const firstRowKeys = Object.keys(rows[0] || {}).map(normalizeHeader);
        const required = ['propiedad', 'inicio de alquiler', 'fin de alquiler', 'nombre compania', 'alquiler'];
        const missing = required.filter((key) => !firstRowKeys.includes(key));

        if (missing.length) {
          toast.error(`Faltan columnas obligatorias: ${missing.join(', ')}`);
          return;
        }

        const parsed = rows.map((row) => {
          const byKey = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeHeader(k), v]));
          return {
            idExterno: String(byKey.id || byKey.identificador || '').trim() || undefined,
            propiedad: String(byKey.propiedad || '').trim(),
            tipo: String(byKey.tipo || '').trim(),
            inicioAlquiler: parseDate(byKey['inicio de alquiler']),
            finAlquiler: parseDate(byKey['fin de alquiler']),
            nombreCompania: String(byKey['nombre compania'] || '').trim(),
            alquiler: parseNumber(byKey.alquiler),
            fianza: parseNumber(byKey.fianza),
            gastos: parseNumber(byKey.gastos),
            otrosGastos: parseNumber(byKey['otros gastos']),
            comentarios: String(byKey.comentarios || '').trim(),
          } as RentilaImportRow;
        });

        setPreview(parsed.filter((row) => row.propiedad || row.nombreCompania));
      } catch (error) {
        console.error(error);
        toast.error('Error leyendo el archivo Excel');
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const handleImport = async () => {
    if (!preview?.length || !selectedAccountId) {
      toast.error('Selecciona una cuenta y carga un archivo antes de importar');
      return;
    }

    setImporting(true);
    try {
      const result = await importContractsFromRentilaRows(preview, selectedAccountId);
      if (result.errors.length) {
        toast.error(`Importación parcial: ${result.errors.length} incidencias`);
      } else {
        toast.success('Contratos importados correctamente');
      }

      toast.success(`Nuevos: ${result.imported}, actualizados: ${result.updated}, omitidos: ${result.skipped}`);
      setPreview(null);
      onComplete();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo completar la importación');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ fontFamily: 'var(--font-inter)' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--atlas-blue)', fontSize: '0.875rem', fontWeight: 500, padding: '0', marginBottom: '20px' }}>
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        Volver a Migración de Datos
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--warning-light, #FFF8E7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={20} strokeWidth={1.5} style={{ color: 'var(--warning)' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>Importar contratos de alquiler</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>Compatible con exportación de Rentila y plantillas Excel.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={handleDescargarPlantilla} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--hz-neutral-300)', background: 'white', cursor: 'pointer' }}>
          <Download size={14} /> Descargar plantilla
        </button>
        <select
          value={selectedAccountId || ''}
          onChange={(e) => setSelectedAccountId(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--hz-neutral-300)', minWidth: '240px' }}
        >
          {!accounts.length && <option value="">No hay cuentas activas</option>}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.alias || account.name || account.iban}</option>
          ))}
        </select>
      </div>

      {!preview && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) parseFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)'}`, borderRadius: '12px', padding: '44px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' }}
        >
          <Upload size={34} strokeWidth={1.5} style={{ margin: '0 auto 8px auto', color: dragging ? 'var(--atlas-blue)' : 'var(--text-gray)' }} />
          <p style={{ margin: 0, fontWeight: 500 }}>Arrastra el Excel de Rentila o haz clic para seleccionar</p>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>Formatos admitidos: .xlsx, .xls</p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
        </div>
      )}

      {preview && (
        <div style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Vista previa ({preview.length} filas)</h3>
            <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><X size={14} />Cancelar</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--atlas-blue-light, #EBF3FF)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
            <AlertCircle size={16} style={{ color: 'var(--atlas-blue)', marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.8125rem' }}>
              Inmuebles detectados: <strong>{propiedadesDetectadas.ok}</strong> · Sin match: <strong>{propiedadesDetectadas.missing}</strong>.
              Los no detectados se omitirán para evitar errores.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hz-neutral-300)' }}>
                  {['Propiedad', 'Inquilino', 'Inicio', 'Fin', 'Renta', 'Fianza'].map((title) => (
                    <th key={title} style={{ textAlign: 'left', padding: '8px 6px' }}>{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, PREVIEW_LIMIT).map((row, idx) => (
                  <tr key={`${row.idExterno || row.nombreCompania}-${idx}`} style={{ borderBottom: '1px solid #f2f2f2' }}>
                    <td style={{ padding: '8px 6px' }}>{row.propiedad || '-'}</td>
                    <td style={{ padding: '8px 6px' }}>{row.nombreCompania || '-'}</td>
                    <td style={{ padding: '8px 6px' }}>{row.inicioAlquiler || '-'}</td>
                    <td style={{ padding: '8px 6px' }}>{row.finAlquiler || '-'}</td>
                    <td style={{ padding: '8px 6px' }}>{row.alquiler || 0} €</td>
                    <td style={{ padding: '8px 6px' }}>{row.fianza || 0} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.length > PREVIEW_LIMIT && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '8px' }}>Mostrando {PREVIEW_LIMIT} de {preview.length} filas.</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              onClick={handleImport}
              disabled={importing || !accounts.length || !selectedAccountId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: importing ? 'var(--hz-neutral-400)' : 'var(--atlas-blue)',
                color: 'white',
                cursor: importing ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {importing ? 'Importando...' : 'Importar contratos'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarContratos;
