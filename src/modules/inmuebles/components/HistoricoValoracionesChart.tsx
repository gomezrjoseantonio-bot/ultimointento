import React, { useMemo } from 'react';
import { MoneyValue } from '../../../design-system/v5';
import styles from './HistoricoValoracionesChart.module.css';

export interface PuntoValoracion {
  fecha: string; // 'YYYY-MM' o 'YYYY-MM-DD'
  valor: number;
}

export interface HistoricoValoracionesChartProps {
  puntos: PuntoValoracion[];
  /** Tasa de revalorización anual supuesta para la proyección (default 3 %). */
  tasaProyeccionAnual?: number;
  /** Años de proyección a dibujar tras la última valoración real (default 5; 0 = sin proyección). */
  aniosProyeccion?: number;
}

/** 'YYYY-MM[-DD]' → año decimal (2024-07 → 2024.5) para espaciar el eje X por fecha real. */
const aAnioDecimal = (fecha: string): number => {
  const [anioStr, mesStr] = fecha.split('-');
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  if (!Number.isFinite(anio)) return 0;
  const mesIdx = Number.isFinite(mes) ? Math.min(Math.max(mes - 1, 0), 11) : 0;
  return anio + mesIdx / 12;
};

const anioDe = (fecha: string): string => fecha.split('-')[0] ?? fecha;

const W = 600;
const H = 176;
const PAD_T = 14;
const PAD_B = 22;
const PAD_L = 6;
const PAD_R = 6;

/**
 * Evolución del valor del inmueble como gráfica de área (antes era una lista de texto).
 * Dibuja la parte real (sólida) y una proyección opcional (discontinua) claramente
 * etiquetada como supuesto — nunca se presenta como dato registrado.
 */
const HistoricoValoracionesChart: React.FC<HistoricoValoracionesChartProps> = ({
  puntos,
  tasaProyeccionAnual = 0.03,
  aniosProyeccion = 5,
}) => {
  const modelo = useMemo(() => {
    const reales = [...puntos]
      .filter((p) => Number.isFinite(p.valor))
      .sort((a, b) => aAnioDecimal(a.fecha) - aAnioDecimal(b.fecha));
    if (reales.length === 0) return null;

    const ultimo = reales[reales.length - 1];
    const xUltimoReal = aAnioDecimal(ultimo.fecha);

    const proyeccion: Array<{ x: number; valor: number }> = [];
    if (aniosProyeccion > 0 && tasaProyeccionAnual > 0) {
      for (let k = 1; k <= aniosProyeccion; k++) {
        proyeccion.push({
          x: xUltimoReal + k,
          valor: Math.round(ultimo.valor * Math.pow(1 + tasaProyeccionAnual, k)),
        });
      }
    }

    const puntosReales = reales.map((p) => ({ x: aAnioDecimal(p.fecha), valor: p.valor }));
    const todos = [...puntosReales, ...proyeccion];
    const xMin = todos[0].x;
    const xMax = todos[todos.length - 1].x;
    const yMax = Math.max(...todos.map((p) => p.valor)) * 1.08 || 1;
    const spanX = xMax - xMin || 1;

    const px = (x: number) => PAD_L + ((x - xMin) / spanX) * (W - PAD_L - PAD_R);
    const py = (v: number) => PAD_T + (1 - v / yMax) * (H - PAD_T - PAD_B);

    const linea = (pts: Array<{ x: number; valor: number }>) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(p.valor).toFixed(1)}`).join(' ');

    const areaReal = `${linea(puntosReales)} L${px(xUltimoReal).toFixed(1)},${H - PAD_B} L${px(
      puntosReales[0].x,
    ).toFixed(1)},${H - PAD_B} Z`;

    return {
      puntosReales,
      lineaReal: linea(puntosReales),
      areaReal,
      lineaProyeccion: proyeccion.length > 0 ? linea([puntosReales[puntosReales.length - 1], ...proyeccion]) : null,
      px,
      py,
      xUltimoReal,
      etiquetaInicio: anioDe(reales[0].fecha),
      etiquetaFin: proyeccion.length > 0 ? String(Math.round(xMax)) : anioDe(ultimo.fecha),
      valorUltimo: ultimo.valor,
      hayProyeccion: proyeccion.length > 0,
    };
  }, [puntos, tasaProyeccionAnual, aniosProyeccion]);

  if (!modelo) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span>
          <i className={styles.lineReal} />
          realidad
        </span>
        {modelo.hayProyeccion && (
          <span>
            <i className={styles.lineProj} />
            proyección
          </span>
        )}
      </div>

      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolución del valor del inmueble"
      >
        <defs>
          <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--atlas-v5-gold-soft)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--atlas-v5-gold-soft)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={modelo.areaReal} fill="url(#valGrad)" />

        {modelo.lineaProyeccion && (
          <path
            d={modelo.lineaProyeccion}
            fill="none"
            stroke="var(--atlas-v5-gold)"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeOpacity={0.85}
            vectorEffect="non-scaling-stroke"
          />
        )}

        <path
          d={modelo.lineaReal}
          fill="none"
          stroke="var(--atlas-v5-gold)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {modelo.hayProyeccion && (
          <line
            x1={modelo.px(modelo.xUltimoReal)}
            y1={PAD_T}
            x2={modelo.px(modelo.xUltimoReal)}
            y2={H - PAD_B}
            stroke="var(--atlas-v5-ink-5)"
            strokeWidth={1}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {modelo.puntosReales.map((p) => (
          <circle
            key={`${p.x}-${p.valor}`}
            cx={modelo.px(p.x)}
            cy={modelo.py(p.valor)}
            r={3}
            fill="var(--atlas-v5-card)"
            stroke="var(--atlas-v5-gold)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className={styles.axis}>
        <span>{modelo.etiquetaInicio}</span>
        <span className={styles.axisNow}>
          <MoneyValue value={modelo.valorUltimo} decimals={0} /> · hoy
        </span>
        <span>{modelo.etiquetaFin}</span>
      </div>

      {modelo.hayProyeccion && (
        <div className={styles.caption}>
          proyección a {aniosProyeccion} años · supuesto de revalorización{' '}
          +{(tasaProyeccionAnual * 100).toFixed(0)} %/año
        </div>
      )}
    </div>
  );
};

export default HistoricoValoracionesChart;
