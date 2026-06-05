// REORG Contratos · FIX § 1.1 · persistent-bar canónico (banda navy ARRIBA del
// todo · sticky · full-bleed). Única fuente de los stats de la página
// (Vigentes · Ocupación · Renta · Vencen 30 días). Todos los valores vienen de
// `useContratosKPIs` (estado efectivo por fechas), por lo que un Rentila
// finalizado nunca infla el contador de Vigentes.

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
    <div className={styles.bar} role="group" aria-label="Resumen de contratos">
      <div className={styles.title}>
        <span className={styles.titleDot} aria-hidden="true" />
        Mis contratos
      </div>

      <div className={styles.stat}>
        <div className={styles.lab}>Vigentes</div>
        <div className={styles.val}>{kpis.vigentes}</div>
        <div className={styles.sub}>de {kpis.unidadesArrendables} unidades</div>
      </div>

      <div className={styles.stat}>
        <div className={styles.lab}>Ocupación</div>
        <div className={styles.val}>{kpis.ocupacion} %</div>
        <div className={styles.sub}>unidades ocupadas</div>
      </div>

      <div className={styles.stat}>
        <div className={styles.lab}>Renta mensual</div>
        <div className={styles.val}>{eur(kpis.rentaMensual)}</div>
        <div className={styles.sub}>anual {eur(kpis.rentaAnual)}</div>
      </div>

      <div className={styles.stat}>
        <div className={styles.lab}>Vencen 30 días</div>
        <div className={`${styles.val} ${venceCount > 0 ? styles.warn : ''}`}>
          {venceCount}
        </div>
        <div className={styles.sub} title={kpis.venceProx30.firstName}>
          {kpis.venceProx30.firstName}
        </div>
      </div>
    </div>
  );
};

export default ContratosTopHero;
