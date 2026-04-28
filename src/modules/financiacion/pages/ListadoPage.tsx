import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, MoneyValue } from '../../../design-system/v5';
import type { FinanciacionOutletContext } from '../FinanciacionContext';
import type { LoanKind, LoanRow } from '../types';
import {
  formatPct,
  formatYear,
  getBankPalette,
  labelKind,
  monthsLeftLabel,
} from '../helpers';
import styles from './ListadoPage.module.css';

type Filter = 'todos' | LoanKind;

const ListadoPage: React.FC = () => {
  const navigate = useNavigate();
  const { rows } = useOutletContext<FinanciacionOutletContext>();
  const [filter, setFilter] = useState<Filter>('todos');

  const counts = useMemo(() => {
    return {
      todos: rows.length,
      hipoteca: rows.filter((r) => r.kind === 'hipoteca').length,
      personal: rows.filter((r) => r.kind === 'personal').length,
      pignora: rows.filter((r) => r.kind === 'pignora').length,
      otro: rows.filter((r) => r.kind === 'otro').length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'todos') return rows;
    return rows.filter((r) => r.kind === filter);
  }, [rows, filter]);

  const renderCard = (row: LoanRow, idx: number) => {
    const palette = getBankPalette(row.banco);
    const cls = row.kind;
    const cuotasPagadas = row.raw.cuotasPagadas ?? 0;
    return (
      <div
        key={row.id}
        className={styles.card}
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/financiacion/${row.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate(`/financiacion/${row.id}`);
        }}
      >
        <div className={styles.head}>
          <div className={styles.logo} style={{ background: palette.bg, color: palette.fg }}>
            {palette.abbr}
          </div>
          <div>
            <div className={styles.ast}>
              PREST · {String(idx + 1).padStart(2, '0')} · {row.kind}
            </div>
            <div className={styles.nom}>{row.alias}</div>
          </div>
          <span className={`${styles.kindBadge} ${styles[cls]}`}>{labelKind(row.kind)}</span>
        </div>

        <div className={styles.numbers}>
          <div>
            <div className={styles.numLab}>Capital vivo</div>
            <div className={`${styles.numVal} ${styles.neg}`}>
              <MoneyValue value={-row.capitalVivo} decimals={0} showSign tone="neg" />
            </div>
            <div className={styles.numSub}>
              inicial <MoneyValue value={row.principalInicial} decimals={0} tone="muted" />
            </div>
          </div>
          <div>
            <div className={styles.numLab}>Cuota mes</div>
            <div className={styles.numVal}>
              <MoneyValue value={row.cuotaMensual} decimals={0} tone="ink" />
            </div>
            <div className={styles.numSub}>TIN {formatPct(row.tin, 2)}</div>
          </div>
          <div>
            <div className={styles.numLab}>Vencimiento</div>
            <div className={styles.numVal}>{formatYear(row.fechaVencimiento)}</div>
            <div className={styles.numSub}>{monthsLeftLabel(row.cuotasRestantes)}</div>
          </div>
        </div>

        <div className={styles.progress}>
          <div className={styles.progressTop}>
            <span>
              Amortizado · {cuotasPagadas}/{row.raw.plazoMesesTotal} cuotas
            </span>
            <span className={styles.pct}>{formatPct(row.porcentajeAmortizado, 1)}</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={`${styles.progressFill} ${styles[cls]}`}
              style={{ width: `${row.porcentajeAmortizado}%` }}
            />
          </div>
        </div>

        <div className={styles.dg}>
          <div className={styles.dgRow}>
            <div className={styles.dgLab}>Destino</div>
            <div className={styles.dgChips}>
              {(row.raw.destinos ?? []).length === 0 && (
                <span className={styles.dgChip}>{row.destinosResumen}</span>
              )}
              {(row.raw.destinos ?? []).map((d) => (
                <span
                  key={d.id}
                  className={`${styles.dgChip} ${
                    d.tipo === 'CANCELACION_DEUDA' ? styles.cancel : styles.inmueble
                  }`}
                >
                  {d.descripcion ?? d.tipo.toLowerCase()}
                  {d.porcentaje != null && (
                    <span className={styles.pct}>{d.porcentaje.toFixed(0)}%</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.dgRow}>
            <div className={styles.dgLab}>Garantía</div>
            <div className={styles.dgChips}>
              {(row.raw.garantias ?? []).length === 0 && (
                <span className={styles.dgChip}>{row.garantiasResumen}</span>
              )}
              {(row.raw.garantias ?? []).map((g, i) => (
                <span
                  key={`${g.tipo}-${i}`}
                  className={`${styles.dgChip} ${
                    g.tipo === 'PIGNORATICIA'
                      ? styles.pignora
                      : g.tipo === 'PERSONAL'
                        ? styles.persona
                        : styles.inmueble
                  }`}
                >
                  {g.descripcion ?? g.tipo.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <div>
            <span className={styles.footerLab}>Intereses deducibles {new Date().getFullYear()}</span>
            <span className={styles.footerVal}>
              <MoneyValue value={row.intDeducibles} decimals={0} showSign tone="pos" />{' '}
              · {formatPct(row.intDeduciblesPct, 0)}
            </span>
          </div>
          <span className={styles.cta}>Ver detalle →</span>
        </div>
      </div>
    );
  };

  if (rows.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.empty}>
            Aún no tienes préstamos registrados. Crea tu primer préstamo desde el botón
            <strong> Nuevo préstamo</strong>.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <div className={styles.filterBar}>
        <span className={styles.filterLab}>Mostrar</span>
        <button
          type="button"
          className={`${styles.pill} ${filter === 'todos' ? styles.active : ''}`}
          onClick={() => setFilter('todos')}
          aria-pressed={filter === 'todos'}
        >
          Todos
          <span className={styles.pillCount}>{counts.todos}</span>
        </button>
        <button
          type="button"
          className={`${styles.pill} ${filter === 'hipoteca' ? styles.active : ''}`}
          onClick={() => setFilter('hipoteca')}
          aria-pressed={filter === 'hipoteca'}
          disabled={counts.hipoteca === 0}
        >
          Hipotecas
          <span className={styles.pillCount}>{counts.hipoteca}</span>
        </button>
        <button
          type="button"
          className={`${styles.pill} ${filter === 'personal' ? styles.active : ''}`}
          onClick={() => setFilter('personal')}
          aria-pressed={filter === 'personal'}
          disabled={counts.personal === 0}
        >
          Personales
          <span className={styles.pillCount}>{counts.personal}</span>
        </button>
        <button
          type="button"
          className={`${styles.pill} ${filter === 'pignora' ? styles.active : ''}`}
          onClick={() => setFilter('pignora')}
          aria-pressed={filter === 'pignora'}
          disabled={counts.pignora === 0}
        >
          Pignoraticia
          <span className={styles.pillCount}>{counts.pignora}</span>
        </button>
      </div>

      <div className={styles.grid}>{filtered.map(renderCard)}</div>
    </>
  );
};

export default ListadoPage;
