import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Upload } from 'lucide-react';
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
import type { DeclaracionIRPF as FiscalDeclaracionIRPF } from '../../types/fiscal';
import FiscalPageShell from '../../modules/horizon/fiscalidad/components/FiscalPageShell';
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
    ganancias: [],
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
      texto: `Estimación en tiempo real del ejercicio ${ejercicio}. Los datos se actualizan con cada cambio.`,
      colorVar: 'var(--s-pos)',
      bgVar: 'var(--s-pos-bg)',
      Icon: Info,
    },
    cerrado: {
      texto: tieneAeat
        ? `Ejercicio cerrado. Declaración AEAT subida — puedes seguir añadiendo documentación.`
        : `Ejercicio cerrado, pendiente de declarar. Puedes ajustar datos antes de presentar.`,
      colorVar: 'var(--s-warn)',
      bgVar: 'var(--s-warn-bg)',
      Icon: Clock,
    },
    declarado: {
      texto: tieneAeat
        ? `Ejercicio declarado. Datos de Hacienda importados. Puedes añadir documentación para mejorar la cobertura.`
        : `Ejercicio declarado según datos de ATLAS. Sube el PDF de Hacienda para tener la verdad oficial.`,
      colorVar: 'var(--blue)',
      bgVar: 'var(--n-100)',
      Icon: CheckCircle,
    },
  };

interface SectionRow { label: string; value: number; accent?: 'positive' | 'negative' | 'neutral'; }
interface SectionData { id: string; title: string; total: number; rows?: SectionRow[]; note?: string; defaultOpen?: boolean; }

const sectionCardStyle: React.CSSProperties = {
  border: '1px solid var(--n-200)',
  borderRadius: 16,
  overflow: 'hidden',
  background: 'var(--white)',
};

const TaxView: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tax = useSelector((state: RootState) => state.tax);
  const [loadingDeclaracion, setLoadingDeclaracion] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    trabajo: true,
    inmuebles: true,
    actividad: false,
    reducciones: false,
    cuotaIntegra: false,
    retenciones: true,
  });
  const { estado, declarado, tieneAeat } = useEjercicioFiscal(tax.ejercicio);

  const currentYear = new Date().getFullYear();
  const isCurrentYear = tax.ejercicio === currentYear;

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
        const hydrationPayload = tresVerdades.estado === 'declarado' && tresVerdades.declarado
          ? mapFiscalDeclaracionToTaxState(tresVerdades.declarado)
          : await mapDeclaracionToTaxState(await calcularDeclaracionIRPF(tax.ejercicio, { usarConciliacion: true }));

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
    return () => { cancelled = true; };
  }, [dispatch, tax.ejercicio, declarado]);

  const sections = useMemo<SectionData[]>(() => {
    const trabajoBruto = tax.workIncome.dinerarias + tax.workIncome.especieValoracion + tax.workIncome.especieIngresoACuenta + tax.workIncome.contribucionEmpresarialPP;
    const trabajoNeto = trabajoBruto - tax.workIncome.cotizacionSS - tax.workIncome.otrosGastosDeducibles;
    const totalInmuebles = tax.inmuebles.reduce((sum, item) => sum + item.rendimientoNetoReducido, 0);
    const totalActividad = tax.actividades.reduce((sum, item) => sum + item.rendimientoNeto, 0);
    const totalRetenciones = -(tax.workIncome.retencion + tax.capitalMobiliario.retencion + tax.actividades.reduce((sum, item) => sum + item.retencion, 0));

    return [
      {
        id: 'trabajo',
        title: 'Rendimientos del trabajo',
        total: trabajoNeto,
        defaultOpen: true,
        rows: [
          { label: 'Retribuciones dinerarias', value: trabajoBruto },
          { label: 'Gastos deducibles trabajo', value: -(tax.workIncome.cotizacionSS + tax.workIncome.otrosGastosDeducibles), accent: 'negative' },
          { label: 'Rendimiento neto', value: trabajoNeto },
        ],
      },
      {
        id: 'inmuebles',
        title: 'Rendimientos de inmuebles',
        total: totalInmuebles,
        defaultOpen: true,
        note: tax.inmuebles.length > 1 ? `${tax.inmuebles.length - 1} inmuebles más con desglose similar` : undefined,
        rows: tax.inmuebles.length > 0 ? [
          { label: `${tax.inmuebles[0].direccion || tax.inmuebles[0].refCatastral} · Ingresos íntegros`, value: tax.inmuebles[0].ingresosIntegros },
          { label: 'Gastos financieros', value: -tax.inmuebles[0].interesesFinanciacion, accent: 'negative' },
          { label: 'Reparación y conservación', value: -tax.inmuebles[0].gastosReparacion, accent: 'negative' },
          { label: 'Amortización inmueble', value: -tax.inmuebles[0].amortizacionInmueble, accent: 'negative' },
          { label: 'Otros gastos', value: -(tax.inmuebles[0].gastosComunidad + tax.inmuebles[0].serviciosPersonales + tax.inmuebles[0].suministros + tax.inmuebles[0].seguro + tax.inmuebles[0].tributosRecargos), accent: 'negative' },
          { label: 'Rendimiento neto', value: tax.inmuebles[0].rendimientoNeto },
          { label: 'Rendimiento neto reducido', value: tax.inmuebles[0].rendimientoNetoReducido, accent: 'positive' },
        ] : [{ label: 'Sin inmuebles arrendados', value: 0 }],
      },
      { id: 'actividad', title: 'Actividades económicas', total: totalActividad, rows: tax.actividades.map((item) => ({ label: item.codigoActividad || 'Actividad', value: item.rendimientoNeto })) },
      { id: 'base', title: 'Base imponible general', total: tax.baseImponibleGeneral },
      { id: 'reducciones', title: 'Reducciones', total: -tax.previsionSocial.importeAplicado, rows: [{ label: 'Previsión social', value: -tax.previsionSocial.importeAplicado, accent: 'negative' }] },
      { id: 'baseLiquidable', title: 'Base liquidable general', total: tax.baseLiquidableGeneral },
      { id: 'cuotaIntegra', title: 'Cuota íntegra', total: tax.cuotaIntegra, rows: [{ label: 'Cuota íntegra estimada', value: tax.cuotaIntegra }] },
      {
        id: 'retenciones',
        title: 'Retenciones y pagos a cuenta',
        total: totalRetenciones,
        defaultOpen: true,
        rows: [
          { label: 'Retenciones trabajo', value: -tax.workIncome.retencion, accent: 'positive' },
          { label: 'Retenciones capital mobiliario', value: -tax.capitalMobiliario.retencion, accent: 'positive' },
          { label: 'Retenciones actividades', value: -tax.actividades.reduce((sum, item) => sum + item.retencion, 0), accent: 'positive' },
        ],
      },
    ];
  }, [tax]);

  const toggleSection = (id: string) => setOpenSections((current) => ({ ...current, [id]: !current[id] }));

      {isCurrentYear && (
        <div className="tv-forecast-note">
          Ejercicio en curso: la declaración se calcula en modo previsión (budget) y se ajustará con datos reales conciliados.
        </div>
      )}

      {readOnlyMessage && <div className="tv-sync-note">{readOnlyMessage}</div>}
      {loadingDeclaracion && <div className="tv-sync-note">Cargando datos reales de la declaración…</div>}
      {loadingError && <div className="tv-sync-note tv-sync-note--error">{loadingError}</div>}

      {shouldShowUploadButton && (
        <div className="tv-actions-row">
          <button type="button" className="tv-upload-button" onClick={() => navigate('/fiscalidad/historial')}>
            <Upload size={16} />
            Subir declaración AEAT
          </button>
        </div>
      )}

                {collapsible && isOpen && (
                  <div style={{ borderTop: '1px solid var(--n-200)', padding: '12px 18px 0' }}>
                    {section.rows?.map((row) => (
                      <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, padding: '8px 12px', color: 'var(--n-700)', fontSize: 14 }}>
                        <span>{row.label}</span>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: row.accent === 'positive' ? 'var(--s-pos)' : row.accent === 'negative' ? 'var(--s-neg)' : 'var(--n-900)' }}>{fmtSignedMoney(row.value)}</span>
                      </div>
                    ))}
                    {section.note && (
                      <div style={{ margin: '8px 12px 14px', background: 'var(--n-50)', borderRadius: 10, padding: '10px 14px', color: 'var(--n-500)' }}>
                        {section.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', color: 'var(--n-500)', fontFamily: 'IBM Plex Mono, monospace' }}>===</div>

      <div className={`tv-content ${!esEditable ? 'tv-content--readonly' : ''}`}>
        {tab === 'Resumen' && <ResumenInline tax={tax} fmt={fmt} />}
        {tab === 'Trabajo' && <WorkIncomeBlock readOnly={!esEditable} />}
        {tab === 'Inmuebles' && <RealEstateBlock readOnly={!esEditable} />}
        {tab === 'Actividad' && <BusinessBlock readOnly={!esEditable} />}
        {tab === 'Ahorro y G/P' && <SavingsGPBlock readOnly={!esEditable} />}
        {tab === 'Resultado' && <ResultBlock />}
      </div>
    </FiscalPageShell>
  );
};

export default TaxView;
