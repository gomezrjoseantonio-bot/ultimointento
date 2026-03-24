import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Download, Upload } from 'lucide-react';
import { RootState } from '../../store';
// Sub-tab block imports removed (C3 — cascade is the complete view)
import { hydrateFromCalculation, setEjercicio, type TaxState, type Inmueble as TaxInmueble } from '../../store/taxSlice';
import { calcularDeclaracionIRPF } from '../../services/irpfCalculationService';
import { mapDeclaracionToTaxState } from './taxHydrationMapper';
import EjercicioSelector from '../fiscal/EjercicioSelector';
import { useEjercicioFiscal } from '../../hooks/useEjercicioFiscal';
import { ejercicioFiscalService, getAllEjercicios } from '../../services/ejercicioFiscalService';
import type { DeclaracionIRPF as FiscalDeclaracionIRPF, EstadoEjercicio } from '../../types/fiscal';
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

// TABS removed (C3)

// EstadoBanner removed (C4 — banners were noise)

interface SectionRow { label: string; value: number; accent?: 'positive' | 'negative' | 'neutral'; }
interface SectionData { id: string; title: string; total: number; rows?: SectionRow[]; note?: string; defaultOpen?: boolean; inmuebles?: TaxInmueble[]; }

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
  // C5: Track which individual inmuebles are expanded (first one open by default)
  const [openInmuebles, setOpenInmuebles] = useState<Record<string, boolean>>({});
  const {
    estado,
    declarado,
    cobertura,
    esEditable,
    tieneAeat,
  } = useEjercicioFiscal(tax.ejercicio);

  const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSignedMoney = (v: number) => `${v >= 0 ? '+' : '-'}${fmt(Math.abs(v))} €`;

  const currentYear = new Date().getFullYear();
  const isCurrentYear = tax.ejercicio === currentYear;
  const shouldShowUploadButton = estado === 'cerrado' || (estado === 'declarado' && !tieneAeat);

  // C2: Default to most recent "pendiente" exercise, then en_curso, then latest with data
  useEffect(() => {
    const ejercicioFromUrl = Number(searchParams.get('ejercicio'));
    if (Number.isInteger(ejercicioFromUrl) && ejercicioFromUrl > 2009 && ejercicioFromUrl !== tax.ejercicio) {
      dispatch(setEjercicio(ejercicioFromUrl));
      return;
    }

    // Only run default selection on initial mount (no URL param)
    if (searchParams.get('ejercicio')) return;

    getAllEjercicios().then((ejercicios) => {
      const sorted = [...ejercicios].sort((a, b) => b.ejercicio - a.ejercicio);
      const now = new Date().getFullYear();

      const pendiente = sorted.find((e) => e.estado === 'cerrado' && e.ejercicio < now);
      const enCurso = sorted.find((e) => e.estado === 'en_curso' || e.ejercicio === now);
      const conDatos = sorted.find((e) => {
        const r = e.declaracionAeat?.basesYCuotas ?? e.calculoAtlas?.basesYCuotas;
        return r && ((r.cuotaLiquida ?? 0) !== 0 || (r.retencionesTotal ?? 0) !== 0);
      });

      const best = pendiente || enCurso || conDatos;
      if (best && best.ejercicio !== tax.ejercicio) {
        dispatch(setEjercicio(best.ejercicio));
      }
    }).catch(() => { /* keep current default */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

        if (!cancelled) dispatch(hydrateFromCalculation(hydrationPayload));
      } catch {
        if (!cancelled) setLoadingError('No se pudieron cargar los datos fiscales reales para este ejercicio.');
      } finally {
        if (!cancelled) setLoadingDeclaracion(false);
      }
    };

    void cargarDeclaracion();
    return () => { cancelled = true; };
  }, [dispatch, tax.ejercicio, declarado]);

  const readOnlyMessage = useMemo(() => {
    if (estado !== 'declarado') return null;
    return tieneAeat
      ? 'Vista solo lectura basada en la declaración oficial importada desde AEAT.'
      : 'Vista solo lectura del ejercicio declarado. Sube el PDF de Hacienda para completar la verdad oficial.';
  }, [estado, tieneAeat]);

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
        inmuebles: tax.inmuebles,
        rows: tax.inmuebles.length === 0 ? [{ label: 'Sin inmuebles arrendados', value: 0 }] : undefined,
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

  return (
    <FiscalPageShell>
      <div className="tv-root">
        <div className="tv-header">
          <div>
            <h2 className="tv-title">Declaración IRPF {tax.ejercicio}</h2>
            <p className="tv-subtitle">Modelo 100 — Estimación en tiempo real</p>
          </div>
          <div className="tv-header-right">
            {estado === 'declarado' && tieneAeat && <span className="tv-source-pill">Fuente AEAT</span>}
            <button
              type="button"
              disabled
              title="Próximamente"
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--r-md, 12px)',
                border: '1px solid var(--n-300)',
                background: 'var(--white)',
                color: 'var(--n-500)',
                cursor: 'not-allowed',
                fontWeight: 500,
                fontSize: 'var(--t-sm, 14px)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: 0.6,
                minHeight: 44,
              }}
            >
              <Download size={16} />
              Exportar borrador
            </button>
            <div className="tv-year-picker">
              <label className="tv-year-label">Ejercicio</label>
              <EjercicioSelector value={tax.ejercicio} onChange={(ejercicio) => dispatch(setEjercicio(ejercicio))} />
            </div>
          </div>
        </div>

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

        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {sections.map((section) => {
            const hasInmuebles = section.inmuebles && section.inmuebles.length > 0;
            const collapsible = Boolean((section.rows && section.rows.length) || hasInmuebles);
            const isOpen = openSections[section.id] ?? section.defaultOpen ?? false;
            return (
              <div key={section.id} style={sectionCardStyle}>
                <button
                  type="button"
                  onClick={() => collapsible && toggleSection(section.id)}
                  style={{ width: '100%', border: 0, background: 'transparent', padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', cursor: collapsible ? 'pointer' : 'default' }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--n-900)' }}>{section.title}</div>
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: section.total >= 0 ? 'var(--n-900)' : 'var(--s-neg)' }}>
                    {fmtSignedMoney(section.total)}
                  </div>
                  {collapsible ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span />}
                </button>
                {collapsible && isOpen ? (
                  <div style={{ borderTop: '1px solid var(--n-200)', padding: '12px 18px 0' }}>
                    {/* C5: Render each inmueble as a collapsible sub-block */}
                    {hasInmuebles && section.inmuebles!.map((inm, idx) => {
                      const inmKey = inm.id;
                      const inmOpen = openInmuebles[inmKey] ?? (idx === 0);
                      const inmName = inm.direccion || inm.refCatastral || `Inmueble ${idx + 1}`;
                      return (
                        <div key={inmKey} style={{ borderBottom: idx < section.inmuebles!.length - 1 ? '1px solid var(--n-100)' : 'none', paddingBottom: 8, marginBottom: 4 }}>
                          <button
                            type="button"
                            onClick={() => setOpenInmuebles(prev => ({ ...prev, [inmKey]: !inmOpen }))}
                            style={{ width: '100%', border: 0, background: 'transparent', padding: '8px 0', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center', cursor: 'pointer', minHeight: 36 }}
                          >
                            {inmOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span style={{ textAlign: 'left', fontWeight: 500, color: 'var(--n-700)', fontSize: 14 }}>{inmName}</span>
                            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 14, color: inm.rendimientoNetoReducido >= 0 ? 'var(--s-pos)' : 'var(--s-neg)' }}>
                              {fmtSignedMoney(inm.rendimientoNetoReducido)}
                            </span>
                          </button>
                          {inmOpen && (
                            <div style={{ paddingLeft: 22 }}>
                              {[
                                { label: 'Ingresos íntegros', value: inm.ingresosIntegros },
                                { label: 'Gastos financieros', value: -inm.interesesFinanciacion, accent: 'negative' as const },
                                { label: 'Amortización inmueble', value: -inm.amortizacionInmueble, accent: 'negative' as const },
                                { label: 'Otros gastos', value: -(inm.gastosComunidad + inm.serviciosPersonales + inm.suministros + inm.seguro + inm.tributosRecargos + inm.gastosReparacion), accent: 'negative' as const },
                                { label: 'Rendimiento neto', value: inm.rendimientoNeto },
                                { label: 'Rendimiento neto reducido', value: inm.rendimientoNetoReducido, accent: 'positive' as const },
                              ].map((row) => (
                                <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, padding: '4px 12px', color: 'var(--n-700)', fontSize: 13 }}>
                                  <span>{row.label}</span>
                                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: row.accent === 'positive' ? 'var(--s-pos)' : row.accent === 'negative' ? 'var(--s-neg)' : 'var(--n-900)' }}>{fmtSignedMoney(row.value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Total line for inmuebles */}
                    {hasInmuebles && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, padding: '8px 12px 14px', color: 'var(--n-700)', fontSize: 14, fontWeight: 600 }}>
                        <span>Total rendimientos netos reducidos</span>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtSignedMoney(section.total)}</span>
                      </div>
                    )}
                    {section.rows?.map((row) => (
                      <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, padding: '8px 12px', color: 'var(--n-700)', fontSize: 14 }}>
                        <span>{row.label}</span>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: row.accent === 'positive' ? 'var(--s-pos)' : row.accent === 'negative' ? 'var(--s-neg)' : 'var(--n-900)' }}>{fmtSignedMoney(row.value)}</span>
                      </div>
                    ))}
                    {section.note ? (
                      <div style={{ margin: '8px 12px 14px', background: 'var(--n-50)', borderRadius: 10, padding: '10px 14px', color: 'var(--n-500)' }}>
                        {section.note}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Sub-tabs removed — cascade above is the complete declaration view */}
      </div>
    </FiscalPageShell>
  );
};

export default TaxView;
