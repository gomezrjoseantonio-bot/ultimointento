import React, { useEffect, useState } from 'react';
import { CheckCircle2, ScanLine, Link2, Building, CheckCircle, X } from 'lucide-react';
import { confirmLink, CandidatoMatch } from '../../services/documentMatchingService';
import { initDB, Property } from '../../services/db';
import { mejorasInmuebleService } from '../../services/mejorasInmuebleService';
import { mueblesInmuebleService } from '../../services/mueblesInmuebleService';
import toast from 'react-hot-toast';

interface InboxV3ExtractedPanelProps {
  document: any;
  onConfirm: () => void;
  onProcessOCR: () => void;
  processingOCR: boolean;
  onDocumentUpdated?: (updatedDoc: any) => void;
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

const TIPO_LABELS: Record<string, string> = {
  mejora: 'Mejora',
  ampliacion: 'Ampliación',
  reparacion: 'Reparación',
  mobiliario: 'Mobiliario',
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

// ── skeleton row ─────────────────────────────────────────────────────────────

const SkeletonRow: React.FC<{ wide?: boolean }> = ({ wide }) => (
  <div>
    <div style={{ height: 10, width: wide ? '55%' : '35%', marginBottom: 8, background: 'var(--n-200)', borderRadius: 'var(--r-sm)', opacity: 0.7 }} />
    <div style={{ height: 40, background: 'var(--n-100)', borderRadius: 'var(--r-md)' }} />
  </div>
);

// ── Matching card for pendiente_vinculacion ──────────────────────────────────

const MatchCandidateCard: React.FC<{
  candidate: CandidatoMatch;
  onVincular: (c: CandidatoMatch) => void;
  onDescartar: (c: CandidatoMatch) => void;
  linking: boolean;
}> = ({ candidate, onVincular, onDescartar, linking }) => (
  <div
    className="border p-3"
    style={{
      borderRadius: 'var(--r-md)',
      borderColor: 'var(--teal-200, var(--n-200))',
      background: 'var(--teal-50, var(--n-50))',
    }}
  >
    <div className="flex items-center gap-2 mb-2">
      <Link2 size={14} style={{ color: 'var(--teal-700, var(--blue))' }} />
      <span className="text-xs font-semibold" style={{ color: 'var(--teal-700, var(--blue))' }}>
        Posible coincidencia encontrada
      </span>
    </div>

    <div className="text-sm font-medium" style={{ color: 'var(--n-900)' }}>
      {TIPO_LABELS[candidate.tipoGasto] || candidate.tipoGasto}
      {' · '}
      {candidate.inmuebleAlias}
      {' · '}
      {candidate.ejercicio}
    </div>
    <div className="text-sm mt-0.5" style={{ color: 'var(--n-600)' }}>
      {formatCurrency(candidate.importe)}
    </div>

    <div className="flex items-center gap-2 mt-3">
      <button
        type="button"
        onClick={() => onVincular(candidate)}
        disabled={linking}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
        style={{
          borderRadius: 'var(--r-sm)',
          background: 'var(--teal-700, var(--blue))',
          color: 'var(--white)',
          opacity: linking ? 0.5 : 1,
        }}
      >
        <CheckCircle size={12} />
        Vincular
      </button>
      <button
        type="button"
        onClick={() => onDescartar(candidate)}
        disabled={linking}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border"
        style={{
          borderRadius: 'var(--r-sm)',
          borderColor: 'var(--n-300)',
          background: 'var(--white)',
          color: 'var(--n-700)',
          opacity: linking ? 0.5 : 1,
        }}
      >
        <X size={12} />
        Descartar
      </button>
    </div>
  </div>
);

// ── Manual assignment form for pendiente_asignacion ──────────────────────────

const ManualAssignmentForm: React.FC<{
  documentId: number;
  onAssigned: () => void;
}> = ({ documentId, onAssigned }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [inmuebleId, setInmuebleId] = useState<number | ''>('');
  const [tipo, setTipo] = useState<'mejora' | 'reparacion' | 'mobiliario'>('mejora');
  const [ejercicio, setEjercicio] = useState(new Date().getFullYear());
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    initDB().then(db => db.getAll('properties')).then(setProperties);
  }, []);

  const handleAssign = async () => {
    if (!inmuebleId) { toast.error('Selecciona un inmueble'); return; }
    setAssigning(true);
    try {
      const db = await initDB();
      const now = new Date().toISOString();

      if (tipo === 'mobiliario') {
        await db.add('mobiliarioActivo', {
          inmuebleId: inmuebleId as number,
          ejercicio,
          descripcion: 'Asignado desde factura',
          fechaAlta: `${ejercicio}-01-01`,
          importe: 0,
          vidaUtil: 10,
          activo: true,
          proveedorNIF: '',
          documentId,
          createdAt: now,
          updatedAt: now,
        });
        // Dual write: mueblesInmueble
        await mueblesInmuebleService.crear({
          inmuebleId: inmuebleId as number,
          ejercicio,
          descripcion: 'Asignado desde factura',
          fechaAlta: `${ejercicio}-01-01`,
          importe: 0,
          vidaUtil: 10,
          activo: true,
          documentId,
        }).catch(() => {});
      } else {
        await db.add('mejorasActivo', {
          inmuebleId: inmuebleId as number,
          ejercicio,
          descripcion: 'Asignado desde factura',
          tipo,
          importe: 0,
          proveedorNIF: '',
          documentId,
          createdAt: now,
          updatedAt: now,
        });
        // Dual write: mejorasInmueble
        await mejorasInmuebleService.crear({
          inmuebleId: inmuebleId as number,
          ejercicio,
          descripcion: 'Asignado desde factura',
          tipo: tipo as 'mejora' | 'ampliacion' | 'reparacion',
          importe: 0,
          fecha: `${ejercicio}-01-01`,
          documentId,
        }).catch(() => {});
      }

      // Mark document as Asignado
      const doc = await db.get('documents', documentId);
      if (doc) {
        doc.metadata = { ...doc.metadata, status: 'Asignado', matchCandidates: undefined };
        await db.put('documents', doc);
      }

      toast.success('Documento asignado correctamente');
      onAssigned();
    } catch (e: any) {
      toast.error(e.message || 'Error al asignar');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div
      className="border p-3"
      style={{ borderRadius: 'var(--r-md)', borderColor: 'var(--n-200)', background: 'var(--n-50)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Building size={14} style={{ color: 'var(--n-600)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--n-700)' }}>
          Asignación manual
        </span>
      </div>

      <div className="space-y-2">
        <select
          value={inmuebleId}
          onChange={(e) => setInmuebleId(e.target.value ? Number(e.target.value) : '')}
          className="w-full px-2 py-1.5 border text-xs"
          style={{ borderColor: 'var(--n-300)', borderRadius: 'var(--r-sm)', background: 'var(--white)' }}
        >
          <option value="">Seleccionar inmueble...</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.alias || p.address}</option>
          ))}
        </select>

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
          className="w-full px-2 py-1.5 border text-xs"
          style={{ borderColor: 'var(--n-300)', borderRadius: 'var(--r-sm)', background: 'var(--white)' }}
        >
          <option value="mejora">Mejora</option>
          <option value="reparacion">Reparación</option>
          <option value="mobiliario">Mobiliario</option>
        </select>

        <input
          type="number"
          value={ejercicio}
          onChange={(e) => setEjercicio(Number(e.target.value))}
          min={2015}
          max={2030}
          className="w-full px-2 py-1.5 border text-xs"
          placeholder="Ejercicio fiscal"
          style={{ borderColor: 'var(--n-300)', borderRadius: 'var(--r-sm)', background: 'var(--white)' }}
        />

        <button
          type="button"
          onClick={handleAssign}
          disabled={assigning || !inmuebleId}
          className="w-full px-3 py-1.5 text-xs font-medium"
          style={{
            borderRadius: 'var(--r-sm)',
            background: 'var(--blue)',
            color: 'var(--white)',
            opacity: (assigning || !inmuebleId) ? 0.5 : 1,
          }}
        >
          Asignar
        </button>
      </div>
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────

const InboxV3ExtractedPanel: React.FC<InboxV3ExtractedPanelProps> = ({
  document,
  onConfirm,
  onProcessOCR,
  processingOCR,
  onDocumentUpdated,
}) => {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [linking, setLinking] = useState(false);

  const ocr = document?.metadata?.ocr;
  const ocrStatus = ocr?.status;
  const hasCompletedOCR = ocrStatus === 'completed';
  const hasErroredOCR = ocrStatus === 'error';
  const hasOCR = !!ocr;
  const hasAnyExtractedValue = hasCompletedOCR && rowsHaveValues(document);

  const docStatus = document?.metadata?.status;
  const matchCandidates: CandidatoMatch[] = document?.metadata?.matchCandidates || [];
  const isPendienteVinculacion = docStatus === 'pendiente_vinculacion' && matchCandidates.length > 0;
  const isPendienteAsignacion = docStatus === 'pendiente_asignacion';

  // Reset candidate index when document changes
  useEffect(() => {
    setCandidateIndex(0);
  }, [document?.id]);

  const currentCandidate = matchCandidates[candidateIndex] || null;

  const handleVincular = async (candidate: CandidatoMatch) => {
    if (!document?.id) return;
    setLinking(true);
    try {
      // Support both new shape (tipo = store name) and old shape (store field)
      const store =
        (candidate as any).store ??
        (candidate.tipo === 'mobiliarioActivo' ? 'mobiliarioActivo' : 'mejorasActivo');
      await confirmLink(store as 'mejorasActivo' | 'mobiliarioActivo', candidate.id, document.id);

      // Update document status
      const db = await initDB();
      const doc = await db.get('documents', document.id);
      if (doc) {
        doc.metadata = { ...doc.metadata, status: 'Asignado', matchCandidates: undefined };
        await db.put('documents', doc);
      }

      toast.success('Documento vinculado correctamente');
      onDocumentUpdated?.(doc || { ...document, metadata: { ...document.metadata, status: 'Asignado', matchCandidates: undefined } });
    } catch (e: any) {
      toast.error(e.message || 'Error al vincular');
    } finally {
      setLinking(false);
    }
  };

  const handleDescartar = (candidate: CandidatoMatch) => {
    const nextIndex = candidateIndex + 1;
    if (nextIndex < matchCandidates.length) {
      // Show next candidate
      setCandidateIndex(nextIndex);
    } else {
      // No more candidates → switch to pendiente_asignacion
      const updateDoc = async () => {
        if (!document?.id) return;
        const db = await initDB();
        const doc = await db.get('documents', document.id);
        if (doc) {
          doc.metadata = { ...doc.metadata, status: 'pendiente_asignacion', matchCandidates: undefined };
          await db.put('documents', doc);
          onDocumentUpdated?.(doc);
        }
      };
      updateDoc();
    }
  };

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
    { label: 'Notas',          value: pickSnakeField(document, 'notas') },
  ];

  function rowsHaveValues(doc: any): boolean {
    const values = [
      pickSnakeField(doc, 'proveedor'),
      pickSnakeField(doc, 'numero_factura'),
      pickSnakeField(doc, 'fecha'),
      pickSnakeField(doc, 'base_imponible'),
      pickSnakeField(doc, 'iva'),
      pickSnakeField(doc, 'importe_total'),
      pickField(doc, ['supplier_name', 'invoice_id', 'invoice_date', 'net_amount', 'subtotal', 'tax_amount', 'total_amount', 'currency']),
    ];

    return values.some((value) => value !== '—');
  }

  return (
    <div className="h-full flex flex-col">

      {/* ── header ── */}
      <div className="h-14 px-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--n-200)' }}>
        <p style={{ color: 'var(--n-900)', fontFamily: 'var(--font-base)', fontSize: 'var(--t-lg)', fontWeight: 600, lineHeight: 1.3 }}>
          Datos extraídos
        </p>
        {hasCompletedOCR && !processingOCR && <span className="atlas-chip-positive">OCR completado</span>}
        {hasErroredOCR && !processingOCR && <span className="atlas-chip-negative">OCR con error</span>}
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

      {!processingOCR && hasErroredOCR && (
        <div className="h-full flex flex-col items-center justify-center px-6 gap-4 text-center">
          <ScanLine size={32} style={{ color: 'var(--s-neg)' }} />
          <p className="text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>
            El OCR no pudo procesar este documento.
          </p>
          {ocr?.error && (
            <p className="text-xs" style={{ color: 'var(--n-400)', fontFamily: 'var(--font-base)' }}>
              {ocr.error}
            </p>
          )}
          <button
            type="button"
            className="atlas-btn-primary w-full"
            onClick={onProcessOCR}
            disabled={!document}
          >
            <ScanLine size={16} />
            Reintentar OCR
          </button>
        </div>
      )}

      {!processingOCR && hasCompletedOCR && !hasAnyExtractedValue && (
        <div className="h-full flex flex-col items-center justify-center px-6 gap-4 text-center">
          <ScanLine size={32} style={{ color: 'var(--n-300)' }} />
          <p className="text-sm" style={{ color: 'var(--n-500)', fontFamily: 'var(--font-base)' }}>
            El OCR terminó, pero no devolvió campos utilizables.
          </p>
          <p className="text-xs" style={{ color: 'var(--n-400)', fontFamily: 'var(--font-base)' }}>
            Revisa el PDF y vuelve a procesarlo. Si el proveedor de OCR respondió texto no estructurado, ahora intentaremos recuperarlo mejor.
          </p>
          <button
            type="button"
            className="atlas-btn-primary w-full"
            onClick={onProcessOCR}
            disabled={!document}
          >
            <ScanLine size={16} />
            Reprocesar OCR
          </button>
        </div>
      )}

      {/* ── datos extraídos + matching ── */}
      {!processingOCR && hasCompletedOCR && hasAnyExtractedValue && (
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

            {/* ── Matching: pendiente_vinculacion ── */}
            {isPendienteVinculacion && currentCandidate && (
              <div className="mt-2">
                <MatchCandidateCard
                  candidate={currentCandidate}
                  onVincular={handleVincular}
                  onDescartar={handleDescartar}
                  linking={linking}
                />
                {matchCandidates.length > 1 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--n-400)' }}>
                    Candidato {candidateIndex + 1} de {matchCandidates.length}
                  </p>
                )}
              </div>
            )}

            {/* ── Matching: pendiente_asignacion ── */}
            {isPendienteAsignacion && document?.id && (
              <div className="mt-2">
                <ManualAssignmentForm
                  documentId={document.id}
                  onAssigned={() => {
                    onDocumentUpdated?.({ ...document, metadata: { ...document.metadata, status: 'Asignado', matchCandidates: undefined } });
                  }}
                />
              </div>
            )}
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
