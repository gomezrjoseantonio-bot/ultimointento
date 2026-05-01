/**
 * ATLAS · Panel · AttentionList
 *
 * Sección "Piden tu atención" · § Z.11 · § AA.6 · TAREA 22.5
 * Ref: TAREA-22-dashboard-sidebar-topbar.md §6 · mockup §142-190
 *
 * MAX 5 alertas · prioridad:
 *   1. Deudas ejecutiva/apremio · severity='neg'   · TODO servicio alertas
 *   2. Borradores fiscales listos · severity='pos' · TODO servicio alertas
 *   3. Obligaciones fiscales próx (30d) · 'warn'   · TODO servicio alertas
 *   4. Contratos vencer (60d) · severity='warn'    · derivado de contracts store
 *   5. Pagos vencidos sin conciliar · 'neg'        · derivado de treasuryEvents store
 *
 * Si 0 alertas → empty state "Sin atenciones · todo al día" + CheckCircle.
 *
 * Tokens · todos via --atlas-v5-* · cero hex hardcoded.
 */

import React from 'react';
import { Icons } from '../../../design-system/v5';
import styles from './AttentionList.module.css';

/** Tipo de icono por severidad · § AA.6 */
type IconType = 'filetext' | 'calendar' | 'warning';

export interface AlertaItem {
  id: string;
  /** Severidad visual del icono y fondo · § AA.6 */
  severity: 'neg' | 'warn' | 'pos' | 'muted';
  /** Severidad del valor monetario derecho */
  valueSeverity: 'neg' | 'warn' | 'pos' | 'muted';
  /** Tipo de icono Lucide a usar · § AA.6 */
  iconType: IconType;
  title: string;
  meta: string;
  /** Importe monetario a mostrar en columna derecha */
  value: number;
  /** Texto secundario bajo el valor (p.ej. "60 días" · "pendiente") */
  timeWindow: string;
  /** Ruta de navegación al hacer click */
  href: string;
}

export interface AttentionListProps {
  alertas: AlertaItem[];
  onVerTodas?: () => void;
  onAlertaClick?: (alerta: AlertaItem) => void;
}

/** Formatea un importe como "1.234 €" (0 decimales) */
const formatMoney = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

/** Devuelve el componente icono Lucide según iconType · § AA.6 */
const IconBySeverity: React.FC<{ iconType: IconType }> = ({ iconType }) => {
  switch (iconType) {
    case 'calendar':
      return <Icons.Calendar size={16} strokeWidth={2.2} />;
    case 'warning':
      return <Icons.Warning size={16} strokeWidth={2.2} />;
    case 'filetext':
    default:
      // Icons.Contratos === Lucide FileText · § AA.6 · ver design-system/v5/icons.ts
      return <Icons.Contratos size={16} strokeWidth={2.2} />;
  }
};

const AttentionList: React.FC<AttentionListProps> = ({ alertas, onVerTodas, onAlertaClick }) => {
  const n = alertas.length;

  return (
    <div className={styles.card}>
      <div className={styles.cardHd}>
        <div>
          <div className={styles.cardTitle}>Piden tu atención</div>
          {n > 0 && (
            <div className={styles.cardSub}>
              {n} cosa{n === 1 ? '' : 's'} pide{n === 1 ? '' : 'n'} tu atención · ordenadas por urgencia
            </div>
          )}
        </div>
        {n > 0 && onVerTodas && (
          <button type="button" className={styles.cardAction} onClick={onVerTodas}>
            Ver todas →
          </button>
        )}
      </div>

      {n === 0 ? (
        <div className={styles.empty}>
          <Icons.Success size={18} strokeWidth={2} />
          <span className={styles.emptyText}>Sin atenciones · todo al día</span>
        </div>
      ) : (
        alertas.map((a) => (
          <div
            key={a.id}
            className={styles.alerta}
            onClick={() => onAlertaClick?.(a)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onAlertaClick?.(a)}
          >
            <div className={`${styles.alertaIcon} ${styles[a.severity]}`}>
              <IconBySeverity iconType={a.iconType} />
            </div>
            <div>
              <div className={styles.alertaTitle}>{a.title}</div>
              <div className={styles.alertaMeta}>{a.meta}</div>
            </div>
            <div className={`${styles.alertaRight} ${styles[a.valueSeverity]}`}>
              {formatMoney(a.value)}
              <div className={styles.alertaRightSub}>{a.timeWindow}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default AttentionList;
