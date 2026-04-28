import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, MoneyValue, showToastV5 } from '../../../design-system/v5';
import type { FinanciacionOutletContext } from '../FinanciacionContext';
import {
  buildEscalones,
  cuotasDelAnio,
  formatPct,
  getBankPalette,
} from '../helpers';
import styles from './CalendarioPage.module.css';

const MONTH_LABELS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

type FilterKind = 'todos' | 'hipoteca' | 'personal' | 'pignora';

const CalendarioPage: React.FC = () => {
  const navigate = useNavigate();
  const { rows, planes } = useOutletContext<FinanciacionOutletContext>();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [filter, setFilter] = useState<FilterKind>('todos');

  const visible = useMemo(
    () => rows.filter((r) => filter === 'todos' || r.kind === filter),
    [rows, filter],
  );

  // Datos por préstamo · 12 meses + total
  const cuotasPorPrestamo = useMemo(() => {
    return visible.map((r) => {
      const plan = planes.get(r.id);
      const cuotas = cuotasDelAnio(r.raw, plan, year);
      const totalAnio = cuotas.reduce((s, c) => s + c.cuota, 0);
      const interesAnio = cuotas.reduce((s, c) => s + c.interes, 0);
      const capitalAnio = cuotas.reduce((s, c) => s + c.capital, 0);
      const cuotasMap = new Map<number, { cuota: number; capital: number; interes: number; pagado?: boolean }>();
      cuotas.forEach((c) => cuotasMap.set(c.mes, c));
      return {
        row: r,
        cuotasMap,
        totalAnio,
        interesAnio,
        capitalAnio,
      };
    });
  }, [visible, planes, year]);

  const totalAnio = cuotasPorPrestamo.reduce((s, x) => s + x.totalAnio, 0);
  const totalInt = cuotasPorPrestamo.reduce((s, x) => s + x.interesAnio, 0);
  const totalCap = cuotasPorPrestamo.reduce((s, x) => s + x.capitalAnio, 0);
  const cuotaMensual = visible.reduce((s, r) => s + r.cuotaMensual, 0);
  const intDeduciblesAnio = visible.reduce(
    (s, r) => s + (r.intDeducibles * (r.intDeduciblesPct / 100 > 0 ? 1 : 0)),
    0,
  );

  const totalsByMonth = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      return cuotasPorPrestamo.reduce(
        (s, x) => s + (x.cuotasMap.get(mes)?.cuota ?? 0),
        0,
      );
    });
  }, [cuotasPorPrestamo]);

  const escalones = useMemo(() => buildEscalones(rows), [rows]);

  // Vista plurianual · 18 años · suma cuotas/año hasta vencimiento de cada préstamo
  const aniosVistaLargo = useMemo(() => {
    const start = currentYear;
    const end = currentYear + 18;
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const y = start + i;
      const breakdown = visible.map((r) => {
        const venceY = r.fechaVencimiento ? new Date(r.fechaVencimiento).getFullYear() : 0;
        if (venceY === 0 || y < (r.fechaFirma ? new Date(r.fechaFirma).getFullYear() : currentYear)) {
          return 0;
        }
        if (y > venceY) return 0;
        return r.cuotaMensual * 12;
      });
      const total = breakdown.reduce((s, n) => s + n, 0);
      return { year: y, breakdown, total };
    });
  }, [visible, currentYear]);

  if (rows.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.empty}>
            Aún no tienes préstamos · no hay calendario que mostrar.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Cuota mensual hogar</div>
          <div className={styles.kpiVal}>
            <MoneyValue value={cuotaMensual} decimals={0} tone="ink" />
          </div>
          <div className={styles.kpiSub}>
            {visible.length} préstamos activos · {year}
          </div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Total año {year}</div>
          <div className={`${styles.kpiVal} ${styles.neg}`}>
            <MoneyValue value={-totalAnio} decimals={0} showSign tone="neg" />
          </div>
          <div className={styles.kpiSub}>12 cuotas · cuota constante</div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Intereses {year} · deducibles</div>
          <div className={`${styles.kpiVal} ${styles.gold}`}>
            <MoneyValue value={intDeduciblesAnio} decimals={0} tone="gold" />
          </div>
          <div className={styles.kpiSub}>trazables a inmuebles + PP</div>
        </div>
        <div className={styles.kpiCell}>
          <div className={styles.kpiLab}>Amortización {year}</div>
          <div className={`${styles.kpiVal} ${styles.pos}`}>
            <MoneyValue value={totalCap} decimals={0} tone="pos" />
          </div>
          <div className={styles.kpiSub}>capital que pagas a banco</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolGrp}>
          <span className={styles.toolLab}>Año</span>
          {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3].map(
            (y) => (
              <button
                key={y}
                type="button"
                className={`${styles.calPill} ${year === y ? styles.active : ''}`}
                onClick={() => setYear(y)}
                aria-pressed={year === y}
              >
                {y}
              </button>
            ),
          )}
        </div>
        <div className={styles.toolGrp}>
          <span className={styles.toolLab}>Mostrar</span>
          {(['todos', 'hipoteca', 'personal', 'pignora'] as FilterKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`${styles.calPill} ${filter === k ? styles.active : ''}`}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
            >
              {k === 'todos' ? 'Todos' : k.charAt(0).toUpperCase() + k.slice(1) + 's'}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.cardSection}>
        <div className={styles.cardSectionHd}>
          <div className={styles.cardSectionTitle}>Cuotas mes a mes · {year}</div>
          <div className={styles.cardSectionSub}>
            cada celda es la cuota mensual del préstamo · clic en una fila para ver el detalle
          </div>
        </div>
        <table className={styles.calTable}>
          <thead>
            <tr>
              <th style={{ minWidth: 240 }}>Préstamo</th>
              {MONTH_LABELS.map((m) => (
                <th key={m} className={styles.month}>
                  {m}
                </th>
              ))}
              <th className={styles.right} style={{ minWidth: 92 }}>
                Total año
              </th>
            </tr>
          </thead>
          <tbody>
            {cuotasPorPrestamo.map((x) => {
              const palette = getBankPalette(x.row.banco);
              return (
                <tr
                  key={x.row.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/financiacion/${x.row.id}`)}
                >
                  <td className={styles.label}>
                    <div className={styles.prestRowName}>
                      <div
                        className={styles.prestRowLogo}
                        style={{ background: palette.bg, color: palette.fg }}
                      >
                        {palette.abbr}
                      </div>
                      <div>
                        <div className={styles.prestRowNom}>{x.row.alias}</div>
                        <div className={styles.prestRowMeta}>
                          TIN {formatPct(x.row.tin, 2)} ·{' '}
                          {x.row.fechaVencimiento &&
                            `vence ${new Date(x.row.fechaVencimiento).getFullYear()}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  {MONTH_LABELS.map((_, i) => {
                    const mes = i + 1;
                    const c = x.cuotasMap.get(mes);
                    if (!c) return <td key={mes} className={`${styles.center} ${styles.muted}`}>—</td>;
                    return (
                      <td key={mes} className={styles.center}>
                        {Math.round(c.cuota).toLocaleString('es-ES')}
                      </td>
                    );
                  })}
                  <td className={styles.right} style={{ fontWeight: 700 }}>
                    {Math.round(x.totalAnio).toLocaleString('es-ES')}
                  </td>
                </tr>
              );
            })}
            <tr className={styles.total}>
              <td className={styles.label}>Total cuota mensual hogar</td>
              {totalsByMonth.map((t, i) => (
                <td key={i} className={styles.center}>
                  {Math.round(t).toLocaleString('es-ES')}
                </td>
              ))}
              <td className={styles.right}>{Math.round(totalAnio).toLocaleString('es-ES')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.cardSection}>
        <div className={styles.cardSectionHd}>
          <div className={styles.cardSectionTitle}>Desglose interés vs amortización · {year}</div>
          <div className={styles.cardSectionSub}>
            amortización francesa · interés decreciente · capital creciente con el tiempo
          </div>
        </div>
        <table className={styles.calTable}>
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Préstamo</th>
              <th className={styles.right}>Cuota anual</th>
              <th className={styles.right}>Interés (deducible)</th>
              <th className={styles.right}>Amortización</th>
              <th style={{ width: '30%' }}>Composición</th>
            </tr>
          </thead>
          <tbody>
            {cuotasPorPrestamo.map((x) => {
              const palette = getBankPalette(x.row.banco);
              const total = x.interesAnio + x.capitalAnio;
              const pctInt = total > 0 ? (x.interesAnio / total) * 100 : 0;
              const pctCap = 100 - pctInt;
              return (
                <tr key={x.row.id}>
                  <td className={styles.label}>
                    <div className={styles.prestRowName}>
                      <div
                        className={styles.prestRowLogo}
                        style={{ background: palette.bg, color: palette.fg }}
                      >
                        {palette.abbr}
                      </div>
                      <div>
                        <div className={styles.prestRowNom}>{x.row.alias}</div>
                        <div className={styles.prestRowMeta}>
                          {formatPct(x.row.tin, 2)} · cap. vivo{' '}
                          {Math.round(x.row.capitalVivo).toLocaleString('es-ES')} €
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.right}>{Math.round(x.totalAnio).toLocaleString('es-ES')} €</td>
                  <td
                    className={styles.right}
                    style={{ color: 'var(--atlas-v5-gold-ink)', fontWeight: 700 }}
                  >
                    {Math.round(x.interesAnio).toLocaleString('es-ES')} €
                  </td>
                  <td
                    className={styles.right}
                    style={{ color: 'var(--atlas-v5-pos)', fontWeight: 700 }}
                  >
                    {Math.round(x.capitalAnio).toLocaleString('es-ES')} €
                  </td>
                  <td>
                    <div className={styles.yrBar}>
                      <div className={`${styles.yrBarSeg} ${styles.t3}`} style={{ width: `${pctInt}%` }}>
                        {pctInt.toFixed(0)}%
                      </div>
                      <div className={`${styles.yrBarSeg} ${styles.t1}`} style={{ width: `${pctCap}%` }}>
                        {pctCap.toFixed(0)}%
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className={styles.total}>
              <td className={styles.label}>Total hogar · {year}</td>
              <td className={styles.right}>{Math.round(totalAnio).toLocaleString('es-ES')} €</td>
              <td className={styles.right}>{Math.round(totalInt).toLocaleString('es-ES')} €</td>
              <td className={styles.right}>{Math.round(totalCap).toLocaleString('es-ES')} €</td>
              <td />
            </tr>
          </tbody>
        </table>
        <div className={styles.note}>
          <strong>Trazabilidad fiscal</strong> · sólo son deducibles los intereses trazables a
          inmuebles que generen rentas (cumplimiento art. 23 LIRPF) o préstamos pignoraticios cuyo
          destino sea inmueble. Préstamos personales sin destino inmobiliario no son deducibles.
        </div>
      </section>

      {escalones.length > 0 && (
        <section className={styles.cardSection}>
          <div className={styles.cardSectionHd}>
            <div className={styles.cardSectionTitle}>Escalones de cashflow · vencimientos</div>
            <div className={styles.cardSectionSub}>
              cada vencimiento libera la cuota mensual del préstamo · alimenta tu plan de libertad
              financiera en Mi Plan
            </div>
          </div>
          <div className={styles.escalonGrid}>
            {escalones.map((e) => (
              <div key={e.prestamoId} className={styles.escalonCard}>
                <div className={styles.escalonYear}>{e.year}</div>
                <div className={styles.escalonInfo}>
                  <div className={styles.escalonInfoNom}>{e.alias}</div>
                  <div className={styles.escalonInfoSub}>
                    {e.cuotasRestantes} cuotas restantes · TIN {formatPct(e.tin, 2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={styles.escalonLiberaLab}>libera</div>
                  <div className={styles.escalonLibera}>
                    +<MoneyValue value={e.cuotaLiberada} decimals={0} tone="pos" /> /mes
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.cardSection}>
        <div className={styles.cardSectionHd}>
          <div className={styles.cardSectionTitle}>Cuota anual hogar · 18 años</div>
          <div className={styles.cardSectionSub}>
            visión plurianual · los escalones bajan la cuota total cuando vence cada préstamo
          </div>
        </div>
        <table className={styles.calTable}>
          <thead>
            <tr>
              <th>Año</th>
              {visible.map((r) => (
                <th key={r.id} className={styles.right}>
                  {r.alias.length > 18 ? r.alias.slice(0, 18) + '…' : r.alias}
                </th>
              ))}
              <th className={styles.right} style={{ background: 'var(--atlas-v5-brand-wash)', color: 'var(--atlas-v5-brand)' }}>
                Total año
              </th>
              <th className={styles.right} style={{ background: 'var(--atlas-v5-gold-wash)', color: 'var(--atlas-v5-gold-ink)' }}>
                Mensual medio
              </th>
            </tr>
          </thead>
          <tbody>
            {aniosVistaLargo.map((row) => {
              const isLibre = row.total === 0 && row.year > currentYear;
              return (
                <tr key={row.year} className={isLibre ? styles.libre : ''}>
                  <td className={styles.label}>{isLibre ? `${row.year} · libre de financiación` : row.year}</td>
                  {row.breakdown.map((v, i) => (
                    <td key={i} className={styles.right}>
                      {v > 0 ? Math.round(v).toLocaleString('es-ES') : <span className={styles.muted}>—</span>}
                    </td>
                  ))}
                  <td className={styles.right} style={{ fontWeight: 700 }}>
                    {row.total > 0 ? Math.round(row.total).toLocaleString('es-ES') : '0'}
                  </td>
                  <td className={styles.right}>
                    {row.total > 0 ? Math.round(row.total / 12).toLocaleString('es-ES') : '0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          type="button"
          onClick={() => showToastV5('Exportar Excel · sub-tarea follow-up')}
          style={{
            padding: '8px 14px',
            border: '1px solid var(--atlas-v5-line)',
            background: 'var(--atlas-v5-card)',
            color: 'var(--atlas-v5-ink-2)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Exportar Excel
        </button>
      </div>
    </>
  );
};

export default CalendarioPage;
