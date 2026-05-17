// Panel preview lateral del Modal ATLAS · derecha · 340px · card oscura + rows + banners
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §6 · líneas 750-811
// Spec · TAREA-CC-T-INVERSIONES-V5 §6.1 / §6.2

import React from 'react';
import styles from '../../styles/atlas-inversiones.module.css';

export interface ModalAtlasPreviewProps {
  /**
   * Texto del header del panel (uppercase letter-spaced en estilo) ·
   * p.ej. "CÁLCULO FISCAL", "TRAMOS BASE AHORRO", "VISTA PREVIA".
   */
  header?: React.ReactNode;
  /** Icono opcional junto al header (oro · stroke fino). */
  headerIcon?: React.ReactNode;
  children: React.ReactNode;
}

const ModalAtlasPreview: React.FC<ModalAtlasPreviewProps> = ({
  header,
  headerIcon,
  children,
}) => (
  <aside className={styles.preview} aria-label="Vista previa">
    {header != null && (
      <div className={styles.previewHd}>
        {headerIcon}
        <span>{header}</span>
      </div>
    )}
    {children}
  </aside>
);

/** Card oscura · KPI en vivo (val + sub). Variantes pos/neg/gold por color. */
export const ModalAtlasPreviewCardDark: React.FC<{
  label: React.ReactNode;
  value: React.ReactNode;
  valueVariant?: 'pos' | 'neg' | 'gold';
  sub?: React.ReactNode;
  /** sub en Inter (texto narrativo) en lugar de Mono (default). */
  subAsText?: boolean;
}> = ({ label, value, valueVariant, sub, subAsText }) => {
  const valCls = valueVariant ? `${styles.val} ${styles[valueVariant]}` : styles.val;
  const subCls = subAsText ? `${styles.sub} ${styles.wrap}` : styles.sub;
  return (
    <div className={styles.previewCardDark}>
      <div className={styles.lab}>{label}</div>
      <div className={valCls}>{value}</div>
      {sub != null && <div className={subCls}>{sub}</div>}
    </div>
  );
};

/** Fila k → v dentro del bloque. Útil para tramos, breakdowns, etc. */
export const ModalAtlasPreviewRow: React.FC<{
  k: React.ReactNode;
  v: React.ReactNode;
  variant?: 'pos' | 'neg' | 'gold' | 'txt';
}> = ({ k, v, variant }) => {
  const vCls = variant
    ? `${styles.v} ${styles[variant]}`
    : styles.v;
  return (
    <div className={styles.previewRow}>
      <span className={styles.k}>{k}</span>
      <span className={vCls}>{v}</span>
    </div>
  );
};

/** Bloque agrupador con separador superior · usar dentro del preview. */
export const ModalAtlasPreviewBlock: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className={styles.previewBlock}>{children}</div>;

/** Banner informativo · barra lateral oro/warn/pos · texto pequeño. */
export const ModalAtlasPreviewBanner: React.FC<{
  variant?: 'gold' | 'warn' | 'pos';
  children: React.ReactNode;
}> = ({ variant, children }) => {
  const cls =
    variant === 'warn'
      ? `${styles.previewBanner} ${styles.warn}`
      : variant === 'pos'
        ? `${styles.previewBanner} ${styles.pos}`
        : styles.previewBanner;
  return <div className={cls}>{children}</div>;
};

export default ModalAtlasPreview;
