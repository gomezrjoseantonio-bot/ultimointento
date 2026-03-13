import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import WorkIncomeBlock from './blocks/WorkIncomeBlock';
import RealEstateBlock from './blocks/RealEstateBlock';
import BusinessBlock from './blocks/BusinessBlock';
import SavingsGPBlock from './blocks/SavingsGPBlock';
import ResultBlock from './blocks/ResultBlock';
import SimuladorBlock from './blocks/SimuladorBlock';
import DataTraceabilityBlock from './blocks/DataTraceabilityBlock';
import { setEjercicio } from '../../store/taxSlice';
import './tax-view.css';

const TABS = ['Resumen', 'Trabajo', 'Inmuebles', 'Actividad', 'Ahorro y G/P', 'Resultado', 'Simulador', 'Trazabilidad'] as const;
type Tab = typeof TABS[number];

const TaxView: React.FC = () => {
  const dispatch = useDispatch();
  const tax = useSelector((state: RootState) => state.tax);
  const [tab, setTab] = useState<Tab>('Trabajo');

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const isCurrentYear = tax.ejercicio === currentYear;

  return (
    <div className="tv-root">
      {/* HEADER */}
      <div className="tv-header">
        <div>
          <h2 className="tv-title">Declaración IRPF {tax.ejercicio}</h2>
          <p className="tv-subtitle">Modelo 100 — Estimación en tiempo real</p>
        </div>
        <div className="tv-header-right">
          <label className="tv-year-label">Ejercicio</label>
          <select
            className="tv-year-select"
            value={tax.ejercicio}
            onChange={e => dispatch(setEjercicio(Number(e.target.value)))}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>
                {y}{y === currentYear ? ' (en curso · previsión)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isCurrentYear && (
        <div className="tv-forecast-note">
          Ejercicio en curso: la declaración se calcula en modo previsión (budget) y se ajustará con datos reales conciliados.
        </div>
      )}

      {/* RESULTADO RÁPIDO */}
      <div className={`tv-result-banner ${tax.cuotaDiferencial > 0 ? 'banner-pagar' : 'banner-devolver'}`}>
        <span className="tv-result-label">
          {tax.cuotaDiferencial > 0 ? 'A ingresar' : 'A devolver'}
        </span>
        <span className="tv-result-amount">
          {fmt(Math.abs(tax.cuotaDiferencial))} €
        </span>
        <span className="tv-result-meta">
          Base liquidable general: {fmt(tax.baseLiquidableGeneral)} € ·
          Tipo medio: {tax.baseLiquidableGeneral > 0
            ? fmt(tax.cuotaLiquida / tax.baseLiquidableGeneral * 100) : '0,00'}%
        </span>
      </div>

      {/* TABS */}
      <nav className="tv-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`tv-tab ${tab === t ? 'tv-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* CONTENIDO */}
      <div className="tv-content">
        {tab === 'Resumen'     && <ResumenInline tax={tax} fmt={fmt} />}
        {tab === 'Trabajo'     && <WorkIncomeBlock />}
        {tab === 'Inmuebles'   && <RealEstateBlock />}
        {tab === 'Actividad'   && <BusinessBlock />}
        {tab === 'Ahorro y G/P' && <SavingsGPBlock />}
        {tab === 'Resultado'   && <ResultBlock />}
        {tab === 'Simulador'   && <SimuladorBlock />}
        {tab === 'Trazabilidad' && <DataTraceabilityBlock />}
      </div>
    </div>
  );
};

// Resumen inline (sin fichero separado — es simple)
const ResumenInline: React.FC<{ tax: any; fmt: (v: number) => string }> = ({ tax, fmt }) => (
  <div className="tv-resumen">
    <div className="tv-resumen-grid">
      {[
        { label: 'Rendimientos del trabajo', value: tax.baseLiquidableGeneral > 0 ? tax.workIncome.dinerarias : 0, color: 'neutral' },
        { label: 'Rendimientos de inmuebles', value: tax.inmuebles.reduce((a: number, i: any) => a + i.rendimientoNetoReducido, 0), color: 'neutral' },
        { label: 'Actividades económicas', value: tax.actividades.reduce((a: number, act: any) => a + act.rendimientoNeto, 0), color: 'neutral' },
        { label: 'Capital mobiliario', value: tax.capitalMobiliario.interesesCuentasDepositos, color: 'neutral' },
        { label: 'Base imponible general', value: tax.baseImponibleGeneral, color: 'neutral', bold: true },
        { label: 'Reducción previsión social', value: -tax.previsionSocial.importeAplicado, color: 'pos' },
        { label: 'Base liquidable general', value: tax.baseLiquidableGeneral, color: 'neutral', bold: true },
        { label: 'Base liquidable del ahorro', value: tax.baseLiquidableAhorro, color: 'neutral' },
        { label: 'Cuota íntegra', value: tax.cuotaIntegra, color: 'neutral', bold: true },
        { label: 'Total retenciones', value: -tax.totalRetenciones, color: 'pos' },
        { label: 'Cuota diferencial', value: tax.cuotaDiferencial, color: tax.cuotaDiferencial > 0 ? 'neg' : 'pos', bold: true },
      ].map(({ label, value, color, bold }) => (
        <div key={label} className={`tv-resumen-row ${bold ? 'row-bold' : ''}`}>
          <span className="tv-resumen-label">{label}</span>
          <span className={`tv-resumen-value color-${color}`}>{fmt(value)} €</span>
        </div>
      ))}
    </div>
  </div>
);

export default TaxView;
