// Vista plurianual del calendario fiscal · 6 años (3 pasados · actual ·
// 2 futuros) con drill-down por modelo. Sustituye el placeholder anterior
// y replica visualmente el timeline del Dashboard pero con más años y
// filtro por modelo.
//
// Mockup oficial · `docs/audit-inputs/atlas-fiscal.html` · combinado con
// la sección `page-calendario`.

import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import type { FiscalOutletContext } from '../FiscalContext';
import { ESTADOS_VIVOS, obligacionesAnioBase } from '../helpers';
import styles from './CalendarioFiscalPage.module.css';

const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type ModeloFilter = 'todos' | '303' | '130' | '100' | '180' | '347';

const CalendarioFiscalPage: React.FC = () => {
  const navigate = useNavigate();
  const { ejercicios } = useOutletContext<FiscalOutletContext>();

  const [modeloFilter, setModeloFilter] = useState<ModeloFilter>('todos');

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const todayPctOfYear = useMemo(() => {
    const start = new Date(today.getFullYear(), 0, 1).getTime();
    const end = new Date(today.getFullYear() + 1, 0, 1).getTime();
    return ((today.getTime() - start) / (end - start)) * 100;
  }, [today]);

  const visibleObligaciones = useMemo(
    () =>
      modeloFilter === 'todos'
        ? obligacionesAnioBase
        : obligacionesAnioBase.filter((o) => o.modelo === modeloFilter),
    [modeloFilter],
  );

  // 6 años · currentYear-3 ... currentYear+2.
  const years = useMemo(() => {
    return [
      currentYear - 3,
      currentYear - 2,
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2,
    ].map((y) => {
      const ej = ejercicios.find((e) => e.ejercicio === y);
      const isFuture = y > currentYear;
      const estado = ej?.estado;
      const stateClass: keyof typeof styles = isFuture
        ? 'futuro'
        : estado === 'declarado'
          ? 'declarado'
          : estado === 'prescrito'
            ? 'prescrito'
            : estado && ESTADOS_VIVOS.includes(estado)
              ? 'curso'
              : 'pendiente';
      const stateLabel = isFuture
        ? 'Futuro'
        : estado === 'declarado'
          ? 'Declarado'
          : estado === 'prescrito'
            ? 'Prescrito'
            : estado && ESTADOS_VIVOS.includes(estado)
              ? 'En curso'
              : 'Pendiente';
      return { year: y, ejercicio: ej, stateClass, stateLabel };
    });
  }, [ejercicios, currentYear]);

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.toolLab}>Modelo</span>
        {(['todos', '303', '130', '100', '180', '347'] as ModeloFilter[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`${styles.pill} ${modeloFilter === m ? styles.active : ''}`}
            aria-pressed={modeloFilter === m}
            onClick={() => setModeloFilter(m)}
          >
            {m === 'todos' ? 'Todos' : `Modelo ${m}`}
          </button>
        ))}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHd}>
          <div className={styles.sectionTitle}>Calendario fiscal · 6 años</div>
          <div className={styles.sectionSub}>
            cada barra es una obligación · click en un año para abrir detalle · línea roja = hoy
          </div>
        </div>

        <div className={styles.tlHeaderRow}>
          <div>Modelo · concepto</div>
          <div className={styles.tlMonths}>
            {MONTH_NAMES.map((m) => (
              <div key={m} className={styles.tlMonth}>{m}</div>
            ))}
          </div>
        </div>

        {years.map(({ year, ejercicio, stateClass, stateLabel }) => (
          <div key={year} className={styles.tlYearGroup}>
            <div className={styles.tlYearHead}>
              <button
                type="button"
                className={styles.tlYearName}
                onClick={() => navigate(`/fiscal/ejercicio/${year}`)}
              >
                <span className={styles.tlYearNum}>{year}</span>
                <span className={`${styles.tlYearState} ${styles[stateClass]}`}>
                  {stateLabel}
                </span>
                <Icons.ChevronRight size={12} strokeWidth={2} />
              </button>
              <span className={styles.tlYearMeta}>
                {ejercicio
                  ? `actualizado ${new Date(ejercicio.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`
                  : 'sin datos'}
              </span>
            </div>

            {visibleObligaciones.map((o) => (
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
                      const isPast =
                        year < currentYear || (year === currentYear && todayPctOfYear > q * 25);
                      const isFuture = year > currentYear;
                      const cls = isFuture
                        ? styles.futura
                        : isPast
                          ? styles.cumplida
                          : styles.futura;
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
                  {o.frecuencia === 'anual' &&
                    (() => {
                      const mes = o.mesPresentacion ?? 6;
                      const left = ((mes - 1) / 12) * 100;
                      const width = (1 / 12) * 100;
                      const dueMs = new Date(year + 1, mes - 1, 30).getTime();
                      const isPast = dueMs < today.getTime();
                      const isFuture = year > currentYear;
                      const cls = isFuture
                        ? styles.futura
                        : isPast
                          ? styles.cumplida
                          : styles.futura;
                      return (
                        <div
                          className={`${styles.tlBar} ${cls}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          {o.nombre}
                        </div>
                      );
                    })()}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
};

export default CalendarioFiscalPage;
