/**
 * EjercicioDocumentosTab · tab "Documentos" del ejercicio.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.2.
 */

import React from 'react';
import styles from './FiscalEjercicioPage.module.css';

export interface DocumentoRow {
  id?: number;
  titulo: string;
  concepto?: string;
  fecha?: string;
  tipo?: string;
}

export interface EjercicioDocumentosTabProps {
  documentos: DocumentoRow[];
  onSelectDocumento?: (id: number) => void;
}

function fmtFecha(iso?: string): string {
  if (!iso) return '—';
  const dateStr = iso.length > 10 ? iso.slice(0, 10) : iso;
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const EjercicioDocumentosTab: React.FC<EjercicioDocumentosTabProps> = ({
  documentos,
  onSelectDocumento,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.cardHd}>
        <div>
          <div className={styles.cardTitle}>Documentos fuente del ejercicio</div>
          <div className={styles.cardSub}>
            archivos importados que alimentaron las casillas (XML AEAT · PDF · certificados · facturas)
          </div>
        </div>
      </div>
      <div>
        {documentos.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateTitle}>Sin documentos importados</div>
            <div>Cuando importes XML AEAT, PDF del Modelo 100 o certificados de retención aparecerán aquí.</div>
          </div>
        ) : (
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Concepto</th>
                <th>Fecha</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((doc, idx) => (
                <tr
                  key={doc.id ?? `doc-${idx}`}
                  onClick={() => onSelectDocumento && doc.id && onSelectDocumento(doc.id)}
                  style={onSelectDocumento ? { cursor: 'pointer' } : undefined}
                >
                  <td className={styles.tStrong}>{doc.titulo}</td>
                  <td>{doc.concepto ?? '—'}</td>
                  <td>
                    <span className={styles.mono}>{fmtFecha(doc.fecha)}</span>
                  </td>
                  <td>{doc.tipo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EjercicioDocumentosTab;
