import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Upload } from 'lucide-react';
import FiscalPageShell from '../components/FiscalPageShell';
import EjercicioPillSelector from '../components/EjercicioPillSelector';
import ResumenDeclaracion from '../../../../components/fiscal/ResumenDeclaracion';
import SeccionRendimiento from '../../../../components/fiscal/SeccionRendimiento';
import CompletenessBar from '../../../../components/fiscal/CompletenessBar';
import BannerContextual from '../../../../components/fiscal/BannerContextual';
import { useFiscalData } from '../../../../contexts/FiscalContext';
import {
  getTodosLosEjercicios,
  getDeclaracion,
} from '../../../../services/ejercicioResolverService';
import type { DeclaracionIRPF } from '../../../../services/irpfCalculationService';
import type { InmuebleDetalleData } from '../../../../components/fiscal/InmuebleDetalle';
import type { SeccionRendimientoProps } from '../../../../components/fiscal/SeccionRendimiento';
import { initDB, downloadBlob, getDocumentBlob } from '../../../../services/db';
import ImportarDatosWizard from '../historial/ImportarDatosWizard';

// ── Constants ──────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

// ── Estado / Fuente logic ──────────────────────────────────
type EstadoFiscal = 'declarado' | 'pendiente' | 'en_curso';
type FuenteDatos = 'pdf_aeat' | 'atlas' | 'manual' | 'parcial' | 'sin_datos';

function getEstadoFiscal(year: number): EstadoFiscal {
  const hoy = new Date();
  const añoActual = hoy.getFullYear();

  if (year === añoActual) return 'en_curso';

  if (year === añoActual - 1) {
    const finCampaña = new Date(añoActual, 5, 30); // 30 de junio
    return hoy <= finCampaña ? 'pendiente' : 'declarado';
  }

  return 'declarado';
}

const ESTADO_DISPLAY: Record<EstadoFiscal, { label: string; bg: string; color: string }> = {
  declarado: { label: 'Declarado', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  pendiente: { label: 'Pendiente', bg: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  en_curso: { label: 'En curso', bg: '#E6F7FA', color: 'var(--teal)' },
};

const FUENTE_DISPLAY: Record<FuenteDatos, { label: string; bg: string; color: string }> = {
  pdf_aeat: { label: 'PDF AEAT', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  atlas: { label: 'ATLAS', bg: '#E6F7FA', color: 'var(--teal)' },
  manual: { label: 'Manual', bg: 'var(--n-100)', color: 'var(--n-700)' },
  parcial: { label: 'Parcial', bg: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  sin_datos: { label: 'Sin datos', bg: 'var(--n-100)', color: 'var(--n-500)' },
};

// ── Helpers ────────────────────────────────────────────────
function mapFuente(resolverFuente: string, hasPDF: boolean): FuenteDatos {
  if (hasPDF) return 'pdf_aeat';
  if (resolverFuente === 'aeat') return 'pdf_aeat';
  if (resolverFuente === 'atlas') return 'atlas';
  if (resolverFuente === 'manual') return 'manual';
  return 'sin_datos';
}

function getBannerTipo(estado: EstadoFiscal, fuente: FuenteDatos): 'en_curso' | 'pendiente_incompleto' | 'declarado_atlas' | 'declarado_pdf' | null {
  if (estado === 'en_curso') return 'en_curso';
  if (estado === 'pendiente' && (fuente === 'parcial' || fuente === 'sin_datos' || fuente === 'atlas')) return 'pendiente_incompleto';
  if (estado === 'declarado' && fuente === 'atlas') return 'declarado_atlas';
  if (fuente === 'pdf_aeat') return 'declarado_pdf';
  return null;
}

/** Compute completeness % based on which sections have data */
function calcCompleteness(decl: DeclaracionIRPF | null): number {
  if (!decl) return 0;
  let total = 4;
  let filled = 0;
  if (decl.baseGeneral.rendimientosTrabajo) filled++;
  if (decl.baseGeneral.rendimientosInmuebles.length > 0) filled++;
  if (decl.baseGeneral.rendimientosAutonomo) filled++;
  if (decl.baseAhorro && decl.baseAhorro.total !== 0) filled++;
  return Math.round((filled / total) * 100);
}

// ── Main Component ─────────────────────────────────────────
const MiIRPFPage: React.FC = () => {
  const { declaracion: contextDecl, loading: contextLoading, setEjercicio: setContextEjercicio } = useFiscalData();

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [allYears, setAllYears] = useState<number[]>([]);
  const [resolverFuente, setResolverFuente] = useState<string>('ninguno');
  const [hasPDF, setHasPDF] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Load available years
  useEffect(() => {
    getTodosLosEjercicios().then((todos) => {
      const years = todos
        .map((e) => e.año)
        .filter((a) => a <= CURRENT_YEAR && a >= 2015)
        .sort((a, b) => b - a);
      setAllYears(years.length > 0 ? years : Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - i));
    }).catch(() => {
      setAllYears(Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - i));
    });
  }, []);

  // Sync context year with selected year
  useEffect(() => {
    setContextEjercicio(selectedYear);
  }, [selectedYear, setContextEjercicio]);

  // Load resolver data for selected year
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const decl = await getDeclaracion(selectedYear);
        if (cancelled) return;
        setResolverFuente(decl.fuente);
        // Check if PDF exists for year
        const db = await initDB();
        const docs = await db.getAll('documents');
        const pdfExists = (docs as Array<{ type?: string; metadata?: { ejercicio?: number } }>)
          .some((d) => d.type === 'declaracion_irpf' && d.metadata?.ejercicio === selectedYear);
        setHasPDF(pdfExists);
      } catch (e) {
        console.error('[MiIRPF] Error loading data:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedYear]);

  const declaracion: DeclaracionIRPF | null = contextDecl;
  const estado = getEstadoFiscal(selectedYear);
  const fuente = mapFuente(resolverFuente, hasPDF);
  const estadoDisplay = ESTADO_DISPLAY[estado];
  const fuenteDisplay = FUENTE_DISPLAY[fuente];
  const bannerTipo = getBannerTipo(estado, fuente);
  const completeness = calcCompleteness(declaracion);
  const showCompleteness = estado === 'pendiente' && (fuente === 'parcial' || fuente === 'atlas');

  // Build cascade sections
  const sections = useMemo<Array<SeccionRendimientoProps & { isResult?: boolean }>>(() => {
    if (!declaracion) return [];

    const trabajo = declaracion.baseGeneral.rendimientosTrabajo;
    const trabajoBruto = (trabajo?.salarioBrutoAnual ?? 0) + (trabajo?.especieAnual ?? 0);
    const trabajoGastos = trabajo?.cotizacionSS ?? 0;
    const trabajoNeto = trabajo?.rendimientoNeto ?? (trabajoBruto - trabajoGastos);
    const hasTrabajo = trabajo !== null;

    const inmuebleDetails: InmuebleDetalleData[] = declaracion.baseGeneral.rendimientosInmuebles
      .filter((inm) => inm.inmuebleId >= 0)
      .map((inm) => {
        const rawPct = Math.round(inm.porcentajeReduccionHabitual * 100);
        const legalPcts = [0, 50, 60, 70, 90] as const;
        const displayPct = legalPcts.reduce<number>((best, l) =>
          Math.abs(l - rawPct) < Math.abs(best - rawPct) ? l : best, 0) as 0 | 50 | 60 | 70 | 90;

        // Determine missing expenses for ATLAS-sourced properties
        const gastosFaltantes: string[] = [];
        if (fuente === 'atlas' || fuente === 'parcial') {
          if (inm.gastosDeducibles === 0 && inm.ingresosIntegros > 0) {
            gastosFaltantes.push('Comunidad', 'IBI', 'Seguro');
          }
        }

        // TODO: T2.4 - Connect per-contract reduction data when available.
        // For now, use single contract with inferred reduction %.
        const contratos: InmuebleDetalleData['contratos'] = [];
        if (inm.reduccionHabitual > 0 || inm.esHabitual) {
          contratos.push({
            tipo: inm.esHabitual ? 'Larga estancia' : 'Temporada',
            fecha: undefined, // TODO: connect from contract model
            reduccion: displayPct,
            reduccionImporte: -inm.reduccionHabitual,
          });
        } else if (!inm.esHabitual && inm.ingresosIntegros > 0) {
          contratos.push({
            tipo: 'Temporada',
            reduccion: 0,
            reduccionImporte: 0,
          });
        }

        return {
          nombre: inm.alias || `Inmueble ${inm.inmuebleId}`,
          rendimientoNetoReducido: inm.rendimientoNetoReducido,
          ingresosIntegros: inm.ingresosIntegros,
          gastosDeducibles: inm.gastosDeducibles,
          amortizacion: inm.amortizacion,
          rendimientoNeto: inm.rendimientoNetoAlquiler,
          contratos,
          gastosFaltantes,
          fuenteAtlas: fuente === 'atlas' || fuente === 'parcial',
        };
      });

    const totalInmuebles = inmuebleDetails.reduce((s, i) => s + i.rendimientoNetoReducido, 0);
    const hasInmuebles = inmuebleDetails.length > 0;

    const autonomo = declaracion.baseGeneral.rendimientosAutonomo;
    const totalActividad = autonomo?.rendimientoNeto ?? 0;
    const hasActividad = autonomo !== null && (autonomo.ingresos > 0 || totalActividad !== 0);

    const ahorro = declaracion.baseAhorro;
    const totalAhorro = ahorro?.total ?? 0;
    const hasAhorro = totalAhorro !== 0;

    const result: Array<SeccionRendimientoProps & { isResult?: boolean }> = [
      {
        id: 'trabajo',
        title: 'Rendimientos del trabajo',
        total: hasTrabajo ? trabajoNeto : null,
        sinDatos: !hasTrabajo,
        defaultOpen: true,
        rows: hasTrabajo ? [
          { label: 'Retribuciones íntegras', value: trabajoBruto },
          { label: 'Gastos deducibles (SS)', value: -trabajoGastos, accent: 'negative' as const },
        ] : undefined,
      },
      {
        id: 'inmuebles',
        title: 'Rendimientos de inmuebles',
        total: hasInmuebles ? totalInmuebles : null,
        sinDatos: !hasInmuebles,
        defaultOpen: true,
        inmuebles: hasInmuebles ? inmuebleDetails : undefined,
      },
    ];

    // Actividades
    result.push({
      id: 'actividad',
      title: 'Rendimientos de actividades',
      total: hasActividad ? totalActividad : null,
      sinDatos: !hasActividad,
      rows: hasActividad ? [
        { label: 'Ingresos', value: autonomo!.ingresos },
        { label: 'Gastos', value: -(autonomo!.gastos), accent: 'negative' as const },
      ] : undefined,
    });

    // Ahorro
    result.push({
      id: 'ahorro',
      title: 'Rendimientos del ahorro',
      total: hasAhorro ? totalAhorro : null,
      sinDatos: !hasAhorro,
      rows: hasAhorro ? [
        { label: 'Capital mobiliario', value: ahorro.capitalMobiliario.total },
        { label: 'Ganancias y pérdidas', value: ahorro.gananciasYPerdidas.plusvalias - ahorro.gananciasYPerdidas.minusvalias },
      ] : undefined,
    });

    // Summary rows (not expandable)
    result.push(
      { id: 'baseGeneral', title: 'Base imponible general', total: declaracion.liquidacion.baseImponibleGeneral },
      { id: 'baseAhorro', title: 'Base imponible del ahorro', total: declaracion.liquidacion.baseImponibleAhorro },
      { id: 'cuota', title: 'Cuota íntegra', total: declaracion.liquidacion.cuotaIntegra },
      {
        id: 'retenciones',
        title: 'Retenciones y pagos a cuenta',
        total: -declaracion.retenciones.total,
        defaultOpen: false,
        rows: [
          { label: 'Retenciones trabajo', value: -(declaracion.retenciones.trabajo), accent: 'positive' as const },
          { label: 'Retenciones capital mobiliario', value: -(declaracion.retenciones.capitalMobiliario), accent: 'positive' as const },
          { label: 'Pagos fraccionados (M130)', value: -(declaracion.retenciones.autonomoM130), accent: 'positive' as const },
        ],
      },
    );

    return result;
  }, [declaracion, fuente]);

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

  // TODO: Completar manualmente — for now, show a toast or no-op
  const handleCompletar = useCallback(() => {
    // This will be connected in a future task
  }, []);

  const isLoading = loading || (selectedYear === CURRENT_YEAR && contextLoading);

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
            {/* Estado badge */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 'var(--t-xs, 11px)',
              fontWeight: 600,
              background: estadoDisplay.bg,
              color: estadoDisplay.color,
            }}>
              {estadoDisplay.label}
            </span>
            {/* Fuente badge */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 'var(--t-xs, 11px)',
              fontWeight: 600,
              background: fuenteDisplay.bg,
              color: fuenteDisplay.color,
            }}>
              {fuenteDisplay.label}
            </span>
            {/* PDF / Import button */}
            {hasPDF ? (
              <button
                type="button"
                onClick={handleDownloadPDF}
                title="Descargar PDF"
                style={{
                  border: '1px solid var(--n-300)',
                  borderRadius: 'var(--r-md, 8px)',
                  background: 'var(--white)',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--t-xs, 11px)',
                  fontWeight: 500,
                  color: 'var(--n-700)',
                  minHeight: 32,
                }}
              >
                <Download size={14} />
                PDF
              </button>
            ) : estado !== 'en_curso' ? (
              <button
                type="button"
                onClick={() => setShowImportWizard(true)}
                title="Importar declaración"
                style={{
                  border: '1px solid var(--n-300)',
                  borderRadius: 'var(--r-md, 8px)',
                  background: 'var(--white)',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--t-xs, 11px)',
                  fontWeight: 500,
                  color: 'var(--n-700)',
                  minHeight: 32,
                }}
              >
                <Upload size={14} />
                Importar
              </button>
            ) : null}
          </div>
        </header>

        {/* ── Year selector ── */}
        {allYears.length > 0 && (
          <EjercicioPillSelector value={selectedYear} onChange={handleYearChange} years={allYears} />
        )}

        {/* ── Loading ── */}
        {isLoading ? (
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
        ) : resolverFuente === 'ninguno' && !declaracion ? (
          /* ── Empty state ── */
          <section style={{
            padding: 48,
            textAlign: 'center',
            background: 'var(--n-50)',
            borderRadius: 'var(--r-lg, 12px)',
            border: '1px dashed var(--n-300)',
          }}>
            <p style={{ margin: 0, color: 'var(--n-500)', fontSize: 'var(--t-sm, 13px)' }}>
              No hay datos para {selectedYear}. Importa la declaración o los Datos Fiscales.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowImportWizard(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--r-md, 8px)',
                  border: '1px solid var(--n-300)',
                  background: 'var(--white)',
                  color: 'var(--n-900)',
                  fontWeight: 500,
                  fontSize: 'var(--t-sm, 13px)',
                  cursor: 'pointer',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
                }}
              >
                <FileText size={16} />
                Importar declaración
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* ── Resumen ── */}
            <ResumenDeclaracion
              resultado={declaracion?.resultado ?? null}
              baseGeneral={declaracion?.liquidacion.baseImponibleGeneral ?? null}
              baseAhorro={declaracion?.liquidacion.baseImponibleAhorro ?? null}
              cuotaIntegra={declaracion?.liquidacion.cuotaIntegra ?? null}
              retenciones={declaracion?.retenciones.total ?? null}
            />

            {/* ── Completeness bar (only for pendiente + parcial) ── */}
            {showCompleteness && (
              <CompletenessBar
                porcentaje={completeness}
                label={`Completitud de la declaración ${selectedYear}`}
              />
            )}

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
                  onCompletar={section.sinDatos && fuente !== 'pdf_aeat' ? handleCompletar : undefined}
                  defaultOpen={section.defaultOpen}
                />
              ))}

              {/* ── Resultado final ── */}
              {declaracion && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 18px',
                  background: 'var(--n-100)',
                  borderTop: '1px solid var(--n-200)',
                }}>
                  <span style={{
                    fontWeight: 600,
                    fontSize: 'var(--t-base, 14px)',
                    color: 'var(--n-900)',
                  }}>
                    RESULTADO
                  </span>
                  <span style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 'var(--t-lg, 1.25rem)',
                    fontWeight: 600,
                    color: declaracion.resultado < 0 ? 'var(--s-pos)' : 'var(--s-neg)',
                  }}>
                    {declaracion.resultado < 0 ? 'A devolver ' : 'A pagar '}
                    {Math.abs(declaracion.resultado).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
              )}
            </div>

            {/* ── Banner contextual ── */}
            {bannerTipo && (
              <BannerContextual
                tipo={bannerTipo}
                onImportar={fuente !== 'pdf_aeat' && estado !== 'en_curso' ? () => setShowImportWizard(true) : undefined}
                onCompletar={fuente !== 'pdf_aeat' ? handleCompletar : undefined}
              />
            )}
          </>
        )}
      </div>

      {/* ── Import wizard modal ── */}
      {showImportWizard && (
        <ImportarDatosWizard
          onClose={() => setShowImportWizard(false)}
          onImported={() => {
            setShowImportWizard(false);
            // Reload data by bumping the year (triggers effects)
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
