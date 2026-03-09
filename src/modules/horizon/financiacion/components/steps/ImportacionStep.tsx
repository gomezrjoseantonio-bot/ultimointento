import React, { useState } from 'react';
import { PrestamoFinanciacion } from '../../../../../types/financiacion';

interface ImportacionStepProps {
  data: Partial<PrestamoFinanciacion>;
  onChange: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: Record<string, string>;
}

type ImportMode = 'CAPITAL_VIVO' | 'CUOTAS_PAGADAS' | 'FECHA_ULTIMA_CUOTA';

const AVG_DAYS_PER_MONTH = 30.44;

const cardStyle = (active: boolean): React.CSSProperties => ({
  border: `2px solid ${active ? 'var(--atlas-blue)' : '#ddd'}`,
  borderRadius: 8,
  padding: '12px 16px',
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box' as const,
  backgroundColor: 'var(--bg)',
  color: 'var(--atlas-navy-1)',
  fontVariantNumeric: 'tabular-nums',
};

const ImportacionStep: React.FC<ImportacionStepProps> = ({ data, onChange, errors }) => {
  const [mode, setMode] = useState<ImportMode>('CAPITAL_VIVO');
  const [capitalVivo, setCapitalVivo] = useState('');
  const [cuotasPagadas, setCuotasPagadas] = useState('');
  const [fechaUltimaCuota, setFechaUltimaCuota] = useState('');

  // Derived calculations
  const plazoMeses =
    data.plazoPeriodo === 'AÑOS'
      ? (data.plazoTotal || 0) * 12
      : data.plazoTotal || 0;

  const cuotasPagadasCalc =
    mode === 'CAPITAL_VIVO' && capitalVivo && data.capitalInicial
      ? Math.round(((data.capitalInicial - parseFloat(capitalVivo)) / data.capitalInicial) * plazoMeses)
      : mode === 'CUOTAS_PAGADAS'
      ? parseInt(cuotasPagadas, 10) || 0
      : mode === 'FECHA_ULTIMA_CUOTA' && fechaUltimaCuota && data.fechaPrimerCargo
      ? Math.round(
          (new Date(fechaUltimaCuota).getTime() - new Date(data.fechaPrimerCargo).getTime()) /
            (1000 * 60 * 60 * 24 * AVG_DAYS_PER_MONTH)
        )
      : null;

  const capitalVivoCalc =
    mode === 'CAPITAL_VIVO'
      ? parseFloat(capitalVivo) || null
      : mode === 'CUOTAS_PAGADAS' && cuotasPagadas && data.capitalInicial && plazoMeses
      ? data.capitalInicial * (1 - parseInt(cuotasPagadas, 10) / plazoMeses)
      : null;

  const handleModeChange = (m: ImportMode) => {
    setMode(m);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 13, color: 'var(--text-gray)', padding: '10px 14px', backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: 8, border: '1px solid rgba(255,193,7,0.3)' }}>
        Este paso es necesario cuando el préstamo ya está en curso. Indica el punto de partida para el cálculo.
      </div>

      {/* Mode selector */}
      <div>
        <label style={labelStyle}>Modo de importación</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={cardStyle(mode === 'CAPITAL_VIVO')} onClick={() => handleModeChange('CAPITAL_VIVO')}>
            Capital vivo actual
          </button>
          <button style={cardStyle(mode === 'CUOTAS_PAGADAS')} onClick={() => handleModeChange('CUOTAS_PAGADAS')}>
            Nº cuotas pagadas
          </button>
          <button style={cardStyle(mode === 'FECHA_ULTIMA_CUOTA')} onClick={() => handleModeChange('FECHA_ULTIMA_CUOTA')}>
            Fecha última cuota
          </button>
        </div>
      </div>

      {/* Input based on mode */}
      {mode === 'CAPITAL_VIVO' && (
        <div>
          <label style={labelStyle}>Capital vivo actual (€)</label>
          <input
            type="number"
            style={inputStyle}
            placeholder="Ej. 180.000"
            value={capitalVivo}
            onChange={e => setCapitalVivo(e.target.value)}
          />
        </div>
      )}

      {mode === 'CUOTAS_PAGADAS' && (
        <div>
          <label style={labelStyle}>Número de cuotas ya pagadas</label>
          <input
            type="number"
            style={inputStyle}
            placeholder="Ej. 24"
            min={0}
            value={cuotasPagadas}
            onChange={e => setCuotasPagadas(e.target.value)}
          />
        </div>
      )}

      {mode === 'FECHA_ULTIMA_CUOTA' && (
        <div>
          <label style={labelStyle}>Fecha de la última cuota pagada</label>
          <input
            type="date"
            style={inputStyle}
            value={fechaUltimaCuota}
            onChange={e => {
              setFechaUltimaCuota(e.target.value);
            }}
          />
        </div>
      )}

      {/* Calculated results */}
      {(cuotasPagadasCalc !== null || capitalVivoCalc !== null) && (
        <div style={{ padding: '12px 14px', backgroundColor: 'rgba(40,167,69,0.08)', border: '1px solid rgba(40,167,69,0.2)', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--ok)' }}>Resultado calculado</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            {cuotasPagadasCalc !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-gray)' }}>Cuotas pagadas estimadas:</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cuotasPagadasCalc}</span>
              </div>
            )}
            {capitalVivoCalc !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-gray)' }}>Capital vivo estimado:</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {capitalVivoCalc.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
            )}
            {plazoMeses > 0 && cuotasPagadasCalc !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-gray)' }}>Cuotas restantes:</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{plazoMeses - cuotasPagadasCalc}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportacionStep;
