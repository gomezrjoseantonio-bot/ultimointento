import React from 'react';
import type { InmuebleSupervision } from '../hooks/useSupervisionData';

interface EvoBarListProps {
  inmuebles: InmuebleSupervision[];
}

const COLORS = [
  'var(--navy-900)',
  'var(--teal-600)',
  'var(--grey-500)',
  'var(--navy-600)',
  'var(--grey-700)',
  'var(--navy-800)',
];

const fmt = (n: number): string =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

const EvoBarList: React.FC<EvoBarListProps> = ({ inmuebles }) => {
  if (inmuebles.length === 0) return null;

  const maxVal = Math.max(...inmuebles.map((i) => i.valorActual), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {inmuebles.map((inm, idx) => {
        const pct = (inm.valorActual / maxVal) * 100;
        const revPct = inm.costeAdquisicion > 0
          ? ((inm.valorActual - inm.costeAdquisicion) / inm.costeAdquisicion * 100)
          : 0;
        const color = COLORS[idx % COLORS.length];

        return (
          <div key={inm.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* Inversión total */}
            <span style={{
              fontSize: 'var(--t-sm)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--grey-500)',
              minWidth: 80,
              textAlign: 'right',
              flexShrink: 0,
            }}>
              {fmt(inm.inversionTotal)}
            </span>

            {/* Bar container */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--t-sm)',
                fontWeight: 500,
                color: 'var(--grey-900)',
                marginBottom: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {inm.alias}
              </div>
              <div style={{
                height: 22,
                borderRadius: 'var(--r-sm)',
                background: 'var(--grey-100)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(pct, 8)}%`,
                  background: color,
                  borderRadius: 'var(--r-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 8,
                  transition: 'width 400ms ease',
                }}>
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'var(--white)',
                    whiteSpace: 'nowrap',
                  }}>
                    {revPct >= 0 ? '+' : ''}{revPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Valor actual */}
            <span style={{
              fontSize: 'var(--t-sm)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--grey-900)',
              minWidth: 80,
              textAlign: 'right',
              flexShrink: 0,
            }}>
              {fmt(inm.valorActual)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default EvoBarList;
