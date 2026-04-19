import React, { useEffect, useRef, useState } from 'react';
import { FileText, Landmark, UploadCloud, X, Eye, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB } from '../../../../../services/db';
import type { Document } from '../../../../../services/db';
import {
  attachDocumentToEvent,
  detachDocumentFromEvent,
  setDocumentNoAplica,
  type DocSlot,
} from '../../../../../services/treasuryConfirmationService';
import { fileSizeLabel, timeAgoLabel } from '../utils/conciliacionFormatters';

interface DocumentPickerPopoverProps {
  slot: DocSlot;
  eventId: number;
  anchorElement: HTMLElement;
  currentDocumentId?: number;
  currentDocName?: string;
  currentDocSize?: number;
  currentDocUploadedAt?: string;
  currentNoAplica: boolean;
  facturaDocumentId?: number;   // para "Usar mismo archivo que la factura" (solo si slot='justificante')
  onClose: () => void;
  onChanged: () => void;        // recarga del padre tras cambios
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME = 'application/pdf,image/*';

interface PopoverPosition {
  top: number;
  left: number;
  placement: 'below' | 'above';
}

function computePosition(anchor: HTMLElement, popoverHeightEstimate = 280): PopoverPosition {
  const rect = anchor.getBoundingClientRect();
  const popoverWidth = 380;

  // Preferimos abajo. Si no cabe, arriba.
  const spaceBelow = window.innerHeight - rect.bottom;
  const placement: 'below' | 'above' = spaceBelow >= popoverHeightEstimate ? 'below' : 'above';

  let left = rect.left;
  if (left + popoverWidth > window.innerWidth - 12) {
    left = window.innerWidth - popoverWidth - 12;
  }
  if (left < 12) left = 12;

  let top: number;
  if (placement === 'below') {
    top = rect.bottom + 6;
  } else {
    top = rect.top - popoverHeightEstimate - 6;
    if (top < 12) top = 12;
  }

  return { top, left, placement };
}

const DocumentPickerPopover: React.FC<DocumentPickerPopoverProps> = ({
  slot,
  eventId,
  anchorElement,
  currentDocumentId,
  currentDocName,
  currentDocSize,
  currentDocUploadedAt,
  currentNoAplica,
  facturaDocumentId,
  onClose,
  onChanged,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<PopoverPosition>(() =>
    computePosition(anchorElement),
  );
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Document[]>([]);

  // Cerrar al click fuera / ESC
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(e.target as Node)) return;
      if (anchorElement.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorElement, onClose]);

  // Reposicionar al cambiar tamaño de ventana
  useEffect(() => {
    const handler = () => setPosition(computePosition(anchorElement));
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [anchorElement]);

  // Búsqueda en Inbox (solo cuando no hay documento asociado)
  useEffect(() => {
    if (currentDocumentId) return;
    const q = search.trim().toLowerCase();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const db = await initDB();
      const all = (await db.getAll('documents')) as Document[];
      if (cancelled) return;
      const filtered = all
        .filter((d) => (d.filename || '').toLowerCase().includes(q))
        .slice(0, 6);
      setSearchResults(filtered);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, currentDocumentId]);

  const slotTitleAttached = slot === 'factura' ? 'Factura adjuntada' : 'Justificante adjuntado';
  const slotTitleEmpty = slot === 'factura' ? 'Asociar factura' : 'Asociar justificante bancario';
  const Icon = slot === 'factura' ? FileText : Landmark;

  const uploadAndAttach = async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast.error('El archivo supera los 10MB. Elige uno más pequeño.');
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const documentPayload: Omit<Document, 'id'> = {
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
      const db = await initDB();
      const newId = Number(await (db as any).add('documents', documentPayload));
      await attachDocumentToEvent(eventId, slot, newId);
      toast.success(slot === 'factura' ? 'Factura asociada' : 'Justificante asociado');
      onChanged();
      onClose();
    } catch (err) {
      console.error('[DocumentPickerPopover] upload failed', err);
      toast.error('No se pudo subir el archivo');
    } finally {
      setBusy(false);
    }
  };

  const attachExisting = async (documentId: number) => {
    setBusy(true);
    try {
      await attachDocumentToEvent(eventId, slot, documentId);
      toast.success(slot === 'factura' ? 'Factura asociada' : 'Justificante asociado');
      onChanged();
      onClose();
    } catch (err) {
      console.error('[DocumentPickerPopover] attach failed', err);
      toast.error('No se pudo asociar el documento');
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async () => {
    setBusy(true);
    try {
      await detachDocumentFromEvent(eventId, slot);
      toast.success('Asociación retirada');
      onChanged();
      onClose();
    } catch (err) {
      console.error('[DocumentPickerPopover] detach failed', err);
      toast.error('No se pudo retirar la asociación');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleNoAplica = async (value: boolean) => {
    setBusy(true);
    try {
      await setDocumentNoAplica(eventId, slot, value);
      onChanged();
      if (value) onClose();
    } catch (err) {
      console.error('[DocumentPickerPopover] setNoAplica failed', err);
      toast.error('No se pudo actualizar el estado');
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadAndAttach(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = () => setDragActive(false);

  const openFilePicker = () => fileInputRef.current?.click();
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadAndAttach(file);
    e.target.value = '';
  };

  const handleViewDocument = async () => {
    if (!currentDocumentId) return;
    const db = await initDB();
    const doc = (await db.get('documents', currentDocumentId)) as Document | undefined;
    if (!doc) {
      toast.error('Documento no encontrado');
      return;
    }
    const url = URL.createObjectURL(doc.content);
    window.open(url, '_blank', 'noopener');
  };

  const style: React.CSSProperties = {
    top: position.top,
    left: position.left,
  };

  const hasDocument = !!currentDocumentId;

  return (
    <>
      <div className="cv2-popover-backdrop" />
      <div ref={popoverRef} className="cv2-popover cv2-scope" style={style} role="dialog" aria-label={hasDocument ? slotTitleAttached : slotTitleEmpty}>
        <div className="cv2-popover-header">
          <span
            className={`cv2-popover-title ${hasDocument ? 'cv2-popover-title--attached' : ''}`}
          >
            <Icon size={14} />
            {hasDocument ? slotTitleAttached : slotTitleEmpty}
          </span>
          <button type="button" className="cv2-btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="cv2-popover-body">
          {hasDocument ? (
            <>
              <div className="cv2-attached-preview">
                <span className="cv2-attached-preview-icon">
                  <FileText size={22} />
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="cv2-attached-preview-name">{currentDocName}</div>
                  <div className="cv2-attached-preview-meta">
                    {currentDocSize ? fileSizeLabel(currentDocSize) : ''}
                    {currentDocSize && currentDocUploadedAt ? ' · ' : ''}
                    {currentDocUploadedAt ? `subido ${timeAgoLabel(currentDocUploadedAt)}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button
                  type="button"
                  className="cv2-btn cv2-btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleViewDocument}
                  disabled={busy}
                >
                  <Eye size={14} />
                  Ver
                </button>
                <button
                  type="button"
                  className="cv2-btn cv2-btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={openFilePicker}
                  disabled={busy}
                >
                  <Upload size={14} />
                  Reemplazar
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                className={`cv2-dropzone ${dragActive ? 'cv2-dropzone--active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={openFilePicker}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFilePicker();
                  }
                }}
              >
                <div className="cv2-dropzone-icon">
                  <UploadCloud size={28} />
                </div>
                <div className="cv2-dropzone-text">
                  Arrastra aquí o haz clic para seleccionar
                </div>
                <div className="cv2-dropzone-hint">PDF, imagen · máx. 10MB</div>
              </div>

              <div className="cv2-separator-o">o</div>

              <div>
                <label className="cv2-field-label">Buscar en Inbox</label>
                <input
                  type="text"
                  className="cv2-text-input"
                  placeholder="Buscar por nombre de archivo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {searchResults.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className="cv2-btn cv2-btn-secondary"
                        style={{ justifyContent: 'flex-start', fontSize: 12 }}
                        onClick={() => attachExisting(doc.id!)}
                        disabled={busy}
                      >
                        <FileText size={14} />
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {doc.filename}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME}
            style={{ display: 'none' }}
            onChange={onFileSelected}
          />
        </div>

        <div className="cv2-popover-footer">
          {hasDocument ? (
            <>
              <button
                type="button"
                className="cv2-link-action cv2-link-action--teal"
                onClick={handleDetach}
                disabled={busy}
              >
                Quitar asociación
              </button>
              <span style={{ color: 'var(--cv2-grey-500)', fontSize: 11 }}>
                {currentDocUploadedAt ? new Date(currentDocUploadedAt).toLocaleDateString('es-ES') : ''}
              </span>
            </>
          ) : (
            <>
              <label className="cv2-na-check">
                <input
                  type="checkbox"
                  checked={currentNoAplica}
                  onChange={(e) => void handleToggleNoAplica(e.target.checked)}
                  disabled={busy}
                />
                No aplica
              </label>
              {slot === 'justificante' && facturaDocumentId && (
                <button
                  type="button"
                  className="cv2-link-action"
                  onClick={() => attachExisting(facturaDocumentId)}
                  disabled={busy}
                >
                  Usar mismo archivo que la factura
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default DocumentPickerPopover;
