// src/pages/GestionInmuebles/tabs/FacturaSelectorModal.tsx
// Asocia / desvincula una factura (Document del Inbox) a una línea de
// reparación, mejora o mobiliario.

import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, FileText, Link2Off } from 'lucide-react';
import { initDB, type Document } from '../../../services/db';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

const C = {
  navy900: 'var(--navy-900, #042C5E)',
  teal600: 'var(--teal-600, #00A7B5)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey100: 'var(--grey-100, #EEF1F5)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey300: 'var(--grey-300, #C8D0DC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
  white: '#FFFFFF',
};

interface LineaInfo {
  id: number;
  concepto: string;
  proveedorNIF?: string;
  importe: number;
  currentDocumentId?: number;
}

interface Props {
  linea: LineaInfo;
  onCancel: () => void;
  onAssociate: (documentId: number | null) => void | Promise<void>;
}

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + ' €';

const FacturaSelectorModal: React.FC<Props> = ({ linea, onCancel, onAssociate }) => {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  // Accesibilidad: foco atrapado + Escape cierra (patrón repo via evento
  // `modal-escape`).
  const focusTrapRef = useFocusTrap(true);
  useEffect(() => {
    const node = focusTrapRef.current;
    if (!node) return;
    const handler = () => onCancel();
    node.addEventListener('modal-escape', handler);
    return () => node.removeEventListener('modal-escape', handler);
  }, [focusTrapRef, onCancel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const all = (await db.getAll('documents')) as Document[];
        if (cancelled) return;
        // Mostrar facturas primero: filtra por metadata.tipo === 'Factura'
        // y documentos con nombre o tags que sugieran factura. Añade los demás
        // después por si el usuario quiere elegir otro tipo.
        const score = (d: Document) => {
          if (d.metadata?.tipo === 'Factura') return 0;
          if (d.metadata?.carpeta === 'facturas') return 1;
          if ((d.filename || '').toLowerCase().includes('factura')) return 2;
          return 3;
        };
        const sorted = [...all].sort((a, b) => {
          const s = score(a) - score(b);
          if (s !== 0) return s;
          return (b.lastModified || 0) - (a.lastModified || 0);
        });
        setDocs(sorted);
      } catch (err) {
        console.warn('No se pudieron cargar los documentos del Inbox:', err);
        setDocs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      const haystacks = [
        d.filename,
        d.metadata?.title,
        d.metadata?.contraparte,
        d.metadata?.counterpartyName,
        d.metadata?.proveedor,
        d.metadata?.financialData?.invoiceNumber,
      ];
      return haystacks.some((h) => typeof h === 'string' && h.toLowerCase().includes(q));
    });
  }, [docs, filter]);

  const fmtDateMs = (ms?: number) => {
    if (!ms) return '—';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES');
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 15, 30, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 20,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="factura-selector-modal-title"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{
          background: C.white,
          borderRadius: 12,
          width: '100%',
          maxWidth: 640,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          outline: 'none',
        }}
      >
        <header
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.grey200}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 id="factura-selector-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.grey900 }}>
              {linea.currentDocumentId ? 'Cambiar factura vinculada' : 'Asociar factura del Inbox'}
            </h2>
            <div style={{ fontSize: 12, color: C.grey500, marginTop: 4 }}>
              {linea.concepto} · {fmtEuro(linea.importe)}
              {linea.proveedorNIF ? ` · ${linea.proveedorNIF}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.grey500 }}
          >
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.grey200}` }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: `1px solid ${C.grey300}`,
              borderRadius: 8,
              padding: '6px 10px',
              background: C.white,
            }}
          >
            <Search size={14} color={C.grey500} />
            <input
              type="text"
              placeholder="Buscar por nombre, proveedor o nº factura..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 13,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                color: C.grey900,
                background: 'transparent',
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: C.grey500, fontSize: 13 }}>
              Cargando documentos...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: C.grey500, fontSize: 13 }}>
              {filter ? 'Sin resultados para el filtro' : 'No hay documentos en el Inbox'}.{' '}
              <a
                href="/inbox"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.navy900, textDecoration: 'underline' }}
              >
                Subir factura al Inbox
              </a>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filtered.map((d) => {
                const selected = d.id === linea.currentDocumentId;
                return (
                  <li
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 20px',
                      borderBottom: `1px solid ${C.grey100}`,
                      background: selected ? C.grey50 : C.white,
                    }}
                  >
                    <FileText size={16} color={selected ? C.teal600 : C.grey500} />
                    <div style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: C.grey900,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.filename}
                      </div>
                      <div style={{ fontSize: 11, color: C.grey500, marginTop: 2 }}>
                        {d.metadata?.proveedor || d.metadata?.counterpartyName || d.metadata?.contraparte || '—'}
                        {' · '}
                        {fmtDateMs(d.lastModified)}
                        {d.metadata?.tipo ? ` · ${d.metadata.tipo}` : ''}
                      </div>
                    </div>
                    {selected ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: C.teal600,
                          fontWeight: 500,
                          marginRight: 8,
                        }}
                      >
                        Vinculada
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => d.id != null && onAssociate(d.id)}
                      disabled={selected || d.id == null}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: 6,
                        background: selected ? C.grey200 : C.navy900,
                        color: selected ? C.grey500 : C.white,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: selected ? 'not-allowed' : 'pointer',
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      }}
                    >
                      {selected ? 'Actual' : 'Asociar'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${C.grey200}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {linea.currentDocumentId ? (
            <button
              type="button"
              onClick={() => onAssociate(null)}
              style={{
                padding: '8px 16px',
                border: `1.5px solid ${C.grey300}`,
                background: C.white,
                color: C.grey700,
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}
            >
              <Link2Off size={14} /> Desvincular
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: `1.5px solid ${C.grey300}`,
              background: C.white,
              color: C.grey700,
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default FacturaSelectorModal;
