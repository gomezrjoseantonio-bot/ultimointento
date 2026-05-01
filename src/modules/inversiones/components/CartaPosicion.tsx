// T23.1 · Carta de posición · galería v2 (§ Z.3 spec).
// Render contextual de la visualización inferior según el grupo del tipo
// (sparkline para valoración_simple/dividendos · matriz cobros para
// rendimiento_periodico · placeholder en otro caso).

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { PosicionInversion } from '../../../types/inversiones';
import {
  clasificarTipo,
  construirSerieValor,
  formatCurrency,
  formatDelta,
  formatPercent,
  getColorByTipo,
  getFooterMeta,
  getLogoClass,
  getLogoText,
  getTipoLabel,
  getTipoTagLabel,
  mapTipoToCardClass,
  signClass,
} from '../helpers';
import styles from '../InversionesGaleria.module.css';

interface CartaPosicionProps {
  posicion: PosicionInversion;
  onClick: (id: number) => void;
}

const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Sparkline SVG simple · sin dependencias externas. Calcula el path desde
 * la serie temporal y dibuja una línea continua.
 */
const Sparkline: React.FC<{ data: { x: number; y: number }[]; color: string }> = ({
  data,
  color,
}) => {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const xs = data.map((p) => p.x);
    const ys = data.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const W = 280;
    const H = 56;
    const pad = 2;
    const sx = (x: number) => pad + ((x - minX) / dx) * (W - pad * 2);
    const sy = (y: number) => H - pad - ((y - minY) / dy) * (H - pad * 2);
    return data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
      .join(' ');
  }, [data]);

  if (!path) return null;
  return (
    <svg
      className={styles.cartaVizSparkline}
      viewBox="0 0 280 56"
      preserveAspectRatio="none"
      role="img"
      aria-label="Evolución de valor"
    >
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/**
 * Matriz de cobros mensuales del año en curso · 12 cuadritos.
 * Estado heurístico para 23.1:
 *   - cobrado · aportación de tipo `dividendo` registrada en ese mes
 *   - pendiente · mes ya pasado sin cobro registrado
 *   - futuro · mes posterior al actual
 */
const MatrizCobrosMensuales: React.FC<{ posicion: PosicionInversion }> = ({ posicion }) => {
  const now = new Date();
  const year = now.getFullYear();
  const mesActual = now.getMonth();
  const cobradosPorMes = useMemo(() => {
    const arr = new Array<boolean>(12).fill(false);
    for (const ap of posicion.aportaciones || []) {
      if (ap.tipo !== 'dividendo' || !ap.fecha) continue;
      const d = new Date(ap.fecha);
      if (d.getFullYear() === year) arr[d.getMonth()] = true;
    }
    return arr;
  }, [posicion.aportaciones, year]);

  return (
    <div style={{ width: '100%' }}>
      <div className={styles.cartaMatriz} role="img" aria-label="Cobros mensuales del año en curso">
        {Array.from({ length: 12 }, (_, i) => {
          let cls = styles.cartaMatrizCell;
          if (cobradosPorMes[i]) cls += ' ' + styles.cobrado;
          else if (i < mesActual) cls += ' ' + styles.pendiente;
          else cls += ' ' + styles.futuro;
          return <div key={i} className={cls} title={`${MESES[i]} ${year}`} />;
        })}
      </div>
      <div className={styles.cartaMatrizLeyenda}>
        {MESES.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
    </div>
  );
};

const PlaceholderViz: React.FC<{ mensaje: string }> = ({ mensaje }) => (
  <div className={styles.cartaVizPlaceholder}>{mensaje}</div>
);

const CartaVisualizacion: React.FC<{ posicion: PosicionInversion }> = ({ posicion }) => {
  const grupo = clasificarTipo(posicion.tipo);

  if (grupo === 'rendimiento_periodico') {
    return <MatrizCobrosMensuales posicion={posicion} />;
  }
  if (grupo === 'valoracion_simple' || grupo === 'dividendos') {
    const serie = construirSerieValor(posicion);
    if (serie.length < 2) {
      return <PlaceholderViz mensaje="datos insuficientes para gráfico" />;
    }
    return <Sparkline data={serie} color={getColorByTipo(posicion.tipo)} />;
  }
  return <PlaceholderViz mensaje="—" />;
};

const CartaPosicion: React.FC<CartaPosicionProps> = ({ posicion, onClick }) => {
  const cardClass = mapTipoToCardClass(posicion.tipo);
  const aportado = Number(posicion.total_aportado ?? 0);
  const valorActual = Number(posicion.valor_actual ?? 0);
  const rentEur = Number(posicion.rentabilidad_euros ?? valorActual - aportado);
  const rentPct = Number(
    posicion.rentabilidad_porcentaje ?? (aportado > 0 ? ((valorActual - aportado) / aportado) * 100 : 0),
  );

  const handleClick = () => onClick(posicion.id);

  const handleKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(posicion.id);
    }
  };

  return (
    <button
      type="button"
      className={`${styles.carta} ${styles[cardClass]}`}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-label={`Ver detalle de ${posicion.nombre || posicion.entidad || 'posición'}`}
    >
      <div className={styles.cartaTop}>
        <div className={styles.cartaMarca}>
          <div
            className={`${styles.cartaLogo} ${
              getLogoClass(posicion.entidad) ? styles[getLogoClass(posicion.entidad)] : ''
            }`}
          >
            {getLogoText(posicion.entidad)}
          </div>
          <div className={styles.cartaEntidadInfo}>
            <div className={styles.cartaEntidadLab}>{getTipoLabel(posicion.tipo)}</div>
            <div className={styles.cartaEntidadNom}>{posicion.entidad || '—'}</div>
          </div>
        </div>
        <span className={`${styles.cartaTipo} ${styles[cardClass]}`}>
          {getTipoTagLabel(posicion.tipo)}
        </span>
      </div>

      <div className={styles.cartaNom}>
        {posicion.nombre || posicion.entidad || 'Sin nombre'}
      </div>

      <div>
        <div className={styles.cartaValor}>{formatCurrency(valorActual)}</div>
        <div className={styles.cartaValorSub}>
          <span>aportado {formatCurrency(aportado)}</span>
          <span>·</span>
          <span className={`${styles.delta} ${styles[signClass(rentEur)]}`}>
            {formatDelta(rentEur)}
            {aportado > 0 && (
              <>
                {' · '}
                {formatPercent(rentPct)}
              </>
            )}
          </span>
        </div>
      </div>

      <div className={styles.cartaViz}>
        <CartaVisualizacion posicion={posicion} />
      </div>

      <div className={styles.cartaFooter}>
        <span className={styles.cartaFooterMeta}>{getFooterMeta(posicion)}</span>
        <span className={styles.cartaFooterCta}>
          Ver detalle <Icons.ArrowRight size={10} strokeWidth={2.5} />
        </span>
      </div>
    </button>
  );
};

export default CartaPosicion;
