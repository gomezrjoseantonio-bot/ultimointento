import React from 'react';
import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';
import { computeMonthly } from '../../utils/compromisoUtils';
import { formatEur } from '../utils/amountFormatter';
import { formatPattern } from '../utils/patternFormatter';

interface KpiStripProps {
  compromisos: CompromisoRecurrente[];
}

const MESES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDateShort(d: Date): string {
  return `${d.getDate()} ${MESES_SHORT[d.getMonth()] ?? ''} ${d.getFullYear()}`;
}

const KpiStrip: React.FC<KpiStripProps> = ({ compromisos }) => {
  const mensual = compromisos
    .filter((c) => c.estado === 'activo')
    .reduce((s, c) => s + computeMonthly(c), 0);
  const anual = mensual * 12;

  let nextDate: string | null = null;
  let nextAlias: string | null = null;
  let nearestMs = Infinity;

  for (const c of compromisos) {
    if (c.estado !== 'activo') continue;
    const fp = formatPattern(c.patron, c.fechaInicio);
    if (fp.nextDate) {
      const ms = fp.nextDate.getTime() - Date.now();
      if (ms >= 0 && ms < nearestMs) {
        nearestMs = ms;
        nextDate = formatDateShort(fp.nextDate);
        nextAlias = c.alias;
      }
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-neg)' }}>
        <div style={kpiLabel}>Coste mensual</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-neg)' }}>{formatEur(mensual)}</div>
        <div style={kpiHint}>estimación · compromisos activos</div>
      </div>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-brand)' }}>
        <div style={kpiLabel}>Coste anual</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-brand)' }}>{formatEur(anual)}</div>
        <div style={kpiHint}>×12 coste mensual estimado</div>
      </div>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-gold)' }}>
        <div style={kpiLabel}>Próximo cargo</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-gold)', fontSize: 15 }}>{nextDate ?? '—'}</div>
        <div style={kpiHint}>{nextAlias ?? 'sin próximos cargos'}</div>
      </div>
    </div>
  );
};

const kpiCard: React.CSSProperties = {
  flex: 1,
  padding: '14px 16px',
  background: 'var(--atlas-v5-card)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 10,
  minWidth: 0,
};
const kpiLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 6,
};
const kpiValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  marginBottom: 4,
};
const kpiHint: React.CSSProperties = { fontSize: 11, color: 'var(--atlas-v5-ink-4)' };

export default KpiStrip;
