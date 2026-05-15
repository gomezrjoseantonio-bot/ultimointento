/**
 * Bloque 4 · Re-importar o exportar ejercicio · selector + 4 botones
 * (Re-importar · Exportar PDF · Ver versiones · Comparar).
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.2 / §8.3.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initDB } from '../../../../services/db';
import type { EjercicioFiscalCoord } from '../../../../services/ejercicioResolverService';
import styles from '../FiscalAccionesPage.module.css';

interface ToastFn {
  (msg: string): void;
}

export interface ReImportarExportarSectionProps {
  /** Inyección de feedback al usuario · default usa console.info */
  showToast?: ToastFn;
}

const ReImportarExportarSection: React.FC<ReImportarExportarSectionProps> = ({ showToast }) => {
  const navigate = useNavigate();
  const [años, setAños] = useState<number[]>([]);
  const [añoSel, setAñoSel] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const db = await initDB();
        const todos = (await db.getAll('ejerciciosFiscalesCoord')) as EjercicioFiscalCoord[];
        const declarados = todos
          .filter((e) => e.estado === 'declarado' || e.estado === 'pendiente')
          .map((e) => e.año)
          .sort((a, b) => b - a);
        setAños(declarados);
        if (declarados.length > 0) setAñoSel(declarados[0]);
      } catch { /* OK */ }
    })();
  }, []);

  const notify = (msg: string): void => {
    if (showToast) showToast(msg);
    else console.info('[fiscal acciones]', msg);
  };

  const onReimportar = () => {
    if (añoSel === null) return;
    navigate(`/fiscal/importar/${añoSel}`);
  };

  const onExportarPDF = () => {
    if (añoSel === null) return;
    // Export PDF · servicio dedicado pendiente · placeholder informativo
    notify(`Exportar PDF del ejercicio ${añoSel} · función disponible próximamente.`);
  };

  const onVerVersiones = () => {
    if (añoSel === null) return;
    navigate(`/fiscal/ejercicio/${añoSel}`);
  };

  const onComparar = () => {
    if (añoSel === null) return;
    notify(`Comparativa entre ejercicios · próximamente.`);
  };

  return (
    <>
      <div className={styles.fld}>
        <label className={styles.fldLab} htmlFor="reimport-anio">Ejercicio</label>
        <select
          id="reimport-anio"
          className={styles.fldSelect}
          value={añoSel ?? ''}
          onChange={(e) => setAñoSel(Number(e.target.value))}
          disabled={años.length === 0}
        >
          {años.length === 0 ? (
            <option value="">No hay ejercicios disponibles</option>
          ) : años.map((año) => (
            <option key={año} value={año}>{año}</option>
          ))}
        </select>
      </div>

      <div className={styles.btnGroup}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onReimportar}
          disabled={añoSel === null}
        >
          Re-importar declaración
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onExportarPDF}
          disabled={añoSel === null}
        >
          Exportar PDF
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onVerVersiones}
          disabled={añoSel === null}
        >
          Ver versiones
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onComparar}
          disabled={añoSel === null}
        >
          Comparar con otro año
        </button>
      </div>
    </>
  );
};

export default ReImportarExportarSection;
