// Shell común de las fichas detalle · alineado con el mockup canónico
// `docs/audit-inputs/atlas-inversiones-v2.html` líneas 783-989.
// Renderiza: detail-head (back button) · detail-hero (badge superior +
// logo + título + meta + 4 stats horizontales) · acciones opcionales
// debajo del hero. El bloque de contenido específico va como children.

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

export interface FichaShellHeroStat {
  lab: React.ReactNode;
  val: React.ReactNode;
  /** Variante de color del valor. */
  valVariant?: 'pos' | 'neg' | 'gold';
  /** Override de tamaño · útil para fechas (no aplican a 18px mono). */
  small?: boolean;
}

export interface FichaShellHero {
  /** Variante visual del badge superior · pinta el fondo del .detail-hero-top. */
  variant: 'plan' | 'prestamo' | 'accion';
  /** Texto del badge superior (mockup ej.: "Plan de pensiones · revalorización · liquidez en jubilación"). */
  badge: React.ReactNode;
  /** Configuración del logo (background + texto). */
  logo: { text: string; bg?: string; color?: string };
  /** Título principal del hero. */
  title: React.ReactNode;
  /** Línea de metadata bajo el título (acepta strings con `<strong>`). */
  meta?: React.ReactNode;
  /** 1 a 4 stats horizontales · típico 4. */
  stats: FichaShellHeroStat[];
}

interface Props {
  /** Modo nuevo: hero canónico del mockup. */
  hero?: FichaShellHero;
  /** Modo legacy: título plano (compat con consumidores no migrados). */
  title?: string;
  subtitle?: string;
  tipoChip?: string;
  onBack: () => void;
  /** Acciones opcionales (Aportar · Editar · Actualizar valor · Registrar cobro…). */
  actions?: FichaShellAction[];
  children: React.ReactNode;
}

const HeroBadgeIcon: React.FC<{ variant: FichaShellHero['variant'] }> = ({ variant }) => {
  const common = { width: 10, height: 10, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 3 };
  if (variant === 'plan') {
    return (
      <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
    );
  }
  if (variant === 'prestamo') {
    return (
      <svg {...common}><circle cx="12" cy="12" r="10"/></svg>
    );
  }
  return (
    <svg {...common}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  );
};

const FichaShell: React.FC<Props> = ({
  hero,
  title,
  subtitle,
  tipoChip,
  onBack,
  actions,
  children,
}) => (
  <div className={styles.page}>
    {/* Detail head · solo back button cuando hay hero (mockup) */}
    <div className={styles.detailHead}>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        <Icons.ChevronLeft size={12} strokeWidth={2} />
        Volver a Inversiones
      </button>
      {actions && actions.length > 0 && (
        <div className={styles.detailActions}>
          {actions.map((a, i) => {
            const variantCls = a.variant === 'gold' ? styles.btnGold : styles.btnGhost;
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

    {hero ? (
      <div
        className={styles.detailHero}
        style={{ ['--detail-stats' as string]: hero.stats.length }}
      >
        <div className={`${styles.detailHeroTop} ${styles[hero.variant]}`}>
          <HeroBadgeIcon variant={hero.variant} />
          {hero.badge}
        </div>
        <div className={styles.detailHeroBody}>
          <div
            className={styles.detailHeroLogo}
            style={{
              background: hero.logo.bg ?? 'var(--atlas-v5-bg)',
              color: hero.logo.color ?? 'var(--atlas-v5-ink-2)',
            }}
          >
            {hero.logo.text}
          </div>
          <div>
            <div className={styles.detailHeroNom}>{hero.title}</div>
            {hero.meta != null && <div className={styles.detailHeroMeta}>{hero.meta}</div>}
          </div>
          {hero.stats.map((s, i) => (
            <div key={i} className={styles.detailHeroStat}>
              <div className={styles.detailHeroStatLab}>{s.lab}</div>
              <div
                className={`${styles.detailHeroStatVal}${s.valVariant ? ' ' + styles[s.valVariant] : ''}`}
                style={s.small ? { fontSize: 14 } : undefined}
              >
                {s.val}
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      // Fallback legacy · sin hero
      <div className={styles.detailHeadLeft}>
        {title && (
          <h1 className={styles.detailTitle}>
            {title}
            {tipoChip && <span className={styles.tipoChip}>{tipoChip}</span>}
          </h1>
        )}
        {subtitle && <div className={styles.detailSub}>{subtitle}</div>}
      </div>
    )}

    {children}
  </div>
);

export default FichaShell;
