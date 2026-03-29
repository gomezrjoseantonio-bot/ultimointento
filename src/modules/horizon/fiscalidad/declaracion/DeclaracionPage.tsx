import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calculator, ChevronDown, ChevronRight, FileCheck, FileText, Pencil, Camera } from 'lucide-react';
import FiscalPageShell from '../components/FiscalPageShell';
import EjercicioPillSelector from '../components/EjercicioPillSelector';
import {
  getDeclaracion,
  getTodosLosEjercicios,
} from '../../../../services/ejercicioResolverService';
import type { ResumenFiscal } from '../../../../services/ejercicioResolverService';
import { useFiscalData } from '../../../../contexts/FiscalContext';
import type { DeclaracionIRPF } from '../../../../services/irpfCalculationService';

// ── Formatters ──────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMoney = (v: number) => `${fmt(Math.abs(v))} €`;
const fmtSigned = (v: number) => `${v >= 0 ? '' : '-'}${fmt(Math.abs(v))} €`;

// ── Source badge config ─────────────────────────────────────
const SOURCE_BADGE: Record<string, { label: string; icon: React.ReactNode }> = {
  aeat: { label: 'PDF AEAT', icon: <FileCheck size={14} /> },
  atlas: { label: 'Cálculo ATLAS', icon: <Calculator size={14} /> },
  manual: { label: 'Manual', icon: <Pencil size={14} /> },
};

// ── Section types ───────────────────────────────────────────
interface DetailRow {
  label: string;
  value: number;
  accent?: 'positive' | 'negative';
}

interface InmuebleDetail {
  name: string;
  rendimientoReducido: number;
  rows: DetailRow[];
}

interface CascadeSection {
  id: string;
  title: string;
  total: number;
  rows?: DetailRow[];
  inmuebles?: InmuebleDetail[];
  isResult?: boolean;
}

// ── Component ───────────────────────────────────────────────
const DeclaracionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { declaracion: contextDecl, loading: contextLoading } = useFiscalData();
  const currentYear = new Date().getFullYear();

  const initialYear = Number(searchParams.get('ejercicio')) || currentYear;
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [allYears, setAllYears] = useState<number[]>([]);
  const [fuente, setFuente] = useState<'aeat' | 'atlas' | 'ninguno'>('ninguno');
  const [resumen, setResumen] = useState<ResumenFiscal | null>(null);
  const [loading, setLoading] = useState(true);

  // Section expand state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    trabajo: true,
    inmuebles: true,
    retenciones: true,
  });
  const [openInmuebles, setOpenInmuebles] = useState<Record<number, boolean>>({ 0: true });

  // Load available years
  useEffect(() => {
    getTodosLosEjercicios().then((todos) => {
      const years = todos
        .map((e) => e.año)
        .filter((año) => año <= currentYear && año >= 2015)
        .sort((a, b) => b - a);
      setAllYears(years.length > 0 ? years : Array.from({ length: 7 }, (_, i) => currentYear - i));
    }).catch(() => {
      setAllYears(Array.from({ length: 7 }, (_, i) => currentYear - i));
    });
  }, [currentYear]);

  // Load resolver data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const decl = await getDeclaracion(selectedYear);
        if (cancelled) return;
        setFuente(decl.fuente);
        setResumen(decl.resumen);
      } catch (e) {
        console.error('Error loading declaracion:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedYear]);

  // Use FiscalContext declaracion for detailed cascade (it has full breakdown)
  const declaracion: DeclaracionIRPF | null = contextDecl;

  // Build cascade sections from declaracion
  const sections = useMemo<CascadeSection[]>(() => {
    if (!declaracion && !resumen) return [];

    // If we have full declaracion from context, build detailed cascade
    if (declaracion) {
      const trabajo = declaracion.baseGeneral.rendimientosTrabajo;
      const trabajoBruto = (trabajo?.salarioBrutoAnual ?? 0) + (trabajo?.especieAnual ?? 0);
      const trabajoGastos = trabajo?.cotizacionSS ?? 0;
      const trabajoNeto = trabajo?.rendimientoNeto ?? (trabajoBruto - trabajoGastos);

      const inmuebleDetails: InmuebleDetail[] = declaracion.baseGeneral.rendimientosInmuebles
        .filter((inm) => inm.inmuebleId >= 0)
        .map((inm) => {
          // Round reduction % to nearest legal value (0, 50, 60, 70, 90)
          const rawPct = Math.round(inm.porcentajeReduccionHabitual * 100);
          const legalPcts = [0, 50, 60, 70, 90];
          const displayPct = legalPcts.reduce((best, l) => Math.abs(l - rawPct) < Math.abs(best - rawPct) ? l : best, 0);

          return {
            name: inm.alias || `Inmueble ${inm.inmuebleId}`,
            rendimientoReducido: inm.rendimientoNetoReducido,
            rows: [
              { label: 'Ingresos íntegros', value: inm.ingresosIntegros },
              { label: 'Gastos deducibles', value: -inm.gastosDeducibles, accent: 'negative' as const },
              { label: 'Amortización', value: -inm.amortizacion, accent: 'negative' as const },
              { label: 'Rendimiento neto', value: inm.rendimientoNetoAlquiler },
              ...(inm.reduccionHabitual > 0 ? [
                { label: `Reducción (${displayPct}%)`, value: -inm.reduccionHabitual, accent: 'negative' as const },
              ] : []),
              { label: 'Rendimiento neto reducido', value: inm.rendimientoNetoReducido },
            ],
          };
        });

      const totalInmuebles = inmuebleDetails.reduce((s, i) => s + i.rendimientoReducido, 0);
      const totalActividad = declaracion.baseGeneral.rendimientosAutonomo?.rendimientoNeto ?? 0;
      const totalRetenciones = declaracion.retenciones.total;

      const result: CascadeSection[] = [
        {
          id: 'trabajo',
          title: 'Rendimientos del trabajo',
          total: trabajoNeto,
          rows: [
            { label: 'Retribuciones íntegras', value: trabajoBruto },
            { label: 'Gastos deducibles', value: -trabajoGastos, accent: 'negative' },
          ],
        },
        {
          id: 'inmuebles',
          title: 'Rendimientos de inmuebles',
          total: totalInmuebles,
          inmuebles: inmuebleDetails,
        },
      ];

      if (totalActividad !== 0 || (declaracion.baseGeneral.rendimientosAutonomo?.ingresos ?? 0) > 0) {
        result.push({
          id: 'actividad',
          title: 'Rendimientos de actividades',
          total: totalActividad,
          rows: [
            { label: 'Ingresos', value: declaracion.baseGeneral.rendimientosAutonomo?.ingresos ?? 0 },
            { label: 'Gastos', value: -(declaracion.baseGeneral.rendimientosAutonomo?.gastos ?? 0), accent: 'negative' as const },
          ],
        });
      }

      result.push(
        { id: 'baseGeneral', title: 'Base imponible general', total: declaracion.liquidacion?.baseImponibleGeneral ?? resumen?.baseImponibleGeneral ?? 0 },
        { id: 'baseAhorro', title: 'Base imponible del ahorro', total: declaracion.liquidacion?.baseImponibleAhorro ?? resumen?.baseImponibleAhorro ?? 0 },
        { id: 'cuota', title: 'Cuota íntegra', total: declaracion.liquidacion?.cuotaIntegra ?? resumen?.cuotaIntegra ?? 0 },
        {
          id: 'retenciones',
          title: 'Retenciones y pagos a cuenta',
          total: -totalRetenciones,
          rows: [
            { label: 'Retenciones trabajo', value: -(declaracion.retenciones.trabajo ?? 0), accent: 'positive' },
            { label: 'Retenciones capital mobiliario', value: -(declaracion.retenciones.capitalMobiliario ?? 0), accent: 'positive' },
            { label: 'Pagos fraccionados (M130)', value: -(declaracion.retenciones.autonomoM130 ?? 0), accent: 'positive' },
          ],
        },
        {
          id: 'resultado',
          title: 'RESULTADO',
          total: declaracion.resultado,
          isResult: true,
        },
      );

      return result;
    }

    // Fallback: use resumen only (less detail)
    if (resumen) {
      return [
        { id: 'baseGeneral', title: 'Base liquidable general', total: resumen.baseLiquidableGeneral },
        { id: 'baseAhorro', title: 'Base liquidable del ahorro', total: resumen.baseLiquidableAhorro },
        { id: 'cuotaEstatal', title: 'Cuota íntegra estatal', total: resumen.cuotaIntegraEstatal },
        { id: 'cuotaAutonomica', title: 'Cuota íntegra autonómica', total: resumen.cuotaIntegraAutonomica },
        { id: 'cuotaLiqEstatal', title: 'Cuota líquida estatal', total: resumen.cuotaLiquidaEstatal },
        { id: 'cuotaLiqAutonomica', title: 'Cuota líquida autonómica', total: resumen.cuotaLiquidaAutonomica },
        { id: 'resultado', title: 'RESULTADO', total: resumen.resultado, isResult: true },
      ];
    }

    return [];
  }, [declaracion, resumen]);

  const toggleSection = (id: string) => setOpenSections((s) => ({ ...s, [id]: !s[id] }));
  const toggleInmueble = (idx: number) => setOpenInmuebles((s) => ({ ...s, [idx]: !s[idx] }));

  const isLoading = loading || (selectedYear === currentYear && contextLoading);
  const sourceInfo = SOURCE_BADGE[fuente] ?? null;

  return (
    <FiscalPageShell>
      <div style={{ display: 'grid', gap: 'var(--s4, 16px)', fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)' }}>
        {/* ── Header ── */}
        <header>
          <h2 style={{ margin: 0, fontSize: 'var(--t-lg, 1.25rem)', fontWeight: 600, color: 'var(--n-900)' }}>
            Declaración IRPF {selectedYear}
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>
            Modelo 100 — Desglose completo
          </p>
        </header>

        {/* ── Exercise selector + Source badge ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {allYears.length > 0 && (
            <EjercicioPillSelector value={selectedYear} onChange={setSelectedYear} years={allYears} />
          )}
          {sourceInfo && fuente !== 'ninguno' && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 'var(--t-xs, 11px)',
              fontWeight: 500,
              background: 'var(--n-100)',
              color: 'var(--n-700)',
            }}>
              {sourceInfo.icon}
              {sourceInfo.label}
            </span>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading ? (
          <section style={{ display: 'grid', gap: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '14px 18px',
                border: '1px solid var(--n-200)', borderRadius: i === 0 ? 'var(--r-lg, 12px) var(--r-lg, 12px) 0 0' : i === 4 ? '0 0 var(--r-lg, 12px) var(--r-lg, 12px)' : 0,
                borderTop: i > 0 ? 'none' : undefined,
              }}>
                <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 4px)', height: 16, width: 200, animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 4px)', height: 16, width: 100, animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </section>
        ) : fuente === 'ninguno' ? (
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
                onClick={() => navigate('/fiscalidad/historial')}
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
              <button
                type="button"
                onClick={() => navigate('/fiscalidad/historial')}
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
                <Camera size={16} />
                Importar Datos Fiscales
              </button>
            </div>
          </section>
        ) : (
          /* ── Cascade ── */
          <div style={{
            border: '1px solid var(--n-200)',
            borderRadius: 'var(--r-lg, 12px)',
            overflow: 'hidden',
          }}>
            {sections.map((section, sIdx) => {
              if (section.isResult) {
                // RESULTADO row — always visible, not collapsable
                const isDevolver = section.total < 0;
                return (
                  <div
                    key={section.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 18px',
                      background: 'var(--n-100)',
                      borderTop: '1px solid var(--n-200)',
                    }}
                  >
                    <span style={{
                      fontWeight: 500,
                      fontSize: 'var(--t-base, 14px)',
                      color: 'var(--n-900)',
                    }}>
                      {section.title}
                    </span>
                    <span style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 'var(--t-lg, 1.25rem)',
                      fontWeight: 500,
                      color: isDevolver ? 'var(--s-pos)' : 'var(--s-neg)',
                    }}>
                      {isDevolver ? 'A devolver ' : 'A pagar '}
                      {fmtMoney(section.total)}
                    </span>
                  </div>
                );
              }

              const hasDetail = Boolean((section.rows && section.rows.length) || (section.inmuebles && section.inmuebles.length));
              const isOpen = openSections[section.id] ?? false;

              return (
                <div key={section.id}>
                  {/* Section header row */}
                  <button
                    type="button"
                    onClick={() => hasDetail && toggleSection(section.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 18px',
                      border: 'none',
                      borderBottom: '1px solid var(--n-100)',
                      background: 'transparent',
                      cursor: hasDetail ? 'pointer' : 'default',
                      minHeight: 44,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {hasDetail && (
                        isOpen
                          ? <ChevronDown size={16} style={{ color: 'var(--n-500)' }} />
                          : <ChevronRight size={16} style={{ color: 'var(--n-500)' }} />
                      )}
                      <span style={{
                        fontFamily: 'IBM Plex Sans, sans-serif',
                        fontSize: 'var(--t-sm, 13px)',
                        fontWeight: 500,
                        color: 'var(--n-900)',
                      }}>
                        {section.title}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 'var(--t-sm, 13px)',
                      color: 'var(--n-900)',
                    }}>
                      {fmtSigned(section.total)}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {hasDetail && isOpen && (
                    <div style={{ background: 'var(--n-50)', borderBottom: '1px solid var(--n-100)', padding: '8px 18px 12px' }}>
                      {/* Inmuebles sub-sections */}
                      {section.inmuebles?.map((inm, iIdx) => {
                        const inmOpen = openInmuebles[iIdx] ?? false;
                        return (
                          <div key={iIdx} style={{ borderBottom: iIdx < (section.inmuebles?.length ?? 0) - 1 ? '1px solid var(--n-100)' : 'none', paddingBottom: 6, marginBottom: 4 }}>
                            <button
                              type="button"
                              onClick={() => toggleInmueble(iIdx)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 0',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                minHeight: 36,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {inmOpen ? <ChevronDown size={14} style={{ color: 'var(--n-500)' }} /> : <ChevronRight size={14} style={{ color: 'var(--n-500)' }} />}
                                <span style={{ fontWeight: 500, color: 'var(--n-700)', fontSize: 'var(--t-xs, 12px)' }}>{inm.name}</span>
                              </div>
                              <span style={{
                                fontFamily: 'IBM Plex Mono, monospace',
                                fontSize: 'var(--t-xs, 12px)',
                                color: inm.rendimientoReducido >= 0 ? 'var(--s-pos)' : 'var(--s-neg)',
                              }}>
                                {fmtSigned(inm.rendimientoReducido)}
                              </span>
                            </button>
                            {inmOpen && (
                              <div style={{ paddingLeft: 22 }}>
                                {inm.rows.map((row) => (
                                  <div key={row.label} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '3px 0',
                                    fontSize: 'var(--t-xs, 12px)',
                                    color: 'var(--n-700)',
                                  }}>
                                    <span>{row.label}</span>
                                    <span style={{
                                      fontFamily: 'IBM Plex Mono, monospace',
                                      color: row.accent === 'positive' ? 'var(--s-pos)' : row.accent === 'negative' ? 'var(--s-neg)' : 'var(--n-700)',
                                    }}>
                                      {fmtSigned(row.value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Regular detail rows */}
                      {section.rows?.map((row) => (
                        <div key={row.label} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          fontSize: 'var(--t-xs, 12px)',
                          color: 'var(--n-700)',
                        }}>
                          <span>{row.label}</span>
                          <span style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            color: row.accent === 'positive' ? 'var(--s-pos)' : row.accent === 'negative' ? 'var(--s-neg)' : 'var(--n-700)',
                          }}>
                            {fmtSigned(row.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FiscalPageShell>
  );
};

export default DeclaracionPage;
