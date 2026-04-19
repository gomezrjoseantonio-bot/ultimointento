import React, { useRef } from 'react';
import { FileText, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB } from '../../../../../services/db';
import type { Document } from '../../../../../services/db';
import {
  attachDocumentToEvent,
  detachDocumentFromEvent,
  setDocumentNoAplica,
  type DocSlot as DocSlotName,
} from '../../../../../services/treasuryConfirmationService';
import type { DocSlotState } from '../hooks/useMonthConciliacion';

interface DocSlotProps {
  slot: DocSlotName;
  eventId: number;
  state: DocSlotState;
  facturaDocumentId?: number;
  onChanged: () => void;
}

const MAX_SIZE = 10 * 1024 * 1024;

const DocSlot: React.FC<DocSlotProps> = ({
  slot,
  eventId,
  state,
  facturaDocumentId,
  onChanged,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const Icon = slot === 'factura' ? FileText : Landmark;

  const slotTitle =
    slot === 'factura'
      ? 'Factura o recibo del proveedor'
      : 'Justificante bancario';

  const isAttached = !!state.documentId;
  const classes = ['cv2-doc-slot'];
  if (isAttached) classes.push('cv2-doc-slot--attached');
  else if (state.noAplica) classes.push('cv2-doc-slot--no-aplica');

  const handleView = async () => {
    if (!state.documentId) return;
    const db = await initDB();
    const doc = (await db.get('documents', state.documentId)) as Document | undefined;
    if (!doc) {
      toast.error('Documento no encontrado');
      return;
    }
    const url = URL.createObjectURL(doc.content);
    window.open(url, '_blank', 'noopener');
  };

  const handleUpload = async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast.error('El archivo supera los 10MB');
      return;
    }
    const now = new Date().toISOString();
    const db = await initDB();
    const payload: Omit<Document, 'id'> = {
      filename: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      content: file,
      metadata: {
        tipo: slot === 'factura' ? 'Factura' : 'Otros',
        status: 'Asignado',
        carpeta: slot === 'factura' ? 'facturas' : 'extractos',
      },
      uploadDate: now,
    };
    const id = Number(await (db as any).add('documents', payload));
    await attachDocumentToEvent(eventId, slot, id);
    toast.success(slot === 'factura' ? 'Factura asociada' : 'Justificante asociado');
    onChanged();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    e.target.value = '';
  };

  const handleDetach = async () => {
    await detachDocumentFromEvent(eventId, slot);
    toast.success('Asociación retirada');
    onChanged();
  };

  const handleToggleNoAplica = async (value: boolean) => {
    await setDocumentNoAplica(eventId, slot, value);
    onChanged();
  };

  const useSameAsFactura = async () => {
    if (!facturaDocumentId) return;
    await attachDocumentToEvent(eventId, slot, facturaDocumentId);
    toast.success('Justificante asociado');
    onChanged();
  };

  return (
    <div className={classes.join(' ')}>
      <div className="cv2-doc-slot-header">
        <span className="cv2-doc-slot-title">
          <Icon size={14} />
          {slotTitle}
        </span>
        {isAttached && <span className="cv2-attached-info">✓ Adjuntada</span>}
      </div>

      <div className="cv2-doc-slot-body">
        {isAttached ? (
          <>
            <input type="text" value={state.docName ?? ''} readOnly style={{ background: 'white' }} />
            <button
              type="button"
              className="cv2-btn cv2-btn-secondary"
              style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={handleView}
            >
              Ver
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Buscar o arrastrar archivo..."
              disabled={state.noAplica}
            />
            <button
              type="button"
              className="cv2-btn cv2-btn-secondary"
              style={{ padding: '6px 10px', fontSize: 12 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={state.noAplica}
            >
              Subir
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              style={{ display: 'none' }}
              onChange={onFileSelected}
            />
          </>
        )}
      </div>

      <div className="cv2-doc-slot-footer">
        <label className="cv2-na-check">
          <input
            type="checkbox"
            checked={state.noAplica}
            onChange={(e) => void handleToggleNoAplica(e.target.checked)}
          />
          No aplica
        </label>
        {isAttached ? (
          <button type="button" className="cv2-link-action" onClick={handleDetach}>
            Quitar
          </button>
        ) : slot === 'justificante' && facturaDocumentId ? (
          <button type="button" className="cv2-link-action" onClick={useSameAsFactura}>
            Usar mismo archivo que factura
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
};

export default DocSlot;
