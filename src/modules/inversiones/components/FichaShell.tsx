// T23.3 · Shell común de las fichas detalle (§ Z.7 spec).
// Renderiza el header con back button · título · subtítulo · y la fila
// de botones de acción (típicamente [Actualizar valor] · [Aportar] ·
// [Editar posición]). Cada ficha específica añade sus KPIs y bloques
// de contenido como children.

import React from 'react';
import { Icons } from '../../../design-system/v5';
import styles from '../pages/FichaPosicion.module.css';

export interface FichaShellAction {
  label: string;
  /** Variant visual · 'gold' (primario) o 'ghost' (secundario · default). */
  variant?: 'gold' | 'ghost';
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Texto del chip que aparece junto al título · normalmente el tipo. */
  tipoChip?: string;
  onBack: () => void;
  actions?: FichaShellAction[];
  children: React.ReactNode;
}

const FichaShell: React.FC<Props> = ({
  title,
  subtitle,
  tipoChip,
  onBack,
  actions,
  children,
}) => (
  <div className={styles.page}>
    <div className={styles.detailHead}>
      <div className={styles.detailHeadLeft}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <Icons.ChevronLeft size={12} strokeWidth={2} />
          Volver a Inversiones
        </button>
        <h1 className={styles.detailTitle}>
          {title}
          {tipoChip && <span className={styles.tipoChip}>{tipoChip}</span>}
        </h1>
        {subtitle && <div className={styles.detailSub}>{subtitle}</div>}
      </div>
      {actions && actions.length > 0 && (
        <div className={styles.detailActions}>
          {actions.map((a, i) => {
            const variantCls =
              a.variant === 'gold' ? styles.btnGold : styles.btnGhost;
            return (
              <button
                key={i}
                type="button"
                className={`${styles.btn} ${variantCls}`}
                onClick={a.onClick}
                disabled={a.disabled}
              >
                {a.icon}
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
    {children}
  </div>
);

export default FichaShell;
