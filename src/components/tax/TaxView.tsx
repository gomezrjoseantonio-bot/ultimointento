import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import WorkIncomeBlock from './blocks/WorkIncomeBlock';
import RealEstateBlock from './blocks/RealEstateBlock';
import BusinessBlock from './blocks/BusinessBlock';
import SavingsGPBlock from './blocks/SavingsGPBlock';
import ResultBlock from './blocks/ResultBlock';
import { hydrateFromCalculation, setEjercicio, type TaxState } from '../../store/taxSlice';
import { calcularDeclaracionIRPF } from '../../services/irpfCalculationService';
import { mapDeclaracionToTaxState } from './taxHydrationMapper';
import EjercicioSelector from '../fiscal/EjercicioSelector';
import { useEjercicioFiscal } from '../../hooks/useEjercicioFiscal';
import { ejercicioFiscalService } from '../../services/ejercicioFiscalService';
import { CheckCircle, Clock, Info, Upload, type LucideIcon } from 'lucide-react';
import type { DeclaracionIRPF as FiscalDeclaracionIRPF, EstadoEjercicio } from '../../types/fiscal';
import './tax-view.css';


function mapFiscalDeclaracionToTaxState(declaracion: FiscalDeclaracionIRPF): Omit<TaxState, 'ejercicio'> {
  return {
    workIncome: {
      dinerarias: declaracion.trabajo.retribucionesDinerarias ?? 0,
      especieValoracion: declaracion.trabajo.retribucionEspecie ?? 0,
      especieIngresoACuenta: declaracion.trabajo.ingresosACuenta ?? 0,
      contribucionEmpresarialPP: declaracion.trabajo.contribucionesPPEmpresa ?? 0,
      cotizacionSS: declaracion.trabajo.cotizacionSS ?? 0,
      otrosGastosDeducibles: declaracion.trabajo.otrosGastosDeducibles ?? 0,
      retencion: declaracion.trabajo.retencionesTrabajoTotal ?? 0,
    },
    capitalMobiliario: {
      interesesCuentasDepositos: declaracion.capitalMobiliario.interesesCuentas ?? 0,
      otrosRendimientos: declaracion.capitalMobiliario.otrosRendimientos ?? 0,
      retencion: declaracion.capitalMobiliario.retencionesCapital ?? 0,
    },
    inmuebles: declaracion.inmuebles.map((inmueble, index) => ({
      id: `${declaracion.personal?.nif ?? 'aeat'}-inmueble-${index}`,
      refCatastral: inmueble.referenciaCatastral ?? '',
      direccion: inmueble.direccion ?? '',
      pctPropiedad: inmueble.porcentajePropiedad ?? 100,
      tipo: (inmueble.uso === 'disposicion' ? 'disposicion' : inmueble.uso === 'mixto' ? 'mixto' : 'arrendado') as 'disposicion' | 'mixto' | 'arrendado',
      fechaAdquisicion: inmueble.fechaAdquisicion ?? '',
      importeAdquisicion: inmueble.importeAdquisicion ?? 0,
      gastosTributos: inmueble.gastosAdquisicion ?? 0,
      mejoras: inmueble.mejoras ?? 0,
      valorCatastral: inmueble.valorCatastral ?? 0,
      valorCatastralConstruccion: inmueble.valorCatastralConstruccion ?? 0,
      diasArrendados: inmueble.diasArrendado ?? 0,
      diasDisposicion: inmueble.diasDisposicion ?? 0,
      valorCatastralRevisado: false,
      ingresosIntegros: inmueble.ingresosIntegros ?? 0,
      interesesFinanciacion: inmueble.interesesFinanciacion ?? 0,
      gastosReparacion: inmueble.gastosReparacion ?? 0,
      gastosComunidad: inmueble.gastosComunidad ?? 0,
      serviciosPersonales: inmueble.gastosServicios ?? 0,
      suministros: inmueble.gastosSuministros ?? 0,
      seguro: inmueble.gastosSeguros ?? 0,
      tributosRecargos: inmueble.gastosTributos ?? 0,
      amortizacionMuebles: inmueble.amortizacionMuebles ?? 0,
      arrastres: [],
      tieneReduccion: inmueble.derechoReduccion ?? false,
      pctReduccion: inmueble.rendimientoNeto > inmueble.rendimientoNetoReducido && inmueble.rendimientoNeto !== 0
        ? Math.round((1 - (inmueble.rendimientoNetoReducido / inmueble.rendimientoNeto)) * 100)
        : 0,
      pctConstruccion: inmueble.porcentajeConstruccion ?? 0,
      baseAmortizacion: inmueble.baseAmortizacion ?? 0,
      amortizacionInmueble: inmueble.amortizacionInmueble ?? 0,
      limiteInteresesReparacion: (inmueble.interesesFinanciacion ?? 0) + (inmueble.gastosReparacion ?? 0),
      excesoReparacion: inmueble.arrastresGenerados ?? 0,
      rentaImputada: inmueble.rentaImputada ?? 0,
      rendimientoNeto: inmueble.rendimientoNeto ?? 0,
      rendimientoNetoReducido: inmueble.rendimientoNetoReducido ?? 0,
    })),
    actividades: declaracion.actividades.map((actividad, index) => ({
      id: `aeat-actividad-${index}`,
      codigoActividad: actividad.tipoActividad ?? '',
      epigafreIAE: actividad.epigrafeIAE ?? '',
      ingresosExplotacion: actividad.ingresos ?? 0,
      seguridadSocialTitular: 0,
      serviciosProfesionales: 0,
      otrosGastos: actividad.gastos ?? 0,
      retencion: actividad.retencionesActividad ?? 0,
      provisionSimplificada: actividad.provisionDificilJustificacion ?? 0,
      rendimientoNeto: actividad.rendimientoNeto ?? 0,
    })),
    ganancias: [{
      id: 'aeat-ganancias',
      tipo: 'otra_ba' as const,
      base: declaracion.gananciasPerdidas.saldoNetoGeneral !== 0 ? 'general' as const : 'ahorro' as const,
      descripcion: 'Saldo neto agregado AEAT',
      valorTransmision: declaracion.gananciasPerdidas.gananciasTransmision + declaracion.gananciasPerdidas.gananciasNoTransmision,
      valorAdquisicion: declaracion.gananciasPerdidas.perdidasTransmision + declaracion.gananciasPerdidas.perdidasNoTransmision,
      resultado: declaracion.gananciasPerdidas.saldoNetoGeneral !== 0
        ? declaracion.gananciasPerdidas.saldoNetoGeneral
        : declaracion.gananciasPerdidas.saldoNetoAhorro,
    }].filter((ganancia) => ganancia.valorTransmision !== 0 || ganancia.valorAdquisicion !== 0 || ganancia.resultado !== 0),
    saldosNegativosBIA: declaracion.gananciasPerdidas.perdidasPendientes.map((perdida) => ({
      ejercicio: perdida.ejercicioOrigen,
      pendienteInicio: perdida.importeOriginal,
      aplicado: perdida.importeAplicado,
      pendienteFuturo: perdida.importePendiente,
    })),
    previsionSocial: {
      aportacionTrabajador: declaracion.planPensiones.aportacionesTrabajador ?? 0,
      contribucionEmpresarial: declaracion.planPensiones.contribucionesEmpresariales ?? 0,
      importeAplicado: declaracion.planPensiones.reduccionAplicada ?? 0,
    },
    baseImponibleGeneral: declaracion.basesYCuotas.baseImponibleGeneral ?? 0,
    baseImponibleAhorro: declaracion.basesYCuotas.baseImponibleAhorro ?? 0,
    baseLiquidableGeneral: declaracion.basesYCuotas.baseLiquidableGeneral ?? 0,
    baseLiquidableAhorro: declaracion.basesYCuotas.baseLiquidableAhorro ?? 0,
    cuotaIntegra: declaracion.basesYCuotas.cuotaIntegra ?? 0,
    cuotaLiquida: declaracion.basesYCuotas.cuotaLiquida ?? 0,
    totalRetenciones: declaracion.basesYCuotas.retencionesTotal ?? 0,
    cuotaDiferencial: declaracion.basesYCuotas.cuotaDiferencial ?? declaracion.basesYCuotas.resultadoDeclaracion ?? 0,
  };
}

const TABS = ['Resumen', 'Trabajo', 'Inmuebles', 'Actividad', 'Ahorro y G/P', 'Resultado'] as const;
type Tab = typeof TABS[number];

function EstadoBanner({
  estado,
  tieneAeat,
  ejercicio,
  coberturaLineas,
}: {
  estado: EstadoEjercicio;
  tieneAeat: boolean;
  ejercicio: number;
  coberturaLineas: number;
}) {
  const configs: Record<EstadoEjercicio, { texto: string; colorVar: string; bgVar: string; Icon: LucideIcon }> = {
    en_curso: {
      texto: `Estimaci\u00f3n en tiempo real del ejercicio ${ejercicio}. Los datos se actualizan con cada cambio.`,
      colorVar: 'var(--s-pos)',
      bgVar: 'var(--s-pos-bg)',
      Icon: Info,
    },
    cerrado: {
      texto: tieneAeat
        ? `Ejercicio cerrado. Declaraci\u00f3n AEAT subida \u2014 puedes seguir a\u00f1adiendo documentaci\u00f3n.`
        : `Ejercicio cerrado, pendiente de declarar. Puedes ajustar datos antes de presentar.`,
      colorVar: 'var(--s-warn)',
      bgVar: 'var(--s-warn-bg)',
      Icon: Clock,
    },
    declarado: {
      texto: tieneAeat
        ? `Ejercicio declarado. Datos de Hacienda importados. Puedes a\u00f1adir documentaci\u00f3n para mejorar la cobertura.`
        : `Ejercicio declarado seg\u00fan datos de ATLAS. Sube el PDF de Hacienda para tener la verdad oficial.`,
      colorVar: 'var(--blue)',
      bgVar: 'var(--n-100)',
      Icon: CheckCircle,
    },
  };

  const config = configs[estado];
  const BannerIcon = config.Icon;

  return (
    <div
      className="tv-state-banner"
      style={{
        background: config.bgVar,
        color: config.colorVar,
      }}
    >
      <BannerIcon size={16} />
      <span>{config.texto}</span>
      {coberturaLineas > 0 && (
        <span className="tv-state-banner__meta">
          Cobertura documental: {coberturaLineas} conceptos monitorizados.
        </span>
      )}
    </div>
  );
}

const TaxView: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const tax = useSelector((state: RootState) => state.tax);
  const [tab, setTab] = useState<Tab>('Trabajo');
  const [loadingDeclaracion, setLoadingDeclaracion] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const {
    ejercicio: fiscalExercise,
    estado,
    declarado,
    cobertura,
    esEditable,
    tieneAeat,
  } = useEjercicioFiscal(tax.ejercicio);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currentYear = new Date().getFullYear();
  const isCurrentYear = tax.ejercicio === currentYear;

  const shouldShowUploadButton = estado === 'cerrado' || (estado === 'declarado' && !tieneAeat);

  useEffect(() => {
    let cancelled = false;

    const cargarDeclaracion = async () => {
      setLoadingDeclaracion(true);
      setLoadingError(null);

      try {
        const tresVerdades = await ejercicioFiscalService.getTresVerdades(tax.ejercicio);
        let hydrationPayload;

        if (tresVerdades.estado === 'declarado' && tresVerdades.declarado) {
          hydrationPayload = mapFiscalDeclaracionToTaxState(tresVerdades.declarado);
        } else {
          const declaracionCalculada = await calcularDeclaracionIRPF(tax.ejercicio, { usarConciliacion: true });
          hydrationPayload = await mapDeclaracionToTaxState(declaracionCalculada);
        }

        if (cancelled) return;
        dispatch(hydrateFromCalculation(hydrationPayload));
      } catch {
        if (cancelled) return;
        setLoadingError('No se pudieron cargar los datos fiscales reales para este ejercicio.');
      } finally {
        if (!cancelled) setLoadingDeclaracion(false);
      }
    };

    void cargarDeclaracion();

    return () => {
      cancelled = true;
    };
  }, [dispatch, tax.ejercicio, declarado]);

  const readOnlyMessage = useMemo(() => {
    if (estado !== 'declarado') return null;
    return tieneAeat
      ? 'Vista solo lectura basada en la declaraci\u00f3n oficial importada desde AEAT.'
      : 'Vista solo lectura del ejercicio declarado. Sube el PDF de Hacienda para completar la verdad oficial.';
  }, [estado, tieneAeat]);

  return (
    <div className="tv-root">
      <div className="tv-header">
        <div>
          <h2 className="tv-title">Declaraci\u00f3n IRPF {tax.ejercicio}</h2>
          <p className="tv-subtitle">Modelo 100 \u2014 Estimaci\u00f3n en tiempo real</p>
        </div>
        <div className="tv-header-right">
          {estado === 'declarado' && tieneAeat && <span className="tv-source-pill">Fuente AEAT</span>}
          <div className="tv-year-picker">
            <label className="tv-year-label">Ejercicio</label>
            <EjercicioSelector
              value={tax.ejercicio}
              onChange={(ejercicio) => dispatch(setEjercicio(ejercicio))}
            />
          </div>
        </div>
      </div>

      <EstadoBanner
        estado={estado}
        tieneAeat={tieneAeat}
        ejercicio={tax.ejercicio}
        coberturaLineas={cobertura?.lineas.length ?? 0}
      />

      {isCurrentYear && (
        <div className="tv-forecast-note">
          Ejercicio en curso: la declaraci\u00f3n se calcula en modo previsi\u00f3n (budget) y se ajustar\u00e1 con datos reales conciliados.
        </div>
      )}

      {readOnlyMessage && <div className="tv-sync-note">{readOnlyMessage}</div>}
      {loadingDeclaracion && <div className="tv-sync-note">Cargando datos reales de la declaraci\u00f3n\u2026</div>}
      {loadingError && <div className="tv-sync-note tv-sync-note--error">{loadingError}</div>}

      {shouldShowUploadButton && (
        <div className="tv-actions-row">
          <button type="button" className="tv-upload-button" onClick={() => navigate('/fiscalidad/historial')}>
            <Upload size={16} />
            Subir declaraci\u00f3n AEAT
          </button>
        </div>
      )}

      <div className={`tv-result-banner ${tax.cuotaDiferencial > 0 ? 'banner-pagar' : 'banner-devolver'}`}>
        <span className="tv-result-label">
          {tax.cuotaDiferencial > 0 ? 'A ingresar' : 'A devolver'}
        </span>
        <span className="tv-result-amount">
          {fmt(Math.abs(tax.cuotaDiferencial))} \u20ac
        </span>
        <span className="tv-result-meta">
          Base liquidable general: {fmt(tax.baseLiquidableGeneral)} \u20ac \u00b7
          Tipo medio: {tax.baseLiquidableGeneral > 0
            ? fmt(tax.cuotaLiquida / tax.baseLiquidableGeneral * 100) : '0,00'}%
        </span>
      </div>

      <nav className="tv-tabs">
        {TABS.map((tabName) => (
          <button
            key={tabName}
            className={`tv-tab ${tab === tabName ? 'tv-tab--active' : ''}`}
            onClick={() => setTab(tabName)}
          >
            {tabName}
          </button>
        ))}
      </nav>

      <div className={`tv-content ${!esEditable ? 'tv-content--readonly' : ''}`}>
        {tab === 'Resumen' && <ResumenInline tax={tax} fmt={fmt} />}
        {tab === 'Trabajo' && <WorkIncomeBlock readOnly={!esEditable} />}
        {tab === 'Inmuebles' && <RealEstateBlock readOnly={!esEditable} />}
        {tab === 'Actividad' && <BusinessBlock readOnly={!esEditable} />}
        {tab === 'Ahorro y G/P' && <SavingsGPBlock readOnly={!esEditable} />}
        {tab === 'Resultado' && <ResultBlock />}
      </div>
    </div>
  );
};

const ResumenInline: React.FC<{ tax: any; fmt: (v: number) => string }> = ({ tax, fmt }) => (
  <div className="tv-resumen">
    <div className="tv-resumen-grid">
      {[
        { label: 'Rendimientos del trabajo', value: tax.baseLiquidableGeneral > 0 ? tax.workIncome.dinerarias : 0, color: 'neutral' },
        { label: 'Rendimientos de inmuebles', value: tax.inmuebles.reduce((a: number, i: any) => a + i.rendimientoNetoReducido, 0), color: 'neutral' },
        { label: 'Actividades econ\u00f3micas', value: tax.actividades.reduce((a: number, act: any) => a + act.rendimientoNeto, 0), color: 'neutral' },
        { label: 'Capital mobiliario', value: tax.capitalMobiliario.interesesCuentasDepositos, color: 'neutral' },
        { label: 'Base imponible general', value: tax.baseImponibleGeneral, color: 'neutral', bold: true },
        { label: 'Reducci\u00f3n previsi\u00f3n social', value: -tax.previsionSocial.importeAplicado, color: 'pos' },
        { label: 'Base liquidable general', value: tax.baseLiquidableGeneral, color: 'neutral', bold: true },
        { label: 'Base liquidable del ahorro', value: tax.baseLiquidableAhorro, color: 'neutral' },
        { label: 'Cuota \u00edntegra', value: tax.cuotaIntegra, color: 'neutral', bold: true },
        { label: 'Total retenciones', value: -tax.totalRetenciones, color: 'pos' },
        { label: 'Cuota diferencial', value: tax.cuotaDiferencial, color: tax.cuotaDiferencial > 0 ? 'neg' : 'pos', bold: true },
      ].map(({ label, value, color, bold }) => (
        <div key={label} className={`tv-resumen-row ${bold ? 'row-bold' : ''}`}>
          <span className="tv-resumen-label">{label}</span>
          <span className={`tv-resumen-value color-${color}`}>{fmt(value)} \u20ac</span>
        </div>
      ))}
    </div>
  </div>
);

export default TaxView;
