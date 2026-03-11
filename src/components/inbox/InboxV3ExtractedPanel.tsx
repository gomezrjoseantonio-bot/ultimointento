import React from 'react';
import { CheckCircle2, ScanLine } from 'lucide-react';

interface InboxV3ExtractedPanelProps {
  document: any;
  onConfirm: () => void;
  onProcessOCR: () => void;
  processingOCR: boolean;
}

const pickSnakeField = (document: any, key: string): string => {
  const ocrData = document?.metadata?.ocr?.data || {};
  const value = ocrData[key];
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
};

const pickField = (document: any, candidates: string[]): string => {
  const fields = document?.metadata?.ocr?.fields || [];
  const hit = fields.find((field: any) => candidates.includes(String(field.name || '').toLowerCase()));
  if (hit?.value) return String(hit.value);
  const ocrData = document?.metadata?.ocr?.data || {};
  for (const key of candidates) { if (ocrData[key]) return String(ocrData[key]); }
  const metadata = document?.metadata || {};
  for (const key of candidates) { if (metadata[key]) return String(metadata[key]); }
  return '—';
};

const TIPO_GASTO_LABELS: Record<string, string> = {
  telecomunicaciones:      'Telecomunicaciones',
  electricidad:            'Electricidad',
  agua:                    'Agua',
  gas:                     'Gas',
  alquiler:                'Alquiler',
  seguros:                 'Seguros',
  mantenimiento:           'Mantenimiento',
  transporte:              'Transporte',
  alimentacion:            'Alimentación',
  material_oficina:        'Material de oficina',
  servicios_profesionales: 'Servicios profesionales',
  otros:                   'Otros',
};

// ── skeleton row ─────────────────────────────────────────────────────────────

const SkeletonRow: React.FC<{ wide?: boolean }> = ({ wide }) => (
  <div>
    <div style={{ height: 10, width: wide ? '55%' : '35%', marginBottom: 8, background: 'var(--n-200)', borderRadius: 'var(--r-sm)', opacity: 0.7 }} />
    <div style={{ height: 40, background: 'var(--n-100)', borderRadius: 'var(--r-md)' }} />
  </div>
);

// ── main component ────────────────────────────────────────────────────────────

const InboxV3ExtractedPanel: React.FC<InboxV3ExtractedPanelProps> = ({
  document,
  onConfirm,
  onProcessOCR,
  processingOCR,
}) => {
  const hasOCR = !!document?.metadata?.ocr;

  const tipoRaw = pickSnakeField(document, 'tipo_gasto');
  const tipoLabel = tipoRaw !== '—' ? (TIPO_GASTO_LABELS[tipoRaw] ?? tipoRaw) : '—';

  const rows = [
    { label: 'Proveedor',      value: pickSnakeField(document, 'proveedor')      !== '—' ? pickSnakeField(document, 'proveedor')      : pickField(document, ['supplier_name']) },
    { label: 'Tipo de gasto',  value: tipoLabel },
    { label: 'Dirección',      value: pickSnakeField(document, 'direccion') },
    { label: 'Nº factura',     value: pickSnakeField(document, 'numero_factura') !== '—' ? pickSnakeField(document, 'numero_factura') : pickField(document, ['invoice_id', 'invoice_number']) },
    { label: 'Fecha',          value: pickSnakeField(document, 'fecha')          !== '—' ? pickSnakeField(document, 'fecha')          : pickField(document, ['invoice_date']) },
    { label: 'Base imponible', value: pickSnakeField(document, 'base_imponible') !== '—' ? pickSnakeField(document, 'base_imponible') : pickField(document, ['net_amount', 'subtotal']) },
    { label: 'IVA',            value: pickSnakeField(document, 'iva')            !== '—' ? pickSnakeField(document, 'iva')            : pickField(document, ['tax_amount']) },
    { label: 'Importe total',  value: pickSnakeField(document, 'importe_total')  !== '—' ? pickSnakeField(document, 'importe_total')  : pickField(document, ['total_amount']) },
    { label: 'Moneda',         value: pickSnakeField(document, 'moneda')         !== '—' ? pickSnakeField(document, 'moneda')         : pickField(document, ['currency']) },
    // Confianza se muestra como badge en el header — no se repite aquí
    { label: 'Notas',          value: pickSnakeField(document, 'notas') },
  ];

  return (
    <div className="h-full flex flex-col">

      {/* ── header ── */}
      <div className="h-14 px-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--n-200)' }}>
        <p style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)', fontSize: 'var(--t-lg)', fontWeight: 600, lineHeight: 1.3 }}>
          Datos extraídos
        </p>
        {hasOCR && !processingOCR && <span className="atlas-chip-positive">OCR completado</span>}
      </div>

      {/* ── skeleton mientras procesa ── */}
      {processingOCR && (
        <div className="h-full p-5 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center gap-2" style={{ color: 'var(--n-500)', fontSize: 'var(--t-sm)', fontFamily: 'var(--font-base)', marginBottom: 4 }}>
            <div
              className="animate-spin flex-shrink-0"
              style={{ width: 16, height: 16, border: '2px solid var(--blue)', borderTopColor: 'transparent', borderRadius: '50%' }}
            />
            Procesando OCR…
          </div>
          {[true, false, true, false, false, true, false, false, true].map((wide, i) => (
            <SkeletonRow key={i} wide={wide} />
          ))}
        </div>
      )}

      {/* ── empty state ── */}
      {!processingOCR && !hasOCR && (
        <div className="h-full flex flex-col items-center justify-center px-6 gap-4 text-center">
          <ScanLine size={32} style={{ color: 'var(--n-300)' }} />
          <p className="text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>
            Procesa el documento para extraer datos automáticamente.
          </p>
          <button
            type="button"
            className="atlas-btn-primary w-full"
            onClick={onProcessOCR}
            disabled={!document}
          >
            <ScanLine size={16} />
            Procesar con OCR
          </button>
        </div>
      )}

      {/* ── datos extraídos ── */}
      {!processingOCR && hasOCR && (
        <div className="h-full p-5 flex flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--s-pos)' }}>
            <CheckCircle2 size={16} />
            Confianza alta
          </div>

          <div className="space-y-4 flex-1">
            {rows.map((row) => (
              <div key={row.label}>
                <p className="text-xs mb-1" style={{ color: 'var(--n-500)' }}>{row.label}</p>
                <div
                  className="min-h-10 px-3 py-2 border flex items-center text-sm"
                  style={{
                    borderRadius: 'var(--r-md)',
                    borderColor: 'var(--n-300)',
                    color: 'var(--n-900)',
                    background: 'var(--n-50)',
                    lineHeight: 1.4,
                  }}
                >
                  {row.value}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="atlas-btn-primary w-full mt-5" onClick={onConfirm}>
            Confirmar y guardar
          </button>
        </div>
      )}
    </div>
  );
};

// Keep default export as the final statement in this module.
export default InboxV3ExtractedPanel;
