// INVERSIONES V1 · Fase 2 · GALERÍA · "Trayectoria a 20 años" por posición.
//
// Tres capas sobre panel oscuro (--brand-ink), decisión de Jose:
//   · REALIDAD  → línea blanca sólida con el histórico real (valoracionesActivos),
//                 del pasado hasta hoy.
//   · PROYECCIÓN → áreas apiladas (una banda por posición) creciendo cada una a
//                 SU CAGR realizada, de hoy hacia el futuro.
//   · OBJETIVO  → línea oro discontinua: la misma cartera creciendo a la tasa
//                 objetivo del escenario. NO sustituye a la CAGR, la compara.
// Un marcador vertical separa "hoy". Hover muestra, para el año bajo el cursor,
// el desglose por posición y los totales (realidad / proyección / objetivo).
// Préstamos terminan en su vencimiento (su banda cae a 0 · el capital sale de la
// gráfica · NO se proyecta reinversión). Supuestos del escenario compartido
// (Fase 5) · ver `serieTrayectoria` / `supuestosProyeccion`.

import React, { useMemo, useRef, useState } from 'react';
import type { SerieTrayectoria } from '../../adapters/galeriaHero';
import styles from './galeriaV5.module.css';

// Marco del lienzo (coordenadas del viewBox · mismas proporciones que el mockup).
const VB_W = 360;
const VB_H = 170;
const X0 = 44;
const X1 = 352;
const Y0 = 12;
const Y1 = 140;

// Formato compacto para eje/tooltip. Bajo 1.000 muestra el valor entero (no
// redondea 500 → "1k"); en miles usa 1 decimal por debajo de 10k para no perder
// resolución en rangos pequeños/medios.
const kfmt = (v: number): string => {
  if (v < 1000) return String(Math.round(v));
  const k = v / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
};

interface Props {
  serie: SerieTrayectoria;
}

const TrayectoriaChart: React.FC<Props> = ({ serie }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  const { years, bandas, totalPorAño, historicoPorAño, objetivoPorAño, baseYearIdx, vmax } =
    serie;
  const baseYear = years[0] ?? new Date().getFullYear();
  const lastYear = years[years.length - 1] ?? baseYear;
  const span = Math.max(1, lastYear - baseYear);
  const hoyYear = years[baseYearIdx] ?? baseYear;
  const hayHistorico = baseYearIdx > 0;

  const xY = (year: number): number => X0 + ((year - baseYear) / span) * (X1 - X0);
  const yV = (v: number): number => Y1 - (vmax > 0 ? v / vmax : 0) * (Y1 - Y0);

  // Polilínea sobre los años con valor definido (ignora `null`).
  const linePath = (vals: (number | null)[]): string => {
    let d = '';
    vals.forEach((v, i) => {
      if (v == null) return;
      const seg = `${xY(years[i]).toFixed(1)} ${yV(v).toFixed(1)}`;
      d += d === '' ? `M${seg}` : ` L${seg}`;
    });
    return d;
  };
  const histPath = linePath(historicoPorAño);
  const objPath = linePath(objetivoPorAño);

  // Paths apilados (de abajo hacia arriba).
  const bandPaths = useMemo(() => {
    const cum = years.map(() => 0);
    const paths: Array<{ d: string; color: string }> = [];
    for (const banda of bandas) {
      const lo = years.map((y, i) => [xY(y), yV(cum[i])] as const);
      years.forEach((_, i) => {
        cum[i] += banda.valores[i];
      });
      const up = years.map((y, i) => [xY(y), yV(cum[i])] as const);
      let d = `M${lo[0][0].toFixed(1)} ${lo[0][1].toFixed(1)}`;
      for (let i = 1; i < lo.length; i++) d += ` L${lo[i][0].toFixed(1)} ${lo[i][1].toFixed(1)}`;
      for (let i = up.length - 1; i >= 0; i--) d += ` L${up[i][0].toFixed(1)} ${up[i][1].toFixed(1)}`;
      paths.push({ d: `${d} Z`, color: banda.color });
    }
    return paths;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandas, years, vmax]);

  const vencimientos = useMemo(
    () =>
      Array.from(
        new Set(
          bandas
            .map((b) => b.vencYear)
            .filter((y): y is number => y != null && y >= baseYear && y <= lastYear),
        ),
      ),
    [bandas, baseYear, lastYear],
  );

  const xTicks = useMemo(() => {
    const ticks = [baseYear];
    for (let y = baseYear + 5; y < lastYear; y += 5) ticks.push(y);
    ticks.push(lastYear);
    return Array.from(new Set(ticks));
  }, [baseYear, lastYear]);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const rx = ((e.clientX - rect.left) / rect.width) * VB_W;
    let y = Math.round(baseYear + ((rx - X0) / (X1 - X0)) * span);
    y = Math.max(baseYear, Math.min(lastYear, y));
    setHoverYear(y);
  };

  const hoverIdx = hoverYear != null ? hoverYear - baseYear : -1;
  const guideX = hoverYear != null ? xY(hoverYear) : 0;
  // Posición del tooltip en % (para que acompañe al cursor sin salirse).
  const tipLeftPct = hoverYear != null ? Math.min(78, Math.max(2, ((guideX - X0) / (X1 - X0)) * 100)) : 0;

  return (
    <div className={styles.trajChart}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverYear(null)}
        role="img"
        aria-label="Trayectoria proyectada a 20 años por posición"
      >
        {/* Rejilla + eje Y */}
        <g stroke="var(--atlas-v5-border-translucent)" strokeWidth={1}>
          <line x1={X0} y1={Y0} x2={X1} y2={Y0} />
          <line x1={X0} y1={(Y0 + Y1) / 2} x2={X1} y2={(Y0 + Y1) / 2} />
          <line x1={X0} y1={Y1} x2={X1} y2={Y1} />
        </g>
        <g fontFamily="var(--atlas-v5-font-mono-num)" fontSize={8} fill="var(--atlas-v5-on-navy-6)">
          <text x={X0 - 4} y={Y0 + 3} textAnchor="end">{kfmt(vmax)}</text>
          <text x={X0 - 4} y={(Y0 + Y1) / 2 + 3} textAnchor="end">{kfmt(vmax / 2)}</text>
          <text x={X0 - 4} y={Y1} textAnchor="end">0</text>
          {xTicks.map((y) => (
            <text key={y} x={xY(y).toFixed(1)} y={VB_H - 12} textAnchor="middle">{y}</text>
          ))}
        </g>

        {/* Bandas apiladas (proyección con la CAGR de cada posición) */}
        {bandPaths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity={0.95} />
        ))}

        {/* Marcador "hoy" (separa realidad de proyección) */}
        {hayHistorico && (
          <>
            <line
              x1={xY(hoyYear).toFixed(1)}
              y1={Y0}
              x2={xY(hoyYear).toFixed(1)}
              y2={Y1}
              stroke="var(--atlas-v5-on-navy-3)"
              strokeWidth={1}
              strokeDasharray="1 2"
            />
            <text
              x={xY(hoyYear).toFixed(1)}
              y={Y0 - 3}
              textAnchor="middle"
              fontFamily="var(--atlas-v5-font-mono-num)"
              fontSize={7}
              fill="var(--atlas-v5-on-navy-4)"
            >
              hoy
            </text>
          </>
        )}

        {/* Línea de OBJETIVO (oro discontinua) */}
        {objPath && (
          <path
            d={objPath}
            fill="none"
            stroke="var(--atlas-v5-gold-2)"
            strokeWidth={1.5}
            strokeDasharray="3 2.5"
            strokeLinejoin="round"
          />
        )}

        {/* Línea de REALIDAD (histórico real · blanca sólida) */}
        {histPath && (
          <path
            d={histPath}
            fill="none"
            stroke="var(--atlas-v5-on-navy-1)"
            strokeWidth={1.75}
            strokeLinejoin="round"
          />
        )}

        {/* Líneas de vencimiento */}
        {vencimientos.map((y) => (
          <line
            key={`v-${y}`}
            x1={xY(y).toFixed(1)}
            y1={Y0}
            x2={xY(y).toFixed(1)}
            y2={Y1}
            stroke="var(--atlas-v5-on-navy-5)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}

        {/* Guía de hover */}
        {hoverYear != null && (
          <line
            x1={guideX}
            y1={Y0}
            x2={guideX}
            y2={Y1}
            stroke="var(--atlas-v5-on-navy-1)"
            strokeWidth={1}
            opacity={0.5}
          />
        )}
      </svg>

      {hoverYear != null && hoverIdx >= 0 && (
        <div className={styles.trajTip} style={{ left: `${tipLeftPct}%`, top: 6, opacity: 1 }}>
          <div className={styles.trajTipYear}>
            {hoverYear}
            {hoverIdx < baseYearIdx ? ' · real' : hoverIdx > baseYearIdx ? ' · proyección' : ''}
          </div>
          <div className={styles.trajTipRows}>
            {bandas.map((b, i) => {
              const v = b.valores[hoverIdx];
              if (v <= 0) return null;
              return (
                <div key={i} className={styles.trajTipRow}>
                  <span className={styles.trajTipDot} style={{ background: b.color }} />
                  <span className={styles.trajTipNom}>{b.nombre}</span>
                  <span className={styles.trajTipAm}>{kfmt(v)}</span>
                </div>
              );
            })}
          </div>
          {historicoPorAño[hoverIdx] != null && (
            <div className={styles.trajTipTotal}>
              <span>realidad</span>
              <b>{kfmt(historicoPorAño[hoverIdx] as number)} €</b>
            </div>
          )}
          {hoverIdx >= baseYearIdx && (
            <div className={styles.trajTipTotal}>
              <span>proyección</span>
              <b>{kfmt(totalPorAño[hoverIdx])} €</b>
            </div>
          )}
          {objetivoPorAño[hoverIdx] != null && (
            <div className={styles.trajTipTotal}>
              <span>objetivo</span>
              <b>{kfmt(objetivoPorAño[hoverIdx] as number)} €</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrayectoriaChart;
