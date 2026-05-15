/**
 * OptimizacionesNote · nota descartable con resumen de optimizaciones
 * aplicadas por ATLAS (sin acrónimos R10/N4/etc · texto humano).
 *
 * Persiste el cierre en localStorage por inmueble · año.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 §6.2.
 */

import React, { useEffect, useState } from 'react';
import styles from './FiscalInmueblePage.module.css';

export interface OptimizacionLinea {
  titulo: string;
  detalle?: string;
}

export interface OptimizacionesNoteProps {
  inmuebleId: number;
  año: number;
  lineas: OptimizacionLinea[];
}

const STORAGE_PREFIX = 'fiscal.note.optimizaciones';

const OptimizacionesNote: React.FC<OptimizacionesNoteProps> = ({
  inmuebleId,
  año,
  lineas,
}) => {
  const key = `${STORAGE_PREFIX}.${inmuebleId}.${año}.dismissed`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(key) === 'true'); } catch { /* noop */ }
  }, [key]);

  if (dismissed || lineas.length === 0) return null;

  const onClose = () => {
    try { localStorage.setItem(key, 'true'); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div className={styles.noteBlock} role="note">
      <button
        type="button"
        className={styles.noteClose}
        onClick={onClose}
        aria-label="Descartar nota de optimizaciones"
      >
        ×
      </button>
      <div className={styles.noteTitle}>Optimizaciones aplicadas por ATLAS</div>
      <div className={styles.noteBody}>
        {lineas.map((l, idx) => (
          <p key={idx}>
            <strong>{l.titulo}</strong>
            {l.detalle ? ` ${l.detalle}` : ''}
          </p>
        ))}
      </div>
    </div>
  );
};

export default OptimizacionesNote;
