import React, { useEffect, useMemo, useState } from 'react';
import {
  CardV5,
  MoneyValue,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import { computeBudgetProjection12mAsync, type BudgetProjection } from '../services/budgetProjection';

const formatYearLabel = (year: number) => `${year}`;

const ProyeccionPage: React.FC = () => {
  const year = new Date().getFullYear();
  const [projection, setProjection] = useState<BudgetProjection | null>(null);

  useEffect(() => {
    let cancelled = false;
    computeBudgetProjection12mAsync(year).then((p) => {
      if (!cancelled) setProjection(p);
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const months = useMemo(() => projection?.months ?? [], [projection]);
  const balanceAnual = useMemo(
    () => (projection ? projection.entradasAnuales + projection.salidasAnuales : 0),
    [projection],
  );

  // Para el waterfall · escala según valor abs máximo.
  const maxAbs = useMemo(
    () => months.reduce((m, x) => Math.max(m, Math.abs(x.flujoNeto)), 1),
    [months],
  );

  // Hitos · meses con flujo más positivo y más negativo.
  const mejorMes = months.reduce((best, m) => (m.flujoNeto > (best?.flujoNeto ?? -Infinity) ? m : best), null as null | typeof months[number]);
  const peorMes = months.reduce((worst, m) => (m.flujoNeto < (worst?.flujoNeto ?? Infinity) ? m : worst), null as null | typeof months[number]);

  return (
    <>
      <CardV5 accent="brand" style={{ marginBottom: 14 }}>
        <CardV5.Title>Resultado caja · {formatYearLabel(year)}</CardV5.Title>
        <CardV5.Subtitle>
          proyección estructural mes a mes · ingresos − gastos del hogar
        </CardV5.Subtitle>
        <CardV5.Body>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
              marginBottom: 14,
            }}
          >
            <ProjectionKpi
              label="Entradas anuales"
              value={projection?.entradasAnuales ?? 0}
              tone="pos"
            />
            <ProjectionKpi
              label="Salidas anuales"
              value={projection?.salidasAnuales ?? 0}
              tone="neg"
            />
            <ProjectionKpi
              label="Balance neto"
              value={balanceAnual}
              tone={balanceAnual >= 0 ? 'pos' : 'neg'}
              showSign
            />
            <ProjectionKpi
              label="Mes más positivo"
              value={mejorMes?.flujoNeto ?? 0}
              tone="pos"
              footLabel={mejorMes?.label}
              showSign
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 6,
              alignItems: 'end',
              height: 200,
              padding: '20px 4px 30px',
              borderTop: '1px dashed var(--atlas-v5-line-2)',
              borderBottom: '1px solid var(--atlas-v5-line-2)',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                borderTop: '1px solid var(--atlas-v5-line-2)',
                pointerEvents: 'none',
              }}
            />
            {months.map((m, idx) => {
              const totalH = 70; // % desde la línea 0 hasta extremos
              const heightPct = maxAbs > 0 ? (Math.abs(m.flujoNeto) / maxAbs) * totalH : 0;
              const isPositive = m.flujoNeto >= 0;
              return (
                <button
                  key={m.month}
                  type="button"
                  onClick={() =>
                    showToastV5(
                      `${m.label} ${year} · entradas ${m.entradas.toFixed(0)} € · salidas ${m.salidas.toFixed(0)} €`,
                    )
                  }
                  style={{
                    background: 'transparent',
                    border: 'none',
                    height: '100%',
                    position: 'relative',
                    cursor: 'pointer',
                    padding: 0,
                    fontFamily: 'var(--atlas-v5-font-ui)',
                  }}
                  aria-label={`${m.label} ${year} · flujo ${m.flujoNeto.toFixed(0)} €`}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bottom: isPositive ? '50%' : 'auto',
                      top: isPositive ? 'auto' : '50%',
                      width: '85%',
                      height: `${heightPct}%`,
                      background: isPositive ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
                      borderRadius: isPositive ? '4px 4px 0 0' : '0 0 4px 4px',
                      outline: m.isCurrent ? '2px solid var(--atlas-v5-gold)' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -22,
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      fontSize: 10,
                      fontFamily: 'var(--atlas-v5-font-mono-num)',
                      color: m.isCurrent ? 'var(--atlas-v5-ink)' : 'var(--atlas-v5-ink-4)',
                      fontWeight: m.isCurrent ? 700 : 500,
                    }}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 18,
              fontSize: 11.5,
              color: 'var(--atlas-v5-ink-3)',
              marginTop: 18,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: 'var(--atlas-v5-pos)',
                }}
              />
              Mes con superávit · {months.filter((m) => m.flujoNeto >= 0).length}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: 'var(--atlas-v5-neg)',
                }}
              />
              Mes con déficit · {months.filter((m) => m.flujoNeto < 0).length}
            </span>
            {peorMes && peorMes.flujoNeto < 0 && (
              <span style={{ marginLeft: 'auto', color: 'var(--atlas-v5-neg)' }}>
                <Icons.Warning size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Atención · {peorMes.label} prevé{' '}
                <MoneyValue value={peorMes.flujoNeto} decimals={0} showSign tone="neg" />
              </span>
            )}
          </div>
        </CardV5.Body>
      </CardV5>

      <CardV5>
        <CardV5.Title>Tabla mes a mes</CardV5.Title>
        <CardV5.Body>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--atlas-v5-font-ui)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--atlas-v5-line)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mes</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Entradas</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Salidas</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10.5, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Flujo neto</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr
                  key={m.month}
                  style={{
                    borderBottom: '1px solid var(--atlas-v5-line-2)',
                    background: m.isCurrent ? 'var(--atlas-v5-gold-wash)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: m.isCurrent ? 700 : 600 }}>
                    {m.label}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)' }}>
                    <MoneyValue value={m.entradas} decimals={0} tone="pos" />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)' }}>
                    <MoneyValue value={m.salidas} decimals={0} tone="neg" />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--atlas-v5-font-mono-num)', fontWeight: 700 }}>
                    <MoneyValue value={m.flujoNeto} decimals={0} showSign tone="auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardV5.Body>
      </CardV5>
    </>
  );
};

interface ProjectionKpiProps {
  label: string;
  value: number;
  tone?: 'pos' | 'neg';
  showSign?: boolean;
  footLabel?: string;
}

const ProjectionKpi: React.FC<ProjectionKpiProps> = ({ label, value, tone, showSign, footLabel }) => (
  <div
    style={{
      background: 'var(--atlas-v5-card-alt)',
      border: '1px solid var(--atlas-v5-line)',
      borderRadius: 10,
      padding: '12px 14px',
    }}
  >
    <div
      style={{
        fontSize: 10.5,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: 'var(--atlas-v5-ink-4)',
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: 'var(--atlas-v5-font-mono-num)',
        fontWeight: 700,
        fontSize: 20,
        color:
          tone === 'pos'
            ? 'var(--atlas-v5-pos)'
            : tone === 'neg'
              ? 'var(--atlas-v5-neg)'
              : 'var(--atlas-v5-ink)',
        letterSpacing: '-0.025em',
      }}
    >
      <MoneyValue value={value} decimals={0} showSign={showSign} tone={tone === 'pos' ? 'pos' : tone === 'neg' ? 'neg' : 'auto'} />
    </div>
    {footLabel && (
      <div
        style={{
          fontSize: 11,
          color: 'var(--atlas-v5-ink-4)',
          marginTop: 4,
          fontFamily: 'var(--atlas-v5-font-mono-num)',
        }}
      >
        {footLabel}
      </div>
    )}
  </div>
);

export default ProyeccionPage;
