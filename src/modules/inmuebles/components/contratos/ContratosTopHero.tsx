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

// Pluralización mínima es-ES para la línea-resumen ("1 inmueble" / "2 inmuebles").
const plural = (n: number, singular: string, plural_: string): string =>
  `${n} ${n === 1 ? singular : plural_}`;

const ContratosTopHero: React.FC<Props> = ({ kpis }) => {
  const venceCount = kpis.venceProx30.count;

  // Línea-resumen de explotación (spec §13) · "N inmuebles · M unidades · K vigentes".
  const resumen = [
    plural(kpis.inmueblesActivos, 'inmueble', 'inmuebles'),
    plural(kpis.unidadesArrendables, 'unidad', 'unidades'),
    plural(kpis.vigentes, 'vigente', 'vigentes'),
  ].join(' · ');

  return (
    <div className={styles.bar} role="group" aria-label="Resumen de alquileres">
      <div className={styles.brand}>
        <div className={styles.title}>
          <span className={styles.titleDot} aria-hidden="true" />
          Mis alquileres
        </div>
        <div className={styles.summary}>{resumen}</div>
      </div>

      <div className={styles.stat}>
        <div className={styles.lab}>Ocupación</div>
        <div className={styles.val}>{kpis.ocupacion} %</div>
        <div className={styles.sub}>unidades ocupadas</div>
      </div>

      <div className={styles.stat}>
        <div className={styles.lab}>Renta prevista</div>
        <div className={styles.val}>{eur(kpis.rentaMensual)}</div>
        <div className={styles.sub}>anual {eur(kpis.rentaAnual)}</div>
      </div>

      <div className={styles.stat}>
        <div className={styles.lab}>Unidades libres</div>
        <div className={`${styles.val} ${kpis.unidadesLibres > 0 ? styles.gold : ''}`}>
          {kpis.unidadesLibres}
        </div>
        <div className={styles.sub}>de {kpis.unidadesArrendables} unidades</div>
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
