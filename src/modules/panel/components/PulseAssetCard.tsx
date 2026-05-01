/**
 * ATLAS · Panel · PulseAssetCard
 *
 * Card individual "Pulso 4 activos" · § Z.9 · § AA.4 · TAREA 22.3
 * Ref: TAREA-22-dashboard-sidebar-topbar.md §4 · mockup §111-130
 *
 * Tokens · todos via --atlas-v5-* · cero hex hardcoded.
 * Iconos · § AA.4 Building2 · TrendingUp · Wallet · Landmark (18x18 stroke 1.7)
 *         · § AA.5 ArrowRight (10x10 stroke 2.5)
 *         · § AA.8 ArrowUpRight · ArrowDownRight
 */

import React from 'react';
import { Icons } from '../../../design-system/v5';
import { MoneyValue } from '../../../design-system/v5';
import styles from './PulseAssetCard.module.css';

export type PulseAssetVariant = 'inmuebles' | 'inversiones' | 'tesoreria' | 'financiacion';

export interface PulseAssetCardDelta {
  /** Porcentaje de cambio últimos 30 días (valor absoluto) */
  pct: number;
  sign: 'pos' | 'neg';
}

export interface PulseAssetCardProps {
  /** Identificador de variante · controla borde izquierdo y colores */
  variant: PulseAssetVariant;
  /** Nombre visible del activo */
  label: string;
  /** Valor monetario principal */
  value: number;
  /** Si true · muestra valor en rojo (deuda) */
  valueNeg?: boolean;
  /** Si true · muestra el signo en el valor */
  valueShowSign?: boolean;
  /**
   * Delta cambio últimos 30 días.
   * null → muestra "—" con clase muted (datos no disponibles · TODO)
   */
  delta: PulseAssetCardDelta | null;
  /** Etiqueta de la métrica extra específica por card */
  extraLabel: string;
  /**
   * Valor de la métrica extra.
   * null → muestra "—" (datos no disponibles · TODO)
   */
  extraValue: string | null;
  /** Si true · colorea el valor extra en positivo */
  extraPos?: boolean;
  /** Si true · colorea el valor extra en negativo */
  extraNeg?: boolean;
  onClick: () => void;
}

/** Icono según variante · § AA.4 · 18×18 stroke 1.7 */
const variantIcon: Record<PulseAssetVariant, React.ReactElement> = {
  inmuebles: <Icons.Inmuebles size={18} strokeWidth={1.7} />,     // Building2
  inversiones: <Icons.Inversiones size={18} strokeWidth={1.7} />, // TrendingUp
  tesoreria: <Icons.Tesoreria size={18} strokeWidth={1.7} />,     // Wallet
  financiacion: <Icons.Financiacion size={18} strokeWidth={1.7} />, // Landmark
};

const PulseAssetCard: React.FC<PulseAssetCardProps> = ({
  variant,
  label,
  value,
  valueNeg = false,
  valueShowSign = false,
  delta,
  extraLabel,
  extraValue,
  extraPos = false,
  extraNeg = false,
  onClick,
}) => {
  const deltaClass =
    delta === null
      ? styles.muted
      : delta.sign === 'neg'
        ? styles.neg
        : '';

  const extraValClass = [
    styles.activoExtraVal,
    extraPos ? styles.pos : '',
    extraNeg ? styles.neg : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={`${styles.activoCard} ${styles[variant]}`}
      onClick={onClick}
    >
      {/* Head · nombre + icono */}
      <div className={styles.activoHead}>
        <div className={styles.activoNom}>{label}</div>
        <span className={styles.activoIcon}>{variantIcon[variant]}</span>
      </div>

      {/* Valor principal */}
      <div className={`${styles.activoVal}${valueNeg ? ` ${styles.neg}` : ''}`}>
        <MoneyValue
          value={value}
          decimals={0}
          tone={valueNeg ? 'neg' : 'ink'}
          showSign={valueShowSign}
        />
      </div>

      {/* Delta · cambio últimos 30 días · § AA.8 */}
      <div className={`${styles.activoDelta} ${deltaClass}`}>
        {delta === null ? (
          // TODO: conectar con historial de valores por activo para mostrar delta real últimos 30 días
          <span>— últimos 30 días</span>
        ) : (
          <>
            {delta.sign === 'pos'
              ? <Icons.ArrowUpRight size={11} />
              : <Icons.ArrowDownRight size={11} />
            }
            <span>{delta.pct.toFixed(1)}% últimos 30 días</span>
          </>
        )}
      </div>

      {/* Extra · métrica específica por card */}
      <div className={styles.activoExtra}>
        <span className={styles.activoExtraLab}>{extraLabel}</span>
        <span className={extraValClass}>
          {extraValue ?? '—'}
        </span>
      </div>

      {/* CTA · § AA.5 ArrowRight 10×10 stroke 2.5 */}
      <span className={styles.activoCta}>
        Ver detalle <Icons.ArrowRight size={10} strokeWidth={2.5} />
      </span>
    </button>
  );
};

export default PulseAssetCard;
