/**
 * Bloque 6 · Histórico completo de declaraciones · listado de todos los
 * modelos presentados (100 · 303 · 130 · 184).
 *
 * Por ahora ATLAS solo persiste el Modelo 100 vía `ejerciciosFiscalesCoord`.
 * Los modelos trimestrales (303 · 130) se inferirán de `deudasFiscales`
 * cuando estén pagados (status='pagada' = presentado). Placeholder OK
 * según DoD §8.5.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.2 / §8.3.
 */

import React, { useEffect, useState } from 'react';
import { initDB, type DeudaFiscal } from '../../../../services/db';
import type { EjercicioFiscalCoord } from '../../../../services/ejercicioResolverService';
import styles from '../FiscalAccionesPage.module.css';

interface Resumen {
  totalDeclaraciones: number;
  modelo100: number;
  modelo303: number;
  modelo130: number;
  modelo184: number;
  conDeuda: number;
  rangoAños: { desde: number; hasta: number } | null;
}

const HistoricoDeclaracionesSection: React.FC = () => {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [mostrarListado, setMostrarListado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = await initDB();
        const coords = (await db.getAll('ejerciciosFiscalesCoord')) as EjercicioFiscalCoord[];
        const deudas = ((await db.getAll('deudasFiscales')) as DeudaFiscal[]) ?? [];

        const modelo100 = coords.filter((e) => e.aeat).length;
        const modelo303 = deudas.filter((d) => d.modelo === '303' && d.estado === 'pagada').length;
        const modelo130 = deudas.filter((d) => d.modelo === '130' && d.estado === 'pagada').length;
        const modelo184 = deudas.filter((d) => d.modelo === '184' && d.estado === 'pagada').length;
        const conDeuda = deudas.filter((d) => d.estado !== 'pagada').length;

        const años = coords.filter((e) => e.aeat).map((e) => e.año);
        const rango = años.length > 0
          ? { desde: Math.min(...años), hasta: Math.max(...años) }
          : null;

        setResumen({
          totalDeclaraciones: modelo100 + modelo303 + modelo130 + modelo184,
          modelo100,
          modelo303,
          modelo130,
          modelo184,
          conDeuda,
          rangoAños: rango,
        });
      } catch {
        setResumen({
          totalDeclaraciones: 0,
          modelo100: 0,
          modelo303: 0,
          modelo130: 0,
          modelo184: 0,
          conDeuda: 0,
          rangoAños: null,
        });
      }
    })();
  }, []);

  if (!resumen) {
    return <div className={styles.bodyText}>Cargando histórico…</div>;
  }

  const rangoTxt = resumen.rangoAños
    ? `entre ${resumen.rangoAños.desde} y ${resumen.rangoAños.hasta}`
    : 'sin datos';
  const partes: string[] = [];
  if (resumen.modelo100 > 0) partes.push(`${resumen.modelo100} modelo${resumen.modelo100 === 1 ? '' : 's'} 100`);
  if (resumen.modelo303 > 0) partes.push(`${resumen.modelo303} modelo${resumen.modelo303 === 1 ? '' : 's'} 303`);
  if (resumen.modelo130 > 0) partes.push(`${resumen.modelo130} modelo${resumen.modelo130 === 1 ? '' : 's'} 130`);
  if (resumen.modelo184 > 0) partes.push(`${resumen.modelo184} modelo${resumen.modelo184 === 1 ? '' : 's'} 184`);
  const desglose = partes.length > 0 ? partes.join(' · ') : 'sin presentaciones registradas';
  const deudaTxt = resumen.conDeuda > 0
    ? ` · ${resumen.conDeuda} con deuda abierta`
    : '';

  return (
    <>
      <div className={styles.bodyText}>
        {resumen.totalDeclaraciones} declaracion{resumen.totalDeclaraciones === 1 ? '' : 'es'} {rangoTxt} · {desglose}{deudaTxt}.
      </div>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={() => setMostrarListado((v) => !v)}
      >
        {mostrarListado ? 'Ocultar listado' : 'Ver listado completo'}
      </button>
      {mostrarListado && (
        <div className={styles.emptyBlock} style={{ marginTop: 12 }}>
          Listado detallado por modelo · función disponible próximamente.
        </div>
      )}
    </>
  );
};

export default HistoricoDeclaracionesSection;
