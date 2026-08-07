// Gráfica SVG de intereses acumulados de un préstamo.
// Extraída de `FichaRendimientoPeriodico` · la curva la define el cuadro de
// amortización: con cuota francesa es cóncava (el interés se calcula sobre un
// capital vivo que va bajando) y recta cuando el capital no se amortiza hasta
// el vencimiento.

import React, { useMemo } from 'react';
import { formatCurrency } from '../helpers';
import styles from '../pages/FichaPosicion.module.css';

const MES_NOMBRE_LOWER = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Punto normalizado (0-1) de la curva de intereses acumulados. */
export interface Punto {
  x: number;
  y: number;
}

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Interpola linealmente la `y` de la curva en la abscisa `x`. */
export const interpolarY = (puntos: Punto[], x: number): number => {
  if (puntos.length === 0) return 0;
  if (x <= puntos[0].x) return puntos[0].y;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    if (x <= b.x) {
      const tramo = b.x - a.x;
      if (tramo <= 0) return b.y;
      return a.y + ((x - a.x) / tramo) * (b.y - a.y);
    }
  }
  return puntos[puntos.length - 1].y;
};

interface ChartProps {
  totalIntereses: number;
  ratioHoy: number;
  acumuladoHoy: number;
  inicio: Date;
  fin: Date;
  /** Curva normalizada (0-1) de intereses acumulados en el tiempo. */
  puntos: Punto[];
}

const ChartInteresesAcumulados: React.FC<ChartProps> = ({
  totalIntereses,
  ratioHoy,
  acumuladoHoy,
  inicio,
  fin,
  puntos,
}) => {
  // Eje X = tiempo (0..1) · eje Y = intereses (0..total)
  const W = 900;
  const H = 220;
  const padL = 50;
  const padR = 30;
  const padT = 30;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xHoy = padL + innerW * ratioHoy;
  const yHoy = padT + innerH * (1 - interpolarY(puntos, ratioHoy));

  // Trazado de la curva en coordenadas SVG.
  const linePath = useMemo(
    () =>
      puntos
        .map(
          (pt, i) =>
            `${i === 0 ? 'M' : 'L'} ${padL + innerW * pt.x} ${padT + innerH * (1 - pt.y)}`,
        )
        .join(' '),
    [puntos, padL, innerW, padT, innerH],
  );

  // Etiquetas X · 6 puntos (inicio, 20%, 40%, 60%, 80%, fin)
  const tickLabels = useMemo(() => {
    const ticks: { x: number; label: string }[] = [];
    for (let i = 0; i <= 5; i++) {
      const ratio = i / 5;
      const ms = inicio.getTime() + (fin.getTime() - inicio.getTime()) * ratio;
      const d = new Date(ms);
      const label = `${MES_NOMBRE_LOWER[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
      ticks.push({ x: padL + innerW * ratio, label });
    }
    return ticks;
  }, [inicio, fin, padL, innerW]);

  // Etiquetas Y · 4 puntos
  const yLabels = useMemo(() => {
    const labels: { y: number; label: string }[] = [];
    for (let i = 0; i <= 3; i++) {
      const ratio = i / 3;
      const value = totalIntereses * (1 - ratio);
      const y = padT + innerH * ratio;
      labels.push({ y, label: `${Math.round(value / 1000)}K` });
    }
    return labels;
  }, [totalIntereses, padT, innerH]);

  const xEnd = padL + innerW;
  const yEnd = padT;

  return (
    <svg className={styles.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Grid horizontal */}
      <g stroke="var(--atlas-v5-line-2)" strokeWidth={1} fill="none">
        {yLabels.map((y, i) => (
          <line key={i} x1={padL} y1={y.y} x2={xEnd} y2={y.y} />
        ))}
      </g>
      {/* Etiquetas Y */}
      <g
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={9}
        fill="var(--atlas-v5-ink-4)"
        fontWeight={600}
      >
        {yLabels.map((y, i) => (
          <text key={i} x={padL - 5} y={y.y + 4} textAnchor="end">
            {y.label}
          </text>
        ))}
      </g>
      {/* Etiquetas X */}
      <g
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={9}
        fill="var(--atlas-v5-ink-4)"
        fontWeight={600}
        textAnchor="middle"
      >
        {tickLabels.map((t, i) => (
          <text key={i} x={t.x} y={H - 10}>
            {t.label}
          </text>
        ))}
      </g>
      {/* Área bajo la línea */}
      <defs>
        <linearGradient id="gradInteresesP2P" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--atlas-v5-gold)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--atlas-v5-gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${linePath} L ${xEnd} ${padT + innerH} L ${padL} ${padT + innerH} Z`}
        fill="url(#gradInteresesP2P)"
        opacity={0.6}
      />
      {/* Curva de intereses acumulados · cóncava con cuota francesa (el
          interés se calcula sobre un capital vivo que va bajando) · recta
          cuando el capital no se amortiza hasta el vencimiento. */}
      <path
        d={linePath}
        stroke="var(--atlas-v5-gold)"
        strokeWidth={2.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Marker HOY · vertical dashed */}
      <line
        x1={xHoy}
        y1={padT}
        x2={xHoy}
        y2={padT + innerH}
        stroke="var(--atlas-v5-gold)"
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.45}
      />
      {/* Etiqueta HOY */}
      <rect x={xHoy - 25} y={padT - 18} width={50} height={14} rx={3} fill="var(--atlas-v5-gold)" />
      <text
        x={xHoy}
        y={padT - 8}
        textAnchor="middle"
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={9}
        fill="var(--atlas-v5-on-navy-1)"
        fontWeight={700}
      >
        HOY
      </text>
      {/* Pelota HOY con importe */}
      <circle cx={xHoy} cy={yHoy} r={5} fill="var(--atlas-v5-on-navy-1)" stroke="var(--atlas-v5-gold)" strokeWidth={2.5} />
      <text
        x={xHoy + 10}
        y={yHoy + 3}
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={10}
        fill="var(--atlas-v5-ink-2)"
        fontWeight={700}
      >
        {formatCurrency(acumuladoHoy)}
      </text>
      {/* Etiqueta vencimiento */}
      <text
        x={xEnd - 8}
        y={yEnd - 8}
        textAnchor="end"
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize={10}
        fill="var(--atlas-v5-gold-ink)"
        fontWeight={700}
      >
        {formatCurrency(totalIntereses)} · vencimiento
      </text>
    </svg>
  );
};
export default ChartInteresesAcumulados;
