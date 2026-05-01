// T23.3 · Ficha detalle · grupo `rendimiento_periodico`
// (préstamos P2P · cuentas remuneradas · depósitos a plazo).
// § 4.3 spec · 4 KPIs · matriz cobros 36 meses (3 años) · tabla cobros.

import React, { useMemo } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Aportacion, PosicionInversion } from '../../../types/inversiones';
import {
  formatCurrency,
  formatPercent,
  getTipoLabel,
  getTipoTagLabel,
} from '../helpers';
import FichaShell from './FichaShell';
import styles from '../pages/FichaPosicion.module.css';

interface Props {
  posicion: PosicionInversion;
  onBack: () => void;
  onRegistrarCobro: () => void;
  onEditar: () => void;
}

const MESES_ABBR = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Construye una matriz [year][month] con `true` si hubo cobro. */
function calcularCobros(
  aportaciones: Aportacion[],
  yearsBack: number,
): { years: number[]; map: Record<number, boolean[]> } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = currentYear - (yearsBack - 1);
  const years: number[] = [];
  const map: Record<number, boolean[]> = {};
  for (let y = startYear; y <= currentYear; y++) {
    years.push(y);
    map[y] = new Array(12).fill(false);
  }
  for (const ap of aportaciones || []) {
    if (ap.tipo !== 'dividendo' || !ap.fecha) continue;
    const d = new Date(ap.fecha);
    const y = d.getFullYear();
    if (y in map) map[y][d.getMonth()] = true;
  }
  return { years, map };
}

const FichaRendimientoPeriodico: React.FC<Props> = ({
  posicion,
  onBack,
  onRegistrarCobro,
  onEditar,
}) => {
  const aportado = Number(posicion.total_aportado ?? 0);
  const cobros = useMemo(
    () =>
      (posicion.aportaciones || [])
        .filter((a) => a.tipo === 'dividendo')
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [posicion.aportaciones],
  );
  const interesGenerado = useMemo(
    () => cobros.reduce((s, c) => s + Number(c.importe ?? 0), 0),
    [cobros],
  );
  const tin = Number(posicion.rendimiento?.tasa_interes_anual ?? NaN);
  const proximoCobro = useMemo(() => {
    // Heurística simple · usar `plan_aportaciones` si está activo · si no
    // mostramos "—". Una implementación más rica vendría con el cierre de 23.3.
    const plan = posicion.plan_aportaciones;
    if (plan?.activo && plan.fecha_inicio) {
      // Próxima fecha futura siguiendo cadencia. Aproximación: mes actual + 1.
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      return next.toISOString();
    }
    return null;
  }, [posicion.plan_aportaciones]);

  const { years, map } = useMemo(() => calcularCobros(posicion.aportaciones || [], 3), [
    posicion.aportaciones,
  ]);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const exportarCSV = () => {
    const filas = [
      ['Fecha', 'Importe (€)', 'Notas'].join(';'),
      ...cobros.map((c) =>
        [c.fecha, String(Number(c.importe ?? 0).toFixed(2)), (c.notas || '').replace(/;/g, ',')].join(';'),
      ),
    ].join('\n');
    const blob = new Blob([filas], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobros-${posicion.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <FichaShell
      title={posicion.nombre || posicion.entidad || 'Posición'}
      tipoChip={getTipoTagLabel(posicion.tipo)}
      subtitle={`${getTipoLabel(posicion.tipo)}${posicion.entidad ? ` · ${posicion.entidad}` : ''}`}
      onBack={onBack}
      actions={[
        {
          label: 'Registrar cobro',
          variant: 'ghost',
          icon: <Icons.Plus size={14} strokeWidth={1.8} />,
          onClick: onRegistrarCobro,
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
          <div className={styles.detailKpiLab}>Capital invertido</div>
          <div className={styles.detailKpiVal}>{formatCurrency(aportado)}</div>
          <div className={styles.detailKpiSub}>
            {posicion.duracion_meses ? `${posicion.duracion_meses} meses` : 'duración indefinida'}
          </div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Interés generado</div>
          <div className={styles.detailKpiVal}>{formatCurrency(interesGenerado)}</div>
          <div className={styles.detailKpiSub}>
            {cobros.length} {cobros.length === 1 ? 'cobro' : 'cobros'}
          </div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>TIN</div>
          <div className={styles.detailKpiVal}>
            {Number.isFinite(tin) ? formatPercent(tin) : '—'}
          </div>
          <div className={styles.detailKpiSub}>tasa nominal anual</div>
        </div>
        <div className={styles.detailKpi}>
          <div className={styles.detailKpiLab}>Próximo cobro</div>
          <div className={`${styles.detailKpiVal} ${proximoCobro ? '' : styles.muted}`}>
            {proximoCobro ? formatDate(proximoCobro) : '—'}
          </div>
          <div className={styles.detailKpiSub}>
            {proximoCobro ? 'estimado · plan activo' : 'sin plan periódico'}
          </div>
        </div>
      </div>

      <div className={styles.detailCard}>
        <div className={styles.detailCardTit}>Cobros mensuales · últimos 3 años</div>
        <div className={styles.matrizMesesHeader}>
          <div />
          {MESES_ABBR.map((m, i) => (
            <div key={i} className={styles.matrizMesLab}>{m}</div>
          ))}
        </div>
        {years.map((y) => (
          <div key={y} className={styles.matrizGrande}>
            <div className={styles.matrizYearLab}>{y}</div>
            {MESES_ABBR.map((_, i) => {
              let cls = styles.matrizCell;
              if (map[y][i]) cls += ' ' + styles.cobrado;
              else if (y < currentYear || (y === currentYear && i < currentMonth)) cls += ' ' + styles.pendiente;
              else cls += ' ' + styles.futuro;
              return <div key={i} className={cls} title={`${MESES_ABBR[i]} ${y}`} />;
            })}
          </div>
        ))}
        <div className={styles.matrizLeyenda}>
          <span className={styles.matrizLeyendaItem}>
            <span className={`${styles.leyendaDot} ${styles.cobrado}`} /> Cobrado
          </span>
          <span className={styles.matrizLeyendaItem}>
            <span className={`${styles.leyendaDot} ${styles.pendiente}`} /> Pendiente
          </span>
          <span className={styles.matrizLeyendaItem}>
            <span className={`${styles.leyendaDot} ${styles.futuro}`} /> Futuro
          </span>
        </div>
      </div>

      <div className={styles.detailCard} style={{ marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div className={styles.detailCardTit} style={{ marginBottom: 0 }}>Cobros · histórico</div>
          {cobros.length > 0 && (
            <button type="button" className={styles.linkBtn} onClick={exportarCSV}>
              <Icons.Download size={11} strokeWidth={2} /> Exportar CSV
            </button>
          )}
        </div>
        {cobros.length === 0 ? (
          <div className={styles.tablaEmpty}>
            Aún no has registrado ningún cobro. Usa el botón "Registrar cobro" para añadir uno.
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
                {cobros.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.fecha)}</td>
                    <td className={`${styles.num} ${styles.pos}`}>
                      {formatCurrency(Number(c.importe ?? 0))}
                    </td>
                    <td className={styles.txt}>{c.notas || '—'}</td>
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

export default FichaRendimientoPeriodico;
