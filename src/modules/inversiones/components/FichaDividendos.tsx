// T23.3 · Ficha detalle · grupo `dividendos` (acciones · ETFs · REITs).
// § 4.3 spec · 4 KPIs · sparkline precio + markers cobro · tablas
// dividendos y operaciones · botones acción.

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import {
  construirSerieValor,
  formatCurrency,
  formatDelta,
  formatPercent,
  getColorByTipo,
  getTipoLabel,
} from '../helpers';
import { getEntidadLogoConfig } from '../utils/entidadLogo';
import FichaShell from './FichaShell';
import SparklineGigante from './SparklineGigante';
import styles from '../pages/FichaPosicion.module.css';

interface Props {
  posicion: PosicionInversion;
  onBack: () => void;
  onRegistrarDividendo: () => void;
  onComprarVender: () => void;
  onActualizarValor: () => void;
}

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const TIPO_LAB: Record<Aportacion['tipo'], string> = {
  aportacion: 'Compra',
  reembolso: 'Venta',
  dividendo: 'Dividendo',
};

const FichaDividendos: React.FC<Props> = ({
  posicion,
  onBack,
  onRegistrarDividendo,
  onComprarVender,
  onActualizarValor,
}) => {
  const aportado = Number(posicion.total_aportado ?? 0);
  const valorActual = Number(posicion.valor_actual ?? 0);

  const dividendos = useMemo(
    () =>
      (posicion.aportaciones || [])
        .filter((a) => a.tipo === 'dividendo')
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [posicion.aportaciones],
  );

  const operaciones = useMemo(
    () =>
      (posicion.aportaciones || [])
        .filter((a) => a.tipo === 'aportacion' || a.tipo === 'reembolso')
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [posicion.aportaciones],
  );

  const dividendosTotal = useMemo(
    () => dividendos.reduce((s, d) => s + Number(d.importe ?? 0), 0),
    [dividendos],
  );

  /**
   * Yield medio · proyección anualizada del flujo de dividendos cobrados
   * sobre el capital invertido. Si el histórico cubre menos de un mes,
   * devolvemos `null` (datos insuficientes para anualizar con sentido).
   * Para 1-12 meses de histórico el cálculo extrapola linealmente y la
   * UI lo etiqueta como "estimado" para que el usuario sepa que es
   * proyección, no realización.
   */
  const yieldMedio = useMemo(() => {
    if (dividendos.length === 0 || aportado <= 0) return null;
    const fechas = dividendos.map((d) => new Date(d.fecha).getTime());
    const minTs = Math.min(...fechas);
    const elapsedYears = (Date.now() - minTs) / (365.25 * 24 * 60 * 60 * 1000);
    // Mínimo · 1 mes (~0.083 años). Por debajo el yield anualizado se
    // dispararía artificialmente con un único cobro reciente.
    if (elapsedYears < 1 / 12) return null;
    return (dividendosTotal / aportado / elapsedYears) * 100;
  }, [dividendos, dividendosTotal, aportado]);

  const serie = useMemo(() => construirSerieValor(posicion), [posicion]);
  const dividendoMarkers = useMemo(() => {
    if (!serie.length) return [];
    return dividendos
      .map((d) => {
        const ts = new Date(d.fecha).getTime();
        // Buscar el punto de la serie más cercano por timestamp para
        // colocar el marker en la línea (no flotando en el aire).
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
          label: `${formatDate(d.fecha)} · ${formatCurrency(Number(d.importe ?? 0))}`,
        };
      })
      .filter(Boolean);
  }, [dividendos, serie]);

  const logoCfg = getEntidadLogoConfig(posicion.entidad);
  const heroBadge = `${getTipoLabel(posicion.tipo)} · liquidez disponible · dividendos periódicos`;

  return (
    <FichaShell
      hero={{
        variant: 'accion',
        badge: heroBadge,
        logo: {
          text: logoCfg.text,
          bg: logoCfg.gradient ?? logoCfg.bg ?? 'var(--atlas-v5-bg)',
          color: logoCfg.color,
        },
        title: `${posicion.nombre || 'Posición'}${posicion.ticker ? ` · ${posicion.ticker}` : ''}`,
        meta: (
          <>
            {posicion.entidad && (
              <>broker <strong>{posicion.entidad}</strong></>
            )}
            {posicion.isin && (
              <>
                {posicion.entidad && <span className={styles.detailHeroSep}>·</span>}
                ISIN <strong>{posicion.isin}</strong>
              </>
            )}
          </>
        ),
        stats: [
          {
            lab: 'Nº acciones',
            val: posicion.numero_participaciones != null
              ? posicion.numero_participaciones.toLocaleString('es-ES')
              : '—',
          },
          { lab: 'Valor total', val: formatCurrency(valorActual) },
          {
            lab: 'Dividendos',
            val: dividendos.length ? formatDelta(dividendosTotal) : '—',
            valVariant: dividendos.length ? 'pos' : undefined,
          },
          {
            lab: 'Yield medio',
            val: yieldMedio == null ? '—' : formatPercent(yieldMedio),
            valVariant: yieldMedio != null && yieldMedio > 0 ? 'pos' : undefined,
          },
        ],
      }}
      onBack={onBack}
      actions={[
        {
          label: 'Registrar dividendo',
          variant: 'ghost',
          icon: <Icons.Plus size={14} strokeWidth={1.8} />,
          onClick: onRegistrarDividendo,
        },
        {
          label: 'Comprar / Vender',
          variant: 'ghost',
          icon: <Icons.ArrowUpRight size={14} strokeWidth={1.8} />,
          onClick: onComprarVender,
        },
        {
          label: 'Actualizar valor',
          variant: 'gold',
          icon: <Icons.Refresh size={14} strokeWidth={1.8} />,
          onClick: onActualizarValor,
        },
      ]}
    >

      <div className={styles.detailCard}>
        <div className={styles.detailCardTit}>Evolución y dividendos</div>
        {serie.length >= 2 ? (
          <SparklineGigante
            data={serie}
            color={getColorByTipo(posicion.tipo)}
            markers={dividendoMarkers}
            ariaLabel={`Evolución y cobros de dividendo de ${posicion.nombre || 'la posición'}`}
          />
        ) : (
          <div className={styles.bigPlaceholder}>
            Datos insuficientes para dibujar la evolución (necesitamos al menos 2 operaciones).
          </div>
        )}
      </div>

      <div className={styles.detailCols} style={{ marginTop: 16 }}>
        <div className={styles.detailCard}>
          <div className={styles.detailCardTit}>Dividendos · histórico</div>
          {dividendos.length === 0 ? (
            <div className={styles.tablaEmpty}>
              Aún no has registrado ningún dividendo.
            </div>
          ) : (
            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'right' }}>Importe</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {dividendos.map((d) => (
                    <tr key={d.id}>
                      <td>{formatDate(d.fecha)}</td>
                      <td className={`${styles.num} ${styles.pos}`}>
                        {formatCurrency(Number(d.importe ?? 0))}
                      </td>
                      <td className={styles.txt}>{d.notas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.detailCard}>
          <div className={styles.detailCardTit}>Operaciones · compras / ventas</div>
          {operaciones.length === 0 ? (
            <div className={styles.tablaEmpty}>
              Aún no hay operaciones registradas.
            </div>
          ) : (
            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Importe</th>
                    <th style={{ textAlign: 'right' }}>Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {operaciones.map((o) => (
                    <tr key={o.id}>
                      <td>{formatDate(o.fecha)}</td>
                      <td className={styles.tipo}>{TIPO_LAB[o.tipo]}</td>
                      <td className={`${styles.num} ${o.tipo === 'reembolso' ? styles.neg : ''}`}>
                        {o.tipo === 'reembolso' ? '−' : ''}
                        {formatCurrency(Number(o.importe ?? 0))}
                      </td>
                      <td className={styles.num}>
                        {o.unidades != null ? o.unidades.toLocaleString('es-ES') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </FichaShell>
  );
};

export default FichaDividendos;
