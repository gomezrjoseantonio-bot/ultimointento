import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RootState } from '../../store';
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
      texto: `Estimación en tiempo real del ejercicio ${ejercicio}. Los datos se actualizan con cada cambio.`,
      colorVar: 'var(--s-pos)',
      bgVar: 'var(--s-pos-bg)',
      Icon: Info,
    },
    cerrado: {
      texto: tieneAeat
        ? 'Ejercicio cerrado. Declaración AEAT subida — puedes seguir añadiendo documentación.'
        : 'Ejercicio cerrado y pendiente de presentar. Revisa los importes antes de declarar.',
      colorVar: 'var(--s-warn)',
      bgVar: 'var(--s-warn-bg)',
      Icon: Clock,
    },
    declarado: {
      texto: tieneAeat
        ? 'Ejercicio declarado. Esta vista muestra la referencia oficial importada desde AEAT.'
        : 'Ejercicio declarado con datos de ATLAS. Sube el PDF oficial para fijar la verdad presentada.',
      colorVar: 'var(--blue)',
      bgVar: 'var(--n-100)',
      Icon: CheckCircle,
    },
  };

  const config = configs[estado];
  const BannerIcon = config.Icon;

  return (
    <div className="tv-state-banner" style={{ background: config.bgVar, color: config.colorVar }}>
      <BannerIcon size={16} />
      <span>{config.texto}</span>
      {coberturaLineas > 0 && (
        <span className="tv-state-banner__meta">Cobertura documental: {coberturaLineas} conceptos monitorizados.</span>
      )}
    </div>
  );
}

const TaxView: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tax = useSelector((state: RootState) => state.tax);
  const [loadingDeclaracion, setLoadingDeclaracion] = React.useState(false);
  const [loadingError, setLoadingError] = React.useState<string | null>(null);
  const { estado, declarado, cobertura, esEditable, tieneAeat } = useEjercicioFiscal(tax.ejercicio);

  const fmt = (v: number) =>
    v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currentYear = new Date().getFullYear();
  const isCurrentYear = tax.ejercicio === currentYear;
  const shouldShowUploadButton = estado === 'cerrado' || (estado === 'declarado' && !tieneAeat);

  useEffect(() => {
    const ejercicioFromUrl = Number(searchParams.get('ejercicio'));
    if (Number.isInteger(ejercicioFromUrl) && ejercicioFromUrl > 2009 && ejercicioFromUrl !== tax.ejercicio) {
      dispatch(setEjercicio(ejercicioFromUrl));
    }
  }, [dispatch, searchParams, tax.ejercicio]);

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

        if (!cancelled) {
          dispatch(hydrateFromCalculation(hydrationPayload));
        }
      } catch {
        if (!cancelled) {
          setLoadingError('No se pudieron cargar los datos fiscales reales para este ejercicio.');
        }
      } finally {
        if (!cancelled) {
          setLoadingDeclaracion(false);
        }
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
      ? 'Vista solo lectura basada en la declaración oficial importada desde AEAT.'
      : 'Vista solo lectura del ejercicio declarado. Sube el PDF de Hacienda para completar la verdad oficial.';
  }, [estado, tieneAeat]);

  return (
    <div className="tv-root">
      <div className="tv-header">
        <div>
          <h2 className="tv-title">Declaración IRPF {tax.ejercicio}</h2>
          <p className="tv-subtitle">Modelo 100 — Resumen fiscal del ejercicio</p>
        </div>
        <div className="tv-header-right">
          {estado === 'declarado' && tieneAeat && <span className="tv-source-pill">Fuente AEAT</span>}
          <div className="tv-year-picker">
            <label className="tv-year-label">Ejercicio</label>
            <EjercicioSelector value={tax.ejercicio} onChange={(ejercicio) => dispatch(setEjercicio(ejercicio))} />
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
          Ejercicio en curso: la declaración se calcula en modo previsión y se ajustará con datos reales conciliados.
        </div>
      )}

      {readOnlyMessage && <div className="tv-sync-note">{readOnlyMessage}</div>}
      {loadingDeclaracion && <div className="tv-sync-note">Cargando datos reales de la declaración…</div>}
      {loadingError && <div className="tv-sync-note tv-sync-note--error">{loadingError}</div>}

      {shouldShowUploadButton && (
        <div className="tv-actions-row">
          <button type="button" className="tv-upload-button" onClick={() => navigate('/fiscalidad/historial', { state: { openImportWizard: true, defaultMethod: 'pdf' } })}>
            <Upload size={16} />
            Subir declaración AEAT
          </button>
        </div>
      )}

      <div className={`tv-result-banner ${tax.cuotaDiferencial > 0 ? 'banner-pagar' : 'banner-devolver'}`}>
        <span className="tv-result-label">{tax.cuotaDiferencial > 0 ? 'A ingresar' : 'A devolver'}</span>
        <span className="tv-result-amount">{fmt(Math.abs(tax.cuotaDiferencial))} €</span>
        <span className="tv-result-meta">
          Base liquidable general: {fmt(tax.baseLiquidableGeneral)} € · Tipo medio:{' '}
          {tax.baseLiquidableGeneral > 0 ? fmt((tax.cuotaLiquida / tax.baseLiquidableGeneral) * 100) : '0,00'}%
        </span>
      </div>

      <div className={`tv-content ${!esEditable ? 'tv-content--readonly' : ''}`}>
        <ResumenInline tax={tax} fmt={fmt} />
      </div>
    </div>
  );
};

const ResumenInline: React.FC<{ tax: TaxState; fmt: (v: number) => string }> = ({ tax, fmt }) => (
  <div className="tv-resumen">
    <div className="tv-resumen-grid">
      {[
        { label: 'Rendimientos del trabajo', value: tax.baseLiquidableGeneral > 0 ? tax.workIncome.dinerarias : 0, color: 'neutral' },
        { label: 'Rendimientos de inmuebles', value: tax.inmuebles.reduce((a, i) => a + i.rendimientoNetoReducido, 0), color: 'neutral' },
        { label: 'Actividades económicas', value: tax.actividades.reduce((a, act) => a + act.rendimientoNeto, 0), color: 'neutral' },
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
