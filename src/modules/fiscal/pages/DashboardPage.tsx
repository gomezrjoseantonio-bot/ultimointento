import React, { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, MoneyValue, Icons, showToastV5 } from '../../../design-system/v5';
import type { FiscalOutletContext } from '../FiscalContext';
import { cuotaResultado, ESTADOS_VIVOS, obligacionesAnioBase } from '../helpers';
import styles from './DashboardPage.module.css';

const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { ejercicios, rows } = useOutletContext<FiscalOutletContext>();

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const todayPctOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 1).getTime();
    const end = new Date(today.getFullYear() + 1, 0, 1).getTime();
    return ((today.getTime() - start) / (end - start)) * 100;
  }, [today]);

  // Proyección IRPF en curso · "a pagar estimado".
  const proyeccionEnCurso = useMemo(() => {
    const enCurso = ejercicios.find((e) => e.ejercicio === currentYear);
    if (!enCurso) return null;
    return cuotaResultado(enCurso);
  }, [ejercicios, currentYear]);

  const borradorPrev = useMemo(() => {
    const ej = ejercicios.find(
      (e) => e.ejercicio === currentYear - 1 && ESTADOS_VIVOS.includes(e.estado),
    );
    if (!ej) return null;
    return cuotaResultado(ej);
  }, [ejercicios, currentYear]);

  const deudasPendientes = useMemo(() => {
    return ejercicios
      .filter((e) => e.estado === 'declarado' && cuotaResultado(e) < 0)
      .reduce((s, e) => s + Math.abs(cuotaResultado(e)), 0);
  }, [ejercicios]);

  const arrastrePerdidas = useMemo(() => {
    return ejercicios.reduce((s, e) => {
      const a = e.arrastresGenerados as
        | { perdidasAhorroPendientes?: number }
        | undefined;
      return s + (a?.perdidasAhorroPendientes ?? 0);
    }, 0);
  }, [ejercicios]);

  // Timeline · 4 años (currentYear hacia atrás).
  const timelineYears = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => {
      const ej = ejercicios.find((e) => e.ejercicio === y);
      const estado = ej?.estado ?? 'pendiente_cierre';
      const stateClass: keyof typeof styles =
        estado === 'declarado'
          ? 'declarado'
          : estado === 'prescrito'
            ? 'prescrito'
            : ESTADOS_VIVOS.includes(estado)
              ? 'curso'
              : 'pendiente';
      return {
        year: y,
        ejercicio: ej,
        stateClass,
        estado,
      };
    });
  }, [ejercicios, currentYear]);

  if (rows.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.empty}>
            Aún no hay ejercicios fiscales registrados. Atlas creará el ejercicio en curso
            automáticamente al detectar movimientos imputables.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <div className={styles.kpiStrip}>
        <div
          className={styles.kpiCell}
          role="button"
          tabIndex={0}
          onClick={() => showToastV5(`Proyección ${currentYear} · sub-tarea follow-up (3f-B)`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') showToastV5(`Proyección ${currentYear} · sub-tarea follow-up`);
          }}
        >
          <div className={styles.kpiLab}>
            {currentYear} · Proyección IRPF
          </div>
          <div className={`${styles.kpiVal} ${proyeccionEnCurso != null && proyeccionEnCurso < 0 ? styles.neg : ''}`}>
            {proyeccionEnCurso != null ? (
              <MoneyValue value={proyeccionEnCurso} decimals={0} showSign tone="auto" />
            ) : (
              '—'
            )}
          </div>
          <div className={styles.kpiHint}>
            {proyeccionEnCurso != null && proyeccionEnCurso < 0 ? 'a pagar est.' : 'a devolver est.'}
          </div>
          <div className={styles.kpiCta}>Ver detalle →</div>
        </div>
        <div
          className={`${styles.kpiCell} ${styles.warn}`}
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/fiscal/ejercicio/${currentYear - 1}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(`/fiscal/ejercicio/${currentYear - 1}`);
          }}
        >
          <div className={styles.kpiLab}>
            {currentYear - 1} · Borrador
          </div>
          <div className={`${styles.kpiVal} ${borradorPrev != null && borradorPrev > 0 ? styles.pos : borradorPrev != null && borradorPrev < 0 ? styles.neg : ''}`}>
            {borradorPrev != null ? (
              <MoneyValue value={borradorPrev} decimals={0} showSign tone="auto" />
            ) : (
              'sin datos'
            )}
          </div>
          <div className={styles.kpiHint}>
            {borradorPrev != null && borradorPrev > 0 ? 'a devolver · presentar' : 'a pagar · presentar'}
          </div>
          <div className={styles.kpiCta}>Ir al borrador →</div>
        </div>
        <div
          className={`${styles.kpiCell} ${styles.neg}`}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/fiscal/deudas')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate('/fiscal/deudas');
          }}
        >
          <div className={styles.kpiLab}>Deudas pendientes</div>
          <div className={`${styles.kpiVal} ${styles.neg}`}>
            <MoneyValue value={-deudasPendientes} decimals={0} showSign tone="neg" />
          </div>
          <div className={styles.kpiHint}>aplazadas o vencidas</div>
          <div className={styles.kpiCta}>Ver detalle →</div>
        </div>
        <div
          className={styles.kpiCell}
          role="button"
          tabIndex={0}
          onClick={() => showToastV5('Carryforwards · sub-tarea follow-up')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') showToastV5('Carryforwards · sub-tarea follow-up');
          }}
        >
          <div className={styles.kpiLab}>Pérdidas pendientes</div>
          <div className={`${styles.kpiVal} ${styles.gold}`}>
            <MoneyValue value={arrastrePerdidas} decimals={0} tone="gold" />
          </div>
          <div className={styles.kpiHint}>compensables 4 años</div>
          <div className={styles.kpiCta}>Ver detalle →</div>
        </div>
      </div>

      <div className={styles.tlCard}>
        <div className={styles.tlHd}>
          <div>
            <div className={styles.tlTitle}>Calendario fiscal · 4 años</div>
            <div className={styles.tlSub}>
              Cada barra es una obligación · click en un año para abrir detalle · línea roja = hoy
            </div>
          </div>
          <div className={styles.tlAction} role="button" tabIndex={0} onClick={() => showToastV5('Calendario completo · sub-tarea follow-up')}>
            Ver calendario completo →
          </div>
        </div>

        <div>
          <div className={styles.tlHeaderRow}>
            <div>Modelo · concepto</div>
            <div className={styles.tlMonths}>
              {MONTH_NAMES.map((m) => (
                <div key={m} className={styles.tlMonth}>{m}</div>
              ))}
            </div>
          </div>

          {timelineYears.map(({ year, ejercicio, stateClass, estado }) => (
            <div key={year} className={styles.tlYearGroup}>
              <div className={styles.tlYearHead}>
                <div
                  className={styles.tlYearName}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/fiscal/ejercicio/${year}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/fiscal/ejercicio/${year}`);
                  }}
                >
                  <span className={styles.tlYearNum}>{year}</span>
                  <span className={`${styles.tlYearState} ${styles[stateClass]}`}>
                    {estado === 'declarado'
                      ? 'Declarado'
                      : estado === 'prescrito'
                        ? 'Prescrito'
                        : ESTADOS_VIVOS.includes(estado)
                          ? 'En curso'
                          : 'Pendiente'}
                  </span>
                  <Icons.ChevronRight size={12} strokeWidth={2} />
                </div>
                <span className={styles.tlYearMeta}>
                  {ejercicio
                    ? `actualizado ${new Date(ejercicio.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`
                    : 'sin datos cargados'}
                </span>
              </div>

              {obligacionesAnioBase
                .filter((o) => year !== currentYear ? o.frecuencia === 'anual' : true)
                .map((o) => (
                  <div key={o.modelo} className={styles.tlRow}>
                    <div className={styles.tlRowLab}>
                      <span className={styles.tlRowModelo}>{o.modelo}</span>
                      <span className={styles.tlRowName}>{o.nombre}</span>
                    </div>
                    <div className={styles.tlTrack}>
                      {year === currentYear && (
                        <div className={styles.tlToday} style={{ left: `${todayPctOfYear}%` }}>
                          <span className={styles.tlTodayLab}>hoy</span>
                        </div>
                      )}
                      {o.frecuencia === 'trimestral' &&
                        [1, 2, 3, 4].map((q) => {
                          const left = (q - 1) * 25 + 4.17;
                          const isPast = year < currentYear || (year === currentYear && todayPctOfYear > q * 25);
                          const cls = isPast ? styles.cumplida : styles.futura;
                          return (
                            <div
                              key={q}
                              className={`${styles.tlBar} ${cls}`}
                              style={{ left: `${left}%`, width: '16.6%' }}
                            >
                              {q}T
                            </div>
                          );
                        })}
                      {o.frecuencia === 'anual' && (() => {
                        const mes = o.mesPresentacion ?? 6;
                        const left = ((mes - 1) / 12) * 100;
                        const width = (1 / 12) * 100;
                        const dueMs = new Date(year + 1, mes - 1, 30).getTime();
                        const cls = dueMs < today.getTime() ? styles.cumplida : styles.futura;
                        return (
                          <div className={`${styles.tlBar} ${cls}`} style={{ left: `${left}%`, width: `${width}%` }}>
                            {o.nombre}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
