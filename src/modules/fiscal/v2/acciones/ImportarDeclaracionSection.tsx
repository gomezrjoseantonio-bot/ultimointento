/**
 * Bloque 2 · Importar declaración Modelo 100 · selector ejercicio +
 * dropzone (navega al wizard existente con el año) + histórico.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.2 / §8.3.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initDB } from '../../../../services/db';
import type { EjercicioFiscalCoord } from '../../../../services/ejercicioResolverService';
import styles from '../FiscalAccionesPage.module.css';

interface HistoricoRow {
  año: number;
  origen: string;
  fechaImportacion: string;
}

function fmtFecha(iso?: string): string {
  if (!iso) return '—';
  const date = iso.slice(0, 10);
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function describirFuente(fuente?: 'xml' | 'pdf' | 'manual', complementaria?: boolean): string {
  const base = fuente === 'xml' ? 'XML AEAT'
    : fuente === 'pdf' ? 'PDF Modelo 100'
      : fuente === 'manual' ? 'Importación manual'
        : 'Sin fuente';
  return complementaria ? `${base} (v2 paralela)` : base;
}

const ImportarDeclaracionSection: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [añoDestino, setAñoDestino] = useState<number>(new Date().getFullYear());
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = await initDB();
        const todos = (await db.getAll('ejerciciosFiscalesCoord')) as EjercicioFiscalCoord[];
        const rows = todos
          .filter((e) => e.aeat?.fechaImportacion)
          .map((e) => ({
            año: e.año,
            origen: describirFuente(
              e.aeat!.fuenteImportacion,
              (e.aeat!.declaracionCompleta as any)?.meta?.esComplementaria,
            ),
            fechaImportacion: e.aeat!.fechaImportacion,
          }))
          .sort((a, b) => b.año - a.año);
        setHistorico(rows);
      } catch { /* sin ejercicios coord · OK */ }
    })();
  }, []);

  // Pasamos el File al wizard via `navigate state` · evita doble selección
  // de archivo. El wizard puede leer `useLocation().state.archivoImportado`
  // y arrancar la importación directamente (compat backward · si no hay
  // state, el wizard abre su propio selector como antes).
  const navegarConArchivo = (file: File | null) => {
    navigate(`/fiscal/importar/${añoDestino}`, {
      state: file ? { archivoImportado: file, nombre: file.name } : undefined,
    });
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) navegarConArchivo(file);
  };

  const onSelectFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    // Reset input para permitir re-seleccionar el mismo archivo (p.ej.
    // tras un error en el wizard) y disparar onChange de nuevo.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (file) navegarConArchivo(file);
  };

  const añosDisponibles = (() => {
    const hoy = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => hoy - i);
  })();

  return (
    <>
      <div className={styles.fld}>
        <label className={styles.fldLab} htmlFor="importar-anio">Ejercicio fiscal destino</label>
        <select
          id="importar-anio"
          className={styles.fldSelect}
          value={añoDestino}
          onChange={(e) => setAñoDestino(Number(e.target.value))}
        >
          {añosDisponibles.map((año) => (
            <option key={año} value={año}>
              {año}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
        onClick={onSelectFile}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectFile(); } }}
        aria-label="Importar declaración del Modelo 100"
      >
        <div className={styles.dropzoneIcon} aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className={styles.dropzoneTitle}>Arrastra aquí XML · PDF · TXT del Modelo 100</div>
        <div className={styles.dropzoneSub}>o haz click para seleccionar archivo</div>
        <input
          ref={fileInputRef}
          type="file"
          className={styles.dropzoneHidden}
          accept=".xml,.pdf,.txt"
          onChange={onFileChange}
          aria-hidden="true"
        />
      </div>

      <div className={styles.sectionLabel}>Histórico de importaciones</div>
      {historico.length === 0 ? (
        <div className={styles.emptyBlock}>Aún no has importado ninguna declaración.</div>
      ) : (
        <table className={styles.tbl}>
          <tbody>
            {historico.map((row) => (
              <tr key={row.año}>
                <td>
                  <span className={`${styles.mono} ${styles.tStrong}`}>{row.año}</span>
                </td>
                <td>{row.origen}</td>
                <td>
                  <span className={styles.mono}>{fmtFecha(row.fechaImportacion)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
};

export default ImportarDeclaracionSection;
