import React, { useMemo } from 'react';
import { Icons } from '../../../../../design-system/v5';
import type { Contract, Property } from '../../../../../services/db';
import {
  calcularDistribucionMotivosSalida,
  calcularDuracionPorTipo,
  calcularKpisHistorico,
  calcularRotacionPorHabitacion,
  generarInsights,
} from '../../../utils/historico/calculos';
import type { RowDuracion } from '../../../utils/historico/tipos';
import { MOTIVO_LABEL } from './motivoConfig';
import styles from './PanelAnalitico.module.css';

export interface PanelAnaliticoProps {
  contratos: Contract[];
  properties: Property[];
  hoy?: Date;
}

const PanelAnalitico: React.FC<PanelAnaliticoProps> = ({ contratos, properties, hoy }) => {
  const ref = useMemo(() => hoy ?? new Date(), [hoy]);
  const kpis = useMemo(() => calcularKpisHistorico(contratos, ref), [contratos, ref]);
  const rotacion = useMemo(
    () => calcularRotacionPorHabitacion(contratos, properties),
    [contratos, properties],
  );
  const motivos = useMemo(() => calcularDistribucionMotivosSalida(contratos), [contratos]);
  const duracion = useMemo(() => calcularDuracionPorTipo(contratos), [contratos]);
  const insights = useMemo(
    () => generarInsights(contratos, kpis, rotacion, motivos),
    [contratos, kpis, rotacion, motivos],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.kpiRow}>
        <KpiCard
          label="Contratos finalizados"
          value={String(kpis.totalFinalizados)}
          hint="histórico total"
        />
        <KpiCard
          label="Duración media"
          value={kpis.duracionMediaMeses > 0 ? String(kpis.duracionMediaMeses) : '—'}
          unidad={kpis.duracionMediaMeses > 0 ? 'meses' : undefined}
          hint="por contrato"
        />
        <KpiCard
          label="Días vacíos medios"
          value={kpis.diasVaciosMedios != null ? String(kpis.diasVaciosMedios) : '—'}
          unidad={kpis.diasVaciosMedios != null ? 'días' : undefined}
          hint="entre contratos"
        />
        <KpiCard
          label="Valoración media"
          value={kpis.valoracionMedia != null ? String(kpis.valoracionMedia) : '—'}
          unidad={kpis.valoracionMedia != null ? '/ 5' : undefined}
          hint="estrellas"
        />
      </div>

      {insights.length > 0 && (
        <div className={styles.insight}>
          <Icons.Lightbulb size={14} strokeWidth={1.8} />
          <div>
            <strong>Insights detectados:</strong>
            <ul className={styles.insightList}>
              {insights.map((ins, i) => (
                <li key={i} className={styles[`insight_${ins.tipo}` as const]}>
                  {ins.texto}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className={styles.grid2}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Rotación por unidad</h3>
          {rotacion.length === 0 ? (
            <div className={styles.emptyMini}>Sin datos de rotación todavía.</div>
          ) : (
            <div className={styles.heatmap} role="grid" aria-label="Heatmap de rotación">
              {rotacion.map((inm) => (
                <div className={styles.heatRow} role="row" key={inm.inmuebleId}>
                  <div className={styles.heatRowLabel}>{inm.alias}</div>
                  <div className={styles.heatCells}>
                    {inm.celdas.map((celda, idx) => (
                      <div
                        key={idx}
                        role="gridcell"
                        tabIndex={0}
                        className={`${styles.heatCell} ${styles[celda.clase]}`}
                        aria-label={
                          celda.habitacion != null
                            ? `${inm.alias} habitación ${celda.habitacion} · ${celda.rotaciones} contratos`
                            : `${inm.alias} piso completo · ${celda.rotaciones} contratos`
                        }
                        title={
                          celda.habitacion != null
                            ? `Hab ${celda.habitacion} · ${celda.rotaciones}`
                            : `Piso · ${celda.rotaciones}`
                        }
                      >
                        {celda.rotaciones > 0 ? celda.rotaciones : '·'}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Motivos de salida</h3>
          {kpis.totalFinalizados === 0 ? (
            <div className={styles.emptyMini}>Aún no hay salidas registradas.</div>
          ) : (
            <div className={styles.bars}>
              {motivos.map((m) => (
                <div className={styles.barRow} key={m.motivo}>
                  <div className={styles.barLabel}>{MOTIVO_LABEL[m.motivo]}</div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${m.pct}%` }} />
                  </div>
                  <div className={styles.barVal}>{m.pct}%</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Duración media por tipo</h3>
        {kpis.totalFinalizados === 0 ? (
          <div className={styles.emptyMini}>Sin contratos finalizados para comparar.</div>
        ) : (
          <div className={styles.bars}>
            {duracion.map((row) => (
              <RowDuracionItem key={row.tipo} row={row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface KpiCardProps {
  label: string;
  value: string;
  unidad?: string;
  hint: string;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, unidad, hint }) => (
  <div className={styles.kpiCard}>
    <div className={styles.kpiLabel}>{label}</div>
    <div className={styles.kpiValue}>
      {value}
      {unidad && <span className={styles.kpiUnit}> {unidad}</span>}
    </div>
    <div className={styles.kpiHint}>{hint}</div>
  </div>
);

interface RowDuracionItemProps {
  row: RowDuracion;
}
const RowDuracionItem: React.FC<RowDuracionItemProps> = ({ row }) => {
  const Icono = row.tipo === 'corta' ? Icons.Cartera : Icons.Compra;
  return (
    <div className={styles.durRow}>
      <div className={styles.durLeft}>
        <Icono size={14} strokeWidth={1.8} />
        {row.label}
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${row.pctBar}%` }} />
      </div>
      <div className={styles.barVal}>
        {row.count > 0 ? `${row.duracionMediaMeses} m` : '—'}
      </div>
    </div>
  );
};

export default PanelAnalitico;
export { PanelAnalitico };
