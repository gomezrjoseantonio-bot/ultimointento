import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface InboxV3ExtractedPanelProps {
  document: any;
  onConfirm: () => void;
}

const pickField = (document: any, candidates: string[]): string => {
  const fields = document?.metadata?.ocr?.fields || [];
  const hit = fields.find((field: any) => candidates.includes(String(field.name || '').toLowerCase()));
  if (hit?.value) return String(hit.value);

  const metadata = document?.metadata || {};
  for (const key of candidates) {
    if (metadata[key]) return String(metadata[key]);
  }

  return '—';
};

const InboxV3ExtractedPanel: React.FC<InboxV3ExtractedPanelProps> = ({ document, onConfirm }) => {
  const hasOCR = !!document?.metadata?.ocr;

  const rows = [
    { label: 'Proveedor', value: pickField(document, ['supplier_name', 'proveedor']) },
    { label: 'Fecha', value: pickField(document, ['invoice_date', 'fecha']) },
    { label: 'Base imponible', value: pickField(document, ['net_amount', 'subtotal', 'base_imponible']) },
    { label: 'IVA', value: pickField(document, ['tax_amount', 'iva']) },
    { label: 'Total', value: pickField(document, ['total_amount', 'total']) },
    { label: 'Número factura', value: pickField(document, ['invoice_id', 'invoice_number', 'numero_factura']) }
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="h-14 px-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--n-200)' }}>
        <p className="text-2xl font-semibold" style={{ color: 'var(--n-900)' }}>Datos extraídos</p>
        {hasOCR && <span className="atlas-chip-positive">OCR completado</span>}
      </div>

      {!hasOCR ? (
        <div className="h-full flex items-center justify-center px-6 text-sm" style={{ color: 'var(--n-500)' }}>
          Procesa el documento con OCR para ver datos extraídos.
        </div>
      ) : (
        <div className="h-full p-5 flex flex-col">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--s-positive)' }}>
            <CheckCircle2 size={16} />
            Confianza alta
          </div>

          <div className="space-y-4 flex-1">
            {rows.map((row) => (
              <div key={row.label}>
                <p className="text-xs mb-1" style={{ color: 'var(--n-500)' }}>{row.label}</p>
                <div
                  className="h-10 px-3 border flex items-center text-base"
                  style={{
                    borderRadius: 'var(--r-md)',
                    borderColor: 'var(--n-300)',
                    color: 'var(--n-900)',
                    background: 'var(--n-50)'
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

export default InboxV3ExtractedPanel;
