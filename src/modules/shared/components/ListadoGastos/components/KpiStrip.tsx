import React from 'react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import { formatEur } from '../utils/amountFormatter';
import { computeTiraMetrics, nombreMes } from '../utils/tiraMetrics';

interface KpiStripProps {
  compromisos: CompromisoRecurrente[];
}

// Tira superior §3.1 · coste anual · gastos vigentes · sin importe todavía ·
// el mes más cargado. Todo desde el cálculo canónico (misma cifra que Tesorería).
const KpiStrip: React.FC<KpiStripProps> = ({ compromisos }) => {
  const year = new Date().getFullYear();
  const { costeAnual, vigentes, sinImporte, mesMasCargado } = computeTiraMetrics(
    compromisos,
    year,
  );

  return (
    <div style={strip}>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-neg)' }}>
        <div style={kpiLabel}>Coste anual de gastos</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-neg)' }}>
          {formatEur(-Math.abs(costeAnual))}
        </div>
        <div style={kpiHint}>solo lo vigente · {year}</div>
      </div>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-brand)' }}>
        <div style={kpiLabel}>Gastos vigentes</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-ink)' }}>{vigentes}</div>
        <div style={kpiHint}>{vigentes === 1 ? 'activo' : 'activos'}</div>
      </div>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-gold)' }}>
        <div style={kpiLabel}>Sin importe todavía</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-ink)' }}>{sinImporte}</div>
        <div style={kpiHint}>{sinImporte === 0 ? 'todos con importe' : 'no se proyectan'}</div>
      </div>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-ink-4)' }}>
        <div style={kpiLabel}>El mes más cargado</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-ink)', textTransform: 'capitalize' }}>
          {mesMasCargado ? nombreMes(mesMasCargado.month0) : '—'}
        </div>
        <div style={kpiHint}>
          {mesMasCargado ? formatEur(-Math.abs(mesMasCargado.total)) : 'sin cargos'}
        </div>
      </div>
    </div>
  );
};

const strip: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 14,
  marginBottom: 22,
};
const kpiCard: React.CSSProperties = {
  padding: '14px 18px',
  background: 'var(--atlas-v5-card)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 10,
  minWidth: 0,
};
const kpiLabel: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 6,
};
const kpiValue: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.025em',
  lineHeight: 1.05,
};
const kpiHint: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-3)',
  marginTop: 4,
};

export default KpiStrip;
