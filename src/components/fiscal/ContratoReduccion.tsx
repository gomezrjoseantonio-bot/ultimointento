import React from 'react';

interface ContratoReduccionProps {
  habitacion?: string;
  tipo: 'Larga estancia' | 'Temporada' | 'Turístico';
  fecha?: string;
  reduccion: 0 | 50 | 60 | 70 | 90;
  reduccionImporte: number;
}

const fmt = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ContratoReduccion: React.FC<ContratoReduccionProps> = ({
  habitacion,
  tipo,
  fecha,
  reduccion,
  reduccionImporte,
}) => {
  const parts: string[] = [];
  if (habitacion) parts.push(habitacion);
  parts.push(tipo);
  if (fecha) parts.push(`(${fecha})`);
  parts.push(`${reduccion}%`);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '3px 0',
      fontSize: 'var(--t-xs, 12px)',
      color: 'var(--n-700)',
    }}>
      <span>{parts.join(' · ')}</span>
      <span style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontVariantNumeric: 'tabular-nums',
        color: reduccionImporte < 0 ? 'var(--s-pos)' : 'var(--n-700)',
      }}>
        {reduccionImporte !== 0 ? `${reduccionImporte < 0 ? '-' : ''}${fmt(Math.abs(reduccionImporte))} €` : '—'}
      </span>
    </div>
  );
};

export default ContratoReduccion;
