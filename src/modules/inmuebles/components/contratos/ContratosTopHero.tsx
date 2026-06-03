// REORG Contratos · Commit 4 · banda navy GESTIÓN con 4 KPIs.
//
// Única fuente de los stats de la página (Vigentes · Ocupación · Renta ·
// Vencen 30 días). Sustituye al antiguo `kpiStrip` blanco de 5 tarjetas con
// "cálculo en preparación". Todos los valores vienen de `useContratosKPIs`
// (estado efectivo por fechas), por lo que un Rentila finalizado nunca infla
// el contador de Vigentes.

import React from 'react';
import type { ContratosKPIs } from '../../utils/kpisContratosService';
import styles from './ContratosTopHero.module.css';

const eur = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

interface Props {
  kpis: ContratosKPIs;
}

const ContratosTopHero: React.FC<Props> = ({ kpis }) => {
  const venceCount = kpis.venceProx30.count;

  return (
    <header className={styles.bannerNavy} role="group" aria-label="Resumen de contratos">
      <div className={styles.bannerRow}>
        <div className={styles.sectionTitle}>
          <span className={styles.goldDot} aria-hidden="true" />
          <h2>Mis contratos</h2>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Vigentes</div>
          <div className={`${styles.kpiValue} mono`}>{kpis.vigentes}</div>
          <div className={styles.kpiSub}>de {kpis.unidadesArrendables} unidades</div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Ocupación</div>
          <div className={`${styles.kpiValue} mono`}>{kpis.ocupacion} %</div>
          <div className={styles.kpiSub}>unidades ocupadas</div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Renta mensual</div>
          <div className={`${styles.kpiValue} mono`}>{eur(kpis.rentaMensual)}</div>
          <div className={styles.kpiSub}>anual {eur(kpis.rentaAnual)}</div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Vencen 30 días</div>
          <div className={`${styles.kpiValue} mono ${venceCount > 0 ? styles.warn : ''}`}>
            {venceCount}
          </div>
          <div className={styles.kpiSub} title={kpis.venceProx30.firstName}>
            {kpis.venceProx30.firstName}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ContratosTopHero;
