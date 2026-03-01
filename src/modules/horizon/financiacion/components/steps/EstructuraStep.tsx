import React from 'react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';

interface EstructuraStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

const cardStyle = (active: boolean): React.CSSProperties => ({
  border: `2px solid ${active ? 'var(--atlas-blue)' : '#ddd'}`,
  borderRadius: 8,
  padding: '10px 14px',
  cursor: 'pointer',
  backgroundColor: active ? 'rgba(4,44,94,0.1)' : 'var(--bg)',
  color: active ? 'var(--atlas-blue)' : 'var(--text-gray)',
  fontWeight: active ? 600 : 400,
  fontSize: 13,
  flex: 1,
  textAlign: 'center' as const,
  transition: 'all 150ms ease',
});

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--text-gray)',
  marginBottom: 4,
  fontWeight: 500,
};

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '8px 10px',
  border: `1px solid ${hasError ? 'var(--error)' : '#ddd'}`,
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box' as const,
  backgroundColor: 'var(--bg)',
  color: 'var(--atlas-navy-1)',
  fontVariantNumeric: 'tabular-nums',
});

const EstructuraStep: React.FC<EstructuraStepProps> = ({ data, onChange, errors }) => {
  const carenciaOptions = [
    { id: 'NINGUNA', label: 'Ninguna' },
    { id: 'CAPITAL', label: 'Capital' },
    { id: 'TOTAL', label: 'Total' },
  ] as const;

  const tipoOptions = [
    { id: 'FIJO', label: 'Fijo' },
    { id: 'VARIABLE', label: 'Variable' },
    { id: 'MIXTO', label: 'Mixto' },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Capital inicial */}
      <div>
        <label style={labelStyle}>Capital inicial</label>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            style={{ ...inputStyle(!!errors.capitalInicial), paddingRight: 30 }}
            placeholder="0"
            min={0}
            value={data.capitalInicial ?? ''}
            onChange={e => onChange({ capitalInicial: parseFloat(e.target.value) || 0 })}
          />
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-gray)', fontSize: 14 }}>€</span>
        </div>
        {errors.capitalInicial && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.capitalInicial}</div>}
      </div>

      {/* Plazo */}
      <div>
        <label style={labelStyle}>Plazo total</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            style={{ ...inputStyle(!!errors.plazoTotal), flex: 1 }}
            placeholder="25"
            min={1}
            value={data.plazoTotal ?? ''}
            onChange={e => onChange({ plazoTotal: parseInt(e.target.value, 10) || 0 })}
          />
          <select
            style={{ ...inputStyle(), width: 120, flex: 'none' }}
            value={data.plazoPeriodo || 'AÑOS'}
            onChange={e => onChange({ plazoPeriodo: e.target.value as 'MESES' | 'AÑOS' })}
          >
            <option value="AÑOS">Años</option>
            <option value="MESES">Meses</option>
          </select>
        </div>
        {errors.plazoTotal && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.plazoTotal}</div>}
      </div>

      {/* Carencia */}
      <div>
        <label style={labelStyle}>Carencia</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {carenciaOptions.map(opt => (
            <button
              key={opt.id}
              style={cardStyle((data.carencia ?? 'NINGUNA') === opt.id)}
              onClick={() => onChange({ carencia: opt.id, carenciaMeses: opt.id === 'NINGUNA' ? undefined : (data.carenciaMeses || 6) })}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {data.carencia && data.carencia !== 'NINGUNA' && (
          <div>
            <label style={labelStyle}>Meses de carencia</label>
            <input
              type="number"
              style={inputStyle()}
              min={1}
              max={60}
              value={data.carenciaMeses ?? ''}
              onChange={e => onChange({ carenciaMeses: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
        )}
      </div>

      {/* Tipo interés */}
      <div>
        <label style={labelStyle}>Tipo de interés</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {tipoOptions.map(opt => (
            <button
              key={opt.id}
              style={cardStyle(data.tipo === opt.id)}
              onClick={() => onChange({ tipo: opt.id })}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {errors.tipo && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.tipo}</div>}
      </div>
    </div>
  );
};

export default EstructuraStep;
