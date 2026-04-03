import React from 'react';

interface KpiExcedenteProps {
  año: number;
  excedente: number | null;
  tasaAhorro: number | null;
  delta: number | null;
  deltaPct: number | null;
  añoAnterior: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

const KpiExcedente: React.FC<KpiExcedenteProps> = ({
  año,
  excedente,
  tasaAhorro,
  delta,
  deltaPct,
  añoAnterior,
}) => {
  const hasData = excedente !== null;
  const hasDelta = delta !== null && deltaPct !== null;

  return (
    <div style={{
      background: 'var(--white, #FFFFFF)',
      border: '1px solid var(--grey-200, #DDE3EC)',
      borderRadius: 'var(--r-lg, 12px)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Top color bar - teal */}
      <div style={{
        height: 3,
        background: 'var(--teal-600, #1DA0BA)',
      }} />

      {/* Body */}
      <div style={{ padding: '18px 16px 14px' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--grey-500, #6C757D)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 10,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          EXCEDENTE {año}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
          <div>
            <div style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--navy-900, #042C5E)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}>
              {hasData ? `+${fmt(excedente)} €` : '—'}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--grey-500, #6C757D)',
              marginTop: 2,
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}>
              Año en curso
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--teal-600, #1DA0BA)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}>
              {tasaAhorro !== null ? `${tasaAhorro}%` : '—'}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--grey-500, #6C757D)',
              marginTop: 2,
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}>
              tasa ahorro
            </div>
          </div>
        </div>
      </div>

      {/* Separator line - navy, edge to edge */}
      <div style={{
        height: 3,
        background: 'var(--navy-900, #042C5E)',
      }} />

      {/* Footer */}
      <div style={{
        background: 'var(--navy-50, #F0F4FA)',
        padding: '9px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: 12,
          color: 'var(--grey-700, #303A4C)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          {hasDelta ? (
            <>
              {delta! >= 0 ? '↑' : '↓'} Mejora vs {añoAnterior}:{' '}
              <b style={{
                color: 'var(--teal-600, #1DA0BA)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
              }}>
                {delta! >= 0 ? '+' : ''}{fmt(delta!)} €
              </b>
            </>
          ) : '—'}
        </span>
        <span style={{
          fontSize: 12,
          color: 'var(--grey-700, #303A4C)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
        }}>
          {hasDelta ? `${deltaPct! >= 0 ? '+' : ''}${deltaPct}%` : ''}
        </span>
      </div>
    </div>
  );
};

export default KpiExcedente;
