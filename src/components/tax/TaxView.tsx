import React, { useMemo, useReducer, useState } from 'react';
import { ChevronRight, Info, Plus } from 'lucide-react';
import taxReducer, {
  addGanancia,
  addInmueble,
  CapitalMobiliario,
  GananciaPatrimonial,
  Inmueble,
  setEjercicio,
  TaxState,
  updateActividadField,
  updateCapitalMobiliarioField,
  removeGanancia,
  updateGananciaField,
  updateInmuebleField,
  updateWorkIncomeField,
  WorkIncome,
} from '../../store/taxSlice';
import WorkIncomeBlock from './blocks/WorkIncomeBlock';
import RealEstateBlock from './blocks/RealEstateBlock';
import BusinessBlock from './blocks/BusinessBlock';
import SavingsBlock from './blocks/SavingsBlock';
import PatrimGainsBlock from './blocks/PatrimGainsBlock';
import ResultBlock from './blocks/ResultBlock';
import './tax-view.css';

const tabs = ['Resumen', 'Trabajo', 'Inmuebles', 'Actividad', 'Ahorro y G/P', 'Resultado'] as const;
type Tab = (typeof tabs)[number];

const formatCurrency = (value: number): string => value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TaxView: React.FC = () => {
  const [state, dispatch] = useReducer(taxReducer, undefined, () => taxReducer(undefined, { type: '@@INIT' }));
  const [tab, setTab] = useState<Tab>('Resumen');

  const tipoMedioEfectivo = useMemo(() => {
    if (state.baseLiquidableGeneral <= 0) return 0;
    return (state.cuotaLiquida / state.baseLiquidableGeneral) * 100;
  }, [state.baseLiquidableGeneral, state.cuotaLiquida]);

  const addDefaultInmueble = () => {
    const draft: Inmueble = {
      id: `inmueble-${Date.now()}`,
      refCatastral: '', direccion: 'Nuevo inmueble', situacion: 1, urbana: true, pctPropiedad: 100, tipo: 'arrendado',
      fechaAdquisicion: '', importeAdquisicion: 0, gastosTributos: 0, mejoras2024: 0, valorCatastral: 0, valorCatastralConstruccion: 0, pctConstruccion: 0, baseAmortizacion: 0,
      amortizacionInmueble: 0, amortizacionBienesMuebles: 0, diasDisposicion: 0, diasArrendados: 0, ingresosIntegros: 0, interesesFinanciacion: 0, gastosReparacionConservacion: 0,
      limiteInteresesReparacion: 0, gastosReparacionNoDeducibles: 0, gastosComunidad: 0, serviciosPersonales: 0, serviciosSuministros: 0, seguro: 0, tributosRecargos: 0,
      gastosPendientesAnteriores: [], gastosArrastreAplicados: 0, gastosDeduciblesProximos4Anios: 0, rentaImputada: 0, tieneReduccionVivienda: false, pctReduccion: 50, reduccionAplicada: 0,
      rendimientoNeto: 0, rendimientoNetoReducido: 0,
    };
    dispatch(addInmueble(draft));
  };

  const addDefaultGanancia = () => {
    const op: GananciaPatrimonial = {
      id: `gp-${Date.now()}`,
      tipo: 'transmision_fondos',
      base: 'ahorro',
      descripcion: '',
      valorTransmision: 0,
      valorAdquisicion: 0,
      resultado: 0,
    };
    dispatch(addGanancia(op));
  };

  return (
    <div className="tax-view">
      <header className="tax-topbar">
        <h2>Módulo fiscalidad</h2>
        <div className="tax-topbar__right">
          <label>Año fiscal</label>
          <select value={state.ejercicio} onChange={(e) => dispatch(setEjercicio(Number(e.target.value)))}>
            {[state.ejercicio, state.ejercicio - 1, state.ejercicio - 2].map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </header>

      <nav className="tax-tabs">{tabs.map((item) => <button key={item} className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>

      {tab === 'Resumen' && (
        <section className="tax-stack">
          <article className="tax-hero">
            <div className="tax-hero__eyebrow">IRPF estimado · Ejercicio {state.ejercicio}</div>
            <div className="tax-hero__value">{state.cuotaDiferencial >= 0 ? '+' : ''}{formatCurrency(state.cuotaDiferencial)} €</div>
            <span className={`tax-hero__badge ${state.cuotaDiferencial >= 0 ? 'is-neg' : 'is-pos'}`}>{state.cuotaDiferencial >= 0 ? 'A ingresar' : 'A devolver'}</span>
          </article>
          <div className="tax-kpis">
            <div><label>Base liquidable general</label><strong>{formatCurrency(state.baseLiquidableGeneral)} €</strong></div>
            <div><label>Base liquidable del ahorro</label><strong>{formatCurrency(state.baseLiquidableAhorro)} €</strong></div>
            <div><label>Tipo medio efectivo</label><strong>{tipoMedioEfectivo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong></div>
            <div><label>Total retenciones</label><strong className="pos">{formatCurrency(state.totalRetenciones)} €</strong></div>
          </div>
          <div className="tax-section-card">
            <h3>Desglose de fuentes de renta</h3>
            <div className="tax-breakdown-row"><span>Trabajo</span><span className="mono">{formatCurrency(state.baseImponibleGeneral)} €</span><ChevronRight size={14} /></div>
            <div className="tax-breakdown-row"><span>Inmuebles</span><span className="mono">{formatCurrency(state.inmuebles.reduce((a, i) => a + i.rendimientoNetoReducido, 0))} €</span><ChevronRight size={14} /></div>
            <div className="tax-breakdown-row"><span>Actividad</span><span className="mono">{formatCurrency(state.actividades.reduce((a, i) => a + i.rendimientoNeto, 0))} €</span><ChevronRight size={14} /></div>
            <div className="tax-breakdown-row"><span>Ahorro</span><span className="mono">{formatCurrency(state.baseLiquidableAhorro)} €</span><ChevronRight size={14} /></div>
          </div>
        </section>
      )}

      {tab === 'Trabajo' && <WorkIncomeBlock data={state.workIncome} onChange={(field, value) => dispatch(updateWorkIncomeField({ field: field as keyof WorkIncome, value }))} />}
      {tab === 'Inmuebles' && <RealEstateBlock inmuebles={state.inmuebles} onUpdate={(id, field, value) => dispatch(updateInmuebleField({ id, field: field as keyof Inmueble, value }))} onAdd={addDefaultInmueble} />}
      {tab === 'Actividad' && <BusinessBlock actividad={state.actividades[0]} onChange={(field, value) => dispatch(updateActividadField({ id: state.actividades[0].id, field, value }))} />}
      {tab === 'Ahorro y G/P' && (
        <div className="tax-stack">
          <SavingsBlock data={state.capitalMobiliario} onChange={(field, value) => dispatch(updateCapitalMobiliarioField({ field: field as keyof CapitalMobiliario, value }))} />
          <PatrimGainsBlock ganancias={state.gananciasPatrimoniales} saldos={state.saldosNegativosBIA} onUpdateGanancia={(id, field, value) => dispatch(updateGananciaField({ id, field, value }))} onAdd={addDefaultGanancia} onRemove={(id) => dispatch(removeGanancia(id))} />
        </div>
      )}
      {tab === 'Resultado' && <ResultBlock state={state as TaxState} />}

      <footer className="tax-footnote"><Info size={14} />Sin campos de notas ni texto libre adicional en el modelo.</footer>
    </div>
  );
};

export default TaxView;
