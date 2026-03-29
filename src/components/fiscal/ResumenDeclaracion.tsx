import React from 'react';

interface ResumenDeclaracionProps {
  resultado: number | null;
  baseLiquidableGeneral: number | null;
  baseLiquidableAhorro: number | null;
  cuotaIntegraEstatal: number | null;
  cuotaIntegraAutonomica: number | null;
  cuotaLiquidaEstatal: number | null;
  cuotaLiquidaAutonomica: number | null;
}

const fmt = (v: number) => {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtMoney = (v: number) => {
  if (!Number.isFinite(v)) return '—';
  return `${fmt(Math.abs(v))} €`;
};

const monoStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const LineItem: React.FC<{ label: string; value: number | null }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
    <span style={{ fontSize: 'var(--t-sm, 13px)', color: 'var(--n-600)' }}>{label}</span>
    <span style={{ ...monoStyle, fontSize: 'var(--t-sm, 13px)', color: 'var(--n-900)', fontWeight: 500 }}>
      {value !== null ? fmtMoney(value) : '\u2014'}
    </span>
  </div>
);

const ResumenDeclaracion: React.FC<ResumenDeclaracionProps> = ({
  resultado,
  baseLiquidableGeneral,
  baseLiquidableAhorro,
  cuotaIntegraEstatal,
  cuotaIntegraAutonomica,
  cuotaLiquidaEstatal,
  cuotaLiquidaAutonomica,
}) => {
  const hasResult = resultado !== null;
  const isDevolver = hasResult && resultado < 0;
  const resultColor = hasResult
    ? (isDevolver ? 'var(--teal)' : 'var(--blue)')
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
        <div style={{ fontSize: 'var(--t-xs, 11px)', color: 'var(--n-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
          Resultado
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            ...monoStyle,
            fontSize: 28,
            fontWeight: 600,
            color: resultColor,
          }}>
            {hasResult ? fmtMoney(resultado) : '—'}
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

      {/* Casillas oficiales del resumen Modelo 100 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 32px',
        paddingTop: 16,
        borderTop: '1px solid var(--n-100)',
      }}>
        <LineItem label="Base liquidable general" value={baseLiquidableGeneral} />
        <LineItem label="Base liquidable del ahorro" value={baseLiquidableAhorro} />
        <LineItem label="Cuota íntegra estatal" value={cuotaIntegraEstatal} />
        <LineItem label="Cuota íntegra autonómica" value={cuotaIntegraAutonomica} />
        <LineItem label="Cuota líquida estatal" value={cuotaLiquidaEstatal} />
        <LineItem label="Cuota líquida autonómica" value={cuotaLiquidaAutonomica} />
      </div>
    </div>
  );
};

export default ResumenDeclaracion;
