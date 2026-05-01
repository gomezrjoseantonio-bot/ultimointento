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
} from '../helpers';
import { getEntidadLogoConfig } from '../utils/entidadLogo';
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

  const logoCfg = getEntidadLogoConfig(posicion.entidad);
  const rentVariant: 'pos' | 'neg' | undefined =
    rentEur > 0 ? 'pos' : rentEur < 0 ? 'neg' : undefined;

  return (
    <FichaShell
      hero={{
        variant: 'plan',
        badge: getTipoLabel(posicion.tipo),
        logo: {
          text: logoCfg.text,
          bg: logoCfg.gradient ?? logoCfg.bg ?? 'var(--atlas-v5-bg)',
          color: logoCfg.color,
          noBorder: logoCfg.noBorder,
        },
        title: `${posicion.nombre || 'Posición'}${posicion.entidad ? ` · ${posicion.entidad}` : ''}`,
        meta: posicion.fecha_compra ? (
          <>abierto <strong>{formatDate(posicion.fecha_compra)}</strong></>
        ) : null,
        stats: [
          { lab: 'Aportado', val: formatCurrency(aportado) },
          { lab: 'Valor actual', val: formatCurrency(valorActual) },
          { lab: 'Rentabilidad', val: formatDelta(rentEur), valVariant: rentVariant },
          {
            lab: '%',
            val: aportado > 0 ? formatPercent(rentPct) : '—',
            valVariant: rentVariant,
          },
        ],
      }}
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
