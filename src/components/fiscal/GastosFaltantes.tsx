import React from 'react';
import { Info } from 'lucide-react';

interface GastosFaltantesProps {
  gastos: string[];
}

const GastosFaltantes: React.FC<GastosFaltantesProps> = ({ gastos }) => {
  if (gastos.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {gastos.map((gasto) => (
        <span
          key={gasto}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 'var(--t-xs, 11px)',
            fontWeight: 500,
            background: 'var(--s-warn-bg)',
            color: 'var(--s-warn)',
          }}
        >
          <Info size={10} />
          {gasto}
        </span>
      ))}
    </div>
  );
};

export default GastosFaltantes;
