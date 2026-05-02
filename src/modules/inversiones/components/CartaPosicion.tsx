// T23.6.2 · Carta de posición refinada (§Z.2 spec).
// Acepta `CartaItem` directamente (unifica inversiones + planesPensiones).
// Sub-componentes internos: CartaTop · CartaNombreYValor · CartaVisualizacion · CartaFooter.
// Render contextual por tipo/subtipo según §Z.2.2-§Z.2.5.

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { PosicionInversion } from '../../../types/inversiones';
import type { PagoRendimiento } from '../../../types/inversiones-extended';
import type { CartaItem } from '../types/cartaItem';
import {
  construirSerieValor,
  formatCurrency,
  formatDelta,
  formatPercent,
  getFooterMetaFromItem,
  getTipoLabel,
  getTipoTagLabel,
  mapTipoToCardClass,
  signClass,
} from '../helpers';
import { getEntidadLogoConfig } from '../utils/entidadLogo';
import styles from '../InversionesGaleria.module.css';

interface CartaPosicionProps {
  item: CartaItem;
  onClick: (item: CartaItem) => void;
}

const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// ── Sparkline ──────────────────────────────────────────────────────────────

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
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ── MatrizCobros12m ────────────────────────────────────────────────────────

/**
 * Matriz de cobros de 12 meses del año en curso.
 * Corrige divergencia B.3-B.4: usa rendimiento.pagos_generados
 * (estado === 'pagado') para cobros reales en lugar de solo aportaciones.
 */
const MatrizCobros12m: React.FC<{ item: CartaItem }> = ({ item }) => {
  const now = new Date();
  const year = now.getFullYear();
  const mesActual = now.getMonth();

  const cobradosPorMes = useMemo(() => {
    const arr = new Array<boolean>(12).fill(false);
    if (item._origen !== 'inversiones') return arr;

    const posOrig = item._original as PosicionInversion & {
      rendimiento?: { pagos_generados?: PagoRendimiento[] };
    };

    // 1. Revisar rendimiento.pagos_generados (fuente canónica P2P/depósitos)
    const pagos = posOrig?.rendimiento?.pagos_generados ?? [];
    for (const pago of pagos) {
      if (pago.estado !== 'pagado') continue;
      const d = new Date(pago.fecha_pago);
      if (d.getFullYear() === year) arr[d.getMonth()] = true;
    }

    // 2. Fallback: aportaciones tipo 'dividendo'
    if (!pagos.length) {
      for (const ap of posOrig?.aportaciones ?? []) {
        if (ap.tipo !== 'dividendo' || !ap.fecha) continue;
        const d = new Date(ap.fecha);
        if (d.getFullYear() === year) arr[d.getMonth()] = true;
      }
    }
    return arr;
  }, [item, year]);

  return (
    <div
      className={styles.cartaVizCobros}
      role="img"
      aria-label="Cobros mensuales del año en curso"
    >
      {Array.from({ length: 12 }, (_, i) => {
        let cls = styles.cartaVizMes;
        // 4 estados: cobrado (verde) · pasado sin cobro (neutro muted) ·
        // mes actual sin cobro (oro pendiente) · futuro (dashed gris).
        if (cobradosPorMes[i]) cls += ' ' + styles.cobrado;
        else if (i === mesActual) cls += ' ' + styles.pendiente;
        else if (i < mesActual) cls += ' ' + styles.pasado;
        else cls += ' ' + styles.futuro;
        return (
          <div key={i} className={cls} title={`${MESES[i]} ${year}`}>
            {MESES[i]}
          </div>
        );
      })}
    </div>
  );
};

const PlaceholderViz: React.FC<{ mensaje: string }> = ({ mensaje }) => (
  <div className={styles.cartaVizPlaceholder}>{mensaje}</div>
);

// ── CartaTop ───────────────────────────────────────────────────────────────

const CartaTop: React.FC<{ item: CartaItem }> = ({ item }) => {
  const logoCfg = getEntidadLogoConfig(item.entidad);
  const cardClass = mapTipoToCardClass(item.tipo);

  // Ajustar label para RSU y empresa propia
  let tipoLabel = getTipoLabel(item.tipo);
  if (item.tipo === 'accion' && item.subtipo === 'rsu') {
    tipoLabel = 'ACCIONES · RSU';
  } else if (item.tipo === 'prestamo_p2p' && item.subtipo === 'empresa_propia') {
    tipoLabel = 'PRÉSTAMO A EMPRESA';
  }

  let tipoTagLabel = getTipoTagLabel(item.tipo);
  if (item.tipo === 'prestamo_p2p' && item.subtipo === 'empresa_propia') {
    tipoTagLabel = 'PRÉSTAMO';
  }

  // Si el logo tiene clase CSS definida, usamos la clase; si no, usamos inline style
  const logoStyle =
    logoCfg.cls && styles[logoCfg.cls]
      ? undefined
      : {
          background: logoCfg.gradient ?? logoCfg.bg,
          color: logoCfg.color,
          border: logoCfg.noBorder ? 'none' : '1px solid var(--atlas-v5-line)',
        };

  return (
    <div className={styles.cartaTop}>
      <div className={styles.cartaMarca}>
        <div
          className={`${styles.cartaLogo}${logoCfg.cls && styles[logoCfg.cls] ? ' ' + styles[logoCfg.cls] : ''}`}
          style={logoStyle}
        >
          {logoCfg.text}
        </div>
        <div className={styles.cartaEntidadInfo}>
          <div className={styles.cartaEntidadLab}>{tipoLabel}</div>
          <div className={styles.cartaEntidadNom}>{item.entidad || '—'}</div>
        </div>
      </div>
      <span
        className={`${styles.cartaTipo}${styles[cardClass] ? ' ' + styles[cardClass] : ''}`}
      >
        {tipoTagLabel}
      </span>
    </div>
  );
};

// ── CartaNombreYValor ──────────────────────────────────────────────────────

const CartaNombreYValor: React.FC<{ item: CartaItem }> = ({ item }) => {
  const { tipo, subtipo } = item;
  const valorActual = item.valor_actual;
  const aportado = item.total_aportado;
  const rentEur = item.rentabilidad_euros;
  const rentPct = item.rentabilidad_porcentaje;

  // prestamo_p2p con amortización
  if (tipo === 'prestamo_p2p' && typeof item.cuota_mensual === 'number') {
    const capitalInicial = item.capital_inicial ?? aportado;
    const pctAmort = item.pct_amortizado;
    return (
      <div>
        <div className={styles.cartaNom}>
          {item.nombre || item.entidad || 'Sin nombre'}
          {item.tin ? ` · ${item.tin.toFixed(2)}% TIN` : ''}
        </div>
        <div className={styles.cartaValor}>{formatCurrency(valorActual)}</div>
        <div className={styles.cartaValorSub}>
          <span>pendiente de {formatCurrency(capitalInicial)}</span>
          {typeof pctAmort === 'number' && (
            <>
              <span>·</span>
              <span className={`${styles.delta} ${styles.muted}`}>
                amortizado {formatPercent(pctAmort)}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  // prestamo_p2p en curso (solo intereses / bullet)
  if (tipo === 'prestamo_p2p') {
    const interesAnual = item.interes_anual;
    return (
      <div>
        <div className={styles.cartaNom}>
          {item.nombre || item.entidad || 'Sin nombre'}
          {item.tin ? ` · ${item.tin.toFixed(2)}% TIN` : ''}
        </div>
        <div className={styles.cartaValor}>{formatCurrency(valorActual)}</div>
        <div className={styles.cartaValorSub}>
          {typeof interesAnual === 'number' ? (
            <>
              <span>interés anual</span>
              <span className={`${styles.delta} ${styles.gold}`}>
                {formatCurrency(interesAnual)}
              </span>
              {item.frecuencia_cobro && (
                <span>· {item.frecuencia_cobro}</span>
              )}
            </>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
    );
  }

  // accion RSU
  if (tipo === 'accion' && subtipo === 'rsu') {
    return (
      <div>
        <div className={styles.cartaNom}>{item.nombre || item.entidad || 'Sin nombre'}</div>
        <div className={styles.cartaValor}>{formatCurrency(valorActual)}</div>
        <div className={styles.cartaValorSub}>
          <span>aportado {formatCurrency(aportado)}</span>
          <span>·</span>
          <span className={`${styles.delta} ${styles.muted}`}>
            {formatPercent(rentPct)} · neutro
          </span>
        </div>
      </div>
    );
  }

  // Default: valoración simple
  return (
    <div>
      <div className={styles.cartaNom}>{item.nombre || item.entidad || 'Sin nombre'}</div>
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
  );
};

// ── CartaVisualizacion ─────────────────────────────────────────────────────

const CartaVisualizacion: React.FC<{ item: CartaItem }> = ({ item }) => {
  const { tipo, subtipo } = item;

  // Matriz de cobros para P2P / depósito / cuenta remunerada
  if (
    tipo === 'prestamo_p2p' ||
    tipo === 'deposito_plazo' ||
    tipo === 'cuenta_remunerada'
  ) {
    return <MatrizCobros12m item={item} />;
  }

  // Acciones RSU: 3 filas info
  if (tipo === 'accion' && subtipo === 'rsu') {
    return (
      <div className={styles.cartaVizInfoRows}>
        <div className={styles.cartaVizInfoRow}>
          <span className={styles.cartaVizInfoLab}>Precio acción</span>
          <span className={styles.cartaVizInfoVal}>
            {item.precio_actual != null ? `${item.precio_actual.toFixed(2)} €` : '—'}
          </span>
        </div>
        <div className={styles.cartaVizInfoRow}>
          <span className={styles.cartaVizInfoLab}>Número acciones</span>
          <span className={styles.cartaVizInfoVal}>
            {item.numero_participaciones ?? '—'}
          </span>
        </div>
        <div className={styles.cartaVizInfoRow}>
          <span className={styles.cartaVizInfoLab}>Consolidación RSU</span>
          <span className={styles.cartaVizInfoVal}>
            {item.pct_consolidacion != null
              ? `${item.pct_consolidacion.toFixed(0)}%`
              : '—'}
            {item.año_consolidacion != null ? ` · ${item.año_consolidacion}` : ''}
          </span>
        </div>
      </div>
    );
  }

  // Sparkline para tipos con valoración
  if (
    [
      'plan_pensiones',
      'plan_empleo',
      'fondo_inversion',
      'accion',
      'etf',
      'reit',
      'crypto',
    ].includes(tipo)
  ) {
    if (item._origen === 'inversiones') {
      const posOrig = item._original as PosicionInversion;
      const serie = construirSerieValor(posOrig);
      if (serie.length >= 2) {
        const cagrPct = item.cagr_pct ?? 0;
        const color =
          tipo === 'crypto'
            ? 'var(--atlas-v5-cripto)'
            : cagrPct >= 0
              ? 'var(--atlas-v5-brand)'
              : 'var(--atlas-v5-neg)';
        return <Sparkline data={serie} color={color} />;
      }
    }
    return <PlaceholderViz mensaje="datos insuficientes para gráfico" />;
  }

  return <PlaceholderViz mensaje="—" />;
};

// ── CartaFooter ────────────────────────────────────────────────────────────

const CartaFooter: React.FC<{ item: CartaItem }> = ({ item }) => (
  <div className={styles.cartaFooter}>
    <span className={styles.cartaFooterMeta}>{getFooterMetaFromItem(item)}</span>
    <span className={styles.cartaFooterCta}>
      Ver detalle <Icons.ArrowRight size={10} strokeWidth={2.5} />
    </span>
  </div>
);

// ── CartaPosicion ──────────────────────────────────────────────────────────

const CartaPosicion: React.FC<CartaPosicionProps> = ({ item, onClick }) => {
  const cardClass = mapTipoToCardClass(item.tipo);

  const handleClick = () => onClick(item);
  const handleKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(item);
    }
  };

  return (
    <button
      type="button"
      className={`${styles.carta}${styles[cardClass] ? ' ' + styles[cardClass] : ''}`}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-label={`Ver detalle de ${item.nombre || item.entidad || 'posición'}`}
    >
      <CartaTop item={item} />
      <CartaNombreYValor item={item} />
      <div className={styles.cartaViz}>
        <CartaVisualizacion item={item} />
      </div>
      <CartaFooter item={item} />
    </button>
  );
};

export default CartaPosicion;
