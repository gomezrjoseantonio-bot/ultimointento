import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import FiscalPageShell from '../components/FiscalPageShell';
import EjercicioPillSelector from '../components/EjercicioPillSelector';
import ResumenDeclaracion from '../../../../components/fiscal/ResumenDeclaracion';
import SeccionRendimiento from '../../../../components/fiscal/SeccionRendimiento';
import BannerContextual from '../../../../components/fiscal/BannerContextual';
import {
  resolverDatosEjercicio,
  formatFiscalValue,
} from '../../../../services/fiscalResolverService';
import type {
  DatosFiscalesEjercicio,
  EstadoEjercicioFiscal,
  FuenteDatosEjercicio,
} from '../../../../services/fiscalResolverService';
import type { InmuebleDetalleData } from '../../../../components/fiscal/InmuebleDetalle';
import type { SeccionRendimientoProps } from '../../../../components/fiscal/SeccionRendimiento';
import { initDB, downloadBlob, getDocumentBlob } from '../../../../services/db';
import ImportarDatosWizard from '../historial/ImportarDatosWizard';

// ── Constants ──────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - i);

// ── Estado / Fuente display ───────────────────────────────
const ESTADO_DISPLAY: Record<EstadoEjercicioFiscal, { label: string; bg: string; color: string }> = {
  declarado: { label: 'Declarado', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  pendiente: { label: 'Pendiente', bg: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  en_curso: { label: 'En curso', bg: '#E6F7FA', color: 'var(--teal)' },
};

const FUENTE_DISPLAY: Record<FuenteDatosEjercicio, { label: string; bg: string; color: string }> = {
  pdf_aeat: { label: 'PDF AEAT', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  xml_aeat: { label: 'XML AEAT', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  atlas: { label: 'ATLAS', bg: '#E6F7FA', color: 'var(--teal)' },
  sin_datos: { label: 'Sin datos', bg: 'var(--n-100)', color: 'var(--n-500)' },
};

function getBannerTipo(estado: EstadoEjercicioFiscal, fuente: FuenteDatosEjercicio): 'en_curso' | 'pendiente_incompleto' | 'declarado_atlas' | 'declarado_pdf' | 'declarado_xml' | null {
  if (estado === 'en_curso') return 'en_curso';
  if (estado === 'pendiente' && (fuente === 'sin_datos' || fuente === 'atlas')) return 'pendiente_incompleto';
  if (estado === 'declarado' && fuente === 'atlas') return 'declarado_atlas';
  if (fuente === 'xml_aeat') return 'declarado_xml';
  if (fuente === 'pdf_aeat') return 'declarado_pdf';
  return null;
}

// ── Mono style ────────────────────────────────────────────
const monoStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontVariantNumeric: 'tabular-nums',
};

// ── Main Component ─────────────────────────────────────────
const MiIRPFPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const paramYear = searchParams.get('ejercicio');
  const initialYear = paramYear ? parseInt(paramYear, 10) : CURRENT_YEAR;

  const [selectedYear, setSelectedYear] = useState(Number.isFinite(initialYear) ? initialYear : CURRENT_YEAR);
  const [datos, setDatos] = useState<DatosFiscalesEjercicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPDF, setHasPDF] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Load data from resolver
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await resolverDatosEjercicio(selectedYear);
        if (cancelled) return;
        setDatos(result);

        // Check PDF availability
        const db = await initDB();
        const docs = await db.getAll('documents');
        const pdfExists = (docs as Array<{ type?: string; metadata?: { ejercicio?: number } }>)
          .some((d) => d.type === 'declaracion_irpf' && d.metadata?.ejercicio === selectedYear);
        if (!cancelled) setHasPDF(pdfExists);
      } catch (e) {
        console.error('[MiIRPF] Error loading data:', e);
        if (!cancelled) setDatos(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedYear]);

  // Build sections from resolver data
  const sections = useMemo<SeccionRendimientoProps[]>(() => {
    if (!datos) return [];

    const decl = datos.declaracionCompleta;
    // ── Rendimientos del trabajo ──
    const trabajoSections: SeccionRendimientoProps[] = [];
    if (decl?.baseGeneral?.rendimientosTrabajo) {
      const t = decl.baseGeneral.rendimientosTrabajo;
      const bruto = (t.salarioBrutoAnual ?? 0) + (t.especieAnual ?? 0);
      trabajoSections.push({
        id: 'trabajo',
        title: 'Rendimientos del trabajo',
        total: datos.rendimientosTrabajo,
        sinDatos: false,
        defaultOpen: true,
        rows: [
          { label: 'Retribuciones íntegras', value: bruto },
          { label: 'Gastos deducibles (SS)', value: -(t.cotizacionSS ?? 0), accent: 'negative' as const },
        ],
      });
    } else {
      trabajoSections.push({
        id: 'trabajo',
        title: 'Rendimientos del trabajo',
        total: datos.rendimientosTrabajo,
        sinDatos: datos.rendimientosTrabajo === null,
      });
    }

    // ── Rendimientos de inmuebles ──
    const inmuebleSections: SeccionRendimientoProps[] = [];
    if (decl?.baseGeneral?.rendimientosInmuebles && decl.baseGeneral.rendimientosInmuebles.length > 0) {
      const inmuebleDetails: InmuebleDetalleData[] = decl.baseGeneral.rendimientosInmuebles
        .filter((inm) => inm.inmuebleId >= 0)
        .map((inm) => {
          const rawPct = Math.round(inm.porcentajeReduccionHabitual * 100);
          const legalPcts = [0, 50, 60, 70, 90] as const;
          const displayPct = legalPcts.reduce<number>((best, l) =>
            Math.abs(l - rawPct) < Math.abs(best - rawPct) ? l : best, 0) as 0 | 50 | 60 | 70 | 90;

          const contratos: InmuebleDetalleData['contratos'] = [];
          if (inm.reduccionHabitual > 0 || inm.esHabitual) {
            contratos.push({
              tipo: inm.esHabitual ? 'Larga estancia' : 'Temporada',
              reduccion: displayPct,
              reduccionImporte: -inm.reduccionHabitual,
            });
          } else if (!inm.esHabitual && inm.ingresosIntegros > 0) {
            contratos.push({ tipo: 'Temporada', reduccion: 0, reduccionImporte: 0 });
          }

          return {
            nombre: inm.alias || `Inmueble ${inm.inmuebleId}`,
            rendimientoNetoReducido: inm.rendimientoNetoReducido,
            ingresosIntegros: inm.ingresosIntegros,
            gastosDeducibles: inm.gastosDeducibles,
            amortizacion: inm.amortizacion,
            rendimientoNeto: inm.rendimientoNetoAlquiler,
            contratos,
            gastosFaltantes: [],
            fuenteAtlas: datos.fuente === 'atlas',
          };
        });
      const totalInmuebles = inmuebleDetails.reduce((s, i) => s + i.rendimientoNetoReducido, 0);
      inmuebleSections.push({
        id: 'inmuebles',
        title: 'Rendimientos de inmuebles',
        total: totalInmuebles,
        sinDatos: false,
        defaultOpen: true,
        inmuebles: inmuebleDetails,
      });
    } else {
      inmuebleSections.push({
        id: 'inmuebles',
        title: 'Rendimientos de inmuebles',
        total: datos.rendimientosInmuebles,
        sinDatos: datos.rendimientosInmuebles === null,
      });
    }

    // ── Rendimientos de actividades ──
    const actividadSections: SeccionRendimientoProps[] = [];
    if (decl?.baseGeneral?.rendimientosAutonomo && (decl.baseGeneral.rendimientosAutonomo.ingresos > 0 || decl.baseGeneral.rendimientosAutonomo.rendimientoNeto !== 0)) {
      const a = decl.baseGeneral.rendimientosAutonomo;
      actividadSections.push({
        id: 'actividad',
        title: 'Rendimientos de actividades',
        total: datos.rendimientosActividades,
        sinDatos: false,
        rows: [
          { label: 'Ingresos', value: a.ingresos },
          { label: 'Gastos', value: -(a.gastos), accent: 'negative' as const },
        ],
      });
    } else {
      actividadSections.push({
        id: 'actividad',
        title: 'Rendimientos de actividades',
        total: datos.rendimientosActividades,
        sinDatos: datos.rendimientosActividades === null,
      });
    }

    // ── Rendimientos del ahorro ──
    const ahorroSections: SeccionRendimientoProps[] = [];
    if (decl?.baseAhorro && decl.baseAhorro.total !== 0) {
      ahorroSections.push({
        id: 'ahorro',
        title: 'Rendimientos del ahorro',
        total: datos.rendimientosAhorro,
        sinDatos: false,
        rows: [
          { label: 'Capital mobiliario', value: decl.baseAhorro.capitalMobiliario?.total ?? 0 },
          { label: 'Ganancias y pérdidas', value: (decl.baseAhorro.gananciasYPerdidas?.plusvalias ?? 0) - (decl.baseAhorro.gananciasYPerdidas?.minusvalias ?? 0) },
        ],
      });
    } else {
      ahorroSections.push({
        id: 'ahorro',
        title: 'Rendimientos del ahorro',
        total: datos.rendimientosAhorro,
        sinDatos: datos.rendimientosAhorro === null,
      });
    }

    // ── Summary rows (no expand) ──
    const summaryRows: SeccionRendimientoProps[] = [
      { id: 'baseGeneral', title: 'Base imponible general', total: datos.baseImponibleGeneral },
      { id: 'baseAhorro', title: 'Base imponible del ahorro', total: datos.baseImponibleAhorro },
      { id: 'cuota', title: 'Cuota íntegra', total: datos.cuotaIntegra },
    ];

    // ── Retenciones ──
    const retencionesSection: SeccionRendimientoProps[] = [];
    if (decl?.retenciones) {
      const r = decl.retenciones;
      retencionesSection.push({
        id: 'retenciones',
        title: 'Retenciones y pagos a cuenta',
        total: datos.retenciones !== null ? -datos.retenciones : null,
        rows: [
          { label: 'Retenciones trabajo', value: -(r.trabajo ?? 0), accent: 'positive' as const },
          { label: 'Retenciones capital mobiliario', value: -(r.capitalMobiliario ?? 0), accent: 'positive' as const },
          { label: 'Pagos fraccionados (M130)', value: -(r.autonomoM130 ?? 0), accent: 'positive' as const },
        ],
      });
    } else {
      retencionesSection.push({
        id: 'retenciones',
        title: 'Retenciones y pagos a cuenta',
        total: datos.retenciones !== null ? -datos.retenciones : null,
        sinDatos: datos.retenciones === null,
      });
    }

    return [
      ...trabajoSections,
      ...inmuebleSections,
      ...actividadSections,
      ...ahorroSections,
      ...summaryRows,
      ...retencionesSection,
    ];
  }, [datos]);

  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year);
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    try {
      const db = await initDB();
      const docs = await db.getAll('documents');
      const doc = (docs as Array<{ id?: number; type?: string; filename?: string; metadata?: { ejercicio?: number } }>)
        .find((d) => d.type === 'declaracion_irpf' && d.metadata?.ejercicio === selectedYear);
      if (!doc?.id) return;
      const blob = await getDocumentBlob(doc.id);
      if (blob) downloadBlob(blob, doc.filename || `Declaracion_IRPF_${selectedYear}.pdf`);
    } catch (e) {
      console.error('Error downloading PDF:', e);
    }
  }, [selectedYear]);

  const handleCompletar = useCallback(() => {
    // Future: open manual completion modal
  }, []);

  const estado = datos?.estado ?? 'en_curso';
  const fuente = datos?.fuente ?? 'sin_datos';
  const estadoDisplay = ESTADO_DISPLAY[estado];
  const fuenteDisplay = FUENTE_DISPLAY[fuente];
  const bannerTipo = getBannerTipo(estado, fuente);
  const hasAnyData = datos && (datos.resultado !== null || datos.rendimientosTrabajo !== null || datos.rendimientosInmuebles !== null || datos.fuente !== 'sin_datos');

  return (
    <FiscalPageShell>
      <div style={{ display: 'grid', gap: 'var(--s4, 16px)', fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)' }}>
        {/* ── Header ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--t-lg, 1.25rem)', fontWeight: 600, color: 'var(--n-900)' }}>
              Mi IRPF {selectedYear}
            </h2>
            {estado === 'en_curso' && (
              <p style={{ margin: '4px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>
                Estimación del ejercicio en curso
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
              borderRadius: 999, fontSize: 'var(--t-xs, 11px)', fontWeight: 600,
              background: estadoDisplay.bg, color: estadoDisplay.color,
            }}>
              {estadoDisplay.label}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
              borderRadius: 999, fontSize: 'var(--t-xs, 11px)', fontWeight: 600,
              background: fuenteDisplay.bg, color: fuenteDisplay.color,
            }}>
              {fuenteDisplay.label}
            </span>
            {hasPDF ? (
              <button type="button" onClick={handleDownloadPDF} title="Descargar PDF" style={{
                border: '1px solid var(--n-300)', borderRadius: 'var(--r-md, 8px)',
                background: 'var(--white)', padding: '6px 12px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 'var(--t-xs, 11px)', fontWeight: 500, color: 'var(--n-700)', minHeight: 32,
              }}>
                <Download size={14} /> PDF
              </button>
            ) : estado !== 'en_curso' ? (
              <button type="button" onClick={() => setShowImportWizard(true)} title="Importar declaración" style={{
                border: '1px solid var(--n-300)', borderRadius: 'var(--r-md, 8px)',
                background: 'var(--white)', padding: '6px 12px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 'var(--t-xs, 11px)', fontWeight: 500, color: 'var(--n-700)', minHeight: 32,
              }}>
                <Upload size={14} /> Importar
              </button>
            ) : null}
          </div>
        </header>

        {/* ── Year selector ── */}
        <EjercicioPillSelector value={selectedYear} onChange={handleYearChange} years={YEARS} />

        {/* ── Content ── */}
        {loading ? (
          <section style={{ display: 'grid', gap: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '14px 18px',
                border: '1px solid var(--n-200)',
                borderRadius: i === 0 ? 'var(--r-lg, 12px) var(--r-lg, 12px) 0 0' : i === 4 ? '0 0 var(--r-lg, 12px) var(--r-lg, 12px)' : 0,
                borderTop: i > 0 ? 'none' : undefined,
              }}>
                <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 4px)', height: 16, width: 200, animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 4px)', height: 16, width: 100, animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </section>
        ) : !hasAnyData ? (
          <section style={{
            padding: 48, textAlign: 'center',
            background: 'var(--n-50)', borderRadius: 'var(--r-lg, 12px)',
            border: '1px dashed var(--n-300)',
          }}>
            <p style={{ margin: 0, color: 'var(--n-500)', fontSize: 'var(--t-sm, 13px)' }}>
              No hay datos para {selectedYear}. Importa la declaración o los Datos Fiscales.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button type="button" onClick={() => setShowImportWizard(true)} style={{
                padding: '10px 16px', borderRadius: 'var(--r-md, 8px)',
                border: '1px solid var(--n-300)', background: 'var(--white)',
                color: 'var(--n-900)', fontWeight: 500, fontSize: 'var(--t-sm, 13px)',
                cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
              }}>
                <FileText size={16} /> Importar declaración
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* ── Resumen Modelo 100 ── */}
            <ResumenDeclaracion
              resultado={datos!.resultado}
              baseLiquidableGeneral={datos!.resumen.baseLiquidableGeneral}
              baseLiquidableAhorro={datos!.resumen.baseLiquidableAhorro}
              cuotaIntegraEstatal={datos!.resumen.cuotaIntegraEstatal}
              cuotaIntegraAutonomica={datos!.resumen.cuotaIntegraAutonomica}
              cuotaLiquidaEstatal={datos!.resumen.cuotaLiquidaEstatal}
              cuotaLiquidaAutonomica={datos!.resumen.cuotaLiquidaAutonomica}
            />

            {/* ── Cascade sections ── */}
            <div style={{
              border: '1px solid var(--n-200)',
              borderRadius: 'var(--r-lg, 12px)',
              overflow: 'hidden',
            }}>
              {sections.map((section) => (
                <SeccionRendimiento
                  key={section.id}
                  id={section.id}
                  title={section.title}
                  total={section.total}
                  rows={section.rows}
                  inmuebles={section.inmuebles}
                  sinDatos={section.sinDatos}
                  onCompletar={section.sinDatos && fuente === 'sin_datos' ? handleCompletar : undefined}
                  defaultOpen={section.defaultOpen}
                />
              ))}

              {/* ── Resultado final ── */}
              {datos!.resultado !== null && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 18px', background: 'var(--n-100)',
                  borderTop: '1px solid var(--n-200)',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--t-base, 14px)', color: 'var(--n-900)' }}>
                    RESULTADO
                  </span>
                  <span style={{
                    ...monoStyle, fontSize: 'var(--t-lg, 1.25rem)', fontWeight: 600,
                    color: datos!.resultado! < 0 ? 'var(--teal)' : 'var(--blue)',
                  }}>
                    {datos!.tipoResultado === 'devolver' ? 'A devolver ' : 'A pagar '}
                    {formatFiscalValue(Math.abs(datos!.resultado!))}
                  </span>
                </div>
              )}
            </div>

            {/* ── Banner contextual ── */}
            {bannerTipo && (
              <BannerContextual
                tipo={bannerTipo}
                onImportar={fuente !== 'pdf_aeat' && fuente !== 'xml_aeat' && estado !== 'en_curso' ? () => setShowImportWizard(true) : undefined}
                onCompletar={fuente === 'sin_datos' ? handleCompletar : undefined}
              />
            )}
          </>
        )}
      </div>

      {showImportWizard && (
        <ImportarDatosWizard
          onClose={() => setShowImportWizard(false)}
          onImported={() => {
            setShowImportWizard(false);
            const y = selectedYear;
            setSelectedYear(0);
            setTimeout(() => setSelectedYear(y), 0);
          }}
        />
      )}
    </FiscalPageShell>
  );
};

export default MiIRPFPage;
