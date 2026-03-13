import React, { useState } from 'react';
import { TaxState } from '../../../store/taxSlice';

interface Props { state: TaxState; }

const SimuladorBlock: React.FC<Props> = ({ state }) => {
  const [extraPP, setExtraPP] = useState(0);
  const n = (v: unknown) => Number(v) || 0;

  const cuotaBase = n(state?.cuotaDiferencial);
  const ahorroPP = extraPP > 0
    ? Math.min(extraPP, 8000) * 0.37
    : 0;

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ padding: 24, fontFamily: 'var(--font)' }}>
      <h3 style={{ color: 'var(--n-900)', marginBottom: 4 }}>Simulador fiscal</h3>
      <p style={{ color: 'var(--n-500)', fontSize: '0.875rem', marginBottom: 24 }}>
        Simula el impacto de aportaciones adicionales al plan de pensiones.
      </p>

      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--n-300)',
        borderRadius: 12,
        padding: 20,
        maxWidth: 480,
      }}>
        <label style={{ display: 'block', marginBottom: 8, color: 'var(--n-700)', fontSize: '0.875rem' }}>
          Aportación extra al PP (€/año)
        </label>
        <input
          type="number"
          value={extraPP}
          onChange={(e) => setExtraPP(Number(e.target.value) || 0)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--n-300)',
            borderRadius: 8,
            fontFamily: 'var(--mono)',
            fontSize: '1rem',
            color: 'var(--n-900)',
            marginBottom: 20,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--n-500)', fontSize: '0.875rem' }}>Cuota diferencial actual</span>
            <span style={{
              fontFamily: 'var(--mono)',
              color: cuotaBase > 0 ? 'var(--s-neg)' : 'var(--s-pos)',
            }}>
              {fmt(cuotaBase)} €
            </span>
          </div>
          {extraPP > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--n-500)', fontSize: '0.875rem' }}>Ahorro estimado con aportación</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--s-pos)' }}>
                  -{fmt(ahorroPP)} €
                </span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--n-100)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--n-900)', fontWeight: 600, fontSize: '0.875rem' }}>
                  Cuota estimada resultante
                </span>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontWeight: 600,
                  color: (cuotaBase - ahorroPP) > 0 ? 'var(--s-neg)' : 'var(--s-pos)',
                }}>
                  {fmt(cuotaBase - ahorroPP)} €
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--n-500)', fontSize: '0.75rem', marginTop: 16 }}>
        * El ahorro estimado es orientativo (tramo marginal 37%). El cálculo exacto depende del total de aportaciones del ejercicio.
      </p>
    </div>
  );
};

export default SimuladorBlock;
