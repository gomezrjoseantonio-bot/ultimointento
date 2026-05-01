// T23.3 · Ficha detalle · fallback genérico para tipos sin ficha dedicada
// (`otro` · legacy `deposito`). § 8 spec · Riesgo #2.
//
// Renderiza los KPIs canónicos + tabla de aportaciones + botones acción.

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import {
  formatCurrency,
  formatDelta,
  formatPercent,
  getTipoLabel,
  getTipoTagLabel,
  signClass,
} from '../helpers';
import FichaShell from './FichaShell';
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
  dividendo: 'Cobro',
};

const FichaGenerica: React.FC<Props> = ({
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

  const aps = useMemo(
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
      subtitle={`${getTipoLabel(posicion.tipo)}${posicion.entidad ? ` · ${posicion.entidad}` : ''}`}
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
            {aps.length} {aps.length === 1 ? 'movimiento' : 'movimientos'}
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
          <div className={styles.detailKpiLab}>Tipo</div>
          <div className={`${styles.detailKpiVal} ${styles.muted}`}>{getTipoLabel(posicion.tipo)}</div>
          <div className={styles.detailKpiSub}>posición sin ficha dedicada</div>
        </div>
      </div>

      <div className={styles.detailCard}>
        <div className={styles.detailCardTit}>Movimientos</div>
        {aps.length === 0 ? (
          <div className={styles.tablaEmpty}>
            Aún no hay movimientos registrados en esta posición.
          </div>
        ) : (
          <div className={styles.tablaWrap}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {aps.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.fecha)}</td>
                    <td className={styles.tipo}>{TIPO_AP_LABEL[a.tipo]}</td>
                    <td className={`${styles.num} ${a.tipo === 'reembolso' ? styles.neg : ''}`}>
                      {a.tipo === 'reembolso' ? '−' : ''}
                      {formatCurrency(Number(a.importe ?? 0))}
                    </td>
                    <td className={styles.txt}>{a.notas || '—'}</td>
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

export default FichaGenerica;
