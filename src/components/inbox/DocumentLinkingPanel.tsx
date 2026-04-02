/**
 * DocumentLinkingPanel — Pieza 8
 *
 * Shows when a document has matchCandidates (pendiente_vinculacion) or needs
 * manual assignment (pendiente_asignacion). Allows the user to:
 *  - Confirm an auto-detected link (NIF match)
 *  - Manually assign to an inmueble + tipo + ejercicio
 */
import React, { useState, useEffect } from 'react';
import { Link2, Building, CheckCircle, XCircle, Search, ChevronDown } from 'lucide-react';
import { confirmLink, rematchPendingDocuments, CandidatoMatch } from '../../services/documentMatchingService';
import { initDB, Property } from '../../services/db';

type MatchCandidate = CandidatoMatch;

interface DocumentLinkingPanelProps {
  documentId: number;
  candidates: MatchCandidate[];
  status: string;
  onLinked: () => void;
  onDismiss: () => void;
}

const TIPO_LABELS: Record<string, string> = {
  mejora: 'Mejora',
  ampliacion: 'Ampliaci\u00f3n',
  reparacion: 'Reparaci\u00f3n',
  mobiliario: 'Mobiliario',
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const DocumentLinkingPanel: React.FC<DocumentLinkingPanelProps> = ({
  documentId,
  candidates,
  status,
  onLinked,
  onDismiss,
}) => {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(status === 'pendiente_asignacion');

  // Manual assignment state
  const [properties, setProperties] = useState<Property[]>([]);
  const [manualInmuebleId, setManualInmuebleId] = useState<number | ''>('');
  const [manualTipo, setManualTipo] = useState<'mejora' | 'reparacion' | 'mobiliario'>('mejora');
  const [manualEjercicio, setManualEjercicio] = useState(new Date().getFullYear());

  useEffect(() => {
    if (showManual) {
      initDB().then(db => db.getAll('properties')).then(setProperties);
    }
  }, [showManual]);

  const handleConfirmLink = async (candidate: MatchCandidate) => {
    setLinking(true);
    setError(null);
    try {
      const store = candidate.tipo === 'mobiliarioActivo' ? 'mobiliarioActivo' : 'mejorasActivo';
      await confirmLink(store as 'mejorasActivo' | 'mobiliarioActivo', candidate.id, documentId);

      // Update document status to Asignado
      const db = await initDB();
      const doc = await db.get('documents', documentId);
      if (doc) {
        doc.metadata = { ...doc.metadata, status: 'Asignado', matchCandidates: undefined };
        await db.put('documents', doc);
      }
      onLinked();
    } catch (e: any) {
      setError(e.message || 'Error al vincular');
    } finally {
      setLinking(false);
    }
  };

  const handleManualCreate = async () => {
    if (!manualInmuebleId) { setError('Selecciona un inmueble'); return; }
    setLinking(true);
    setError(null);
    try {
      const db = await initDB();
      const now = new Date().toISOString();

      if (manualTipo === 'mobiliario') {
        const id = await db.add('mobiliarioActivo', {
          inmuebleId: manualInmuebleId as number,
          ejercicio: manualEjercicio,
          descripcion: 'Asignado desde factura',
          fechaAlta: `${manualEjercicio}-01-01`,
          importe: 0,
          vidaUtil: 10,
          activo: true,
          proveedorNIF: '',
          documentId,
          createdAt: now,
          updatedAt: now,
        });
        void id;
      } else {
        const id = await db.add('mejorasActivo', {
          inmuebleId: manualInmuebleId as number,
          ejercicio: manualEjercicio,
          descripcion: 'Asignado desde factura',
          tipo: manualTipo,
          importe: 0,
          proveedorNIF: '',
          documentId,
          createdAt: now,
          updatedAt: now,
        });
        void id;
      }

      // Mark document as assigned
      const doc = await db.get('documents', documentId);
      if (doc) {
        doc.metadata = { ...doc.metadata, status: 'Asignado', matchCandidates: undefined };
        await db.put('documents', doc);
      }
      onLinked();
    } catch (e: any) {
      setError(e.message || 'Error al crear registro');
    } finally {
      setLinking(false);
    }
  };

  const unlinkedCandidates = candidates.filter(c => !c.alreadyLinked);
  const linkedCandidates = candidates.filter(c => c.alreadyLinked);

  return (
    <div className="border border-navy-200 bg-navy-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-navy-700" />
          <h3 className="text-sm font-semibold text-navy-900">
            {unlinkedCandidates.length > 0
              ? 'Coincidencias encontradas'
              : 'Asignar factura manualmente'}
          </h3>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          Descartar
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-error-100 text-error-800 text-xs rounded">
          {error}
        </div>
      )}

      {/* Auto-matched candidates */}
      {unlinkedCandidates.length > 0 && (
        <div className="space-y-2 mb-3">
          {unlinkedCandidates.map((c) => (
            <div
              key={`${c.tipo}-${c.id}`}
              className="flex items-center justify-between bg-white border border-neutral-200 p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <Building className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                  <span className="font-medium text-neutral-900 truncate">
                    {c.inmuebleAlias}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 bg-neutral-100 text-neutral-700">
                    {TIPO_LABELS[c.tipoGasto] || c.tipoGasto}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {c.ejercicio}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-600 truncate">
                  {c.descripcion} &middot; {formatCurrency(c.importe)}
                  {c.proveedorNombre && ` &middot; ${c.proveedorNombre}`}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <span className="text-xs text-neutral-400">
                  {c.score}%
                </span>
                <button
                  onClick={() => handleConfirmLink(c)}
                  disabled={linking}
                  className="flex items-center gap-1 px-3 py-1.5 bg-navy-700 text-white text-xs font-medium hover:bg-navy-800 disabled:opacity-50"
                >
                  <CheckCircle className="w-3 h-3" />
                  Vincular
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Already-linked candidates (collapsed) */}
      {linkedCandidates.length > 0 && (
        <details className="mb-3">
          <summary className="text-xs text-neutral-500 cursor-pointer">
            {linkedCandidates.length} operaci{linkedCandidates.length === 1 ? '\u00f3n' : 'ones'} ya vinculada{linkedCandidates.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-2 space-y-1">
            {linkedCandidates.map((c) => (
              <div
                key={`${c.tipo}-${c.id}`}
                className="flex items-center gap-2 p-2 bg-neutral-50 text-xs text-neutral-500"
              >
                <Building className="w-3 h-3" />
                <span>{c.inmuebleAlias} &middot; {TIPO_LABELS[c.tipoGasto] || c.tipoGasto} &middot; {c.ejercicio} &middot; {formatCurrency(c.importe)}</span>
                <span className="ml-auto text-neutral-400">ya vinculada</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Toggle manual assignment */}
      {!showManual && (
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-1 text-xs text-navy-700 hover:text-navy-900"
        >
          <ChevronDown className="w-3 h-3" />
          Asignar manualmente
        </button>
      )}

      {/* Manual assignment form */}
      {showManual && (
        <div className="border-t border-neutral-200 pt-3 mt-3">
          <p className="text-xs text-neutral-600 mb-2">
            Asignar esta factura a una operaci&oacute;n nueva:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={manualInmuebleId}
              onChange={(e) => setManualInmuebleId(e.target.value ? Number(e.target.value) : '')}
              className="px-2 py-1.5 border border-neutral-200 text-xs"
            >
              <option value="">Inmueble...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.alias || p.address}
                </option>
              ))}
            </select>

            <select
              value={manualTipo}
              onChange={(e) => setManualTipo(e.target.value as any)}
              className="px-2 py-1.5 border border-neutral-200 text-xs"
            >
              <option value="mejora">Mejora</option>
              <option value="reparacion">Reparaci&oacute;n</option>
              <option value="mobiliario">Mobiliario</option>
            </select>

            <input
              type="number"
              value={manualEjercicio}
              onChange={(e) => setManualEjercicio(Number(e.target.value))}
              min={2015}
              max={2030}
              className="px-2 py-1.5 border border-neutral-200 text-xs"
              placeholder="Ejercicio"
            />
          </div>

          <button
            onClick={handleManualCreate}
            disabled={linking || !manualInmuebleId}
            className="mt-2 px-3 py-1.5 bg-navy-700 text-white text-xs font-medium hover:bg-navy-800 disabled:opacity-50"
          >
            Crear y vincular
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentLinkingPanel;
