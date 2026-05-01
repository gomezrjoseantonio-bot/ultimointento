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
  getTipoTagLabel,
  signClass,
} from '../helpers';
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
  const rentEur = Number(posicion.rentabilidad_euros ?? valorActual - aportado);

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
   * Yield medio · usamos el yield anualizado aproximado:
   * dividendosTotal anualizados sobre el capital invertido medio.
   * Si solo tenemos un año de datos · es directo. Si menos · `—`.
   */
  const yieldMedio = useMemo(() => {
    if (dividendos.length === 0 || aportado <= 0) return null;
    const fechas = dividendos.map((d) => new Date(d.fecha).getTime());
    const minTs = Math.min(...fechas);
    const elapsedYears = Math.max((Date.now() - minTs) / (365.25 * 24 * 60 * 60 * 1000), 1 / 12);
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

  return (
    <FichaShell
      title={posicion.nombre || posicion.entidad || 'Posición'}
      tipoChip={getTipoTagLabel(posicion.tipo)}
      subtitle={`${getTipoLabel(posicion.tipo)}${posicion.entidad ? ` · ${posicion.entidad}` : ''}${posicion.ticker ? ` · ${posicion.ticker}` : ''}`}
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
      <div className={styles.detailKpis}>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Capital invertido</div>
          <div className={styles.detailKpiVal}>{formatCurrency(aportado)}</div>
          <div className={styles.detailKpiSub}>
            {posicion.numero_participaciones != null
              ? `${posicion.numero_participaciones.toLocaleString('es-ES')} unidades`
              : '—'}
          </div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Valor actual</div>
          <div className={styles.detailKpiVal}>{formatCurrency(valorActual)}</div>
          <div className={`${styles.detailKpiSub}`}>
            <span className={styles[signClass(rentEur)]}>{formatDelta(rentEur)}</span>
          </div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Dividendos cobrados</div>
          <div className={`${styles.detailKpiVal} ${dividendos.length ? styles.pos : styles.muted}`}>
            {dividendos.length ? formatCurrency(dividendosTotal) : '—'}
          </div>
          <div className={styles.detailKpiSub}>
            {dividendos.length} {dividendos.length === 1 ? 'cobro' : 'cobros'}
          </div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Yield medio</div>
          <div className={`${styles.detailKpiVal} ${yieldMedio == null ? styles.muted : ''}`}>
            {yieldMedio == null ? '—' : formatPercent(yieldMedio)}
          </div>
          <div className={styles.detailKpiSub}>anualizado · estimado</div>
        </div>
      </div>

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
