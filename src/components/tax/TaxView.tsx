import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import WorkIncomeBlock from './blocks/WorkIncomeBlock';
import RealEstateBlock from './blocks/RealEstateBlock';
import BusinessBlock from './blocks/BusinessBlock';
import SavingsGPBlock from './blocks/SavingsGPBlock';
import ResultBlock from './blocks/ResultBlock';
import SimuladorBlock from './blocks/SimuladorBlock';
import DataTraceabilityBlock from './blocks/DataTraceabilityBlock';
import { hydrateFromCalculation, setEjercicio } from '../../store/taxSlice';
import { calcularDeclaracionIRPF } from '../../services/irpfCalculationService';
import { mapDeclaracionToTaxState } from './taxHydrationMapper';
import { ejercicioFiscalService } from '../../services/ejercicioFiscalService';
import type { EjercicioFiscal } from '../../types/fiscal';
import {
  buildFiscalExerciseContext,
  getDeclarationBootstrapCopy,
  summarizeFiscalLifecycle,
} from '../../modules/horizon/fiscalidad/modeloFundacional';
import './tax-view.css';

const TABS = ['Resumen', 'Trabajo', 'Inmuebles', 'Actividad', 'Ahorro y G/P', 'Resultado', 'Simulador', 'Trazabilidad'] as const;
type Tab = typeof TABS[number];

const TaxView: React.FC = () => {
  const dispatch = useDispatch();
  const tax = useSelector((state: RootState) => state.tax);
  const [tab, setTab] = useState<Tab>('Trabajo');
  const [loadingDeclaracion, setLoadingDeclaracion] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [fiscalExercise, setFiscalExercise] = useState<EjercicioFiscal | undefined>(undefined);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const isCurrentYear = tax.ejercicio === currentYear;
  const lifecycle = summarizeFiscalLifecycle(
    buildFiscalExerciseContext(tax.ejercicio, currentYear, fiscalExercise),
  );
  const bootstrapCopy = getDeclarationBootstrapCopy(
    tax.inmuebles.length + tax.actividades.length,
    lifecycle.truthPriority === 'aeat',
  );


  useEffect(() => {
    let cancelled = false;

    const cargarDeclaracion = async () => {
      setLoadingDeclaracion(true);
      setLoadingError(null);

      try {
        const declaracion = await calcularDeclaracionIRPF(tax.ejercicio, { usarConciliacion: true });
        if (cancelled) return;
        const hydrationPayload = await mapDeclaracionToTaxState(declaracion);
        dispatch(hydrateFromCalculation(hydrationPayload));
      } catch {
        if (cancelled) return;
        setLoadingError('No se pudieron cargar los datos fiscales reales para este ejercicio.');
      } finally {
        if (!cancelled) setLoadingDeclaracion(false);
      }
    };

    cargarDeclaracion();

    return () => {
      cancelled = true;
    };
  }, [dispatch, tax.ejercicio]);

  useEffect(() => {
    let cancelled = false;

    const cargarEjercicioFiscal = async () => {
      try {
        const storedExercise = await ejercicioFiscalService.getEjercicio(tax.ejercicio);
        if (!cancelled) {
          setFiscalExercise(storedExercise);
        }
      } catch {
        if (!cancelled) {
          setFiscalExercise(undefined);
        }
      }
    };

    cargarEjercicioFiscal();

    return () => {
      cancelled = true;
    };
  }, [tax.ejercicio]);

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

      {loadingDeclaracion && <div className="tv-sync-note">Cargando datos reales de la declaración…</div>}
      {loadingError && <div className="tv-sync-note tv-sync-note--error">{loadingError}</div>}

      <section className="tv-foundation-card" aria-label="modelo fundacional fiscal">
        <div className="tv-foundation-card__header">
          <div>
            <p className="tv-foundation-card__eyebrow">Modelo fundacional ATLAS</p>
            <h3 className="tv-foundation-card__title">Ejercicio {tax.ejercicio}: {lifecycle.estadoLabel}</h3>
          </div>
          <div className="tv-foundation-pill-group">
            {lifecycle.visibleColumns.map((column) => (
              <span key={column} className="tv-foundation-pill">
                {column}
              </span>
            ))}
          </div>
        </div>

        <p className="tv-foundation-card__copy">{lifecycle.subtitle}</p>

        <div className="tv-foundation-grid">
          <div className="tv-foundation-stat">
            <span className="tv-foundation-stat__label">Motor</span>
            <strong className="tv-foundation-stat__value">
              {lifecycle.recalculaMotor ? 'Recalcula' : 'Congelado'}
            </strong>
            <span className="tv-foundation-stat__meta">
              {lifecycle.calculadoCongelado ? 'La foto ATLAS queda congelada tras importar AEAT.' : 'ATLAS usa la foto viva o cerrada del ejercicio.'}
            </span>
          </div>
          <div className="tv-foundation-stat">
            <span className="tv-foundation-stat__label">Verdad principal</span>
            <strong className="tv-foundation-stat__value">
              {lifecycle.truthPriority === 'aeat' ? 'AEAT' : lifecycle.truthPriority === 'atlas' ? 'ATLAS' : 'Manual'}
            </strong>
            <span className="tv-foundation-stat__meta">
              {lifecycle.truthPriority === 'aeat'
                ? 'La declaración presentada manda sobre cualquier recálculo posterior.'
                : lifecycle.truthPriority === 'atlas'
                  ? 'La mejor referencia disponible sigue siendo el cálculo interno de ATLAS.'
                  : 'Sin cálculo persistido: arranca vacío y admite captura mínima.'}
            </span>
          </div>
          <div className="tv-foundation-stat">
            <span className="tv-foundation-stat__label">Arrastres N+1</span>
            <strong className="tv-foundation-stat__value">
              {lifecycle.carryForwardSource === 'casillas_aeat'
                ? 'Casillas AEAT'
                : lifecycle.carryForwardSource === 'calculo_atlas'
                  ? 'Cálculo ATLAS'
                  : 'Entrada manual'}
            </strong>
            <span className="tv-foundation-stat__meta">
              {lifecycle.carryForwardSource === 'casillas_aeat'
                ? 'Se heredan desde las casillas declaradas del ejercicio origen.'
                : lifecycle.carryForwardSource === 'calculo_atlas'
                  ? 'Se estiman con la foto calculada hasta que llegue la AEAT.'
                  : 'Fallback para clientes sin histórico importado.'}
            </span>
          </div>
          <div className="tv-foundation-stat">
            <span className="tv-foundation-stat__label">Bootstrap</span>
            <strong className="tv-foundation-stat__value">Primera declaración</strong>
            <span className="tv-foundation-stat__meta">{bootstrapCopy}</span>
          </div>
        </div>
      </section>

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
