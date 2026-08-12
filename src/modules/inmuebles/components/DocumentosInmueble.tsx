import React, { useEffect, useMemo, useState } from 'react';
import { initDB } from '../../../services/db';
import type { Document } from '../../../services/db';
import { MoneyValue } from '../../../design-system/v5';
import {
  aDocumentoVista,
  agruparDocumentos,
  type DocumentoVista,
} from '../utils/documentosInmuebleVista';
import styles from './DocumentosInmueble.module.css';

export interface DocumentosInmuebleProps {
  inmuebleId: number;
  /** IDs de documentos vinculados en `property.documents` (respaldo). */
  documentIds?: readonly number[];
}

/** Carga los documentos del inmueble desde IndexedDB (por entidad o por ids). */
async function cargarDocumentosInmueble(
  inmuebleId: number,
  documentIds: readonly number[],
): Promise<DocumentoVista[]> {
  const db = await initDB();
  const todos = (await db.getAll('documents')) as Document[];
  const ids = new Set(documentIds);
  const propios = todos.filter(
    (d) =>
      (d.metadata?.entityType === 'property' && d.metadata?.entityId === inmuebleId) ||
      (d.id != null && ids.has(d.id)),
  );
  return propios
    .map(aDocumentoVista)
    .filter((d): d is DocumentoVista => d !== null)
    .sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0));
}

const FolderIcon: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h9l3 3v15H6zM13 3v4h4" />
  </svg>
);

const DocIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h9l3 3v15H6zM13 3v4h4M9 13h6M9 17h4" />
  </svg>
);

const COLOR_CLASE: Record<string, string> = {
  contractual: 'c1',
  suministros: 'c2',
  seguros: 'c3',
  fiscal: 'c4',
  mejoras: 'c5',
  otros: 'c6',
};

const DocumentosInmueble: React.FC<DocumentosInmuebleProps> = ({ inmuebleId, documentIds }) => {
  const [docs, setDocs] = useState<DocumentoVista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [query, setQuery] = useState('');

  const idsKey = (documentIds ?? []).join(',');
  useEffect(() => {
    let activo = true;
    setCargando(true);
    cargarDocumentosInmueble(inmuebleId, documentIds ?? [])
      .then((res) => {
        if (activo) setDocs(res);
      })
      .catch(() => {
        if (activo) setDocs([]);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inmuebleId, idsKey]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) => d.nombre.toLowerCase().includes(q) || (d.proveedor ?? '').toLowerCase().includes(q),
    );
  }, [docs, query]);

  const carpetas = useMemo(() => agruparDocumentos(filtrados), [filtrados]);

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.search}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Buscar documento, proveedor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar documento"
          />
        </div>
        <span className={styles.count}>
          {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}
        </span>
      </div>

      {cargando ? (
        <div className={styles.empty}>Cargando documentos…</div>
      ) : carpetas.length === 0 ? (
        <div className={styles.empty}>
          {docs.length === 0
            ? 'Aún no hay documentos vinculados a este inmueble.'
            : 'Ningún documento coincide con la búsqueda.'}
        </div>
      ) : (
        <div className={styles.folders}>
          {carpetas.map((c) => (
            <div key={c.key} className={styles.folder}>
              <div className={styles.folHd}>
                <span className={`${styles.folIco} ${styles[COLOR_CLASE[c.key]]}`}>
                  <FolderIcon />
                </span>
                <div className={styles.folMeta}>
                  <div className={styles.folNm}>{c.label}</div>
                  <div className={styles.folSub}>{c.hint}</div>
                </div>
                <span className={styles.folCount}>{c.docs.length}</span>
              </div>
              <div className={styles.folList}>
                {c.docs.map((d) => (
                  <div key={d.id} className={styles.fDoc}>
                    <span className={styles.fdIco}>
                      <DocIcon />
                    </span>
                    <div className={styles.fdTx}>
                      <div className={styles.fdNm}>{d.nombre}</div>
                      <div className={styles.fdSub}>
                        {[d.proveedor, d.fecha].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {d.importe != null && (
                      <span className={styles.fdAmt}>
                        <MoneyValue value={d.importe} decimals={0} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentosInmueble;
