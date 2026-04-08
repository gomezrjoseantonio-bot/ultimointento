// src/pages/account/migracion/ImportarCuentas.tsx
// ATLAS HORIZON: Excel importer for bank accounts and opening balances

import React, { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ArrowLeft, Upload, Download, X, Wallet, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cuentasService } from '../../../services/cuentasService';
import { initDB } from '../../../services/db';

interface ImportarCuentasProps {
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewRow {
  iban: string;
  alias: string;
  banco: string;
  // Optional: only set when the cell has an explicit value in the file
  tipo?: 'CORRIENTE' | 'AHORRO' | 'OTRA';
  saldo_inicial?: number;
  fecha_saldo_inicial?: string;
  titular_nombre: string;
  titular_nif: string;
  activa?: boolean;            // parsed from 'estado' column
  _accion: 'crear' | 'actualizar';
  _existingId?: number;
}

const PREVIEW_LIMIT = 10;

const normalizeHeader = (h: string): string =>
  h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');

const normalizeIban = (raw: string): string =>
  raw.replace(/\s/g, '').toUpperCase();

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  if (typeof value === 'number') return value;
  const s = String(value).replace(/€/g, '').replace(/\./g, '').replace(',', '.').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const parseDate = (value: unknown): string | undefined => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    return undefined;
  }
  const raw = String(value).trim();
  if (!raw) return undefined;
  const normalized = raw.replace(/\./g, '/').replace(/-/g, '/');
  const parts = normalized.split('/');
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
  }
  return raw;
};

// Returns undefined when cell is empty; returns null when it's TARJETA (unsupported → skip row)
const parseTipo = (value: unknown): 'CORRIENTE' | 'AHORRO' | 'OTRA' | undefined | null => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const v = String(value).trim().toUpperCase();
  if (v === 'TARJETA_CREDITO' || v === 'TARJETA') return null; // signal to skip
  if (v === 'AHORRO') return 'AHORRO';
  if (v === 'OTRA') return 'OTRA';
  if (v === 'CORRIENTE') return 'CORRIENTE';
  return undefined; // unrecognised value → let service use its default
};

const parseActiva = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const v = String(value).trim().toUpperCase();
  if (v === 'INACTIVE' || v === 'INACTIVO' || v === 'FALSE' || v === '0') return false;
  if (v === 'ACTIVE' || v === 'ACTIVO' || v === 'TRUE' || v === '1') return true;
  return undefined;
};

const ImportarCuentas: React.FC<ImportarCuentasProps> = ({ onBack, onComplete }) => {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDescargarPlantilla = () => {
    const rows = [
      {
        iban: 'ES91 2100 0418 4502 0005 1332',
        alias: 'Cuenta principal',
        banco: 'CaixaBank',
        tipo: 'CORRIENTE',
        saldo_inicial: 5000,
        fecha_saldo_inicial: '2024-01-01',
        titular_nombre: 'Juan García López',
        titular_nif: '12345678A',
        estado: 'ACTIVE',
      },
      {
        iban: 'ES80 2310 0001 1800 0001 2345',
        alias: 'Cuenta ahorro',
        banco: 'EVO Banco',
        tipo: 'AHORRO',
        saldo_inicial: 12000,
        fecha_saldo_inicial: '2024-01-01',
        titular_nombre: '',
        titular_nif: '',
        estado: 'ACTIVE',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuentas');
    XLSX.writeFile(wb, 'plantilla-cuentas-atlas.xlsx');
    toast.success('Plantilla descargada');
  };

  const parseFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Formato no válido. Usa .xlsx o .xls');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (!rows.length) {
          toast.error('El archivo está vacío');
          return;
        }

        const keys = Object.keys(rows[0]).map(normalizeHeader);
        if (!keys.includes('iban')) {
          toast.error('Columna obligatoria no encontrada: iban');
          return;
        }

        // Load existing accounts and build O(1) lookup map
        const db = await initDB();
        const existingAccounts = await db.getAll('accounts');
        const existingByIban = new Map(
          existingAccounts.map((a) => [normalizeIban(a.iban), a]),
        );

        let skippedTarjetas = 0;
        const parsed: PreviewRow[] = [];

        for (const row of rows) {
          const byKey = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeHeader(k), v]));
          const iban = normalizeIban(String(byKey.iban || ''));
          if (!iban) continue;

          const tipoResult = parseTipo(byKey.tipo);
          if (tipoResult === null) {
            // TARJETA_CREDITO — not importable without cardConfig
            skippedTarjetas += 1;
            continue;
          }

          const existing = existingByIban.get(iban);

          parsed.push({
            iban,
            alias: String(byKey.alias || '').trim(),
            banco: String(byKey.banco || '').trim(),
            tipo: tipoResult,                           // undefined = not specified, use service default
            saldo_inicial: parseNumber(byKey.saldo_inicial),
            fecha_saldo_inicial: parseDate(byKey.fecha_saldo_inicial),
            titular_nombre: String(byKey.titular_nombre || '').trim(),
            titular_nif: String(byKey.titular_nif || '').trim(),
            activa: parseActiva(byKey.estado),
            _accion: existing ? 'actualizar' : 'crear',
            _existingId: existing?.id,
          });
        }

        if (skippedTarjetas > 0) {
          toast(`${skippedTarjetas} cuenta(s) de tipo tarjeta omitidas (no se pueden importar sin configuración de domiciliación).`, { icon: '⚠️' });
        }

        if (!parsed.length) {
          toast.error('No se encontraron filas con IBAN válido para importar');
          return;
        }

        setPreview(parsed);
      } catch (err) {
        console.error(err);
        toast.error('Error leyendo el archivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImport = async () => {
    if (!preview?.length) return;
    setImporting(true);
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of preview) {
      try {
        const titular = (row.titular_nombre || row.titular_nif)
          ? { nombre: row.titular_nombre || undefined, nif: row.titular_nif || undefined }
          : undefined;

        if (row._accion === 'actualizar' && row._existingId != null) {
          await cuentasService.update(row._existingId, {
            alias: row.alias || undefined,
            // Only include optional fields when explicitly present in the file
            ...(row.tipo !== undefined && { tipo: row.tipo }),
            ...(titular !== undefined && { titular }),
            ...(row.saldo_inicial !== undefined && { openingBalance: row.saldo_inicial }),
            ...(row.fecha_saldo_inicial !== undefined && { openingBalanceDate: row.fecha_saldo_inicial }),
            ...(row.activa !== undefined && { activa: row.activa }),
          });
          updated += 1;
        } else {
          await cuentasService.create({
            iban: row.iban,
            alias: row.alias || undefined,
            ...(row.tipo !== undefined && { tipo: row.tipo }),
            ...(titular !== undefined && { titular }),
            ...(row.saldo_inicial !== undefined && { openingBalance: row.saldo_inicial }),
            ...(row.fecha_saldo_inicial !== undefined && { openingBalanceDate: row.fecha_saldo_inicial }),
          });
          created += 1;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${row.iban.slice(-4)}: ${msg}`);
      }
    }

    setImporting(false);

    if (errors.length) {
      toast.error(`${errors.length} error(es): ${errors.slice(0, 2).join(' · ')}`);
    }
    if (created || updated) {
      toast.success(`Cuentas creadas: ${created} · actualizadas: ${updated}`);
    }

    setPreview(null);
    onComplete();
  };

  return (
    <div style={{ fontFamily: 'var(--font-inter)' }}>
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--atlas-blue)', fontSize: '0.875rem', fontWeight: 500, padding: '0', marginBottom: '20px' }}
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        Volver a Migración de Datos
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--atlas-blue-light, #EBF3FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={20} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>Importar cuentas bancarias y saldos</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>Crea o actualiza cuentas con IBAN, alias, tipo y saldo inicial.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={handleDescargarPlantilla}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--hz-neutral-300)', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          <Download size={14} /> Descargar plantilla
        </button>
      </div>

      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)'}`, borderRadius: '12px', padding: '44px 24px', textAlign: 'center', cursor: 'pointer' }}
        >
          <Upload size={34} strokeWidth={1.5} style={{ margin: '0 auto 8px auto', color: dragging ? 'var(--atlas-blue)' : 'var(--text-gray)' }} />
          <p style={{ margin: 0, fontWeight: 500 }}>Arrastra el Excel o haz clic para seleccionar</p>
          <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>Formatos admitidos: .xlsx, .xls</p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
        </div>
      )}

      {preview && (
        <div style={{ border: '1px solid var(--hz-neutral-300)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Vista previa ({preview.length} filas)</h3>
            <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <X size={14} /> Cancelar
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--atlas-blue-light, #EBF3FF)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
            <AlertCircle size={16} style={{ color: 'var(--atlas-blue)', marginTop: '2px', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '0.8125rem' }}>
              Nuevas: <strong>{preview.filter((r) => r._accion === 'crear').length}</strong> · A actualizar: <strong>{preview.filter((r) => r._accion === 'actualizar').length}</strong>
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--hz-neutral-300)' }}>
                  {['IBAN', 'Alias', 'Tipo', 'Saldo inicial', 'Fecha saldo', 'Acción'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, PREVIEW_LIMIT).map((row, i) => (
                  <tr key={`${row.iban}-${i}`} style={{ borderBottom: '1px solid #f2f2f2' }}>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>{row.iban.replace(/(.{4})/g, '$1 ').trim()}</td>
                    <td style={{ padding: '8px 6px' }}>{row.alias || <span style={{ color: 'var(--text-gray)' }}>—</span>}</td>
                    <td style={{ padding: '8px 6px' }}>{row.tipo ?? <span style={{ color: 'var(--text-gray)' }}>—</span>}</td>
                    <td style={{ padding: '8px 6px' }}>
                      {row.saldo_inicial !== undefined
                        ? row.saldo_inicial.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                        : <span style={{ color: 'var(--text-gray)' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 6px' }}>{row.fecha_saldo_inicial ?? <span style={{ color: 'var(--text-gray)' }}>—</span>}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: row._accion === 'crear' ? 'var(--ok-light, #E8F8EF)' : '#EEF2FF', color: row._accion === 'crear' ? 'var(--ok)' : '#4F46E5' }}>
                        {row._accion === 'crear' ? 'Crear' : 'Actualizar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.length > PREVIEW_LIMIT && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-gray)', marginTop: '8px' }}>
              Mostrando {PREVIEW_LIMIT} de {preview.length} filas.
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: importing ? 'var(--hz-neutral-400)' : 'var(--atlas-blue)', color: 'white', cursor: importing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
            >
              {importing ? 'Importando...' : 'Importar cuentas'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarCuentas;
