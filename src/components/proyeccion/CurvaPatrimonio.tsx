// CurvaPatrimonio · C-PROY-5 · Fase B4
//
// LA curva de patrimonio a 20 años · un solo componente para los tres
// consumidores (héroe del Panel · Mi Plan · panel de KPIs). Lee la salida
// canónica `PuntoPatrimonioAnual[]` del motor y NO calcula nada por su
// cuenta. SVG puro · sin dependencias · tokens --atlas-v5-* vía module.css
// (variante navy para el héroe · variante clara para fondos blancos).

import React, { useMemo } from 'react';
import type { PuntoPatrimonioAnual } from '../../modules/horizon/proyeccion/mensual/types/proyeccionMensual';
import styles from './CurvaPatrimonio.module.css';

export interface CurvaPatrimonioProps {
  serie: PuntoPatrimonioAnual[];
  /** 'navy' para el héroe del Panel · 'clara' para tarjetas blancas. */
  variante: 'navy' | 'clara';
  /** Alto del área de dibujo en px · default 150. */
  alto?: number;
}

const fmtCompacto = (v: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v);

const W = 600;

const CurvaPatrimonio: React.FC<CurvaPatrimonioProps> = ({ serie, variante, alto = 150 }) => {
  const geometria = useMemo(() => {
    if (serie.length < 2) return null;
    const valores = serie.map((p) => p.patrimonioNeto);
    const min = Math.min(...valores, 0);
    const max = Math.max(...valores);
    const rango = max - min || 1;
    const pad = 8;
    const x = (i: number) => (i / (serie.length - 1)) * W;
    const y = (v: number) => pad + (1 - (v - min) / rango) * (alto - pad * 2);
    const puntos = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.patrimonioNeto).toFixed(1)}`);
    const linea = `M ${puntos.join(' L ')}`;
    const area = `${linea} L ${W},${alto} L 0,${alto} Z`;
    const yCero = min < 0 ? y(0) : null;
    return { linea, area, yCero };
  }, [serie, alto]);

  if (!geometria) return null;

  const primero = serie[0];
  const ultimo = serie[serie.length - 1];

  return (
    <div className={`${styles.wrap} ${styles[variante]}`}>
      <svg
        viewBox={`0 0 ${W} ${alto}`}
        preserveAspectRatio="none"
        className={styles.svg}
        style={{ height: alto }}
        role="img"
        aria-label={`Proyección de patrimonio de ${primero.año} a ${ultimo.año}: de ${fmtCompacto(primero.patrimonioNeto)} a ${fmtCompacto(ultimo.patrimonioNeto)}`}
      >
        <path d={geometria.area} className={styles.area} />
        {geometria.yCero !== null && (
          <line x1={0} x2={W} y1={geometria.yCero} y2={geometria.yCero} className={styles.cero} />
        )}
        <path d={geometria.linea} className={styles.linea} />
      </svg>
      <div className={styles.labels}>
        <span>
          {primero.año} · <b className="mono">{fmtCompacto(primero.patrimonioNeto)}</b>
        </span>
        <span>
          {ultimo.año} · <b className="mono">{fmtCompacto(ultimo.patrimonioNeto)}</b>
        </span>
      </div>
    </div>
  );
};

export default CurvaPatrimonio;
