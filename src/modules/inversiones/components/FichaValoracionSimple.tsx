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
} from '../helpers';
import { getEntidadLogoConfig } from '../utils/entidadLogo';
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
  const esPlan = posicion.tipo === 'plan_pensiones' || posicion.tipo === 'plan_empleo';

  const serie = useMemo(() => construirSerieValor(posicion), [posicion]);

  const aportacionesOrdenadas = useMemo(
    () =>
      [...(posicion.aportaciones || [])].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      ),
    [posicion.aportaciones],
  );

  const logoCfg = getEntidadLogoConfig(posicion.entidad);
  const cagrVariant: 'pos' | 'neg' | undefined = Number.isFinite(cagr)
    ? (cagr >= 0 ? 'pos' : 'neg')
    : undefined;
  const rentVariant: 'pos' | 'neg' | undefined =
    rentEur > 0 ? 'pos' : rentEur < 0 ? 'neg' : undefined;

  const heroBadge = `${getTipoLabel(posicion.tipo)} · revalorización${
    posicion.tipo === 'plan_pensiones' || posicion.tipo === 'plan_empleo'
      ? ' · liquidez en jubilación'
      : ''
  }`;

  return (
    <FichaShell
      hero={{
        variant: 'plan',
        badge: heroBadge,
        logo: {
          text: logoCfg.text,
          bg: logoCfg.gradient ?? logoCfg.bg ?? 'var(--atlas-v5-bg)',
          color: logoCfg.color,
          noBorder: logoCfg.noBorder,
        },
        title: `${posicion.nombre || 'Posición'}${posicion.entidad ? ` · ${posicion.entidad}` : ''}`,
        meta: posicion.fecha_compra ? (
          <>
            abierto <strong>{formatDate(posicion.fecha_compra)}</strong>
            {posicion.isin && (
              <>
                <span className={styles.detailHeroSep}>·</span>ISIN <strong>{posicion.isin}</strong>
              </>
            )}
          </>
        ) : posicion.isin ? (
          <>ISIN <strong>{posicion.isin}</strong></>
        ) : null,
        stats: [
          { lab: 'Valor actual', val: formatCurrency(valorActual), valVariant: rentVariant === 'pos' ? 'pos' : undefined },
          { lab: 'Aportado', val: formatCurrency(aportado) },
          { lab: 'Ganancia', val: formatDelta(rentEur), valVariant: rentVariant },
          { lab: 'CAGR', val: Number.isFinite(cagr) ? formatPercent(cagr) : '—', valVariant: cagrVariant },
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
          <div className={styles.detailCardTit}>Rendimiento y fiscalidad</div>
          <div className={styles.statRowList}>
            <div className={styles.statRow}>
              <span className={styles.statRowLab}>Total aportado</span>
              <span className={styles.statRowVal}>{formatCurrency(aportado)}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statRowLab}>
                {rentEur >= 0 ? 'Ganancia latente' : 'Pérdida latente'}
              </span>
              <span
                className={`${styles.statRowVal} ${
                  rentEur > 0 ? styles.pos : rentEur < 0 ? styles.neg : ''
                }`}
              >
                {formatDelta(rentEur)}
              </span>
            </div>
            <div className={`${styles.statRow} ${styles.highlight}`}>
              <span className={styles.statRowLab}>Valor hoy</span>
              <span
                className={`${styles.statRowVal} ${styles.pos}`}
                style={{ fontSize: 16 }}
              >
                {formatCurrency(valorActual)}
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statRowLab}>Rentabilidad total</span>
              <span
                className={`${styles.statRowVal} ${
                  rentPct > 0 ? styles.pos : rentPct < 0 ? styles.neg : ''
                }`}
              >
                {aportado > 0 ? formatPercent(rentPct) : '—'}
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statRowLab}>CAGR anualizado</span>
              <span
                className={`${styles.statRowVal} ${
                  Number.isFinite(cagr) ? (cagr >= 0 ? styles.pos : styles.neg) : ''
                }`}
              >
                {Number.isFinite(cagr) ? formatPercent(cagr) : '—'}
              </span>
            </div>
          </div>

          {esPlan && (
            <div className={styles.fiscalNota}>
              <strong>Fiscalidad · IRPF base general</strong> · las aportaciones{' '}
              <strong>reducen tu base imponible</strong> hasta 1.500 €/año
              (casilla 0465). El rescate tributa como{' '}
              <strong>rendimiento del trabajo</strong> · no como base del ahorro
              · planifica la liquidación en años de menor renta.{' '}
              <strong>Liquidez solo en jubilación</strong> o supuestos
              especiales (enfermedad grave · paro larga duración · 10 años de
              antigüedad desde 2025).
            </div>
          )}
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
