import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  Printer,
  PenLine,
  Ban,
  ChevronRight,
  Check,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB } from '../../../services/db';
import {
  calcularCuadreCaja,
  type CuadreCaja,
  type CashflowAño,
} from '../../../services/historicalCashflowCalculator';
import {
  generarHistoricoAño,
  tieneHistoricoGenerado,
} from '../../../services/historicalTreasuryService';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const mono = (n: number): React.ReactNode => (
  <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(n)}</span>
);

type Fuente = 'xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'manual';

interface AñoInfo {
  año: number;
  tieneEjercicio: boolean;
  tieneHistorico: boolean;
  prestamosConDatos: number;
  prestamosSinDatos: number;
  cashflow: CashflowAño | null;
  calidad: 'completo' | 'parcial' | 'sin_datos';
}

// ── Styles ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1300,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'stretch', justifyContent: 'center',
};

const modal: React.CSSProperties = {
  background: 'var(--white, #fff)',
  display: 'flex', flexDirection: 'column',
  width: '100%', maxWidth: '860px',
  margin: 'auto',
  borderRadius: 'var(--r-lg, 16px)',
  overflow: 'hidden',
  maxHeight: '95vh',
};

const header: React.CSSProperties = {
  background: 'var(--navy, #1a2e44)',
  color: 'var(--white, #fff)',
  padding: '1.25rem 1.5rem',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  flexShrink: 0,
};

const stepperBar: React.CSSProperties = {
  background: 'var(--navy-light, #243551)',
  padding: '0.75rem 1.5rem',
  display: 'flex', gap: '0.5rem', alignItems: 'center',
  flexShrink: 0, overflowX: 'auto',
};

const body: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '1.75rem 1.5rem',
};

const footer: React.CSSProperties = {
  borderTop: '1px solid var(--grey-200, #e5e7eb)',
  padding: '1rem 1.5rem',
  display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
  flexShrink: 0,
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--navy, #1a2e44)', color: 'var(--white, #fff)',
  border: 'none', borderRadius: 'var(--r-md, 10px)',
  padding: '0.6rem 1.4rem', fontWeight: 600, fontSize: '0.9rem',
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--n-700, #374151)',
  border: '1px solid var(--grey-200, #e5e7eb)',
  borderRadius: 'var(--r-md, 10px)',
  padding: '0.6rem 1.2rem', fontWeight: 500, fontSize: '0.9rem',
  cursor: 'pointer',
};

const card: React.CSSProperties = {
  border: '1.5px solid var(--grey-200, #e5e7eb)',
  borderRadius: 'var(--r-md, 10px)',
  padding: '1.1rem 1.25rem',
  cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
};

const cardActive: React.CSSProperties = {
  ...card,
  borderColor: 'var(--navy, #1a2e44)',
  background: 'var(--navy-50, #f0f4f8)',
};

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem',
};

const th: React.CSSProperties = {
  textAlign: 'left', padding: '0.5rem 0.75rem',
  borderBottom: '2px solid var(--grey-200, #e5e7eb)',
  color: 'var(--n-500, #6b7280)', fontWeight: 600, fontSize: '0.78rem',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

const td: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid var(--grey-100, #f3f4f6)',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--grey-300, #d1d5db)',
  borderRadius: 'var(--r-sm, 6px)',
  padding: '0.35rem 0.5rem',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: '0.875rem', textAlign: 'right', width: '120px',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface HistoricoWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STEP_LABELS = [
  'Fuente', 'Años', 'Préstamos', 'Cuadre', 'Gastos pers.', 'Generar',
];

const HistoricoWizard: React.FC<HistoricoWizardProps> = ({ open, onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [fuente, setFuente] = useState<Fuente>('xml_aeat');
  const [años, setAños] = useState<AñoInfo[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [cuadre, setCuadre] = useState<CuadreCaja | null>(null);
  const [saldoCuentas, setSaldoCuentas] = useState(0);
  const [inversiones, setInversiones] = useState(0);
  const [ventasNetas, setVentasNetas] = useState(0);
  const [otrosSalidas, setOtrosSalidas] = useState(0);
  const [gastosEdits, setGastosEdits] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [totalPrestamos, setTotalPrestamos] = useState<{ id: number; nombre: string; tieneCuadro: boolean }[]>([]);

  // ── Load años disponibles ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const db = await initDB();
        const añoActual = new Date().getFullYear();

        // Bug 1 fix: solo años ya cerrados (ejercicios anteriores al año en curso)
        const ejercicios = (await db.getAll('ejerciciosFiscalesCoord'))
          .filter(e => e.año < añoActual);

        const prestamos = await db.getAll('prestamos');

        // Bug 2 fix: resolver el plan de amortización soportando formato antiguo
        // (prestamo.cuadro_amortizacion) y nuevo (keyval/planpagos_${id})
        const resolvePlanPeriodos = async (p: any): Promise<{ fecha: string }[]> => {
          const old = p.cuadro_amortizacion ?? p.cuadroAmortizacion;
          if (Array.isArray(old) && old.length > 0) {
            return old.map((c: any) => ({ fecha: String(c.fecha ?? c.fechaCargo ?? '') }));
          }
          const plan = await (db as any).get('keyval', `planpagos_${p.id}`);
          if (plan?.periodos?.length > 0) {
            return (plan.periodos as any[]).map((per: any) => ({ fecha: String(per.fechaCargo ?? '') }));
          }
          return [];
        };

        // Cargar periodos de todos los préstamos una sola vez
        const planPorPrestamo = new Map<string | number, { fecha: string }[]>();
        for (const p of prestamos) {
          planPorPrestamo.set(p.id, await resolvePlanPeriodos(p));
        }

        setTotalPrestamos(prestamos.map((p) => ({
          id: p.id as number,
          nombre: p.nombre ?? `Préstamo ${p.id}`,
          tieneCuadro: (planPorPrestamo.get(p.id) ?? []).length > 0,
        })));

        // Bug 4 fix: pre-rellenar saldo de cuentas e inversiones desde DB
        const accounts = await db.getAll('accounts');
        const totalSaldo = accounts
          .filter((a: any) => a.status === 'ACTIVE' || a.isActive || a.activa)
          .reduce((sum: number, a: any) => sum + Number(a.balance ?? a.saldo ?? 0), 0);
        setSaldoCuentas(Math.round(totalSaldo));

        const inversionesList = await db.getAll('inversiones');
        const totalInversiones = inversionesList
          .reduce((sum: number, inv: any) => sum + Number(inv.valor_actual ?? inv.valorActual ?? 0), 0);
        setInversiones(Math.round(totalInversiones));

        const contracts = await db.getAll('contracts');
        const añosList: AñoInfo[] = [];
        for (const ej of ejercicios) {
          const año = ej.año;
          const tieneHistorico = await tieneHistoricoGenerado(año);

          let prestamosConDatos = 0;
          let prestamosSinDatos = 0;
          for (const p of prestamos) {
            const periodos = planPorPrestamo.get(p.id) ?? [];
            if (periodos.length > 0) {
              const tieneEsteAño = periodos.some(c => c.fecha.startsWith(`${año}`));
              if (tieneEsteAño) prestamosConDatos++;
              else prestamosSinDatos++;
            } else {
              prestamosSinDatos++;
            }
          }

          // Bug 3 fix: caer en atlas.snapshot si no hay aeat importado
          const casillas: Record<string, number> =
            ej.aeat?.snapshot ?? ej.atlas?.snapshot ?? {};
          const tieneNomina = Number(casillas['0003'] ?? 0) > 0;
          const tieneAut = Number(casillas['VE1II1'] ?? 0) > 0;
          const tieneRentas = contracts.some(c => c.ejerciciosFiscales?.[año]?.importeDeclarado);

          const calidad: AñoInfo['calidad'] =
            (tieneNomina || tieneAut || tieneRentas) && prestamosConDatos >= prestamos.length * 0.8
              ? 'completo'
              : (tieneNomina || tieneAut || tieneRentas)
              ? 'parcial'
              : 'sin_datos';

          añosList.push({
            año,
            tieneEjercicio: true,
            tieneHistorico,
            prestamosConDatos,
            prestamosSinDatos,
            cashflow: null,
            calidad,
          });
        }

        añosList.sort((a, b) => a.año - b.año);
        setAños(añosList);
        setSelectedYears(añosList.filter(a => !a.tieneHistorico).map(a => a.año));
      } catch (err) {
        console.error('Error cargando ejercicios:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [open]);

  // ── Compute cuadre ────────────────────────────────────────────────────────

  const computeCuadre = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await calcularCuadreCaja({
        saldoCuentasActual: saldoCuentas,
        inversionesActuales: inversiones,
        ventasNetas,
        otrosSalidasConocidas: otrosSalidas,
      });
      setCuadre(result);
      const edits: Record<number, number> = {};
      for (const [year, importe] of Object.entries(result.gastosPersonalesPorAño)) {
        edits[Number(year)] = importe;
      }
      setGastosEdits(edits);
    } catch (err) {
      toast.error('Error al calcular el cuadre de caja');
    } finally {
      setIsLoading(false);
    }
  }, [saldoCuentas, inversiones, ventasNetas, otrosSalidas]);

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerar = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    try {
      const yearsToGenerate = selectedYears;
      for (let i = 0; i < yearsToGenerate.length; i++) {
        const año = yearsToGenerate[i];
        await generarHistoricoAño({
          año,
          gastosPersonalesMes: gastosEdits[año] ?? 0,
          fuente,
        });
        setGenerationProgress(Math.round(((i + 1) / yearsToGenerate.length) * 100));
      }
      toast.success(`Historial generado para ${yearsToGenerate.length} año${yearsToGenerate.length !== 1 ? 's' : ''}`);
      onComplete();
    } catch (err) {
      toast.error('Error al generar el historial');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const canNext = (): boolean => {
    if (step === 2) return selectedYears.length > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 3) {
      await computeCuadre();
    }
    setStep(s => Math.min(s + 1, 6) as typeof step);
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 1) as typeof step);

  // ── Render helpers ────────────────────────────────────────────────────────

  if (!open) return null;

  const badgeCalidad = (calidad: AñoInfo['calidad']) => {
    const styles: Record<AñoInfo['calidad'], React.CSSProperties> = {
      completo: { background: 'var(--s-pos-bg, #ecfdf5)', color: 'var(--s-pos, #16a34a)' },
      parcial: { background: 'var(--s-warn-bg, #fffbeb)', color: 'var(--s-warn, #d97706)' },
      sin_datos: { background: 'var(--n-100, #f3f4f6)', color: 'var(--n-500, #6b7280)' },
    };
    const labels = { completo: 'Datos completos', parcial: 'Datos parciales', sin_datos: 'Sin datos' };
    return (
      <span style={{
        ...styles[calidad],
        display: 'inline-block', padding: '2px 8px',
        borderRadius: 'var(--r-sm, 6px)', fontSize: '0.75rem', fontWeight: 500,
      }}>
        {labels[calidad]}
      </span>
    );
  };

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>

        {/* ── Header ── */}
        <div style={header}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
              Configurar historial de Tesorería
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '2px' }}>
              Paso {step} de 6
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Stepper ── */}
        <div style={stepperBar}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <React.Fragment key={n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700,
                    background: done ? 'var(--s-pos, #16a34a)' : active ? 'var(--white, #fff)' : 'rgba(255,255,255,0.2)',
                    color: done ? 'white' : active ? 'var(--navy, #1a2e44)' : 'rgba(255,255,255,0.6)',
                  }}>
                    {done ? <Check size={12} /> : n}
                  </div>
                  <span style={{
                    fontSize: '0.8rem',
                    color: active ? 'var(--white, #fff)' : 'rgba(255,255,255,0.6)',
                    fontWeight: active ? 600 : 400,
                  }}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div style={body}>

          {/* PASO 1: Fuente */}
          {step === 1 && (
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '1.1rem' }}>
                ¿Desde dónde importaste tus declaraciones?
              </h2>
              <p style={{ margin: '0 0 1.5rem', color: 'var(--n-500, #6b7280)', fontSize: '0.875rem' }}>
                ATLAS usará esta fuente para indicar el nivel de certeza de cada evento.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {([
                  { id: 'xml_aeat', icon: <FileText size={22} />, label: 'XMLs o PDFs importados', desc: 'Tengo las declaraciones importadas en ATLAS' },
                  { id: 'print_aeat', icon: <Printer size={22} />, label: 'Print de Datos Fiscales AEAT', desc: 'Tengo el PDF de datos fiscales de la Agencia Tributaria' },
                  { id: 'manual', icon: <PenLine size={22} />, label: 'Introduzco manualmente', desc: 'Voy a rellenar los importes año a año' },
                  { id: 'none', icon: <Ban size={22} />, label: 'Empezar sin historial', desc: 'Prefiero empezar desde hoy sin datos históricos' },
                ] as { id: Fuente | 'none'; icon: React.ReactNode; label: string; desc: string }[]).map(({ id, icon, label, desc }) => (
                  <div
                    key={id}
                    style={fuente === id || (id === 'none' && fuente === 'manual' && false) ? cardActive : card}
                    onClick={() => {
                      if (id === 'none') { onClose(); return; }
                      setFuente(id as Fuente);
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div style={{ color: 'var(--navy, #1a2e44)', marginTop: '2px' }}>{icon}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '3px' }}>{label}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--n-500, #6b7280)' }}>{desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PASO 2: Años */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '1.1rem' }}>
                Selecciona los años a cerrar
              </h2>
              <p style={{ margin: '0 0 1.25rem', color: 'var(--n-500, #6b7280)', fontSize: '0.875rem' }}>
                ATLAS generará eventos históricos confirmed para cada año seleccionado.
              </p>
              {isLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--n-400)' }}>Cargando ejercicios…</div>
              ) : años.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--n-400)' }}>
                  No se encontraron ejercicios en ATLAS.
                </div>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={th}><input type="checkbox" checked={selectedYears.length === años.length} onChange={e => setSelectedYears(e.target.checked ? años.map(a => a.año) : [])} /></th>
                      <th style={th}>Año</th>
                      <th style={th}>Datos disponibles</th>
                      <th style={th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {años.map(a => (
                      <tr key={a.año}>
                        <td style={td}>
                          <input
                            type="checkbox"
                            checked={selectedYears.includes(a.año)}
                            onChange={e => setSelectedYears(prev =>
                              e.target.checked ? [...prev, a.año] : prev.filter(y => y !== a.año)
                            )}
                          />
                        </td>
                        <td style={{ ...td, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>{a.año}</td>
                        <td style={td}>{badgeCalidad(a.calidad)}</td>
                        <td style={td}>
                          {a.tieneHistorico && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--s-warn, #d97706)' }}>
                              Ya generado — se sobreescribirá
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* PASO 3: Préstamos */}
          {step === 3 && (
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '1.1rem' }}>
                Cuadro de amortización de préstamos
              </h2>
              <p style={{ margin: '0 0 1.25rem', color: 'var(--n-500, #6b7280)', fontSize: '0.875rem' }}>
                ATLAS necesita los cuadros de amortización para calcular las cuotas históricas.
              </p>
              {totalPrestamos.length === 0 ? (
                <p style={{ color: 'var(--n-400)' }}>No hay préstamos registrados en ATLAS.</p>
              ) : (
                <>
                  {totalPrestamos.some(p => !p.tieneCuadro) && (
                    <div style={{
                      display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
                      background: 'var(--s-warn-bg, #fffbeb)', color: 'var(--s-warn, #d97706)',
                      border: '1px solid var(--s-warn-border, #fcd34d)',
                      borderRadius: 'var(--r-md, 10px)', padding: '0.75rem 1rem', marginBottom: '1rem',
                    }}>
                      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: '0.875rem' }}>
                        Algunos préstamos no tienen cuadro de amortización. Las cuotas de esos préstamos no se incluirán en el historial.
                        <a href="/financiacion" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, color: 'inherit', fontWeight: 600 }}>
                          Ir a Financiación <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  )}
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={th}>Préstamo</th>
                        <th style={th}>Cuadro de amortización</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totalPrestamos.map(p => (
                        <tr key={p.id}>
                          <td style={td}>{p.nombre}</td>
                          <td style={td}>
                            {p.tieneCuadro ? (
                              <span style={{ color: 'var(--s-pos, #16a34a)', fontWeight: 500, fontSize: '0.875rem' }}>
                                <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Disponible
                              </span>
                            ) : (
                              <span style={{ color: 'var(--s-neg, #dc2626)', fontWeight: 500, fontSize: '0.875rem' }}>
                                Sin datos
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* PASO 4: Cuadre de caja */}
          {step === 4 && (
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '1.1rem' }}>
                Cuadre de caja
              </h2>
              <p style={{ margin: '0 0 1.25rem', color: 'var(--n-500, #6b7280)', fontSize: '0.875rem' }}>
                Indica tu situación financiera actual para calcular los gastos personales implícitos históricos.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {([
                  { label: 'Saldo en cuentas bancarias (hoy)', value: saldoCuentas, onChange: setSaldoCuentas },
                  { label: 'Inversiones actuales (valor)', value: inversiones, onChange: setInversiones },
                  { label: 'Ventas de inmuebles (neto)', value: ventasNetas, onChange: setVentasNetas },
                  { label: 'Otras salidas conocidas', value: otrosSalidas, onChange: setOtrosSalidas },
                ] as { label: string; value: number; onChange: (n: number) => void }[]).map(({ label, value, onChange }) => (
                  <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--n-500, #6b7280)', fontWeight: 500 }}>{label}</span>
                    <input
                      type="number"
                      value={value || ''}
                      onChange={e => onChange(Number(e.target.value) || 0)}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>
              <button style={btnPrimary} onClick={computeCuadre} disabled={isLoading}>
                {isLoading ? 'Calculando…' : 'Recalcular cuadre'}
              </button>

              {cuadre && (
                <div style={{ marginTop: '1.5rem' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={th}>Año</th>
                        <th style={{ ...th, textAlign: 'right' }}>Ingresos</th>
                        <th style={{ ...th, textAlign: 'right' }}>Gastos</th>
                        <th style={{ ...th, textAlign: 'right' }}>Cashflow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuadre.años.map(a => (
                        <tr key={a.año}>
                          <td style={{ ...td, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>{a.año}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(a.nominaNeta + a.autonomoNeto + a.rentasAlquiler)}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(a.cuotasPrestamos + a.gastosInmuebles)}</td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: a.cashflowParcial >= 0 ? 'var(--s-pos, #16a34a)' : 'var(--s-neg, #dc2626)', fontWeight: 600 }}>{fmt(a.cashflowParcial)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--n-50, #f9fafb)' }}>
                        <td style={{ ...td, fontWeight: 700 }}>Total</td>
                        <td colSpan={2} />
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>{fmt(cuadre.totalCashflow)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--n-50, #f9fafb)', borderRadius: 'var(--r-md, 10px)', fontSize: '0.875rem' }}>
                    <strong>Gastos personales implícitos:</strong>{' '}
                    {mono(cuadre.gastosPersonalesImplicitos)}{' '}
                    <span style={{ color: 'var(--n-500)' }}>
                      (media {mono(cuadre.mediaGastosPersonalesMes)}/mes)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 5: Gastos personales */}
          {step === 5 && (
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '1.1rem' }}>
                Confirmar gastos personales por año
              </h2>
              <p style={{ margin: '0 0 0.5rem', color: 'var(--n-500, #6b7280)', fontSize: '0.875rem' }}>
                Ajusta el estimado mensual por año si lo necesitas. El cuadre se actualiza automáticamente.
              </p>
              {cuadre && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: 'var(--navy-50, #f0f4f8)',
                  border: '1px solid var(--navy-200, #c3d2e4)',
                  borderRadius: 'var(--r-md, 10px)', padding: '0.6rem 1rem',
                  marginBottom: '1.25rem',
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--n-600, #4b5563)' }}>Media histórica:</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: '1.1rem', color: 'var(--navy, #1a2e44)' }}>
                    {fmt(cuadre.mediaGastosPersonalesMes)}/mes
                  </span>
                </div>
              )}
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={th}>Año</th>
                    <th style={{ ...th, textAlign: 'right' }}>Estimado ATLAS (€/mes)</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ajuste (€/mes)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedYears.map(año => {
                    const estimado = cuadre?.gastosPersonalesPorAño[año] ?? 0;
                    const actual = gastosEdits[año] ?? estimado;
                    return (
                      <tr key={año}>
                        <td style={{ ...td, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>{año}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-400)' }}>{fmt(estimado)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <input
                            type="number"
                            value={actual || ''}
                            onChange={e => setGastosEdits(prev => ({ ...prev, [año]: Number(e.target.value) || 0 }))}
                            style={inputStyle}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PASO 6: Generar */}
          {step === 6 && (
            <div>
              <h2 style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '1.1rem' }}>
                Confirmar y generar
              </h2>
              <p style={{ margin: '0 0 1.5rem', color: 'var(--n-500, #6b7280)', fontSize: '0.875rem' }}>
                ATLAS va a generar eventos históricos <strong>confirmed</strong> para los siguientes años.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {selectedYears.map(año => (
                  <div key={año} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 1rem',
                    border: '1px solid var(--grey-200, #e5e7eb)',
                    borderRadius: 'var(--r-sm, 6px)',
                  }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>{año}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--n-500)' }}>
                      Gastos pers.: {mono(gastosEdits[año] ?? 0)}/mes
                    </span>
                  </div>
                ))}
              </div>

              {isGenerating && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--n-500)' }}>
                    <span>Generando historial…</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{generationProgress}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--n-100, #f3f4f6)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: 'var(--navy, #1a2e44)',
                      width: `${generationProgress}%`, transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={footer}>
          {step > 1 && (
            <button style={btnGhost} onClick={handleBack} disabled={isGenerating}>
              Anterior
            </button>
          )}
          {step < 6 && (
            <button
              style={{ ...btnPrimary, opacity: canNext() ? 1 : 0.5 }}
              onClick={handleNext}
              disabled={!canNext() || isLoading}
            >
              {isLoading ? 'Cargando…' : 'Siguiente'}
            </button>
          )}
          {step === 6 && (
            <button
              style={btnPrimary}
              onClick={handleGenerar}
              disabled={isGenerating || selectedYears.length === 0}
            >
              {isGenerating ? 'Generando…' : 'Generar historial'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default HistoricoWizard;
