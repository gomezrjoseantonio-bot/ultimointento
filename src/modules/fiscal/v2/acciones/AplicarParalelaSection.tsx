/**
 * Bloque 3 · Aplicar paralela AEAT · selector ejercicio + botón wizard +
 * histórico de paralelas.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.2 / §8.3.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initDB } from '../../../../services/db';
import type { EjercicioFiscalCoord } from '../../../../services/ejercicioResolverService';
import styles from '../FiscalAccionesPage.module.css';

interface EjercicioOption {
  año: number;
  etiqueta: string;
}

interface HistoricoParalela {
  añoEjercicio: number;
  concepto: string;
  fecha: string;
  resultadoDesfase: number;
}

function fmtFecha(iso?: string): string {
  if (!iso) return '—';
  const date = iso.slice(0, 10);
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtEuros(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)} €`;
}

const AplicarParalelaSection: React.FC = () => {
  const navigate = useNavigate();
  const [opciones, setOpciones] = useState<EjercicioOption[]>([]);
  const [añoSel, setAñoSel] = useState<number | null>(null);
  const [paralelas, setParalelas] = useState<HistoricoParalela[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const db = await initDB();
        const todos = (await db.getAll('ejerciciosFiscalesCoord')) as EjercicioFiscalCoord[];
        const declarados = todos
          .filter((e) => e.estado === 'declarado' || e.estado === 'pendiente')
          .sort((a, b) => b.año - a.año);

        const opts: EjercicioOption[] = declarados.map((e) => {
          const decl = e.aeat?.declaracionCompleta as { meta?: { esComplementaria?: boolean } } | undefined;
          const sufijo = decl?.meta?.esComplementaria ? 'declarado v2' : `${e.estado}`;
          return { año: e.año, etiqueta: `${e.año} · ${sufijo}` };
        });
        setOpciones(opts);
        if (opts.length > 0) setAñoSel(opts[0].año);

        const histo: HistoricoParalela[] = declarados
          .filter((e) => {
            const decl = e.aeat?.declaracionCompleta as { meta?: { esComplementaria?: boolean } } | undefined;
            return Boolean(decl?.meta?.esComplementaria);
          })
          .map((e) => ({
            añoEjercicio: e.año,
            concepto: 'Declaración complementaria',
            fecha: e.aeat!.fechaImportacion,
            resultadoDesfase: e.aeat?.resumen?.resultado ?? 0,
          }));
        setParalelas(histo);
      } catch { /* OK */ }
    })();
  }, []);

  const onIniciarWizard = () => {
    if (añoSel === null) return;
    navigate(`/fiscal/correccion/${añoSel}`);
  };

  return (
    <>
      <div className={styles.bodyText}>
        Si Hacienda te ha enviado propuesta de liquidación · acta · o liquidación
        firmada en conformidad, aplícala aquí. ATLAS genera una versión v2 del
        ejercicio y propaga los cambios a años posteriores.{' '}
        <strong className={styles.negText}>No apliques paralelas que estén en recurso.</strong>
      </div>

      <div className={styles.fld}>
        <label className={styles.fldLab} htmlFor="paralela-anio">Ejercicio a corregir</label>
        <select
          id="paralela-anio"
          className={styles.fldSelect}
          value={añoSel ?? ''}
          onChange={(e) => setAñoSel(Number(e.target.value))}
          disabled={opciones.length === 0}
        >
          {opciones.length === 0 ? (
            <option value="">No hay ejercicios disponibles</option>
          ) : opciones.map((o) => (
            <option key={o.año} value={o.año}>{o.etiqueta}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={onIniciarWizard}
        disabled={añoSel === null}
      >
        Iniciar wizard paralela →
      </button>

      <div className={styles.sectionLabel}>Histórico de paralelas</div>
      {paralelas.length === 0 ? (
        <div className={styles.emptyBlock}>No has aplicado ninguna paralela todavía.</div>
      ) : (
        <table className={styles.tbl}>
          <tbody>
            {paralelas.map((p) => (
              <tr key={`${p.añoEjercicio}-${p.fecha}`}>
                <td>
                  <span className={`${styles.mono} ${styles.tStrong}`}>{p.añoEjercicio} → v2</span>
                </td>
                <td>{p.concepto}</td>
                <td>
                  <span className={styles.mono}>{fmtFecha(p.fecha)}</span>
                </td>
                <td className={styles.tdRight}>
                  <span className={`${styles.tdAmount} ${p.resultadoDesfase >= 0 ? styles.pos : styles.neg}`}>
                    {fmtEuros(p.resultadoDesfase)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
};

export default AplicarParalelaSection;
