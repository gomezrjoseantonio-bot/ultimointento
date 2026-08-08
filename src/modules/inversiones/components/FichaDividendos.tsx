// INVERSIONES V1 · Fase 3 · Ficha detalle · grupo `dividendos`
// (acciones · ETFs · REITs).
//
// Restyle V5 al mockup atlas-inversiones-v10.html · #page-detalle-equity
// (l.716-794). Pantalla de supervisión sin scroll: back + dhero fijos ·
// cuerpo de 2 cards (Cotización + "La ficha"). Los dividendos son SOLO
// LECTURA (regla de oro §3): se muestran, no se registran aquí.

import React, { useMemo, useState } from 'react';
import type { PosicionInversion } from '../../../types/inversiones';
import {
  construirSerieValor,
  formatCurrency,
  formatCurrency2,
  formatDelta,
  formatPercent,
  getColorByTipo,
  getTipoLabel,
} from '../helpers';
import SparklineGigante from './SparklineGigante';
import styles from './ficha/fichaDetalleV5.module.css';

interface Props {
  posicion: PosicionInversion;
  onBack: () => void;
  onVender: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const yearOf = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : String(d.getFullYear());
};

const TrashIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const ChevronLeft: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const FichaDividendos: React.FC<Props> = ({ posicion, onBack, onVender, onEditar, onEliminar }) => {
  const aportado = Number(posicion.total_aportado ?? 0);
  const valorActual = Number(posicion.valor_actual ?? 0);
  const participaciones = posicion.numero_participaciones ?? null;
  // "acciones" solo aplica a acciones; ETF/REIT y demás cotizados usan
  // "participaciones" (término neutral).
  const esAccion = posicion.tipo === 'accion';
  const unidadLabel = esAccion ? 'acciones' : 'participaciones';
  const unidadLabelCap = esAccion ? 'Acciones' : 'Participaciones';

  const [avisoVisible, setAvisoVisible] = useState(true);

  const dividendos = useMemo(
    () =>
      (posicion.aportaciones || [])
        .filter((a) => a.tipo === 'dividendo')
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [posicion.aportaciones],
  );

  const dividendosTotal = useMemo(
    () => dividendos.reduce((s, d) => s + Number(d.importe ?? 0), 0),
    [dividendos],
  );

  // Fecha de inicio · primera operación o compra declarada.
  const fechaInicio = useMemo<string | null>(() => {
    const fechas = (posicion.aportaciones || [])
      .filter((a) => a.tipo === 'aportacion')
      .map((a) => a.fecha)
      .filter(Boolean)
      .sort();
    return fechas[0] ?? posicion.fecha_compra ?? null;
  }, [posicion.aportaciones, posicion.fecha_compra]);

  const aniosHeld = useMemo(() => {
    if (!fechaInicio) return null;
    const t = new Date(fechaInicio).getTime();
    if (Number.isNaN(t)) return null;
    return (Date.now() - t) / MS_PER_YEAR;
  }, [fechaInicio]);

  const yieldMedio = useMemo(() => {
    if (dividendos.length === 0 || aportado <= 0) return null;
    const fechas = dividendos.map((d) => new Date(d.fecha).getTime());
    const minTs = Math.min(...fechas);
    const elapsedYears = (Date.now() - minTs) / MS_PER_YEAR;
    if (elapsedYears < 1 / 12) return null;
    return (dividendosTotal / aportado / elapsedYears) * 100;
  }, [dividendos, dividendosTotal, aportado]);

  const dividendoAnual = yieldMedio != null ? (yieldMedio / 100) * aportado : null;

  const plusvalia = valorActual - aportado;
  const plusvaliaPct = aportado > 0 ? (plusvalia / aportado) * 100 : null;

  // Rentabilidad anualizada (CAGR) si hay ≥1 año; si no, el total.
  const rentabilidad = useMemo<{ text: string; pos: boolean } | null>(() => {
    if (aportado <= 0 || valorActual <= 0) return plusvaliaPct != null
      ? { text: `${plusvaliaPct >= 0 ? '+' : ''}${plusvaliaPct.toFixed(1).replace('.', ',')}%`, pos: plusvaliaPct >= 0 }
      : null;
    if (aniosHeld != null && aniosHeld >= 1) {
      const cagr = (Math.pow(valorActual / aportado, 1 / aniosHeld) - 1) * 100;
      return { text: `${cagr >= 0 ? '+' : ''}${cagr.toFixed(1).replace('.', ',')}%/año`, pos: cagr >= 0 };
    }
    return plusvaliaPct != null
      ? { text: `${plusvaliaPct >= 0 ? '+' : ''}${plusvaliaPct.toFixed(1).replace('.', ',')}%`, pos: plusvaliaPct >= 0 }
      : null;
  }, [aportado, valorActual, aniosHeld, plusvaliaPct]);

  const precioMedio = participaciones && participaciones > 0 ? aportado / participaciones : null;
  const precioHoy = participaciones && participaciones > 0 ? valorActual / participaciones : null;

  const serie = useMemo(() => construirSerieValor(posicion), [posicion]);
  const dividendoMarkers = useMemo(() => {
    if (!serie.length) return [];
    return dividendos.map((d) => {
      const ts = new Date(d.fecha).getTime();
      let nearest = serie[0];
      let bestDiff = Math.abs(serie[0].x - ts);
      for (const p of serie) {
        const diff = Math.abs(p.x - ts);
        if (diff < bestDiff) {
          bestDiff = diff;
          nearest = p;
        }
      }
      return {
        x: nearest.x,
        y: nearest.y,
        label: `${new Date(d.fecha).toLocaleDateString('es-ES')} · ${formatCurrency(Number(d.importe ?? 0))}`,
      };
    });
  }, [dividendos, serie]);

  // Dividendos agregados por año (para el mini bar chart).
  const divPorAnio = useMemo<Array<[number, number]>>(() => {
    const m = new Map<number, number>();
    for (const d of dividendos) {
      const y = new Date(d.fecha).getFullYear();
      if (!Number.isNaN(y)) m.set(y, (m.get(y) || 0) + Number(d.importe ?? 0));
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [dividendos]);

  const desdeYear = yearOf(fechaInicio);

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ChevronLeft />
        Volver a Inversiones
      </button>

      {/* ── Hero navy de detalle ─────────────────────────────────────── */}
      <div className={styles.dhero}>
        <div>
          <div className={styles.dheroEyebrow}>
            {getTipoLabel(posicion.tipo)}
            {posicion.entidad ? ` · vía ${posicion.entidad}` : ''}
          </div>
          <div className={styles.dheroNom}>
            {posicion.nombre || 'Posición'}
            {posicion.ticker ? ` · ${posicion.ticker}` : ''}
          </div>
          <div className={styles.dheroMeta}>
            {desdeYear !== '—' && <>desde <strong>{desdeYear}</strong></>}
            {participaciones != null && (
              <>
                <span className={styles.dheroSep}>·</span>
                <strong>{participaciones.toLocaleString('es-ES')}</strong> {unidadLabel}
              </>
            )}
            {precioMedio != null && (
              <>
                <span className={styles.dheroSep}>·</span>
                precio medio <strong>{formatCurrency2(precioMedio)}</strong>
              </>
            )}
            {posicion.isin && (
              <>
                <span className={styles.dheroSep}>·</span>ISIN <strong>{posicion.isin}</strong>
              </>
            )}
          </div>
        </div>
        <div className={styles.dheroStats}>
          <div className={styles.dstat}>
            <div className={styles.dstatLab}>Valor hoy</div>
            <div className={styles.dstatVal}>{formatCurrency(valorActual)}</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatLab}>Aportado</div>
            <div className={styles.dstatVal}>{formatCurrency(aportado)}</div>
          </div>
          <div className={styles.dstat}>
            <div className={styles.dstatLab}>Rentabilidad</div>
            <div className={`${styles.dstatVal}${rentabilidad?.pos ? ' ' + styles.g : ''}`}>
              {rentabilidad ? rentabilidad.text : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cuerpo · 2 columnas ──────────────────────────────────────── */}
      <div className={styles.dbody}>
        {/* Cotización · frente a tu precio medio */}
        <div className={styles.card}>
          <div className={styles.projHd}>
            <div>
              <div className={styles.projEyebrow}>Cotización · frente a tu precio medio</div>
              <div className={styles.projVerdict}>
                {precioMedio != null && precioHoy != null ? (
                  <>
                    Compraste a <span className={styles.g}>{formatCurrency2(precioMedio)}</span> · hoy vale{' '}
                    <span className={styles.g}>{formatCurrency2(precioHoy)}</span>
                    <br />
                    <span className={styles.muted}>
                      plusvalía latente {formatDelta(plusvalia)}
                      {plusvaliaPct != null ? ` · ${plusvaliaPct >= 0 ? '+' : ''}${plusvaliaPct.toFixed(1).replace('.', ',')}%` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    Valor hoy <span className={styles.g}>{formatCurrency(valorActual)}</span>
                    <br />
                    <span className={styles.muted}>plusvalía latente {formatDelta(plusvalia)}</span>
                  </>
                )}
              </div>
            </div>
            <div className={styles.objCtrl}>
              {participaciones != null && (
                <div className={`${styles.objChip} ${styles.alt}`}>{participaciones.toLocaleString('es-ES')} {unidadLabel}</div>
              )}
              {yieldMedio != null && (
                <div className={styles.objChip}>
                  Dividendo <span className={styles.v}>{formatPercent(yieldMedio)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.projLegend}>
            <span className={styles.pl}><span className={`${styles.plSwatch} ${styles.solid}`} />Cotización</span>
            {precioMedio != null && (
              <span className={styles.pl}>
                <span className={`${styles.plSwatch} ${styles.dot}`} />Tu precio medio · {formatCurrency2(precioMedio)}
              </span>
            )}
          </div>

          <div className={styles.projChart}>
            {serie.length >= 2 ? (
              <SparklineGigante
                data={serie}
                color={getColorByTipo(posicion.tipo)}
                markers={dividendoMarkers}
                ariaLabel={`Evolución y dividendos de ${posicion.nombre || 'la posición'}`}
              />
            ) : (
              <div className={styles.chartPlaceholder}>
                Datos insuficientes para la gráfica (necesitamos al menos 2 operaciones).
              </div>
            )}
          </div>

          <div className={styles.projBoxes}>
            <div className={styles.pbox}>
              <div className={styles.pboxLab}>Plusvalía latente</div>
              <div className={styles.pboxVal}>{formatDelta(plusvalia)}</div>
              <div className={styles.pboxSub}>sin vender · no tributa aún</div>
            </div>
            <div className={styles.pbox}>
              <div className={styles.pboxLab}>Dividendos cobrados</div>
              <div className={`${styles.pboxVal} ${styles.g}`}>{formatCurrency(dividendosTotal)}</div>
              <div className={styles.pboxSub}>
                {desdeYear !== '—' ? `desde ${desdeYear}` : 'histórico'}
                {yieldMedio != null ? ` · yield ${formatPercent(yieldMedio)}` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* La ficha · lo esencial */}
        <div className={`${styles.card} ${styles.cardScroll}`}>
          <div className={styles.fcardTitle}>La ficha</div>
          <div className={styles.fcardSub}>lo esencial de esta {getTipoLabel(posicion.tipo).toLowerCase()}</div>

          <div className={styles.frow}>
            <span className={styles.k}>{unidadLabelCap}</span>
            <span className={styles.v}>{participaciones != null ? participaciones.toLocaleString('es-ES') : '—'}</span>
          </div>
          <div className={styles.frow}>
            <span className={styles.k}>Precio medio · hoy</span>
            <span className={styles.v}>
              {precioMedio != null && precioHoy != null
                ? `${formatCurrency2(precioMedio)} → ${formatCurrency2(precioHoy)}`
                : '—'}
            </span>
          </div>
          <div className={styles.frow}>
            <span className={styles.k}>Plusvalía latente</span>
            <span className={`${styles.v} ${plusvalia >= 0 ? styles.pos : styles.neg}`}>{formatDelta(plusvalia)}</span>
          </div>
          <div className={styles.frow}>
            <span className={styles.k}>Dividendo anual</span>
            <span className={`${styles.v} ${styles.g}`}>{dividendoAnual != null ? `~${formatCurrency(dividendoAnual)}` : '—'}</span>
          </div>
          {posicion.entidad && (
            <div className={styles.frow}>
              <span className={styles.k}>Bróker</span>
              <span className={styles.v}>{posicion.entidad}</span>
            </div>
          )}

          {avisoVisible && dividendoAnual != null && dividendoAnual > 0 && (
            <div className={styles.aviso}>
              <button type="button" className={styles.avisoX} onClick={() => setAvisoVisible(false)} aria-label="Cerrar aviso">
                <CloseIcon />
              </button>
              <div className={styles.avisoT}>Dividendos</div>
              <div className={styles.avisoB}>
                a este ritmo cobras <strong>~{formatCurrency(dividendoAnual)}</strong> al año
                {yieldMedio != null ? <> · yield <strong>{formatPercent(yieldMedio)}</strong></> : null}
              </div>
            </div>
          )}

          {divPorAnio.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLab}>Dividendos por año</span>
                <span className={styles.sectionTotal}>total {formatCurrency(dividendosTotal)}</span>
              </div>
              <div className={styles.miniBars}>
                <svg viewBox="0 0 360 60" preserveAspectRatio="none" role="img" aria-label="Dividendos por año">
                  {(() => {
                    const W = 360;
                    const H = 56;
                    const n = divPorAnio.length;
                    const gap = 8;
                    const bw = (W - gap * (n - 1)) / n;
                    const max = Math.max(...divPorAnio.map((d) => d[1]), 1);
                    return divPorAnio.map(([anio, val], i) => {
                      const bh = 8 + (val / max) * (H - 8);
                      const x = i * (bw + gap);
                      const y = H - bh;
                      return (
                        <rect key={anio} x={x} y={y} width={bw} height={bh} rx={2} fill="var(--atlas-v5-gold-2)">
                          <title>{`${anio} · ${formatCurrency(val)}`}</title>
                        </rect>
                      );
                    });
                  })()}
                </svg>
              </div>
            </div>
          )}

          <div className={styles.fcardActs}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onVender}>
              Vender
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onEditar}>
              Editar
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={onEliminar}
              aria-label="Eliminar esta posición"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FichaDividendos;
