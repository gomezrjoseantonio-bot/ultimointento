// ============================================================================
// Tesorería V9 · "Lo que viene · próximos 30 días"
// ============================================================================
//
// SVG a mano (guía §14 · patrón de la casa, como `CarteraHero`), sin chart.js
// ni recharts y sin tocar `treasuryForecastService` (prohibido en el spec: sus
// `regenerate*` son código muerto con riesgo de doble emisor). Los datos son
// `serieDiariaConsolidada` (capa pura · fase 1).
//
// Colores por tokens `var(--atlas-v5-*)` directamente en los atributos del
// SVG: al ser SVG inline en el DOM resuelve las custom properties solo, sin
// necesitar el puente `useChartColors` (que existe para Recharts, que no
// acepta `var(...)`).
//
// El marcador de "Movimiento grande" señala los días cuyo salto |Δ| supera el
// 25 % del recorrido de la serie — umbral relativo, no configurado por Jose:
// anotado en el PR como perilla abierta.
// ============================================================================

import React, { useMemo, useState } from 'react';
import type { SerieDiaria } from '../../../services/tesoreriaV6Metrics';
import { importeSaldo, mesCorto } from './formatoV6';
import styles from './GraficoTreintaDias.module.css';

const W = 620;
const H = 150;
const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 20;
const PAD_B = 20;

/** "42K" · "1,7K" · por debajo de mil, el importe entero. */
const compacto = (n: number): string => {
  const abs = Math.abs(n);
  if (abs < 1000) return importeSaldo(Math.round(n), false);
  const miles = n / 1000;
  const conDecimal = Math.abs(miles) < 10 && Math.round(miles * 10) % 10 !== 0;
  const txt = conDecimal ? miles.toFixed(1).replace('.', ',') : String(Math.round(miles));
  return `${txt.replace('-', '−')}K`;
};

/** "24 ago" · el día 0 se rotula "hoy" donde toca. */
const rotuloDia = (iso: string): string => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${mesCorto(m - 1)}`;
};

/** Paso "bonito" para la rejilla horizontal · 3-5 líneas. */
const pasoBonito = (rango: number): number => {
  if (rango <= 0) return 1;
  const bruto = rango / 4;
  const magnitud = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (bruto <= m * magnitud) return m * magnitud;
  }
  return 10 * magnitud;
};

interface Props {
  serie: SerieDiaria;
}

const GraficoTreintaDias: React.FC<Props> = ({ serie }) => {
  const [hover, setHover] = useState<number | null>(null);
  const { puntos, descubierto } = serie;

  const geo = useMemo(() => {
    if (puntos.length < 2) return null;
    const valores = puntos.map((p) => p.saldo);
    let min = Math.min(...valores);
    let max = Math.max(...valores);
    if (max === min) {
      // Serie plana · un carril alrededor del valor para que la línea respire.
      max += Math.max(1, Math.abs(max) * 0.05);
      min -= Math.max(1, Math.abs(min) * 0.05);
    }
    const margen = (max - min) * 0.1;
    min -= margen;
    max += margen;

    const n = puntos.length;
    const x = (i: number): number => PAD_L + ((W - PAD_L - PAD_R) * i) / (n - 1);
    const y = (v: number): number => PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / (max - min));

    let linea = '';
    for (let i = 0; i < n; i++) {
      linea += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(puntos[i].saldo).toFixed(1)}`;
    }
    const area = `M${x(0).toFixed(1)} ${(H - PAD_B).toFixed(1)}${puntos
      .map((p, i) => `L${x(i).toFixed(1)} ${y(p.saldo).toFixed(1)}`)
      .join('')}L${x(n - 1).toFixed(1)} ${(H - PAD_B).toFixed(1)}Z`;

    const paso = pasoBonito(max - min);
    const rejilla: number[] = [];
    for (let v = Math.ceil(min / paso) * paso; v <= max; v += paso) rejilla.push(v);

    // "Movimiento grande" · salto diario que supera el 25 % del recorrido.
    const recorrido = Math.max(...valores) - Math.min(...valores);
    const grandes: number[] = [];
    if (recorrido > 0) {
      for (let i = 1; i < n; i++) {
        if (Math.abs(puntos[i].saldo - puntos[i - 1].saldo) >= recorrido * 0.25) grandes.push(i);
      }
    }

    const idxDescubierto =
      descubierto == null ? -1 : puntos.findIndex((p) => p.dia === descubierto.dia);

    return { x, y, linea, area, rejilla, grandes, idxDescubierto, n };
  }, [puntos, descubierto]);

  if (!geo) return null;
  const { x, y, linea, area, rejilla, grandes, idxDescubierto, n } = geo;

  const alMover = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((vx - PAD_L) / (W - PAD_L - PAD_R)) * (n - 1))));
    setHover(i);
  };

  const etiquetasX = [0, 6, 13, 20, n - 1].filter((v, i, a) => a.indexOf(v) === i && v < n);

  return (
    <div className={styles.wrap}>
      <div className={styles.zona}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.svg} aria-hidden="true">
          {rejilla.map((v) => (
            <g key={v}>
              <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="var(--atlas-v5-cartera-grid)" strokeWidth={1} />
              <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" className={styles.eje}>
                {compacto(v)}
              </text>
            </g>
          ))}

          <path d={area} fill="url(#tesoFill)" />
          <defs>
            <linearGradient id="tesoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--atlas-v5-gold-2)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--atlas-v5-gold-2)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path
            d={linea}
            fill="none"
            stroke="var(--atlas-v5-white)"
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Punto de partida · hoy. */}
          <circle cx={x(0)} cy={y(puntos[0].saldo)} r={4} fill="var(--atlas-v5-white)" stroke="var(--atlas-v5-brand-ink)" strokeWidth={1.5} />

          {grandes.map((i) => (
            <circle
              key={`g-${i}`}
              cx={x(i)}
              cy={y(puntos[i].saldo)}
              r={3.5}
              fill="var(--atlas-v5-gold-2)"
              stroke="var(--atlas-v5-brand-ink)"
              strokeWidth={1.5}
            />
          ))}

          {descubierto != null && idxDescubierto >= 0 && (
            <g>
              <line
                x1={x(idxDescubierto)}
                y1={PAD_T}
                x2={x(idxDescubierto)}
                y2={H - PAD_B}
                stroke="var(--atlas-v5-gold-2)"
                strokeWidth={1.2}
                strokeDasharray="3 3"
              />
              <circle
                cx={x(idxDescubierto)}
                cy={y(puntos[idxDescubierto].saldo)}
                r={5}
                fill="var(--atlas-v5-gold-2)"
                stroke="var(--atlas-v5-white)"
                strokeWidth={2}
              />
              <text
                x={Math.max(PAD_L + 56, Math.min(W - PAD_R - 56, x(idxDescubierto)))}
                y={12}
                textAnchor="middle"
                className={styles.avisoDescubierto}
              >
                {descubierto.cuentaAlias} {compacto(descubierto.importe)} · {rotuloDia(descubierto.dia)}
              </text>
            </g>
          )}

          {etiquetasX.map((i) => (
            <text key={`x-${i}`} x={x(i)} y={H - 6} textAnchor="middle" className={styles.eje}>
              {i === 0 ? 'hoy' : rotuloDia(puntos[i].dia)}
            </text>
          ))}

          {hover != null && (
            <g>
              <line x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={H - PAD_B} stroke="var(--atlas-v5-cartera-hoy-line)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(puntos[hover].saldo)} r={4.5} fill="var(--atlas-v5-white)" stroke="var(--atlas-v5-gold-2)" strokeWidth={2.5} />
            </g>
          )}

          <rect
            x={PAD_L}
            y={PAD_T}
            width={W - PAD_L - PAD_R}
            height={H - PAD_T - PAD_B}
            fill="transparent"
            className={styles.hit}
            onMouseMove={alMover}
            onMouseLeave={() => setHover(null)}
          />
        </svg>

        {hover != null && (
          <div
            className={styles.tip}
            style={{
              left: `${(x(hover) / W) * 100}%`,
              top: `${(y(puntos[hover].saldo) / H) * 100}%`,
            }}
          >
            <div className={styles.tipDia}>{hover === 0 ? `hoy · ${rotuloDia(puntos[0].dia)}` : rotuloDia(puntos[hover].dia)}</div>
            <div className={styles.tipVal}>{importeSaldo(puntos[hover].saldo)}</div>
          </div>
        )}
      </div>

      <div className={styles.leyenda}>
        <span>
          <i className={styles.lgLinea} aria-hidden="true" />
          Saldo consolidado
        </span>
        {grandes.length > 0 && (
          <span>
            <i className={styles.lgPunto} aria-hidden="true" />
            Movimiento grande
          </span>
        )}
        {descubierto != null && (
          <span>
            <i className={`${styles.lgPunto} ${styles.lgPuntoAro}`} aria-hidden="true" />
            1 cuenta en descubierto
          </span>
        )}
      </div>
    </div>
  );
};

export default GraficoTreintaDias;
