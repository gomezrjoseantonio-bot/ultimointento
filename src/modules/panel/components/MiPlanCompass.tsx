/**
 * ATLAS · Panel · MiPlanCompass
 *
 * Sección "Mi Plan · brújula" · § Z.11 · TAREA 22.6
 * Ref: TAREA-22-dashboard-sidebar-topbar.md §7 · mockup §142-190
 *
 * Datos:
 *   pctCobertura = (rentaPasiva / gastoVida) * 100 (cap 100)
 *   año          = año estimado libertad · TODO conectar simulador Mi Plan
 *   mc           = meses colchón = saldo / gastoVida
 *   rp           = renta pasiva mensual (contratos activos)
 *   gv           = gasto vida mensual (escenario o derivado)
 *   ni           = inmuebles activos (properties)
 *   meta         = meta inmuebles · TODO conectar simulador Mi Plan
 *
 * Tokens · todos via --atlas-v5-* · cero hex hardcoded.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MiPlanCompass.module.css';

export interface MiPlanCompassProps {
  /** Porcentaje de cobertura renta pasiva / gasto vida (0-100) */
  pctCobertura: number;
  /** Año estimado de libertad financiera · "—" si no disponible */
  añoLibertad: string;
  /** Meses colchón calculados (saldo / gastoVida) · null si no calculable */
  mesesColchon: number | null;
  /** Renta pasiva mensual (€) · suma contratos activos */
  rentaPasiva: number;
  /** Gasto vida mensual (€) · del escenario o derivado */
  gastoVida: number;
  /** Número de inmuebles activos en cartera */
  inmueblesActivos: number;
  /** Meta de inmuebles · null si no configurada · TODO simulador Mi Plan */
  metaInmuebles: number | null;
}

/** Formatea un importe monetario con 0 decimales y símbolo € */
const formatMoney = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const MiPlanCompass: React.FC<MiPlanCompassProps> = ({
  pctCobertura,
  añoLibertad,
  mesesColchon,
  rentaPasiva,
  gastoVida,
  inmueblesActivos,
  metaInmuebles,
}) => {
  const navigate = useNavigate();

  // Aseguramos que el ancho de la barra se mantiene en 0-100
  const pct = Math.max(0, Math.min(100, Math.round(pctCobertura)));

  return (
    <div className={styles.card}>
      <div className={styles.cardHd}>
        <div>
          <div className={styles.cardTitle}>Mi Plan · brújula</div>
          <div className={styles.cardSub}>progreso hacia libertad financiera</div>
        </div>
        <button
          type="button"
          className={styles.cardAction}
          onClick={() => navigate('/mi-plan')}
        >
          Ver plan completo →
        </button>
      </div>

      {/* Métrica grande · RENTA PASIVA CUBRE */}
      <div className={styles.planMetaGrande}>
        <div className={styles.planMetaLab}>RENTA PASIVA CUBRE</div>
        <div className={styles.planMetaVal}>{pct}%</div>
        <div className={styles.planMetaSub}>
          de tus gastos · llegada estimada <strong>{añoLibertad}</strong>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className={styles.planProgreso}>
        <div className={styles.planProgresoHead}>
          <span className={styles.planProgresoLab}>PROGRESO A META</span>
          <span className={styles.planProgresoPct}>{pct}/100</span>
        </div>
        <div className={styles.planTrack}>
          <div className={styles.planFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Items del plan */}
      <div className={styles.planItems}>
        <div className={styles.planItem}>
          <span className={styles.planItemLab}>Meses colchón</span>
          <span className={styles.planItemVal}>
            {mesesColchon !== null ? `${mesesColchon} de 24` : '— de 24'}
          </span>
        </div>
        <div className={styles.planItem}>
          <span className={styles.planItemLab}>Renta pasiva mensual</span>
          <span className={styles.planItemVal}>
            {rentaPasiva > 0 ? formatMoney(rentaPasiva) : '—'}
          </span>
        </div>
        <div className={styles.planItem}>
          <span className={styles.planItemLab}>Gasto vida mensual</span>
          <span className={styles.planItemVal}>
            {gastoVida > 0 ? formatMoney(gastoVida) : '—'}
          </span>
        </div>
        <div className={styles.planItem}>
          <span className={styles.planItemLab}>Inmuebles activos</span>
          <span className={styles.planItemVal}>
            {/* TODO: conectar meta inmuebles con simulador Mi Plan */}
            {inmueblesActivos} de {metaInmuebles ?? '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MiPlanCompass;
