import React from 'react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import { computeMonthly } from '../../../utils/compromisoUtils';
import {
  aplicarVariacion,
  calcularImporte,
} from '../../../../../services/personal/patronCalendario';
import { formatEur } from '../utils/amountFormatter';
import { formatPattern } from '../utils/patternFormatter';

interface KpiStripProps {
  compromisos: CompromisoRecurrente[];
}

const MESES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_SHORT[d.getMonth()] ?? ''}`;
}

const KpiStrip: React.FC<KpiStripProps> = ({ compromisos }) => {
  const activos = compromisos.filter((c) => c.estado === 'activo');
  const mensual = activos.reduce((s, c) => s + computeMonthly(c), 0);
  const anual = mensual * 12;

  let nextDate: Date | null = null;
  let nextAlias: string | null = null;
  let nextAmount: number | null = null;
  let nearestMs = Infinity;

  for (const c of activos) {
    const fp = formatPattern(c.patron, c.fechaInicio);
    if (fp.nextDate) {
      const ms = fp.nextDate.getTime() - Date.now();
      if (ms >= -86_400_000 && ms < nearestMs) {
        nearestMs = ms;
        nextDate = fp.nextDate;
        nextAlias = c.alias;
        // Importe REAL del próximo evento (NO mensual prorrateado).
        try {
          const base = calcularImporte(c.importe, fp.nextDate);
          const conVariacion = aplicarVariacion(
            base,
            c.variacion,
            new Date(c.fechaInicio),
            fp.nextDate,
          );
          nextAmount = -Math.abs(conVariacion);
        } catch {
          nextAmount = -Math.abs(computeMonthly(c));
        }
      }
    }
  }

  return (
    <div style={strip}>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-neg)' }}>
        <div style={kpiLabel}>Coste mensual estimado</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-neg)' }}>
          {formatEur(-Math.abs(mensual))}
        </div>
        <div style={kpiHint}>
          {activos.length} {activos.length === 1 ? 'patrón activo' : 'patrones activos'}
        </div>
      </div>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-brand)' }}>
        <div style={kpiLabel}>Coste anual previsto</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-ink)' }}>
          {formatEur(-Math.abs(anual))}
        </div>
        <div style={kpiHint}>proyectado a 12 meses</div>
      </div>
      <div style={{ ...kpiCard, borderTop: '3px solid var(--atlas-v5-gold)' }}>
        <div style={kpiLabel}>Próximo cargo</div>
        <div style={{ ...kpiValue, color: 'var(--atlas-v5-ink)' }}>
          {nextDate ? formatDateShort(nextDate) : '—'}
        </div>
        <div style={kpiHint}>
          {nextAlias && nextAmount != null
            ? `${nextAlias} · ${formatEur(nextAmount)}`
            : 'sin próximos cargos'}
        </div>
      </div>
    </div>
  );
};

const strip: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
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
