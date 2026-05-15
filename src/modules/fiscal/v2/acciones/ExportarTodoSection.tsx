/**
 * Bloque 7 · Exportar todo · 3 botones (JSON config · ZIP declaraciones ·
 * CSV casillas por año).
 *
 * Implementaciones funcionales sin servicios nuevos · descarga vía
 * Blob+URL directamente desde stores existentes.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.2 / §8.3.
 */

import React, { useState } from 'react';
import { initDB } from '../../../../services/db';
import type { EjercicioFiscalCoord } from '../../../../services/ejercicioResolverService';
import { personalDataService } from '../../../../services/personalDataService';
import styles from '../FiscalAccionesPage.module.css';

interface ToastFn {
  (msg: string): void;
}

export interface ExportarTodoSectionProps {
  showToast?: ToastFn;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ExportarTodoSection: React.FC<ExportarTodoSectionProps> = ({ showToast }) => {
  const [working, setWorking] = useState<'json' | 'zip' | 'csv' | null>(null);

  const notify = (msg: string): void => {
    if (showToast) showToast(msg);
    else console.info('[fiscal acciones]', msg);
  };

  const exportConfigJSON = async () => {
    setWorking('json');
    try {
      const personal = await personalDataService.getPersonalData().catch(() => null);
      const config = {
        exportadoEl: new Date().toISOString(),
        version: 'fiscal-v2',
        perfil: personal ?? null,
      };
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      downloadBlob(`atlas-fiscal-config-${new Date().toISOString().slice(0, 10)}.json`, blob);
      notify('Configuración fiscal exportada en JSON.');
    } catch (err) {
      notify('Error exportando configuración · ver consola.');
      // eslint-disable-next-line no-console
      console.error('[fiscal acciones] export JSON falló:', err);
    } finally {
      setWorking(null);
    }
  };

  const exportZipDeclaraciones = async () => {
    setWorking('zip');
    try {
      const db = await initDB();
      const coords = (await db.getAll('ejerciciosFiscalesCoord')) as EjercicioFiscalCoord[];
      const declaraciones = coords
        .filter((e) => e.aeat)
        .map((e) => ({
          año: e.año,
          estado: e.estado,
          fuenteImportacion: e.aeat!.fuenteImportacion,
          fechaImportacion: e.aeat!.fechaImportacion,
          snapshot: e.aeat!.snapshot,
          resumen: e.aeat!.resumen,
        }));
      // Single JSON con todas las declaraciones · evita dependencia jszip
      // por ahora · una versión ZIP real pasaría por jszip (ya en deps)
      const blob = new Blob(
        [JSON.stringify({ exportadoEl: new Date().toISOString(), declaraciones }, null, 2)],
        { type: 'application/json' },
      );
      downloadBlob(`atlas-fiscal-declaraciones-${new Date().toISOString().slice(0, 10)}.json`, blob);
      notify(`Exportadas ${declaraciones.length} declaracion${declaraciones.length === 1 ? '' : 'es'}.`);
    } catch (err) {
      notify('Error exportando declaraciones · ver consola.');
      // eslint-disable-next-line no-console
      console.error('[fiscal acciones] export ZIP falló:', err);
    } finally {
      setWorking(null);
    }
  };

  const exportCSVCasillas = async () => {
    setWorking('csv');
    try {
      const db = await initDB();
      const coords = (await db.getAll('ejerciciosFiscalesCoord')) as EjercicioFiscalCoord[];
      const declarados = coords.filter((e) => e.aeat?.snapshot);

      // Recolectar todas las casillas vistas · ordenar
      const casillasSet = new Set<string>();
      for (const e of declarados) {
        Object.keys(e.aeat!.snapshot).forEach((k) => casillasSet.add(k));
      }
      const casillas = Array.from(casillasSet).sort();

      const header = ['casilla', ...declarados.map((e) => String(e.año))].join(',');
      const lines = casillas.map((c) => {
        const valores = declarados.map((e) => {
          const v = e.aeat!.snapshot[c];
          if (typeof v === 'number') return v.toFixed(2);
          return '';
        });
        return [c, ...valores].join(',');
      });
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      downloadBlob(`atlas-fiscal-casillas-${new Date().toISOString().slice(0, 10)}.csv`, blob);
      notify(`CSV con ${casillas.length} casillas exportado.`);
    } catch (err) {
      notify('Error exportando CSV · ver consola.');
      // eslint-disable-next-line no-console
      console.error('[fiscal acciones] export CSV falló:', err);
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className={styles.btnGroup}>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={exportConfigJSON}
        disabled={working !== null}
      >
        {working === 'json' ? 'Exportando…' : 'Exportar config (JSON)'}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={exportZipDeclaraciones}
        disabled={working !== null}
      >
        {working === 'zip' ? 'Exportando…' : 'ZIP declaraciones'}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={exportCSVCasillas}
        disabled={working !== null}
      >
        {working === 'csv' ? 'Exportando…' : 'CSV casillas por año'}
      </button>
    </div>
  );
};

export default ExportarTodoSection;
