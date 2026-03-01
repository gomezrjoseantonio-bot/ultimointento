import React from 'react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';

interface ConfiguracionStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

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

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--atlas-navy-1)',
  marginBottom: 12,
  paddingBottom: 6,
  borderBottom: '1px solid #eee',
};

const ConfiguracionStep: React.FC<ConfiguracionStepProps> = ({ data, onChange, errors }) => {
  const tipo = data.tipo || 'FIJO';

  const tinEfectivo =
    tipo === 'VARIABLE' && data.valorIndice !== undefined && data.diferencial !== undefined
      ? data.valorIndice + data.diferencial
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Rate section */}
      <div>
        <div style={sectionTitle}>
          {tipo === 'FIJO' && 'Tasa fija'}
          {tipo === 'VARIABLE' && 'Tasa variable'}
          {tipo === 'MIXTO' && 'Tasa mixta'}
        </div>

        {tipo === 'FIJO' && (
          <div>
            <label style={labelStyle}>TIN fijo (%)</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle(!!errors.tinFijo)}
              placeholder="3.45"
              value={data.tinFijo ?? ''}
              onChange={e => onChange({ tinFijo: parseFloat(e.target.value) || 0 })}
            />
            {errors.tinFijo && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.tinFijo}</div>}
          </div>
        )}

        {tipo === 'VARIABLE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Índice de referencia</label>
                <select
                  style={inputStyle()}
                  value={data.indice || 'EURIBOR'}
                  onChange={e => onChange({ indice: e.target.value as 'EURIBOR' | 'OTRO' })}
                >
                  <option value="EURIBOR">Euríbor</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Valor actual índice (%)</label>
                <input
                  type="number"
                  step="0.001"
                  style={inputStyle()}
                  placeholder="3.500"
                  value={data.valorIndice ?? ''}
                  onChange={e => onChange({ valorIndice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={labelStyle}>Diferencial (%)</label>
                <input
                  type="number"
                  step="0.01"
                  style={inputStyle(!!errors.diferencial)}
                  placeholder="0.75"
                  value={data.diferencial ?? ''}
                  onChange={e => onChange({ diferencial: parseFloat(e.target.value) || 0 })}
                />
                {errors.diferencial && <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.diferencial}</div>}
              </div>
              <div>
                <label style={labelStyle}>Revisión</label>
                <select
                  style={inputStyle()}
                  value={data.revision || 12}
                  onChange={e => onChange({ revision: parseInt(e.target.value, 10) as 6 | 12 })}
                >
                  <option value={6}>Semestral (6 meses)</option>
                  <option value={12}>Anual (12 meses)</option>
                </select>
              </div>
            </div>
            {tinEfectivo !== null && (
              <div style={{ padding: '8px 12px', backgroundColor: 'rgba(4,44,94,0.1)', borderRadius: 6, fontSize: 13, color: 'var(--atlas-blue)' }}>
                TIN calculado: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{tinEfectivo.toFixed(3)} %</strong>
              </div>
            )}
          </div>
        )}

        {tipo === 'MIXTO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Duración tramo fijo (años)</label>
                <input
                  type="number"
                  style={inputStyle()}
                  min={1}
                  value={data.tramoFijoAnos ?? ''}
                  onChange={e => onChange({ tramoFijoAnos: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div>
                <label style={labelStyle}>TIN tramo fijo (%)</label>
                <input
                  type="number"
                  step="0.01"
                  style={inputStyle()}
                  placeholder="2.50"
                  value={data.tinTramoFijo ?? ''}
                  onChange={e => onChange({ tinTramoFijo: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={labelStyle}>Índice tramo variable</label>
                <select
                  style={inputStyle()}
                  value={data.indice || 'EURIBOR'}
                  onChange={e => onChange({ indice: e.target.value as 'EURIBOR' | 'OTRO' })}
                >
                  <option value="EURIBOR">Euríbor</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Diferencial variable (%)</label>
                <input
                  type="number"
                  step="0.01"
                  style={inputStyle()}
                  placeholder="0.75"
                  value={data.diferencial ?? ''}
                  onChange={e => onChange({ diferencial: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={labelStyle}>Revisión</label>
                <select
                  style={inputStyle()}
                  value={data.revision || 12}
                  onChange={e => onChange({ revision: parseInt(e.target.value, 10) as 6 | 12 })}
                >
                  <option value={6}>Semestral (6 meses)</option>
                  <option value={12}>Anual (12 meses)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Commissions */}
      <div>
        <div style={sectionTitle}>Comisiones</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Comisión apertura (%)</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle()}
              placeholder="0"
              value={data.comisionApertura !== undefined ? (data.comisionApertura * 100).toFixed(2) : ''}
              onChange={e => onChange({ comisionApertura: parseFloat(e.target.value) / 100 || 0 })}
            />
          </div>
          <div>
            <label style={labelStyle}>Comisión mantenimiento (€/mes)</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle()}
              placeholder="0"
              value={data.comisionMantenimiento ?? ''}
              onChange={e => onChange({ comisionMantenimiento: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label style={labelStyle}>Amort. anticipada (%)</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle()}
              placeholder="0"
              value={data.comisionAmortizacionAnticipada !== undefined ? (data.comisionAmortizacionAnticipada * 100).toFixed(2) : ''}
              onChange={e => onChange({ comisionAmortizacionAnticipada: parseFloat(e.target.value) / 100 || 0 })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionStep;
