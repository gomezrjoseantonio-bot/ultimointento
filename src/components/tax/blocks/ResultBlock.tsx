import React from 'react';
import { TaxState } from '../../../store/taxSlice';

interface ResultBlockProps { state: TaxState }

const ResultBlock: React.FC<ResultBlockProps> = ({ state }) => (
  <section className="tax-section-card">
    <h3>Resultado</h3>
    <div className="tax-result-list">
      <div><span>Base imponible general</span><span className="mono">{state.baseImponibleGeneral.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
      <div><span>(−) Reducción PP</span><span className="mono">−{state.previsionSocial.importeAplicado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
      <div><span>Base liquidable general</span><span className="mono">{state.baseLiquidableGeneral.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
      <div><span>Base imponible del ahorro</span><span className="mono">{state.baseImponibleAhorro.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
      <div><span>Base liquidable del ahorro</span><span className="mono">{state.baseLiquidableAhorro.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
      <div><span>Cuota líquida</span><span className="mono">{state.cuotaLiquida.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
      <div><span>(−) Retenciones</span><span className="mono">−{state.totalRetenciones.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
      <div className="tax-result-final"><span>Cuota diferencial</span><span className={`mono ${state.cuotaDiferencial >= 0 ? 'neg' : 'pos'}`}>{state.cuotaDiferencial >= 0 ? '+' : ''}{state.cuotaDiferencial.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span></div>
    </div>
    <p className="tax-note">Este cálculo es una estimación basada en los datos introducidos. Para la declaración oficial usa el programa Renta Web de la AEAT.</p>
  </section>
);

export default ResultBlock;
