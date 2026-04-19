// src/pages/account/migracion/ImportarIndexaCapital.tsx
// Indexa Capital pension plan Excel importer (daily-format export → monthly valuations + contributions).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Upload, X, TrendingUp, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  IndexaImportPreview,
  PlanObjetivo,
  getPlanesObjetivo,
  importarIndexaCapital,
  previsualizarImportacionIndexa,
} from '../../../services/indexaCapitalImportService';

interface ImportarIndexaCapitalProps {
  onComplete: () => void;
  onBack: () => void;
}

const MONTHLY_PREVIEW_LIMIT = 12;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatSignedCurrency = (value: number): string => {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
};

const ImportarIndexaCapital: React.FC<ImportarIndexaCapitalProps> = ({ onComplete, onBack }) => {
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<IndexaImportPreview | null>(null);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>('');
  const [planes, setPlanes] = useState<PlanObjetivo[]>([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const planKey = (p: PlanObjetivo): string => `${p.store}|${p.id}`;
  const selectedPlan = planes.find((p) => planKey(p) === selectedPlanKey) ?? null;

  useEffect(() => {
    (async () => {
      try {
        const list = await getPlanesObjetivo();
        setPlanes(list);
        if (list.length === 1) setSelectedPlanKey(planKey(list[0]));
      } catch (e) {
        console.error('Error loading planes:', e);
        toast.error('Error cargando planes de pensiones');
      } finally {
        setLoadingPlanes(false);
      }
    })();
  }, []);

  const runPreview = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const data = await previsualizarImportacionIndexa(file);
      setPreview(data);
      if (!data.rows.length && data.warnings.length) {
        toast.error(data.warnings[0]);
      }
    } catch (error) {
      console.error('Error previewing Indexa file:', error);
      toast.error('Error al leer el archivo Indexa Capital');
    } finally {
      setImporting(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!preview || !selectedPlan) return;
    setImporting(true);
    try {
      const result = await importarIndexaCapital(preview, selectedPlan);
      if (result.errors.length > 0) {
        toast(result.errors[0], { icon: '⚠️' });
      }
      if (result.valoracionesImportadas > 0 || result.saldoActualizado) {
        toast.success(
          `Importadas ${result.valoracionesImportadas} valoraciones mensuales y ${result.mesesConAportaciones} meses con aportaciones.`
        );
        setPreview(null);
        onComplete();
      } else if (result.errors.length === 0) {
        toast('No se detectaron datos para importar.', { icon: 'ℹ️' });
      }
    } catch (error) {
      console.error('Error importing Indexa file:', error);
      toast.error('Error al importar el archivo Indexa Capital');
    } finally {
      setImporting(false);
    }
  }, [onComplete, preview, selectedPlan]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) runPreview(file);
  }, [runPreview]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) runPreview(file);
    event.target.value = '';
  };

  const canUpload = selectedPlan !== null;
  const monthlyToShow = preview?.monthly.slice(0, MONTHLY_PREVIEW_LIMIT) ?? [];
  const extraMonths = Math.max(0, (preview?.monthly.length ?? 0) - MONTHLY_PREVIEW_LIMIT);

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
            Importar plan de pensiones (Indexa Capital)
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Carga el Excel diario de Indexa Capital: valoraciones, aportaciones y rescates.
          </p>
        </div>
      </div>

      {/* Step 1 — plan selection */}
      <div
        style={{
          border: '1px solid var(--hz-neutral-300)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
          1. Selecciona el plan de pensiones
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: 'var(--text-gray)' }}>
          El archivo de Indexa no incluye el nombre del plan. Debes elegir sobre qué plan de pensiones existente
          vuelcas los datos. Si todavía no lo has creado, añádelo antes desde Personal → Planes.
        </p>

        {loadingPlanes ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>Cargando planes...</p>
        ) : planes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: 'var(--s-warn-bg)',
              borderRadius: '8px',
            }}
          >
            <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--s-warn)', flexShrink: 0 }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>
              No tienes ningún plan de pensiones creado. Créalo primero en Personal → Planes de Pensión e Inversiones.
            </p>
          </div>
        ) : (
          <select
            value={selectedPlanKey}
            onChange={(e) => setSelectedPlanKey(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '8px 12px',
              border: '1px solid var(--hz-neutral-300)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-inter)',
              color: 'var(--atlas-navy-1)',
              backgroundColor: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="">— Selecciona un plan —</option>
            {planes.map((p) => (
              <option key={planKey(p)} value={planKey(p)}>
                {p.nombre}{p.entidad ? ` (${p.entidad})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Step 2 — upload */}
      {!preview && (
        <div
          style={{
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
            opacity: canUpload ? 1 : 0.6,
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
            2. Sube el Excel de Indexa Capital
          </h3>
          <div
            onDragOver={(event) => { if (canUpload) { event.preventDefault(); setDragging(true); } }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { if (canUpload) handleDrop(e); }}
            onClick={() => canUpload && !importing && fileInputRef.current?.click()}
            role="button"
            aria-label="Subir archivo Excel de Indexa Capital"
            aria-disabled={!canUpload}
            tabIndex={canUpload ? 0 : -1}
            onKeyDown={(event) => canUpload && event.key === 'Enter' && !importing && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)'}`,
              borderRadius: '10px',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: canUpload ? (importing ? 'wait' : 'pointer') : 'not-allowed',
              backgroundColor: dragging ? 'var(--n-100)' : 'var(--bg)',
              transition: 'all 150ms ease',
            }}
          >
            <Upload size={24} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--atlas-navy-1)', fontWeight: 500 }}>
              {importing
                ? 'Analizando Excel…'
                : canUpload
                  ? 'Arrastra tu Excel aquí o haz clic para seleccionar'
                  : 'Selecciona primero un plan de pensiones'}
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
      )}

      {/* Step 3 — preview */}
      {preview && preview.rows.length > 0 && (
        <div
          style={{
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              3. Vista previa
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              padding: '14px',
              backgroundColor: 'var(--atlas-blue-light, #EBF3FF)',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <SummaryItem label="Rango" value={`${preview.summary.fechaInicio} → ${preview.summary.fechaFin}`} />
            <SummaryItem label="Días" value={String(preview.summary.diasTotales)} />
            <SummaryItem label="Meses detectados" value={String(preview.summary.mesesDetectados)} />
            <SummaryItem label="Saldo final" value={formatCurrency(preview.summary.saldoFinal)} />
            <SummaryItem
              label="Aportaciones netas"
              value={formatSignedCurrency(preview.summary.aportacionNetaAcumulada)}
            />
            <SummaryItem
              label="Rentabilidad acumulada"
              value={formatSignedCurrency(preview.summary.rentabilidadAcumulada)}
            />
          </div>

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
            <CheckCircle2 size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)', flexShrink: 0 }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>
              Se guardará una valoración mensual por cada mes detectado (último valor del mes) y las aportaciones
              netas se agregarán al historial del plan seleccionado. También se actualizará el saldo actual y el
              total de aportaciones realizadas.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {['Mes', 'Saldo fin de mes', 'Aportación neta mes'].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '8px 12px',
                        textAlign: col === 'Mes' ? 'left' : 'right',
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
                {monthlyToShow.map((m, index) => (
                  <tr
                    key={m.mes}
                    style={{
                      borderBottom: '1px solid var(--hz-neutral-300)',
                      backgroundColor: index % 2 === 0 ? 'var(--bg)' : 'var(--atlas-blue-light, #f9fafb)',
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>{m.mes}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(m.valorFinMes)}
                    </td>
                    <td
                      style={{
                        padding: '8px 12px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: m.aportacionNetaMes < 0 ? 'var(--error, #ef4444)' : 'var(--atlas-navy-1)',
                      }}
                    >
                      {formatSignedCurrency(m.aportacionNetaMes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {extraMonths > 0 && (
              <p style={{ padding: '8px 12px', margin: 0, fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                ... y {extraMonths} meses más se importarán también.
              </p>
            )}
          </div>

          {preview.warnings.length > 0 && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                backgroundColor: 'var(--s-warn-bg)',
                borderRadius: '8px',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>
                {preview.warnings[0]}
                {preview.warnings.length > 1 && ` (+${preview.warnings.length - 1} avisos)`}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={handleImport}
              disabled={importing || !selectedPlan}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: importing || !selectedPlan ? 'var(--hz-neutral-300)' : 'var(--atlas-blue)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: importing || !selectedPlan ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-inter)',
              }}
            >
              {importing
                ? 'Importando...'
                : `Importar ${preview.summary.mesesDetectados} meses`}
            </button>
          </div>
        </div>
      )}

      {preview && preview.rows.length === 0 && preview.warnings.length > 0 && (
        <div
          style={{
            border: '1px solid var(--hz-neutral-300)',
            borderLeft: '3px solid var(--s-warn, var(--warn))',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            backgroundColor: 'var(--s-warn-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--s-warn)' }} aria-hidden="true" />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              No se pudo procesar el archivo
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>
            {preview.warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <button
            onClick={() => setPreview(null)}
            style={{
              marginTop: '12px',
              padding: '6px 14px',
              border: '1px solid var(--atlas-blue)',
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--atlas-blue)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-inter)',
            }}
          >
            Probar con otro archivo
          </button>
        </div>
      )}
    </div>
  );
};

const SummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p
      style={{
        margin: '0 0 4px',
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: 'var(--text-gray)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </p>
    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </p>
  </div>
);

export default ImportarIndexaCapital;
