// INVERSIONES V1 · Fase 3.1 · gráfica de proyección del plan de pensiones.
// Mockup atlas-inversiones-v10.html · #page-detalle (proj-chart / renderProj).
//
// Pasado REALIZADO (línea sólida oro · inmutable) + futuro proyectado a la
// rentabilidad objetivo (punteado oro) + poder adquisitivo real descontando
// inflación (punteado gris). Bandas verticales por gestora (tramos). Sin
// librería de charts · SVG a mano. Los sliders (rentabilidad objetivo +
// inflación) viven en la ficha y solo recalculan el FUTURO.

import React, { useId } from 'react';
import styles from './fichaDetalleV5.module.css';

export interface PuntoRealizado {
  year: number;
  valor: number;
}
export interface BandaGestora {
  /** Año de inicio del tramo (se pinta una línea vertical de separación). */
  year: number;
  label: string;
}

interface Props {
  /** Serie realizada (año · valor), ascendente. Puede ser dispersa. */
  realizados: PuntoRealizado[];
  valorHoy: number;
  hoy: number;
  /** Año de rescate (fin de la proyección). */
  yrFin: number;
  /** Rentabilidad objetivo anual (%). */
  ratePct: number;
  /** Inflación anual (%). */
  inflPct: number;
  bandas?: BandaGestora[];
}

const X0 = 44;
const X1 = 712;
const YTOP = 16;
const YBOT = 250;
const VW = 760;
const VH = 280;

const path = (pts: Array<[number, number]>): string =>
  pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

const ProyeccionPlanChart: React.FC<Props> = ({
  realizados,
  valorHoy,
  hoy,
  yrFin,
  ratePct,
  inflPct,
  bandas = [],
}) => {
  // Id único para el gradiente · evita colisión si se montan varias gráficas.
  const gradId = `planProjGrad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const rate = ratePct / 100;
  const infl = inflPct / 100;

  const pasadoOrdenado = [...realizados].filter((p) => Number.isFinite(p.valor)).sort((a, b) => a.year - b.year);
  const yr0 = pasadoOrdenado.length ? Math.min(pasadoOrdenado[0].year, hoy) : hoy - 1;
  const span = Math.max(1, yrFin - yr0);

  const finalNom = valorHoy * Math.pow(1 + rate, Math.max(0, yrFin - hoy));
  const vmaxCandidatos = [finalNom, valorHoy, ...pasadoOrdenado.map((p) => p.valor)];
  const vmax = Math.max(...vmaxCandidatos, 1);

  const xY = (y: number): number => X0 + ((y - yr0) / span) * (X1 - X0);
  const yV = (v: number): number => YBOT - (v / vmax) * (YBOT - YTOP);

  // Pasado realizado (hasta hoy) + enganche al valor de hoy.
  const pastPts: Array<[number, number]> = pasadoOrdenado
    .filter((p) => p.year <= hoy)
    .map((p) => [xY(p.year), yV(p.valor)]);
  pastPts.push([xY(hoy), yV(valorHoy)]);

  // Futuro nominal + poder adquisitivo real.
  const futPts: Array<[number, number]> = [];
  const realPts: Array<[number, number]> = [];
  for (let y = hoy; y <= yrFin; y++) {
    const nominal = valorHoy * Math.pow(1 + rate, y - hoy);
    futPts.push([xY(y), yV(nominal)]);
    realPts.push([xY(y), yV(nominal / Math.pow(1 + infl, y - hoy))]);
  }

  const areaFut = `${path(futPts)} L${X1} ${YBOT} L${xY(hoy).toFixed(1)} ${YBOT} Z`;

  // Gridlines horizontales (3).
  const gridYs = [YTOP + (YBOT - YTOP) * 0.12, YTOP + (YBOT - YTOP) * 0.5, YBOT];

  return (
    <svg className={styles.projSvg} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" role="img" aria-label="Proyección del plan a la jubilación">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--atlas-v5-gold)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--atlas-v5-gold)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      <g stroke="var(--atlas-v5-line-2)" strokeWidth={1}>
        {gridYs.map((gy, i) => (
          <line key={i} x1={X0} y1={gy} x2={X1} y2={gy} />
        ))}
      </g>

      {/* Bandas por gestora · líneas verticales de separación (dentro del rango). */}
      <g>
        {bandas
          .filter((b) => b.year > yr0 && b.year < yrFin)
          .map((b, i) => (
            <line
              key={`band-${i}`}
              x1={xY(b.year)}
              y1={YTOP}
              x2={xY(b.year)}
              y2={YBOT}
              stroke="var(--atlas-v5-line)"
              strokeWidth={1}
              strokeDasharray="1 4"
            />
          ))}
      </g>

      {/* Línea "hoy" */}
      <line x1={xY(hoy)} y1={YTOP} x2={xY(hoy)} y2={YBOT} stroke="var(--atlas-v5-ink-5)" strokeWidth={1} strokeDasharray="2 3" />

      {/* Área bajo el futuro */}
      <path d={areaFut} fill={`url(#${gradId})`} />

      {/* Poder adquisitivo real (punteado gris) */}
      <path d={path(realPts)} fill="none" stroke="var(--atlas-v5-ink-4)" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />

      {/* Pasado realizado (sólido oro) */}
      <path d={path(pastPts)} fill="none" stroke="var(--atlas-v5-gold)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

      {/* Futuro nominal (punteado oro) */}
      <path d={path(futPts)} fill="none" stroke="var(--atlas-v5-gold)" strokeWidth={2.5} strokeDasharray="7 4" strokeLinecap="round" />

      {/* Puntos: hoy + final nominal */}
      <circle cx={xY(hoy)} cy={yV(valorHoy)} r={4.5} fill="var(--atlas-v5-card)" stroke="var(--atlas-v5-gold)" strokeWidth={2.5} />
      <circle cx={xY(yrFin)} cy={yV(finalNom)} r={5} fill="var(--atlas-v5-gold)" stroke="var(--atlas-v5-card)" strokeWidth={2} />
    </svg>
  );
};

export default ProyeccionPlanChart;
