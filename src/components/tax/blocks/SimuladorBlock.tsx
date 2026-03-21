import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { n } from '../../../store/taxSlice';

interface Props {
  readOnly?: boolean;
}

const SimuladorBlock: React.FC<Props> = ({ readOnly = false }) => {
  const tax = useSelector((s: RootState) => s.tax);
  const [extraPP, setExtraPP] = useState(0);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const tipoMarginal = tax.baseLiquidableGeneral > 60000 ? 0.37
    : tax.baseLiquidableGeneral > 35200 ? 0.30
      : 0.24;

  const maxPP = Math.min(8000, tax.baseLiquidableGeneral * 0.10);
  const ppEfectivo = Math.min(extraPP, Math.max(0, maxPP));
  const ahorroPP = ppEfectivo * tipoMarginal;
  const cuotaSimulada = n(tax.cuotaDiferencial) - ahorroPP;

  return (
    <div className="block-root">
      <h3 className="block-title">Simulador fiscal</h3>
      <p style={{ color: 'var(--n-500)', marginBottom: 24, fontSize: '0.875rem' }}>
        Calcula el impacto de decisiones fiscales sobre tu cuota diferencial.
      </p>

      <div className="block-section" style={{ maxWidth: 520 }}>
        <h4 className="block-section-title">Aportación extra al plan de pensiones</h4>
        <div className="field-row">
          <label className="field-label">Importe adicional (€/año)</label>
          <input
            className="field-input"
            type="number"
            step="100"
            value={extraPP === 0 ? '' : extraPP}
            placeholder="0"
            onChange={readOnly ? undefined : (e) => setExtraPP(Number(e.target.value) || 0)}
            readOnly={readOnly}
          />
          <span className="field-unit">€</span>
        </div>
        <p className="field-hint">Límite disponible: {fmt(maxPP)} € · Tipo marginal estimado: {(tipoMarginal * 100).toFixed(0)}%</p>

        <div className="block-results" style={{ marginTop: 16 }}>
          <div className="calc-row">
            <span className="calc-label">Cuota diferencial actual</span>
            <span className={`calc-value ${n(tax.cuotaDiferencial) > 0 ? 'color-neg' : 'color-pos'}`}>
              {fmt(n(tax.cuotaDiferencial))} €
            </span>
          </div>
          {extraPP > 0 && (
            <>
              <div className="calc-row">
                <span className="calc-label">Ahorro fiscal estimado</span>
                <span className="calc-value color-pos">−{fmt(ahorroPP)} €</span>
              </div>
              <div className="calc-row calc-row--bold">
                <span className="calc-label">Cuota diferencial resultante</span>
                <span className={`calc-value ${cuotaSimulada > 0 ? 'color-neg' : 'color-pos'}`}>
                  {fmt(cuotaSimulada)} €
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimuladorBlock;
