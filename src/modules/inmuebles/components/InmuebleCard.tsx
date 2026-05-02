import React from 'react';
import { MoneyValue, Icons } from '../../../design-system/v5';
import MiniRooms, { MiniRoom } from './MiniRooms';
import styles from './InmuebleCard.module.css';

export type InmuebleState =
  | 'occupied'
  | 'attention'
  | 'overdue'
  | 'vacant'
  | 'reform';

export type InmuebleType = 'habitaciones' | 'completo' | 'reforma';

export interface InmuebleCardProps {
  /** Identificador AST · "AST-01" · "AST-02"... */
  astId: string;
  state: InmuebleState;
  stateLabel: string;
  name: string;
  /** T29 · foto base64 del inmueble · si undefined renderiza placeholder */
  photoUrl?: string;
  /** Localización · "Oviedo · La Argañosa · 4ª". */
  location: string;
  /** Chips informativos · tipo · n hab · estilo · m². */
  chips?: Array<{ label: string; isType?: boolean }>;
  /** Métricas · valor · renta · rent neta · cashflow. */
  metrics?: Array<{ label: string; value: React.ReactNode; sub?: string; tone?: 'pos' | 'muted' | 'neg' }>;
  /** Sub-bloque variable según tipo. */
  type: InmuebleType;
  /** Para tipo='habitaciones'. */
  rooms?: {
    occupied: number;
    total: number;
    contextLabel?: React.ReactNode;
    contextTone?: 'pos' | 'gold' | 'neg';
    items: MiniRoom[];
  };
  /** Para tipo='completo'. */
  tenant?: {
    initials: string;
    name: string;
    dateLabel: string;
  };
  /** Para tipo='reforma'. */
  reform?: {
    progressLabel: string;
    progressValue: string;
    percent: number;
  };
  onClick?: () => void;
}

const stateAccent: Record<InmuebleState, string> = {
  occupied: styles.occupied,
  attention: styles.attention,
  overdue: styles.overdue,
  vacant: styles.vacant,
  reform: styles.reform,
};

const InmuebleCard: React.FC<InmuebleCardProps> = ({
  astId,
  state,
  stateLabel,
  name,
  photoUrl,
  location,
  chips = [],
  metrics = [],
  type,
  rooms,
  tenant,
  reform,
  onClick,
}) => {
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  const ctxToneStyle: React.CSSProperties = {
    color:
      rooms?.contextTone === 'pos'
        ? 'var(--atlas-v5-pos)'
        : rooms?.contextTone === 'neg'
          ? 'var(--atlas-v5-neg)'
          : 'var(--atlas-v5-gold-ink)',
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.card}
      onClick={onClick}
      onKeyDown={handleKey}
      aria-label={`${name} · ${stateLabel}`}
    >
      <div className={styles.photo}>
        {photoUrl ? (
          <img src={photoUrl} alt={name} className={styles.photoImg} />
        ) : (
          <span className={styles.photoLabel}>FOTO</span>
        )}
        <span className={`${styles.stateBadge} ${stateAccent[state]}`}>
          {stateLabel}
        </span>
        <span className={styles.astTag}>{astId}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.name}>{name}</div>
        <div className={styles.loc}>
          <Icons.MapPin size={11} strokeWidth={1.8} />
          {location}
        </div>
        {chips.length > 0 && (
          <div className={styles.chips}>
            {chips.map((c, i) => (
              <span
                key={`${c.label}-${i}`}
                className={`${styles.chip} ${c.isType ? styles.type : ''}`}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}

        {type === 'habitaciones' && rooms && (
          <div className={styles.divider}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--atlas-v5-ink-4)',
                fontWeight: 600,
              }}>
                Ocupación {rooms.occupied} / {rooms.total}
              </span>
              {rooms.contextLabel && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--atlas-v5-font-mono-num)',
                    fontWeight: 600,
                    ...ctxToneStyle,
                  }}
                >
                  {rooms.contextLabel}
                </span>
              )}
            </div>
            <div style={{ marginTop: 4 }}>
              <MiniRooms rooms={rooms.items} />
            </div>
          </div>
        )}

        {type === 'completo' && tenant && (
          <div className={styles.tenantRow}>
            <span className={styles.tenantAvatar}>{tenant.initials}</span>
            <div>
              <div className={styles.tenantName}>{tenant.name}</div>
            </div>
            <span className={styles.tenantDate}>{tenant.dateLabel}</span>
          </div>
        )}

        {type === 'reforma' && reform && (
          <div className={styles.reformRow}>
            <div>
              <div className={styles.reformLab}>{reform.progressLabel}</div>
              <div className={styles.reformVal}>{reform.progressValue}</div>
            </div>
            <div style={{ alignSelf: 'center' }}>
              <div className={styles.reformProgress}>
                <div
                  className={styles.reformProgressFill}
                  style={{ width: `${Math.max(0, Math.min(100, reform.percent))}%` }}
                />
              </div>
            </div>
            <div style={{ alignSelf: 'center' }}>
              <span className={styles.reformLab}>{reform.percent}%</span>
            </div>
          </div>
        )}

        {metrics.length > 0 && (
          <div className={styles.metrics}>
            {metrics.map((m, i) => {
              const valCls = [
                styles.metricVal,
                m.tone === 'pos' ? styles.pos : '',
                m.tone === 'neg' ? styles.neg : '',
                m.tone === 'muted' ? styles.muted : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={`${m.label}-${i}`}>
                  <div className={styles.metricLab}>{m.label}</div>
                  <div className={valCls}>{m.value}</div>
                  {m.sub && <div className={styles.metricSub}>{m.sub}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InmuebleCard;
export { InmuebleCard, MoneyValue };
