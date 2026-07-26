// Tira superior §3.1 · cuatro cifras sobre fondo navy con borde superior de oro:
// coste anual de gastos (valor en oro) · gastos vigentes · sin importe todavía
// (valor en ámbar) · el mes más cargado. Todo desde el cálculo canónico (misma
// cifra que Tesorería). Un coste 0 se pinta «—», nunca «-0 €».

import React from 'react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import { formatEur } from '../utils/amountFormatter';
import { computeTiraMetrics, nombreMes } from '../utils/tiraMetrics';

interface KpiStripProps {
  compromisos: CompromisoRecurrente[];
}

const KpiStrip: React.FC<KpiStripProps> = ({ compromisos }) => {
  const year = new Date().getFullYear();
  const { costeAnual, vigentes, sinImporte, mesMasCargado } = computeTiraMetrics(compromisos, year);
  const mediaMes = costeAnual > 0 ? costeAnual / 12 : 0;

  return (
    <div style={tira}>
      <div style={tc}>
        <div style={tl}>Coste anual de gastos</div>
        <div style={{ ...tv, color: 'var(--atlas-v5-gold-soft)' }}>
          {costeAnual > 0 ? formatEur(-Math.abs(costeAnual)) : '—'}
        </div>
        <div style={tn}>{mediaMes > 0 ? `${formatEur(mediaMes)} al mes de media` : 'sin cargos aún'}</div>
      </div>
      <div style={tc}>
        <div style={tl}>Gastos vigentes</div>
        <div style={tv}>{vigentes}</div>
        <div style={tn}>{vigentes === 1 ? 'activo' : 'activos'}</div>
      </div>
      <div style={tc}>
        <div style={tl}>Sin importe todavía</div>
        <div style={{ ...tv, color: 'var(--atlas-v5-gold-bright)' }}>{sinImporte}</div>
        <div style={tn}>{sinImporte === 0 ? 'todos con importe' : 'no se proyecta hasta que lo pongas'}</div>
      </div>
      <div style={{ ...tc, borderRight: 'none' }}>
        <div style={tl}>El mes más cargado</div>
        <div style={{ ...tv, textTransform: 'capitalize' }}>
          {mesMasCargado ? nombreMes(mesMasCargado.month0) : '—'}
        </div>
        <div style={tn}>
          {mesMasCargado ? formatEur(-Math.abs(mesMasCargado.total)) : 'sin cargos'}
        </div>
      </div>
    </div>
  );
};

const tira: React.CSSProperties = {
  background: 'var(--atlas-v5-brand)',
  borderTop: '3px solid var(--atlas-v5-gold)',
  borderRadius: 12,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  overflow: 'hidden',
  marginBottom: 12,
};
const tc: React.CSSProperties = {
  padding: '15px 18px',
  borderRight: '1px solid var(--atlas-v5-brand-2)',
  minWidth: 0,
};
const tl: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 600,
  color: 'var(--atlas-v5-on-navy-5)',
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
};
const tv: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 23,
  fontWeight: 700,
  color: 'var(--atlas-v5-on-navy-1)',
  marginTop: 7,
  letterSpacing: '-0.02em',
  lineHeight: 1.05,
};
const tn: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--atlas-v5-on-navy-4)',
  marginTop: 5,
  lineHeight: 1.45,
};

export default KpiStrip;
