// REORG Contratos · Commit 7 · tab Análisis · 4 bloques (mockup v5).
//
// 1 · Ocupación (12 meses, dato real de calcularDatosAnuales)
// 2 · Resumen anual de ingresos + proyección
// 3 · Ranking por inmueble (renta anual de vigentes)
// 4 · Atención · cosas que requieren acción
// Todo runtime sobre estado efectivo · sin datos inventados.

import React, { useMemo } from 'react';
import type { Contract, Property } from '../../../../services/db';
import {
  calcularDatosAnuales,
  NOMBRES_MES_CORTO,
} from '../../utils/calcularDatosAnuales';
import { useContratosKPIs } from '../../hooks/useContratosByTab';
import {
  rankingPorInmueble,
  alarmasContratos,
} from '../../utils/analisisContratosService';
import styles from './TabAnalisis.module.css';

export interface TabAnalisisProps {
  contratos: Contract[];
  properties: Property[];
}

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

const TabAnalisis: React.FC<TabAnalisisProps> = ({ contratos, properties }) => {
  const ano = useMemo(() => new Date().getFullYear(), []);
  const mesActual = useMemo(() => new Date().getMonth(), []); // 0-11
  const kpis = useContratosKPIs(contratos, properties);

  const datos = useMemo(
    () => calcularDatosAnuales(contratos, properties, ano),
    [contratos, properties, ano],
  );

  const ranking = useMemo(
    () => rankingPorInmueble(contratos, properties),
    [contratos, properties],
  );
  const rankingMax = ranking.length > 0 ? Math.max(...ranking.map((r) => r.rentaAnual), 1) : 1;

  const alarmas = useMemo(
    () => alarmasContratos(contratos, properties),
    [contratos, properties],
  );

  // Ocupación media por mes (0-1) para la tira del bloque 1.
  const ocupacionMes = useMemo(
    () =>
      datos.meses.map((m) => {
        const dias = m.celdas.filter((c) => c.existe && c.ocupacion >= 0);
        if (dias.length === 0) return 0;
        return dias.reduce((s, c) => s + c.ocupacion, 0) / dias.length;
      }),
    [datos],
  );

  return (
    <div>
      {/* ── Bloque 1 · Ocupación ── */}
      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardFull}`}>
          <h3 className={styles.h}>Ocupación · {ano}</h3>
          <div className={styles.headline}>{Math.round(datos.ocupacionMedia * 100)} %</div>
          <div className={styles.headlineSub}>
            ocupación media anual · ~{datos.diasVaciosProyectados} días vacíos proyectados
          </div>
          <div className={styles.monthStrip}>
            {ocupacionMes.map((oc, i) => (
              <div key={i} className={styles.monthCol}>
                <div className={styles.monthBar}>
                  <div
                    className={`${styles.monthFill} ${i === mesActual ? styles.now : ''}`}
                    style={{ height: `${Math.max(4, Math.round(oc * 100))}%` }}
                  />
                </div>
                <div className={styles.monthLabel}>{NOMBRES_MES_CORTO[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bloques 2 (resumen) + 4 (atención) ── */}
      <div className={`${styles.grid} ${styles.grid21}`}>
        <div className={styles.card}>
          <h3 className={styles.h}>Resumen anual</h3>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Contratos vigentes</span>
            <span className={styles.statVal}>{kpis.vigentes}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Renta mensual</span>
            <span className={styles.statVal}>{eur(kpis.rentaMensual)}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Renta anualizada</span>
            <span className={styles.statVal}>{eur(kpis.rentaAnual)}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Ingresos perdidos proyectados</span>
            <span className={`${styles.statVal} ${styles.neg}`}>
              {eur(datos.ingresosPerdidosProyectados)}
            </span>
          </div>
          <div className={styles.paceBox}>
            <div className={styles.paceH}>Ocupación</div>
            <div className={styles.paceV}>{kpis.ocupacion} %</div>
            <div className={styles.paceS}>
              {kpis.vigentes} de {kpis.unidadesArrendables} unidades ocupadas hoy
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.h}>Atención · {alarmas.length} {alarmas.length === 1 ? 'cosa' : 'cosas'}</h3>
          {alarmas.map((a) => (
            <div key={a.id} className={styles.alarm}>
              <span className={`${styles.alarmDot} ${styles[a.tono]}`} aria-hidden="true" />
              <div>
                <div className={styles.alarmTitle}>{a.titulo}</div>
                <div className={styles.alarmDetail}>{a.detalle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bloque 3 · Ranking por inmueble ── */}
      <div className={styles.grid}>
        <div className={`${styles.card} ${styles.cardFull}`}>
          <h3 className={styles.h}>Ingresos por inmueble · ranking anual</h3>
          {ranking.length === 0 ? (
            <div className={styles.headlineSub}>Sin inmuebles activos que mostrar.</div>
          ) : (
            ranking.map((r) => (
              <div key={r.inmuebleId} className={styles.rankRow}>
                <div className={styles.rankName} title={r.alias}>
                  {r.alias}
                </div>
                <div className={styles.rankBarTrack}>
                  <div
                    className={styles.rankBarFill}
                    style={{ width: `${Math.round((r.rentaAnual / rankingMax) * 100)}%` }}
                  />
                </div>
                <div>
                  <div className={styles.rankVal}>{eur(r.rentaAnual)}</div>
                  <div className={styles.rankSub}>{r.ocupacionPct} % ocupación</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TabAnalisis;
export { TabAnalisis };
