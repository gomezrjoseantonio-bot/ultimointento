import React, { useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { MoneyValue, DateLabel, EmptyState, Icons, showToastV5 } from '../../../design-system/v5';
import type { PersonalOutletContext } from '../PersonalContext';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import styles from './PanelPage.module.css';

const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const CATEGORIA_DOTS: Record<string, string> = {
  vivienda: 'var(--atlas-v5-brand)',
  alimentacion: 'var(--atlas-v5-room-green)',
  transporte: 'var(--atlas-v5-room-yellow)',
  ocio: 'var(--atlas-v5-gold)',
  salud: 'var(--atlas-v5-neg)',
  suministros: 'var(--atlas-v5-brand-2)',
  suscripciones: 'var(--atlas-v5-room-blue)',
  otros: 'var(--atlas-v5-ink-4)',
};

const computeIngresoMensualEstimado = (
  nominas: PersonalOutletContext['nominas'],
  autonomos: PersonalOutletContext['autonomos'],
): number => {
  const nominaMensual = nominas
    .filter((n) => n.activa)
    .reduce((sum, n) => sum + (n.salarioBrutoAnual ?? 0) / 12, 0);
  const autonomoMensual = autonomos
    .filter((a) => a.activo)
    .reduce((sum, a) => {
      const ingresos = (a as { ingresoBrutoAnualEstimado?: number }).ingresoBrutoAnualEstimado ?? 0;
      return sum + ingresos / 12;
    }, 0);
  return nominaMensual + autonomoMensual;
};

const computeGastoMensualEstimado = (compromisos: CompromisoRecurrente[]): number => {
  return compromisos
    .filter((c) => c.estado === 'activo' && c.ambito === 'personal')
    .reduce((sum, c) => {
      switch (c.importe.modo) {
        case 'fijo':
          return sum + c.importe.importe;
        case 'variable':
          return sum + c.importe.importeMedio;
        case 'diferenciadoPorMes':
          return (
            sum +
            c.importe.importesPorMes.reduce((s: number, v: number) => s + v, 0) / 12
          );
        case 'porPago': {
          const total = Object.values(c.importe.importesPorPago).reduce((s, v) => s + v, 0);
          return sum + total / 12;
        }
        default:
          return sum;
      }
    }, 0);
};

const computeGastoPorCategoria = (
  compromisos: CompromisoRecurrente[],
): Map<string, number> => {
  const map = new Map<string, number>();
  compromisos
    .filter((c) => c.estado === 'activo' && c.ambito === 'personal')
    .forEach((c) => {
      const monthly = (() => {
        switch (c.importe.modo) {
          case 'fijo':
            return c.importe.importe;
          case 'variable':
            return c.importe.importeMedio;
          case 'diferenciadoPorMes':
            return (
              c.importe.importesPorMes.reduce((s: number, v: number) => s + v, 0) / 12
            );
          case 'porPago':
            return (
              Object.values(c.importe.importesPorPago).reduce((s, v) => s + v, 0) / 12
            );
          default:
            return 0;
        }
      })();
      const cat = (c.categoria ?? 'otros').toLowerCase();
      map.set(cat, (map.get(cat) ?? 0) + monthly);
    });
  return map;
};

const computeProximosCompromisos = (
  compromisos: CompromisoRecurrente[],
  daysAhead = 7,
): Array<{ fecha: string; concepto: string; importe: number }> => {
  const today = new Date();
  const limit = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const items: Array<{ fecha: string; concepto: string; importe: number }> = [];

  compromisos
    .filter((c) => c.estado === 'activo' && c.ambito === 'personal')
    .forEach((c) => {
      // Estimación simple: para mensualDiaFijo · próximo día del mes
      if (c.patron.tipo === 'mensualDiaFijo') {
        const dia = c.patron.dia;
        const next = new Date(today.getFullYear(), today.getMonth(), dia);
        if (next < today) next.setMonth(next.getMonth() + 1);
        if (next <= limit) {
          const importeMensual =
            c.importe.modo === 'fijo'
              ? c.importe.importe
              : c.importe.modo === 'variable'
                ? c.importe.importeMedio
                : 0;
          items.push({
            fecha: next.toISOString().slice(0, 10),
            concepto: c.alias,
            importe: -Math.abs(importeMensual),
          });
        }
      }
    });

  return items.sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 6);
};

const PanelPage: React.FC = () => {
  const navigate = useNavigate();
  const { nominas, autonomos, compromisos } = useOutletContext<PersonalOutletContext>();

  const ingresosMes = useMemo(
    () => computeIngresoMensualEstimado(nominas, autonomos),
    [nominas, autonomos],
  );
  const gastosMes = useMemo(
    () => computeGastoMensualEstimado(compromisos),
    [compromisos],
  );
  const ahorroMes = ingresosMes - gastosMes;
  const tasaAhorroPct = ingresosMes > 0 ? (ahorroMes / ingresosMes) * 100 : 0;

  const gastosPorCategoria = useMemo(
    () => computeGastoPorCategoria(compromisos),
    [compromisos],
  );
  const totalCategorias = Array.from(gastosPorCategoria.values()).reduce((s, v) => s + v, 0);
  const categoriasOrdenadas = Array.from(gastosPorCategoria.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const proximos = useMemo(
    () => computeProximosCompromisos(compromisos, 7),
    [compromisos],
  );

  const numCompromisos = compromisos.filter((c) => c.estado === 'activo' && c.ambito === 'personal').length;

  // Presupuesto 50/30/20
  const meta50 = ingresosMes * 0.5;
  const meta30 = ingresosMes * 0.3;
  const meta20 = ingresosMes * 0.2;

  if (nominas.length === 0 && autonomos.length === 0 && compromisos.length === 0) {
    return (
      <EmptyState
        icon={<Icons.Personal size={20} />}
        title="Sin datos del hogar registrados"
        sub="Añade nóminas, autónomos o compromisos para empezar a ver tu panel personal."
        ctaLabel="+ ir a Gestión Personal"
        onCtaClick={() => navigate('/gestion/personal')}
      />
    );
  }

  return (
    <>
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Ingresos del mes</div>
          <div className={`${styles.kpiVal} ${styles.pos}`}>
            <MoneyValue value={ingresosMes} decimals={0} showSign tone="pos" />
          </div>
          <div className={styles.kpiSub}>
            {nominas.filter((n) => n.activa).length} nómina · {autonomos.filter((a) => a.activo).length} autónomo
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Gastos del mes</div>
          <div className={`${styles.kpiVal} ${styles.neg}`}>
            <MoneyValue value={-gastosMes} decimals={0} showSign tone="neg" />
          </div>
          <div className={styles.kpiSub}>{numCompromisos} compromisos · estimación mensual</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Tasa de ahorro</div>
          <div className={`${styles.kpiVal} ${styles.gold}`}>
            {tasaAhorroPct.toFixed(1)}%
          </div>
          <div className={styles.kpiSub}>
            <MoneyValue value={ahorroMes} decimals={0} /> al mes
          </div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLab}>Ahorro neto</div>
          <div className={`${styles.kpiVal} ${ahorroMes >= 0 ? styles.pos : styles.neg}`}>
            <MoneyValue value={ahorroMes} decimals={0} showSign tone="auto" />
          </div>
          <div className={styles.kpiSub}>ingresos − gastos del mes</div>
        </div>
      </div>

      <div className={styles.row21}>
        <div className={styles.card}>
          <div className={styles.cardHd}>
            <div>
              <div className={styles.cardTitle}>Ingresos vs gastos · 12 meses</div>
              <div className={styles.cardSub}>
                proyección estable · barras simuladas hasta cargar histórico real
              </div>
            </div>
            <button
              type="button"
              className={styles.cardAction}
              onClick={() => showToastV5('Ver detalle 12 meses · pendiente histórico')}
            >
              Ver detalle →
            </button>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.barchart}>
              {MONTH_LABELS.map((m, i) => {
                const total = ingresosMes;
                const variation = 0.85 + ((i * 13) % 25) / 100;
                const stackHeightPct = total > 0 ? Math.min(95, 60 * variation + 25) : 0;
                const gastoPct = total > 0 ? (gastosMes / total) * stackHeightPct : 0;
                const ahorroPct = stackHeightPct - gastoPct;
                const isCurrent = i === new Date().getMonth();
                return (
                  <div
                    key={m}
                    className={`${styles.barCol} ${isCurrent ? styles.highlight : ''}`}
                  >
                    <div
                      className={styles.barStack}
                      style={{ height: `${stackHeightPct}%` }}
                    >
                      <div
                        className={styles.barSeg}
                        style={{ background: 'var(--atlas-v5-neg)', height: `${(gastoPct / stackHeightPct) * 100}%` }}
                      />
                      <div
                        className={styles.barSeg}
                        style={{ background: 'var(--atlas-v5-gold)', height: `${(ahorroPct / stackHeightPct) * 100}%` }}
                      />
                    </div>
                    <span className={styles.barColLab}>{m}</span>
                  </div>
                );
              })}
            </div>
            <div className={styles.detailMes}>
              <div className={styles.detailMesLab}>
                {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} · destacado
              </div>
              <div className={styles.detailMesNumbers}>
                <span style={{ color: 'var(--atlas-v5-pos)' }}>
                  ingresos <MoneyValue value={ingresosMes} decimals={0} showSign tone="pos" />
                </span>
                <span style={{ color: 'var(--atlas-v5-neg)' }}>
                  gastos <MoneyValue value={-gastosMes} decimals={0} showSign tone="neg" />
                </span>
                <span style={{ color: 'var(--atlas-v5-gold-ink)' }}>
                  ahorro neto <MoneyValue value={ahorroMes} decimals={0} showSign tone="gold" />
                </span>
              </div>
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: 'var(--atlas-v5-neg)' }} />
                Gastos del mes
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: 'var(--atlas-v5-gold)' }} />
                Ahorro neto del mes
              </span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHd}>
            <div>
              <div className={styles.cardTitle}>Próximos compromisos · 7 días</div>
              <div className={styles.cardSub}>salidas previstas</div>
            </div>
          </div>
          <div className={`${styles.cardBody} ${styles.flush}`}>
            {proximos.length === 0 ? (
              <div style={{ padding: '32px 22px', textAlign: 'center', color: 'var(--atlas-v5-ink-4)', fontSize: 12.5 }}>
                Sin compromisos previstos en los próximos 7 días.
              </div>
            ) : (
              <table className={styles.tbl}>
                <tbody>
                  {proximos.map((p, i) => (
                    <tr key={`${p.fecha}-${i}`}>
                      <td className={styles.tdMono}>
                        <strong>
                          <DateLabel value={p.fecha} format="compact" size="sm" />
                        </strong>
                      </td>
                      <td>{p.concepto}</td>
                      <td className={`${styles.r} ${styles.tdMono} ${p.importe < 0 ? styles.negCol : styles.posCol}`}>
                        <MoneyValue value={p.importe} decimals={0} showSign tone="auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className={styles.row2}>
        <div className={styles.card}>
          <div className={styles.cardHd}>
            <div>
              <div className={styles.cardTitle}>Distribución de gastos · este mes</div>
              <div className={styles.cardSub}>
                total <MoneyValue value={gastosMes} decimals={0} /> · {gastosPorCategoria.size} categorías
              </div>
            </div>
          </div>
          <div className={styles.cardBody}>
            {categoriasOrdenadas.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--atlas-v5-ink-4)', fontSize: 12.5 }}>
                Aún no hay compromisos categorizados.
              </div>
            ) : (
              <div className={styles.donut}>
                <DonutChart total={totalCategorias} categorias={categoriasOrdenadas} />
                <div className={styles.donutLegend}>
                  {categoriasOrdenadas.map(([cat, val]) => {
                    const pct = totalCategorias > 0 ? (val / totalCategorias) * 100 : 0;
                    return (
                      <React.Fragment key={cat}>
                        <div>
                          <span
                            className={styles.dot}
                            style={{ background: CATEGORIA_DOTS[cat] ?? 'var(--atlas-v5-ink-4)' }}
                          />
                          {cat[0].toUpperCase() + cat.slice(1)} {pct.toFixed(0)}%
                        </div>
                        <div className={`${styles.tdMono} ${styles.num}`}>
                          <MoneyValue value={val} decimals={0} />
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHd}>
            <div>
              <div className={styles.cardTitle}>Presupuesto · método 50/30/20</div>
              <div className={styles.cardSub}>cumplimiento del mes en curso</div>
            </div>
            <button
              type="button"
              className={styles.cardAction}
              onClick={() => navigate('/personal/presupuesto')}
            >
              Ver detalle →
            </button>
          </div>
          <div className={styles.cardBody}>
            <BudgetRow
              label="Necesidades · 50%"
              actual={gastosMes * 0.6}
              meta={meta50}
              color="var(--atlas-v5-brand)"
            />
            <BudgetRow
              label="Deseos · 30%"
              actual={gastosMes * 0.4}
              meta={meta30}
              color="var(--atlas-v5-gold)"
            />
            <BudgetRow
              label="Ahorro + inversión · 20%"
              actual={ahorroMes}
              meta={meta20}
              color="var(--atlas-v5-pos)"
              isAhorro
            />
          </div>
        </div>
      </div>
    </>
  );
};

interface BudgetRowProps {
  label: string;
  actual: number;
  meta: number;
  color: string;
  isAhorro?: boolean;
}

const BudgetRow: React.FC<BudgetRowProps> = ({ label, actual, meta, color, isAhorro }) => {
  const pct = meta > 0 ? Math.min(100, (actual / meta) * 100) : 0;
  return (
    <div className={styles.budgetRow}>
      <div className={styles.budgetHeader}>
        <span className={styles.budgetLabel}>{label}</span>
        <span className={styles.budgetMeta}>
          {isAhorro && actual > meta ? (
            <span className={styles.posCol}>
              <MoneyValue value={actual} decimals={0} /> · superado
            </span>
          ) : (
            <>
              <MoneyValue value={actual} decimals={0} /> de <MoneyValue value={meta} decimals={0} /> meta
            </>
          )}
        </span>
      </div>
      <div className={styles.pbar}>
        <div className={styles.pbarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

interface DonutChartProps {
  total: number;
  categorias: Array<[string, number]>;
}

const DonutChart: React.FC<DonutChartProps> = ({ total, categorias }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Distribución de gastos">
      <circle cx="80" cy="80" r="60" fill="none" stroke="var(--atlas-v5-line)" strokeWidth="28" />
      {categorias.map(([cat, val]) => {
        const pct = total > 0 ? val / total : 0;
        const dash = circumference * pct;
        const seg = (
          <circle
            key={cat}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={CATEGORIA_DOTS[cat] ?? 'var(--atlas-v5-ink-4)'}
            strokeWidth="28"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 80 80)"
          />
        );
        offset += dash;
        return seg;
      })}
      <text
        x="80"
        y="76"
        textAnchor="middle"
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize="18"
        fontWeight="700"
        fill="var(--atlas-v5-ink)"
      >
        {new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(total)} €
      </text>
      <text
        x="80"
        y="92"
        textAnchor="middle"
        fontFamily="var(--atlas-v5-font-mono-num)"
        fontSize="9.5"
        fill="var(--atlas-v5-ink-4)"
        letterSpacing="1"
      >
        TOTAL MES
      </text>
    </svg>
  );
};

export default PanelPage;
