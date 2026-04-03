// src/pages/account/migracion/ImportarPrestamos.tsx
// ATLAS HORIZON: Excel importer for loans & mortgages with merge support

import React, { useCallback, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, Landmark, ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { prestamosService } from '../../../services/prestamosService';
import { initDB } from '../../../services/db';

interface ImportarPrestamosProps {
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewRow {
  tipo: string;
  cuenta_cargo: string;
  fecha_firma: string;
  fecha_primer_cargo: string;
  dia_cobro: number;
  capital_inicial: number;
  plazo_total_meses: number;
  tipo_interes: string;
  tin_fijo: number;
  diferencial: number;
  indice: string;
  valor_indice_actual: number;
  revision_meses: number;
  tramo_fijo_meses: number;
  tin_tramo_fijo: number;
  diferencial_variable: number;
  indice_variable: string;
  inmueble_direccion: string;
  alias: string;
  esquema_primer_recibo: string;
  carencia: string;
  meses_carencia: number;
  comision_apertura: number;
  comision_mantenimiento: number;
  comision_amortizacion_anticipada: number;
  _accion: 'crear' | 'completar';
  _matchId?: string;
  _matchNombre?: string;
  _inmuebleId?: string;
  _cuentaCargoId?: string;
}

const PREVIEW_ROW_LIMIT = 10;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const normalizeHeader = (header: string): string =>
  header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');

const isValidISODate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

const parseDate = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const result = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      return isValidISODate(result) ? result : '';
    }
    return '';
  }

  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/\./g, '/').replace(/-/g, '/');
  const parts = normalized.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    let result = '';
    if (y.length === 4) result = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    else if (d.length === 4) result = `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
    if (result && isValidISODate(result)) return result;
  }

  return '';
};

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

const normalizeForMatch = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const ImportarPrestamos: React.FC<ImportarPrestamosProps> = ({ onComplete, onBack }) => {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ───────────────────────────────────────────────────────

  const handleDescargarPlantilla = () => {
    const datos = [
      {
        tipo: 'inmueble',
        cuenta_cargo: 'ES12 3456 7890 1234 5678 9012',
        fecha_firma: '2022-03-15',
        fecha_primer_cargo: '2022-04-15',
        dia_cobro: 15,
        capital_inicial: 180000,
        plazo_total_meses: 300,
        tipo_interes: 'fijo',
        tin_fijo: 2.5,
        diferencial: '',
        indice: '',
        valor_indice_actual: '',
        revision_meses: '',
        tramo_fijo_meses: '',
        tin_tramo_fijo: '',
        diferencial_variable: '',
        indice_variable: '',
        inmueble_direccion: 'Calle Uria 15, 3A Oviedo',
        alias: 'Hipoteca Piso Oviedo',
        esquema_primer_recibo: 'normal',
        carencia: 'ninguna',
        meses_carencia: '',
        comision_apertura: 0.5,
        comision_mantenimiento: 0,
        comision_amortizacion_anticipada: 0.25,
      },
      {
        tipo: 'personal',
        cuenta_cargo: 'ES98 7654 3210 9876 5432 1098',
        fecha_firma: '2023-06-01',
        fecha_primer_cargo: '2023-07-01',
        dia_cobro: 1,
        capital_inicial: 15000,
        plazo_total_meses: 60,
        tipo_interes: 'variable',
        tin_fijo: '',
        diferencial: 0.75,
        indice: 'euribor',
        valor_indice_actual: 3.5,
        revision_meses: 12,
        tramo_fijo_meses: '',
        tin_tramo_fijo: '',
        diferencial_variable: '',
        indice_variable: '',
        inmueble_direccion: '',
        alias: 'Prestamo personal BBVA',
        esquema_primer_recibo: 'normal',
        carencia: 'ninguna',
        meses_carencia: '',
        comision_apertura: 1,
        comision_mantenimiento: 0,
        comision_amortizacion_anticipada: 0.5,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prestamos');
    XLSX.writeFile(wb, 'plantilla-prestamos-atlas.xlsx');
    toast.success('Plantilla descargada correctamente');
  };

  // ── File parsing ────────────────────────────────────────────────────────────

  const parseFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Formato no valido. Usa .xlsx o .xls');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) {
          toast.error('El archivo esta vacio');
          return;
        }

        const keys = Object.keys(rows[0]).map(normalizeHeader);
        const required = ['tipo', 'cuenta_cargo', 'fecha_firma', 'fecha_primer_cargo', 'dia_cobro', 'capital_inicial', 'plazo_total_meses', 'tipo_interes'];
        const missing = required.filter((r) => !keys.includes(r));
        if (missing.length) {
          toast.error(`Columnas requeridas: ${missing.join(', ')}`);
          return;
        }

        // Load existing data for merge detection
        const db = await initDB();
        const allProperties = await db.getAll('properties');
        const allAccounts = await db.getAll('accounts');
        const allPrestamos = await prestamosService.getAllPrestamos();

        const parsed: PreviewRow[] = [];

        for (const row of rows) {
          const byKey = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])
          );

          const tipoRaw = String(byKey.tipo || 'inmueble').trim().toLowerCase();
          const inmuebleDireccion = String(byKey.inmueble_direccion || '').trim();
          const cuentaCargo = String(byKey.cuenta_cargo || '').trim();
          const tipoInteres = String(byKey.tipo_interes || 'fijo').trim().toLowerCase();

          // Match account by IBAN or alias
          const matchAccount = allAccounts.find((a: any) =>
            (a.iban && a.iban.replace(/\s/g, '').includes(cuentaCargo.replace(/\s/g, ''))) ||
            (a.alias && a.alias.toLowerCase().includes(cuentaCargo.toLowerCase()))
          );
          const cuentaCargoId = matchAccount ? String(matchAccount.id) : (allAccounts[0]?.id ? String(allAccounts[0].id) : '');

          // Match property by address or cadastral ref
          let inmuebleId: string | undefined;
          if (inmuebleDireccion && tipoRaw !== 'personal') {
            const dirNorm = normalizeForMatch(inmuebleDireccion);
            const matchProp = allProperties.find((p) => {
              const pAddr = normalizeForMatch(`${p.alias || ''} ${p.address || ''}`);
              const pRef = normalizeForMatch(p.cadastralReference || '');
              return (pAddr && (pAddr.includes(dirNorm) || dirNorm.includes(pAddr))) ||
                     (pRef && dirNorm.includes(pRef));
            });
            if (matchProp?.id) inmuebleId = String(matchProp.id);
          }

          // Check for existing incomplete loan linked to this property
          let accion: 'crear' | 'completar' = 'crear';
          let matchId: string | undefined;
          let matchNombre: string | undefined;

          if (inmuebleId && tipoRaw !== 'personal') {
            const prestamosInmueble = allPrestamos.filter((p) =>
              p.inmuebleId === inmuebleId ||
              p.afectacionesInmueble?.some((a) => String(a.inmuebleId) === inmuebleId)
            );
            const incomplete = prestamosInmueble.find((p) =>
              p.estado === 'pendiente_completar' || p.principalInicial === 0
            );
            if (incomplete) {
              accion = 'completar';
              matchId = incomplete.id;
              matchNombre = incomplete.nombre;
            }
          }

          parsed.push({
            tipo: tipoRaw,
            cuenta_cargo: cuentaCargo,
            fecha_firma: parseDate(byKey.fecha_firma),
            fecha_primer_cargo: parseDate(byKey.fecha_primer_cargo),
            dia_cobro: Math.min(Math.max(Number(byKey.dia_cobro) || 1, 1), 28),
            capital_inicial: parseNumber(byKey.capital_inicial),
            plazo_total_meses: Number(byKey.plazo_total_meses) || 0,
            tipo_interes: tipoInteres,
            tin_fijo: parseNumber(byKey.tin_fijo),
            diferencial: parseNumber(byKey.diferencial),
            indice: String(byKey.indice || '').trim().toLowerCase(),
            valor_indice_actual: parseNumber(byKey.valor_indice_actual),
            revision_meses: Number(byKey.revision_meses) || 12,
            tramo_fijo_meses: Number(byKey.tramo_fijo_meses) || 0,
            tin_tramo_fijo: parseNumber(byKey.tin_tramo_fijo),
            diferencial_variable: parseNumber(byKey.diferencial_variable),
            indice_variable: String(byKey.indice_variable || '').trim().toLowerCase(),
            inmueble_direccion: inmuebleDireccion,
            alias: String(byKey.alias || '').trim(),
            esquema_primer_recibo: String(byKey.esquema_primer_recibo || 'normal').trim().toLowerCase(),
            carencia: String(byKey.carencia || 'ninguna').trim().toLowerCase(),
            meses_carencia: Number(byKey.meses_carencia) || 0,
            comision_apertura: parseNumber(byKey.comision_apertura),
            comision_mantenimiento: parseNumber(byKey.comision_mantenimiento),
            comision_amortizacion_anticipada: parseNumber(byKey.comision_amortizacion_anticipada),
            _accion: accion,
            _matchId: matchId,
            _matchNombre: matchNombre,
            _inmuebleId: inmuebleId,
            _cuentaCargoId: cuentaCargoId,
          });
        }

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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const mapIndice = (raw: string): 'EURIBOR' | 'OTRO' =>
    raw.includes('euribor') ? 'EURIBOR' : 'OTRO';

  const mapEsquema = (raw: string): 'NORMAL' | 'SOLO_INTERESES' | 'PRORRATA' => {
    if (raw.includes('solo') || raw.includes('interes')) return 'SOLO_INTERESES';
    if (raw.includes('prorrat')) return 'PRORRATA';
    return 'NORMAL';
  };

  const mapCarencia = (raw: string): 'NINGUNA' | 'CAPITAL' | 'TOTAL' => {
    if (raw.includes('capital')) return 'CAPITAL';
    if (raw.includes('total')) return 'TOTAL';
    return 'NINGUNA';
  };

  const formatTIN = (row: PreviewRow): string => {
    if (row.tipo_interes === 'fijo') return `${row.tin_fijo}% fijo`;
    if (row.tipo_interes === 'variable') return `E+${row.diferencial}%`;
    if (row.tipo_interes === 'mixto') return `${row.tin_tramo_fijo}% → E+${row.diferencial_variable || row.diferencial}%`;
    return '-';
  };

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImportar = async () => {
    if (!preview?.length) return;
    setImporting(true);
    try {
      const validRows = preview.filter(
        (r) => r.capital_inicial > 0 && r.fecha_firma && r.plazo_total_meses > 0
      );

      if (!validRows.length) {
        toast.error('No hay filas validas para importar');
        return;
      }

      // Check we have at least one account
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      if (!allAccounts.length) {
        toast.error('No hay cuentas bancarias registradas. Crea una cuenta antes de importar prestamos.');
        return;
      }

      let nuevos = 0;
      let completados = 0;

      for (const row of validRows) {
        try {
          const cuentaCargoId = row._cuentaCargoId || String(allAccounts[0].id);
          const tipoUpper = row.tipo_interes.toUpperCase() as 'FIJO' | 'VARIABLE' | 'MIXTO';

          if (row._accion === 'completar' && row._matchId) {
            // ── Merge: fill empty fields without overwriting ──
            const existing = await prestamosService.getPrestamoById(row._matchId);
            if (!existing) continue;

            await prestamosService.updatePrestamo(row._matchId, {
              nombre: existing.nombre || row.alias || `${row.tipo} ${row.fecha_firma}`,
              principalInicial: existing.principalInicial || row.capital_inicial,
              principalVivo: existing.principalVivo || row.capital_inicial,
              fechaFirma: existing.fechaFirma || row.fecha_firma,
              fechaPrimerCargo: existing.fechaPrimerCargo || row.fecha_primer_cargo,
              plazoMesesTotal: existing.plazoMesesTotal || row.plazo_total_meses,
              diaCargoMes: existing.diaCargoMes || row.dia_cobro,
              esquemaPrimerRecibo: existing.esquemaPrimerRecibo || mapEsquema(row.esquema_primer_recibo),
              tipo: existing.tipo !== 'FIJO' && existing.tipo ? existing.tipo : tipoUpper,
              sistema: existing.sistema || 'FRANCES',
              tipoNominalAnualFijo: existing.tipoNominalAnualFijo || row.tin_fijo || undefined,
              diferencial: existing.diferencial || row.diferencial || row.diferencial_variable || undefined,
              indice: existing.indice || (row.indice ? mapIndice(row.indice) : undefined),
              valorIndiceActual: existing.valorIndiceActual || row.valor_indice_actual || undefined,
              periodoRevisionMeses: existing.periodoRevisionMeses || row.revision_meses || undefined,
              tramoFijoMeses: existing.tramoFijoMeses || row.tramo_fijo_meses || undefined,
              tipoNominalAnualMixtoFijo: existing.tipoNominalAnualMixtoFijo || row.tin_tramo_fijo || undefined,
              carencia: existing.carencia || mapCarencia(row.carencia),
              carenciaMeses: existing.carenciaMeses || row.meses_carencia || undefined,
              comisionApertura: existing.comisionApertura || row.comision_apertura || undefined,
              comisionMantenimiento: existing.comisionMantenimiento || row.comision_mantenimiento || undefined,
              comisionAmortizacionAnticipada: existing.comisionAmortizacionAnticipada || row.comision_amortizacion_anticipada || undefined,
              cuentaCargoId: existing.cuentaCargoId || cuentaCargoId,
              estado: 'vivo',
            });

            completados++;
          } else {
            // ── Create new loan ──
            const afectaciones = row._inmuebleId
              ? [{ inmuebleId: row._inmuebleId, porcentaje: 100 }]
              : [];

            await prestamosService.createPrestamo({
              ambito: row.tipo === 'personal' ? 'PERSONAL' : 'INMUEBLE',
              inmuebleId: row._inmuebleId,
              afectacionesInmueble: afectaciones,
              nombre: row.alias || `${row.tipo} ${row.fecha_firma}`,
              principalInicial: row.capital_inicial,
              principalVivo: row.capital_inicial,
              fechaFirma: row.fecha_firma,
              fechaPrimerCargo: row.fecha_primer_cargo,
              plazoMesesTotal: row.plazo_total_meses,
              diaCargoMes: row.dia_cobro,
              esquemaPrimerRecibo: mapEsquema(row.esquema_primer_recibo),
              tipo: tipoUpper,
              sistema: 'FRANCES',
              tipoNominalAnualFijo: tipoUpper === 'FIJO' ? row.tin_fijo : undefined,
              diferencial: tipoUpper === 'VARIABLE' ? row.diferencial : (tipoUpper === 'MIXTO' ? (row.diferencial_variable || row.diferencial) : undefined),
              indice: tipoUpper !== 'FIJO' ? mapIndice(row.indice || row.indice_variable) : undefined,
              valorIndiceActual: tipoUpper !== 'FIJO' ? row.valor_indice_actual : undefined,
              periodoRevisionMeses: tipoUpper !== 'FIJO' ? row.revision_meses : undefined,
              tramoFijoMeses: tipoUpper === 'MIXTO' ? row.tramo_fijo_meses : undefined,
              tipoNominalAnualMixtoFijo: tipoUpper === 'MIXTO' ? row.tin_tramo_fijo : undefined,
              carencia: mapCarencia(row.carencia),
              carenciaMeses: row.meses_carencia || undefined,
              comisionApertura: row.comision_apertura || undefined,
              comisionMantenimiento: row.comision_mantenimiento || undefined,
              comisionAmortizacionAnticipada: row.comision_amortizacion_anticipada || undefined,
              cuentaCargoId,
              cuotasPagadas: 0,
              estado: 'vivo',
              origenCreacion: 'IMPORTACION',
              activo: true,
            });

            nuevos++;
          }
        } catch (rowErr) {
          console.error('Error importing row:', row.alias, rowErr);
        }
      }

      const parts: string[] = [];
      if (nuevos) parts.push(`${nuevos} prestamos creados`);
      if (completados) parts.push(`${completados} completados`);
      toast.success(parts.join(' · ') || 'Importacion completada');

      setPreview(null);
      onComplete();
    } catch (err) {
      console.error('Error importing:', err);
      toast.error('Error al importar los prestamos');
    } finally {
      setImporting(false);
    }
  };

  const totalCrear = preview?.filter((r) => r._accion === 'crear').length || 0;
  const totalCompletar = preview?.filter((r) => r._accion === 'completar').length || 0;

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
        Volver a Migracion de Datos
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
          <Landmark size={20} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
            Importar prestamos e hipotecas
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Importa tus prestamos desde Excel o completa los que ya existen del XML
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
          Columnas obligatorias: tipo, cuenta_cargo, fecha_firma, fecha_primer_cargo, dia_cobro, capital_inicial, plazo_total_meses, tipo_interes.
          Segun tipo: tin_fijo (fijo), diferencial + indice (variable), tramo_fijo_meses + tin_tramo_fijo + diferencial_variable (mixto).
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
              Arrastra tu archivo aqui o{' '}
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
              aria-label="Cancelar importacion"
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

          {/* Info banner */}
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
              {totalCompletar > 0
                ? `${totalCrear} nuevos y ${totalCompletar} existentes detectados (prestamos pendientes de completar). Los existentes se completaran sin machacar datos.`
                : 'Se crearan nuevos prestamos. Si indicas inmueble_direccion, se vincularan a los inmuebles existentes.'}
            </p>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {['Accion', 'Alias', 'Tipo', 'Capital', 'Fecha firma', 'Plazo', 'TIN'].map((col) => (
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
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: row._accion === 'completar'
                            ? 'var(--ok-light, #E8F5E9)'
                            : 'var(--atlas-blue-light, #EBF3FF)',
                          color: row._accion === 'completar'
                            ? 'var(--ok, #2E7D32)'
                            : 'var(--atlas-blue)',
                        }}
                      >
                        {row._accion === 'completar' ? 'completar' : 'crear'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>
                      {row.alias || `${row.tipo} ${row.fecha_firma}`}
                      {row._matchNombre && (
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-gray)' }}>
                          → {row._matchNombre}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--atlas-blue-light, #EBF3FF)',
                          color: 'var(--atlas-blue)',
                        }}
                      >
                        {row.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {formatCurrency(row.capital_inicial)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.fecha_firma}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.plazo_total_meses} meses
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {formatTIN(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > PREVIEW_ROW_LIMIT && (
              <p style={{ padding: '8px 12px', margin: 0, fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                ... y {preview.length - PREVIEW_ROW_LIMIT} filas mas
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
              {importing ? 'Importando...' : `Importar ${preview.length} prestamos`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarPrestamos;
