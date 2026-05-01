// T23.3 · Ficha detalle · grupo `valoracion_simple`
// (planes pensiones · planes empleo · fondos inversión · crypto).
// § 4.3 spec · 4 KPIs · sparkline gigante · panel composición ·
// tabla aportaciones · botones acción.

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import {
  calculateEstimatedCagr,
  construirSerieValor,
  formatCurrency,
  formatCurrency2,
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
  onActualizarValor: () => void;
  onAportar: () => void;
  onEditar: () => void;
}

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const TIPO_AP_LABEL: Record<Aportacion['tipo'], string> = {
  aportacion: 'Aportación',
  reembolso: 'Reembolso',
  dividendo: 'Dividendo',
};

const FichaValoracionSimple: React.FC<Props> = ({
  posicion,
  onBack,
  onActualizarValor,
  onAportar,
  onEditar,
}) => {
  const aportado = Number(posicion.total_aportado ?? 0);
  const valorActual = Number(posicion.valor_actual ?? 0);
  const rentEur = Number(posicion.rentabilidad_euros ?? valorActual - aportado);
  const rentPct = aportado > 0 ? (rentEur / aportado) * 100 : 0;
  const cagr = useMemo(() => calculateEstimatedCagr(posicion), [posicion]);

  const serie = useMemo(() => construirSerieValor(posicion), [posicion]);

  const aportacionesOrdenadas = useMemo(
    () =>
      [...(posicion.aportaciones || [])].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      ),
    [posicion.aportaciones],
  );

  return (
    <FichaShell
      title={posicion.nombre || posicion.entidad || 'Posición'}
      tipoChip={getTipoTagLabel(posicion.tipo)}
      subtitle={`${getTipoLabel(posicion.tipo)}${posicion.entidad ? ` · ${posicion.entidad}` : ''}${posicion.isin ? ` · ISIN ${posicion.isin}` : ''}`}
      onBack={onBack}
      actions={[
        {
          label: 'Actualizar valor',
          variant: 'ghost',
          icon: <Icons.Refresh size={14} strokeWidth={1.8} />,
          onClick: onActualizarValor,
        },
        {
          label: 'Aportar',
          variant: 'ghost',
          icon: <Icons.Plus size={14} strokeWidth={1.8} />,
          onClick: onAportar,
        },
        {
          label: 'Editar posición',
          variant: 'gold',
          icon: <Icons.Edit size={14} strokeWidth={1.8} />,
          onClick: onEditar,
        },
      ]}
    >
      <div className={styles.detailKpis}>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Aportado</div>
          <div className={styles.detailKpiVal}>{formatCurrency(aportado)}</div>
          <div className={styles.detailKpiSub}>
            {aportacionesOrdenadas.length} {aportacionesOrdenadas.length === 1 ? 'aportación' : 'aportaciones'}
          </div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Valor actual</div>
          <div className={styles.detailKpiVal}>{formatCurrency(valorActual)}</div>
          <div className={styles.detailKpiSub}>al {formatDate(posicion.fecha_valoracion)}</div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Rentabilidad</div>
          <div className={`${styles.detailKpiVal} ${styles[signClass(rentEur)]}`}>
            {formatDelta(rentEur)}
          </div>
          <div className={styles.detailKpiSub}>
            {aportado > 0 ? formatPercent(rentPct) : '—'}
          </div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>CAGR</div>
          <div
            className={`${styles.detailKpiVal} ${
              Number.isFinite(cagr) ? styles[signClass(cagr)] : styles.muted
            }`}
          >
            {Number.isFinite(cagr) ? formatPercent(cagr) : '—'}
          </div>
          <div className={styles.detailKpiSub}>tasa anualizada</div>
        </div>
      </div>

      <div className={styles.detailCols}>
        <div className={styles.detailCard}>
          <div className={styles.detailCardTit}>Evolución del valor</div>
          {serie.length >= 2 ? (
            <SparklineGigante
              data={serie}
              color={getColorByTipo(posicion.tipo)}
              ariaLabel={`Evolución de valor de ${posicion.nombre || 'la posición'}`}
            />
          ) : (
            <div className={styles.bigPlaceholder}>
              Datos insuficientes para dibujar la evolución (necesitamos al menos 2 aportaciones).
            </div>
          )}
        </div>

        <div className={styles.detailCard}>
          <div className={styles.detailCardTit}>Composición</div>
          {/* TODO · 23.3+ · cuando el plan/fondo tenga datos de composición
              (renta variable / renta fija / liquidez · % por categoría) los
              renderizamos aquí. Hasta que el usuario enriquezca su posición
              con esos datos, mostramos un placeholder coherente. */}
          <div className={styles.tablaEmpty}>
            Aún no hay datos de composición para esta posición.
            {posicion.tipo === 'plan_pensiones' || posicion.tipo === 'plan_empleo'
              ? ' Edita la posición para añadir el desglose por categoría.'
              : ''}
          </div>
        </div>
      </div>

      <div className={styles.detailCard} style={{ marginTop: 16 }}>
        <div className={styles.detailCardTit}>Aportaciones · histórico</div>
        {aportacionesOrdenadas.length === 0 ? (
          <div className={styles.tablaEmpty}>
            Aún no has registrado ninguna aportación. Usa el botón "Aportar" para añadir una.
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
                  <th style={{ textAlign: 'right' }}>Precio unidad</th>
                </tr>
              </thead>
              <tbody>
                {aportacionesOrdenadas.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.fecha)}</td>
                    <td className={styles.tipo}>{TIPO_AP_LABEL[a.tipo]}</td>
                    <td className={`${styles.num} ${a.tipo === 'reembolso' ? styles.neg : ''}`}>
                      {a.tipo === 'reembolso' ? '−' : ''}
                      {formatCurrency2(Number(a.importe ?? 0))}
                    </td>
                    <td className={styles.num}>
                      {a.unidades != null ? a.unidades.toLocaleString('es-ES') : '—'}
                    </td>
                    <td className={styles.num}>
                      {a.precioUnitario != null ? formatCurrency2(a.precioUnitario) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FichaShell>
  );
};

export default FichaValoracionSimple;
