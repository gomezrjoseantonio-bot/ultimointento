// INVERSIONES V1 · Fase 2 · GALERÍA · hero navy de gestión (KPIs integrados).
//
// Supervisión en una sola pantalla (sin scroll): valor total de cartera, gauge
// de rentabilidad + € ganados, 3 chips por familia (Planes / Préstamos /
// Acciones), renta pasiva (intereses + dividendos) y la trayectoria a 20 años.
// Paleta solo tokens (navy --brand · panel oscuro --brand-ink · oro sobre navy).

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import { formatCurrency, formatPercent } from '../../helpers';
import type {
  ResumenCartera,
  ResumenFamilia,
  FamiliaChip,
  RentaPasiva,
  SerieTrayectoria,
} from '../../adapters/galeriaHero';
import TrayectoriaChart from './TrayectoriaChart';
import styles from './galeriaV5.module.css';

interface Props {
  resumen: ResumenCartera;
  familias: Record<FamiliaChip, ResumenFamilia>;
  rentaPasiva: RentaPasiva;
  serie: SerieTrayectoria;
}

// Gauge de rentabilidad · arco = pct / 50% (tope visual 50%). Semicírculo.
const Gauge: React.FC<{ pct: number }> = ({ pct }) => {
  const cx = 59;
  const cy = 60;
  const r = 46;
  const frac = Math.min(1, Math.max(0, pct / 50));
  const pol = (a: number): [number, number] => [
    cx + r * Math.cos(Math.PI - a * Math.PI),
    cy - r * Math.sin(Math.PI - a * Math.PI),
  ];
  const bg = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const [px, py] = pol(frac);
  const fa = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)}`;
  return (
    <svg viewBox="0 0 118 66" className={styles.gaugeSvg} aria-hidden>
      <path d={bg} fill="none" stroke="var(--atlas-v5-navy-fill)" strokeWidth={7} strokeLinecap="round" />
      <path d={fa} fill="none" stroke="var(--atlas-v5-gold-2)" strokeWidth={7} strokeLinecap="round" />
      <text
        x={59}
        y={55}
        textAnchor="middle"
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={18}
        fontWeight={700}
        fill="var(--atlas-v5-on-navy-1)"
      >
        {formatPercent(pct)}
      </text>
    </svg>
  );
};

const CHIP_META: Record<FamiliaChip, { nombre: string; icon: React.ReactNode }> = {
  planes: { nombre: 'Planes de pensión', icon: <Icons.Colchon size={16} strokeWidth={1.8} /> },
  prestamos: { nombre: 'Préstamos', icon: <Icons.Ingreso size={16} strokeWidth={1.8} /> },
  acciones: { nombre: 'Acciones', icon: <Icons.Inversiones size={16} strokeWidth={1.8} /> },
  fondos: { nombre: 'Fondos', icon: <Icons.Fondos size={16} strokeWidth={1.8} /> },
};

const HeroInversiones: React.FC<Props> = ({ resumen, familias, rentaPasiva, serie }) => {
  const chips: FamiliaChip[] = ['planes', 'fondos', 'acciones', 'prestamos'];
  const { intereses, dividendos, total, mensual } = rentaPasiva;
  const pctInteres = total > 0 ? (intereses / total) * 100 : 0;
  const pctDiv = total > 0 ? (dividendos / total) * 100 : 0;

  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        <div className={styles.heroLeft}>
          <div className={styles.heroTopL}>
            <div>
              <div className={styles.heroEyebrow}>Mi cartera</div>
              <div className={styles.heroVal}>{formatCurrency(resumen.valorTotal)}</div>
            </div>
            <div className={styles.gauge}>
              <Gauge pct={resumen.rentabilidadPct} />
              <div className={styles.gaugeCap}>rentabilidad</div>
              <div className={styles.gaugeWon}>{formatCurrency(resumen.rentabilidadEur)}</div>
            </div>
          </div>

          <div className={styles.fchips}>
            {chips.map((chip) => {
              const f = familias[chip];
              const meta = CHIP_META[chip];
              if (f.hoy === 0 && f.aportado === 0) return null;
              return (
                <div className={styles.fchip} key={chip}>
                  <div className={styles.fchipIc}>{meta.icon}</div>
                  <div className={styles.fchipBody}>
                    <div className={styles.fchipTop}>
                      <span className={styles.fchipNom}>{meta.nombre}</span>
                    </div>
                    <div className={styles.fchipFlow}>
                      <span className={styles.fchipCap}>aportado</span> {formatCurrency(f.aportado)}
                      <span className={styles.fchipAr}>▸</span>
                      <b>{formatCurrency(f.hoy)}</b>
                      {f.pctAnual != null ? (
                        <span className={styles.fchipRet}>{formatPercent(f.pctAnual)}/año</span>
                      ) : f.pctTotal != null ? (
                        // Posiciones demasiado nuevas para CAGR anualizada · se
                        // muestra la rentabilidad total (sin "/año").
                        <span className={styles.fchipRet}>{formatPercent(f.pctTotal)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.renta}>
            <div className={styles.rentaTop}>
              <span>Tu renta pasiva</span>
              <b>{formatCurrency(total)}</b>
              <span>al año · {formatCurrency(mensual)}/mes</span>
            </div>
            <div className={styles.rentaBar}>
              <div className={styles.rentaRi} style={{ width: `${pctInteres}%` }} />
              <div className={styles.rentaRd} style={{ width: `${pctDiv}%` }} />
            </div>
            <div className={styles.rentaLeg}>
              <span className={styles.rentaLegL}>
                <span className={styles.rentaDotI} />
                intereses <b>{formatCurrency(intereses)}</b>
              </span>
              <span className={styles.rentaLegL}>
                <b>{formatCurrency(dividendos)}</b> dividendos
                <span className={styles.rentaDotD} />
              </span>
            </div>
          </div>
        </div>

        <div className={styles.heroR}>
          <div className={styles.trajTop}>
            <div className={styles.trajTitle}>Trayectoria a 20 años</div>
            <div className={styles.trajSub}>por posición · pasa por encima</div>
          </div>
          <TrayectoriaChart serie={serie} />
          <div className={styles.trajLeg}>
            {serie.bandas.map((b, i) => (
              <span className={styles.tlg} key={i}>
                <span className={styles.tlgDot} style={{ background: b.color }} />
                {b.nombre}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroInversiones;
