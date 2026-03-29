import React from 'react';

interface ResumenDeclaracionProps {
  resultado: number | null;
  baseGeneral: number | null;
  baseAhorro: number | null;
  cuotaIntegra: number | null;
  retenciones: number | null;
}

const fmt = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtMoney = (v: number) => `${fmt(Math.abs(v))} \u20ac`;

const monoStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const KPI: React.FC<{ label: string; value: number | null }> = ({ label, value }) => (
  <div style={{ flex: 1, minWidth: 120 }}>
    <div style={{ fontSize: 'var(--t-xs, 11px)', color: 'var(--n-500)', marginBottom: 4 }}>{label}</div>
    <div style={{ ...monoStyle, fontSize: 'var(--t-sm, 13px)', color: 'var(--n-900)', fontWeight: 500 }}>
      {value !== null ? fmtMoney(value) : '\u2014'}
    </div>
  </div>
);

const ResumenDeclaracion: React.FC<ResumenDeclaracionProps> = ({
  resultado,
  baseGeneral,
  baseAhorro,
  cuotaIntegra,
  retenciones,
}) => {
  const hasResult = resultado !== null;
  const isDevolver = hasResult && resultado < 0;
  const resultColor = hasResult
    ? (isDevolver ? 'var(--s-pos)' : 'var(--s-neg)')
    : 'var(--n-500)';

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--n-200)',
      borderRadius: 'var(--r-md, 8px)',
      padding: '20px 24px',
    }}>
      {/* Resultado principal */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--t-xs, 11px)', color: 'var(--n-500)', marginBottom: 4 }}>
          Resultado
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            ...monoStyle,
            fontSize: 28,
            fontWeight: 600,
            color: resultColor,
          }}>
            {hasResult ? fmtMoney(resultado) : '\u2014'}
          </span>
          {hasResult && (
            <span style={{ fontSize: 'var(--t-sm, 13px)', fontWeight: 500, color: resultColor }}>
              {isDevolver ? 'A devolver' : 'A pagar'}
            </span>
          )}
          {!hasResult && (
            <span style={{ fontSize: 'var(--t-sm, 13px)', color: 'var(--n-500)' }}>
              Datos incompletos
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        paddingTop: 16,
        borderTop: '1px solid var(--n-100)',
      }}>
        <KPI label="Base general" value={baseGeneral} />
        <KPI label="Base ahorro" value={baseAhorro} />
        <KPI label="Cuota \u00edntegra" value={cuotaIntegra} />
        <KPI label="Retenciones" value={retenciones} />
      </div>
    </div>
  );
};

export default ResumenDeclaracion;
