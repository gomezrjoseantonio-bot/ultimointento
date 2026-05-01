import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, X, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { nominaService } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { cuentasService } from '../../../services/cuentasService';
import { planesInversionService } from '../../../services/planesInversionService';
import { getBaseMaxima, getSSDefaults } from '../../../constants/cotizacionSS';
import type { Account } from '../../../services/db';
import type { PlanPensionInversion } from '../../../types/personal';

const FONT = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
// Evaluated lazily so a long-lived session keeps picking up the current year
// (e.g. a tab kept open across a Jan 1 rollover uses the new year's defaults).
const currentSSYear = () => new Date().getFullYear();
const currentSSTope = () => getBaseMaxima(currentSSYear());
const currentSSDefaults = () => getSSDefaults(currentSSYear());
const sumTrabajadorPct = (d: ReturnType<typeof getSSDefaults>) =>
  d.contingenciasComunes.trabajador
  + d.desempleo.trabajador
  + d.formacionProfesional.trabajador
  + d.mei.trabajador;

// ── Tipos internos del wizard ────────────────────────────────────────────────
interface WizardVariable {
  id: string;
  nombre: string;
  tipo: 'variable' | 'bonus';
  base: 'importe' | 'pct';
  importe: number;
  pct: number;
  mes: string;
  /** Preserved from original nomina for multi-month distribution (edit mode). */
  _originalDistribucionMeses?: { mes: number; porcentaje: number }[];
}

interface WizardEspecie {
  id: string;
  nombre: string;
  tributacion: 'Computa en IRPF' | 'Exento IRPF';
  importeMensual: number;
}

// ── Tipo para los items del calendario ──────────────────────────────────────
interface CalendarioItem {
  mes: string;
  idx: number;
  brutoMes: number;
  brutoVar: number;
  liq: number;
  esExtra: boolean;
  hasVar: boolean;
  varTipos: ('variable' | 'bonus')[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtEur = (v: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '\u00A0\u20AC';

const fmtNeg = (v: number) =>
  '\u2212\u00A0' + new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '\u00A0\u20AC';

function calcIRPFEfectivo(brutoTotal: number): number {
  const minExento = 5550;
  const base = Math.max(0, brutoTotal - minExento);
  const tramos = [
    { hasta: 6900, tipo: 0.19 },
    { hasta: 14650, tipo: 0.24 },
    { hasta: 29650, tipo: 0.30 },
    { hasta: 54450, tipo: 0.37 },
    { hasta: 294450, tipo: 0.45 },
    { hasta: Infinity, tipo: 0.47 },
  ];
  let impuesto = 0, acum = 0;
  for (const t of tramos) {
    const tramo = Math.min(base - acum, t.hasta - acum);
    if (tramo <= 0) break;
    impuesto += tramo * t.tipo;
    acum = t.hasta;
    if (acum >= base) break;
  }
  return brutoTotal > 0 ? Math.round((impuesto / brutoTotal) * 10000) / 100 : 0;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Estilos compartidos ──────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1.5px solid var(--grey-300, #C8D0DC)',
  fontSize: 14, fontFamily: FONT, color: 'var(--navy-900, #042C5E)',
  background: '#fff', boxSizing: 'border-box' as const, outline: 'none',
};

const labelSt: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--grey-600, #4A5568)',
  fontFamily: FONT, marginBottom: 4, display: 'block',
};

const cardSt: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--grey-200, #DDE3EC)',
  borderRadius: 12, padding: '20px 24px',
};

const navyCard: React.CSSProperties = {
  background: 'var(--navy-900, #042C5E)', borderRadius: 12,
  padding: '20px 24px', color: '#fff',
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '10px 24px', borderRadius: 10,
  background: 'var(--navy-900, #042C5E)', color: '#fff',
  border: 'none', fontSize: 14, fontWeight: 600,
  fontFamily: FONT, cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8,
  background: 'transparent', color: 'var(--navy-900, #042C5E)',
  border: '1.5px solid var(--grey-300, #C8D0DC)',
  fontSize: 13, fontWeight: 500, fontFamily: FONT, cursor: 'pointer',
};

const tealTag: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '2px 8px', borderRadius: 6,
  background: 'rgba(29,160,186,0.12)', color: 'var(--teal-600, #1DA0BA)',
  fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
  border: 'none',
};

// ── Stepper ──────────────────────────────────────────────────────────────────
const Stepper: React.FC<{ step: number; steps: string[] }> = ({ step, steps }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
    {steps.map((label, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: done || active ? 'var(--navy-900, #042C5E)' : 'var(--grey-200, #DDE3EC)',
              color: done || active ? '#fff' : 'var(--grey-500, #6C757D)',
              fontSize: 12, fontWeight: 700, fontFamily: FONT,
            }}>
              {done ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span style={{
              fontSize: 11, fontWeight: active ? 700 : 400,
              color: active ? 'var(--navy-900, #042C5E)' : 'var(--grey-500, #6C757D)',
              fontFamily: FONT, whiteSpace: 'nowrap',
            }}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: '0 8px', marginBottom: 20,
              background: i < step ? 'var(--navy-900, #042C5E)' : 'var(--grey-200, #DDE3EC)',
            }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ── Componente principal ─────────────────────────────────────────────────────
const NominaWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id');
  const parsedNominaId = idParam !== null ? Number(idParam) : null;
  const nominaId = parsedNominaId !== null && Number.isFinite(parsedNominaId) ? parsedNominaId : null;
  const titularParam = (searchParams.get('titular') || 'yo') as 'yo' | 'pareja';
  const isEditing = nominaId !== null;

  // SS tope and worker rates for the current year, memoised once per mount.
  // `handleSave` re-reads them directly so a tab kept open across Jan 1 still
  // persists that year's defaults instead of the cached ones.
  const ssTope = useMemo(() => currentSSTope(), []);
  const ssDefaults = useMemo(() => currentSSDefaults(), []);
  const ssPct = useMemo(() => sumTrabajadorPct(ssDefaults), [ssDefaults]);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [planes, setPlanes] = useState<PlanPensionInversion[]>([]);
  const [pid, setPid] = useState<number | null>(null);
  const [titularNombre, setTitularNombre] = useState('');
  const [editingTitular, setEditingTitular] = useState<'yo' | 'pareja'>(titularParam);

  // Step 1 state
  const [empresa, setEmpresa] = useState('');
  const [pagas, setPagas] = useState<12 | 14 | 15 | 16>(12);
  const [fechaInicio, setFechaInicio] = useState('');
  const [diaCobro, setDiaCobro] = useState(31);
  const [cuentaId, setCuentaId] = useState(0);
  const [brutoAnual, setBrutoAnual] = useState(0);
  const [irpf, setIrpf] = useState(0);
  const [irpfAuto, setIrpfAuto] = useState(true);
  const [solidaridadAnual, setSolidaridadAnual] = useState(91.80);

  // Step 2 state
  const [variables, setVariables] = useState<WizardVariable[]>([]);
  const [tienePP, setTienePP] = useState(false);
  const [ppPlanId, setPpPlanId] = useState<number | null>(null);
  const [ppEmpleado, setPpEmpleado] = useState(0);
  const [ppEmpresa, setPpEmpresa] = useState(0);
  const [tieneEspecie, setTieneEspecie] = useState(false);
  const [especie, setEspecie] = useState<WizardEspecie[]>([]);

  useEffect(() => {
    void (async () => {
      // T14.4 · EXCEPCIÓN documentada · NO migra al gateway · necesita
      // `spouseName` (campo UI no fiscal). Mantener lectura directa
      // a `personalDataService` evita un dual-read innecesario.
      const perfil = await personalDataService.getPersonalData();
      if (perfil?.id) {
        setPid(perfil.id);
        const [accs, pls] = await Promise.all([
          cuentasService.list(),
          planesInversionService.getPlanes(perfil.id),
        ]);
        setAccounts(accs.filter(a => !a.deleted_at && a.activa));
        setPlanes(pls as unknown as PlanPensionInversion[]);

        if (isEditing && nominaId) {
          // Edit mode: load existing nomina and populate all fields
          const nom = await nominaService.getNominaById(nominaId);
          if (nom) {
            setEditingTitular(nom.titular);
            setTitularNombre(
              nom.titular === 'pareja' ? (perfil.spouseName || 'Pareja') : `${perfil.nombre} ${perfil.apellidos}`.trim()
            );
            setEmpresa(nom.nombre);
            const pagasFromTipo: Record<string, 12 | 14 | 15 | 16> = { doce: 12, catorce: 14, quince: 15, dieciseis: 16 };
            setPagas(pagasFromTipo[nom.distribucion.tipo] ?? 12);
            setFechaInicio(nom.fechaAntiguedad ? nom.fechaAntiguedad.slice(0, 7) : '');
            setDiaCobro(nom.reglaCobroDia.tipo === 'ultimo-habil' ? 31 : (nom.reglaCobroDia as { tipo: 'fijo'; dia: number }).dia);
            setCuentaId(nom.cuentaAbono || (accs.length > 0 && accs[0].id ? accs[0].id : 0));
            setBrutoAnual(nom.salarioBrutoAnual);
            setIrpf(nom.retencion.irpfPorcentaje);
            setIrpfAuto(false);
            if (nom.retencion.cuotaSolidaridadMensual != null) {
              setSolidaridadAnual(nom.retencion.cuotaSolidaridadMensual * 12);
            }
            // Step 2: variables + bonus → WizardVariable[]
            const vars: WizardVariable[] = [
              ...nom.variables.map(v => ({
                id: v.id || uid(),
                nombre: v.nombre,
                tipo: 'variable' as const,
                base: v.tipo === 'porcentaje' ? 'pct' as const : 'importe' as const,
                importe: v.tipo === 'importe' ? v.valor : 0,
                pct: v.tipo === 'porcentaje' ? v.valor : 0,
                mes: MESES[(v.distribucionMeses?.[0]?.mes ?? 1) - 1] || 'Enero',
                _originalDistribucionMeses: v.distribucionMeses,
              })),
              ...nom.bonus.map(b => ({
                id: b.id || uid(),
                nombre: b.descripcion,
                tipo: 'bonus' as const,
                base: 'importe' as const,
                importe: b.importe,
                pct: 0,
                mes: MESES[(b.mes ?? 1) - 1] || 'Enero',
              })),
            ];
            setVariables(vars);
            // PP
            if (nom.planPensiones) {
              setTienePP(true);
              setPpEmpleado(nom.planPensiones.aportacionEmpleado.valor);
              setPpEmpresa(nom.planPensiones.aportacionEmpresa.valor);
              setPpPlanId(nom.planPensiones.productoDestinoId ?? null);
            }
            // Especie
            if (nom.beneficiosSociales?.length) {
              setTieneEspecie(true);
              setEspecie(nom.beneficiosSociales.map(b => ({
                id: b.id || uid(),
                nombre: b.concepto,
                tributacion: b.incrementaBaseIRPF ? 'Computa en IRPF' as const : 'Exento IRPF' as const,
                importeMensual: b.importeMensual,
              })));
            }
          }
        } else {
          setTitularNombre(
            titularParam === 'pareja' ? (perfil.spouseName || 'Pareja') : `${perfil.nombre} ${perfil.apellidos}`.trim()
          );
          if (accs.length > 0 && accs[0].id) setCuentaId(accs[0].id);
        }
      }
    })();
  }, [isEditing, nominaId, titularParam]);

  // IRPF auto-calc
  const varTotal = useMemo(() =>
    variables.reduce((s, v) => s + (v.base === 'importe' ? v.importe : brutoAnual * v.pct / 100), 0),
    [variables, brutoAnual]
  );

  useEffect(() => {
    if (irpfAuto && brutoAnual > 0) {
      setIrpf(calcIRPFEfectivo(brutoAnual + varTotal));
    }
  }, [brutoAnual, varTotal, irpfAuto]);

  const pagaNormal = brutoAnual > 0 ? brutoAnual / pagas : 0;
  const baseSSMes = Math.min(pagaNormal, ssTope);
  const irpfMes = pagaNormal * irpf / 100;
  const ssMes = baseSSMes * ssPct / 100;
  const solidaridadMes = solidaridadAnual / 12;
  const ppMes = tienePP ? ppEmpleado : 0;
  const liquidoMes = pagaNormal - irpfMes - ssMes - solidaridadMes - ppMes;

  // Calendar calc (step 3)
  const calendario = useMemo((): CalendarioItem[] => {
    if (brutoAnual <= 0) return MESES.map((mes, i) => ({ mes, idx: i, brutoMes: 0, brutoVar: 0, liq: 0, esExtra: false, hasVar: false, varTipos: [] }));
    const mesesExtra: number[] = pagas === 14 ? [5, 11] : pagas === 15 ? [2, 5, 11] : pagas === 16 ? [2, 5, 8, 11] : [];
    return MESES.map((mes, i) => {
      const esExtra = mesesExtra.includes(i);
      const brutoMes = esExtra ? pagaNormal * 2 : pagaNormal;
      const baseS = Math.min(brutoMes, ssTope);
      const ssM = baseS * ssPct / 100;
      const solM = solidaridadAnual / 12;
      const varsEste = variables.filter(v => v.mes === mes);
      const brutoVar = varsEste.reduce((s, v) => s + (v.base === 'importe' ? v.importe : brutoAnual * v.pct / 100), 0);
      const irpfM = (brutoMes + brutoVar) * irpf / 100;
      const ppM = tienePP ? ppEmpleado : 0;
      const liq = brutoMes + brutoVar - irpfM - ssM - solM - ppM;
      return { mes, idx: i, brutoMes, brutoVar, liq, esExtra, hasVar: varsEste.length > 0, varTipos: varsEste.map(v => v.tipo) } satisfies CalendarioItem;
    });
  }, [brutoAnual, pagas, pagaNormal, irpf, ssPct, ssTope, solidaridadAnual, variables, tienePP, ppEmpleado]);

  const handleSave = useCallback(async () => {
    if (!pid) return;
    if (!Number.isFinite(brutoAnual) || brutoAnual <= 0) {
      alert('El salario bruto anual debe ser mayor que 0.');
      return;
    }
    setSaving(true);
    try {
      const vars = variables.filter(v => v.tipo === 'variable').map(v => ({
        id: v.id,
        nombre: v.nombre,
        tipo: v.base === 'pct' ? 'porcentaje' as const : 'importe' as const,
        valor: v.base === 'pct' ? v.pct : v.importe,
        distribucionMeses: v._originalDistribucionMeses ?? [{ mes: MESES.indexOf(v.mes) + 1, porcentaje: 100 }],
      }));
      const bonos = variables.filter(v => v.tipo === 'bonus').map(v => ({
        id: v.id,
        descripcion: v.nombre,
        importe: v.base === 'importe' ? v.importe : brutoAnual * v.pct / 100,
        mes: MESES.indexOf(v.mes) + 1,
      }));
      const beneficios = especie.map(e => ({
        id: e.id,
        concepto: e.nombre,
        tipo: 'otro' as const,
        importeMensual: e.importeMensual,
        incrementaBaseIRPF: e.tributacion === 'Computa en IRPF',
      }));
      const pp = tienePP ? {
        aportacionEmpleado: { tipo: 'importe' as const, valor: ppEmpleado },
        aportacionEmpresa: { tipo: 'importe' as const, valor: ppEmpresa },
        productoDestinoId: ppPlanId ?? undefined,
        productoDestinoNombre: ppPlanId ? planes.find(p => p.id === ppPlanId)?.nombre : undefined,
      } : undefined;

      const nominaData = {
        personalDataId: pid,
        titular: isEditing ? editingTitular : titularParam,
        nombre: empresa,
        fechaAntiguedad: fechaInicio ? `${fechaInicio}-01` : new Date().toISOString(),
        salarioBrutoAnual: brutoAnual,
        distribucion: {
          tipo: pagas === 12 ? 'doce' : pagas === 14 ? 'catorce' : 'personalizado',
          meses: pagas,
        } as { tipo: 'doce' | 'catorce' | 'personalizado'; meses: number },
        variables: vars,
        bonus: bonos,
        beneficiosSociales: beneficios,
        retencion: {
          irpfPorcentaje: irpf,
          // Always rewrite SS retencion from the wizard's current source of truth
          // so the stored nomina matches what the form displays (stale legacy
          // values would make nominaService.calculateSalary diverge from the
          // wizard preview and propagate different numbers to other pages).
          // Re-read the year here in case the session spans Jan 1.
          ss: (() => {
            const defs = currentSSDefaults();
            return {
              baseCotizacionMensual: currentSSTope(),
              contingenciasComunes: defs.contingenciasComunes.trabajador,
              desempleo: defs.desempleo.trabajador,
              formacionProfesional: defs.formacionProfesional.trabajador,
              mei: defs.mei.trabajador,
              overrideManual: false,
            };
          })(),
          cuotaSolidaridadMensual: solidaridadAnual / 12,
        },
        planPensiones: pp,
        // The wizard does not expose "deducciones adicionales"; preserving stale
        // values from an old import would create hidden deductions that the
        // summary cannot show. Always persist an empty array here.
        deduccionesAdicionales: [],
        cuentaAbono: cuentaId || 0,
        reglaCobroDia: diaCobro === 31 ? { tipo: 'ultimo-habil' as const } : { tipo: 'fijo' as const, dia: diaCobro },
        activa: true,
      };
      if (isEditing && nominaId) {
        await nominaService.updateNomina(nominaId, nominaData);
      } else {
        await nominaService.saveNomina(nominaData);
      }
      navigate('/gestion/personal');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [pid, titularParam, editingTitular, isEditing, nominaId, empresa, pagas, fechaInicio, brutoAnual, irpf, solidaridadAnual, variables, especie, tienePP, ppEmpleado, ppEmpresa, ppPlanId, cuentaId, diaCobro, planes, navigate]);

  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Empresa y datos básicos */}
      <div style={cardSt}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>
          Datos del empleador
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelSt}>Empresa / pagador</label>
            <input style={inputSt} value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre del empleador" />
          </div>
          <div>
            <label style={labelSt}>Esta configuración aplica desde <span style={{ color: 'var(--grey-400)', fontWeight: 400 }}>Normalmente el mes en que empezaste o cambió tu salario</span></label>
            <input style={inputSt} type="month" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>Día de cobro <span style={{ color: 'var(--grey-400)', fontWeight: 400 }}>— 31 = último hábil</span></label>
            <input style={inputSt} type="number" min={1} max={31} value={diaCobro} onChange={e => setDiaCobro(Number(e.target.value))} />
          </div>
          <div>
            <label style={labelSt}>Cuenta de destino</label>
            <select style={inputSt} value={cuentaId} onChange={e => setCuentaId(Number(e.target.value))}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.alias || a.iban.slice(-4)} — {a.iban.slice(-4)}</option>
              ))}
              <option value={0}>Otra cuenta</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bloque bruto anual */}
      <div style={{ ...navyCard }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, letterSpacing: '0.05em', marginBottom: 6 }}>
              BRUTO ANUAL (SIN VARIABLES)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                value={brutoAnual || ''}
                onChange={e => setBrutoAnual(Number(e.target.value))}
                placeholder="0"
                style={{
                  ...inputSt, background: 'rgba(255,255,255,0.1)', color: '#fff',
                  border: '1.5px solid rgba(255,255,255,0.2)', fontSize: 22, fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums', width: 200,
                }}
              />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>€ / año</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, letterSpacing: '0.05em', marginBottom: 6 }}>
              Nº PAGAS
            </div>
            <select
              value={pagas}
              onChange={e => setPagas(Number(e.target.value) as 12 | 14 | 15 | 16)}
              style={{ ...inputSt, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.2)', width: 80 }}
            >
              {[12, 14, 15, 16].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12, fontFamily: FONT }}>
          Orange 2026: 12 pagas — extras prorrateadas
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Paga normal', val: pagaNormal },
            { label: 'Base SS/mes', val: baseSSMes },
            { label: 'IRPF/mes', val: irpfMes },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: FONT, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                {val > 0 ? fmtEur(val) : '\u2014'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* IRPF */}
      <div style={cardSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <label style={{ ...labelSt, margin: 0, flex: 1 }}>% IRPF retenido</label>
          <button
            style={{ ...tealTag, opacity: irpfAuto ? 1 : 0.45 }}
            onClick={() => { setIrpfAuto(true); setIrpf(calcIRPFEfectivo(brutoAnual + varTotal)); }}
          >
            ATLAS: {calcIRPFEfectivo(brutoAnual + varTotal).toFixed(1)}% efectivo
          </button>
          <input
            type="number"
            step="0.01"
            value={irpf}
            onChange={e => { setIrpf(Number(e.target.value)); setIrpfAuto(false); }}
            style={{ ...inputSt, width: 80, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
        <div style={{ fontSize: 11, color: 'var(--grey-400)', fontFamily: FONT }}>
          Calculado sobre bruto total (fijo + variables estimados)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div>
            <label style={labelSt}>% SS empleado total</label>
            <input style={{ ...inputSt, fontFamily: MONO }} value={ssPct.toFixed(2)} readOnly />
            <div style={{ fontSize: 11, color: 'var(--grey-400)', marginTop: 4, fontFamily: FONT }}>
              SS {ssDefaults.contingenciasComunes.trabajador.toFixed(2).replace('.', ',')}% + Desempleo {ssDefaults.desempleo.trabajador.toFixed(2).replace('.', ',')}% + FP {ssDefaults.formacionProfesional.trabajador.toFixed(2).replace('.', ',')}% + MEI {ssDefaults.mei.trabajador.toFixed(2).replace('.', ',')}%
            </div>
          </div>
          <div>
            <label style={labelSt}>Cuota solidaridad anual (€)</label>
            <input
              style={{ ...inputSt, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}
              type="number"
              value={solidaridadAnual}
              onChange={e => setSolidaridadAnual(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      {pagaNormal > 0 && (
        <div style={navyCard}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, marginBottom: 12 }}>
            Mes normal sin variables · lo que llega a tu cuenta
          </div>
          {[
            { label: 'Bruto mes normal', val: pagaNormal, neg: false },
            { label: `\u2212 IRPF (${irpf.toFixed(2)}%)`, val: irpfMes, neg: true },
            { label: `\u2212 SS sobre ${fmtEur(baseSSMes)} (${ssPct}%)`, val: ssMes, neg: true },
            { label: '\u2212 Cuota solidaridad', val: solidaridadMes, neg: true },
          ].map(({ label, val, neg }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontFamily: FONT }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: neg ? 'rgba(255,255,255,0.7)' : '#fff' }}>
                {neg ? fmtNeg(val) : fmtEur(val)}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#fff', fontFamily: FONT }}>Ingreso en cuenta</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 18, color: 'var(--teal-400, #4AC8E0)' }}>
              {fmtEur(liquidoMes)}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const addVariable = () => setVariables(v => [...v, {
    id: uid(), nombre: 'Variable', tipo: 'variable' as const, base: 'importe' as const, importe: 0, pct: 0, mes: 'Enero',
  }]);
  const updateVar = (id: string, patch: Partial<WizardVariable>) =>
    setVariables(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
  const removeVar = (id: string) => setVariables(v => v.filter(x => x.id !== id));
  const addEspecie = (nombre: string) => setEspecie(e => [...e, { id: uid(), nombre, tributacion: 'Exento IRPF' as const, importeMensual: 0 }]);
  const updateEspecie = (id: string, patch: Partial<WizardEspecie>) =>
    setEspecie(e => e.map(x => x.id === id ? { ...x, ...patch } : x));
  const removeEspecie = (id: string) => setEspecie(e => e.filter(x => x.id !== id));

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Variables */}
      <div style={cardSt}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>
          Variables y bonificaciones
        </h3>
        {variables.length === 0 ? (
          <div style={{ border: '2px dashed var(--grey-300, #C8D0DC)', borderRadius: 8, padding: '20px 16px', textAlign: 'center', color: 'var(--grey-400)', fontSize: 13, fontFamily: FONT }}>
            Sin pagos variables — solo retribución fija
          </div>
        ) : variables.map(v => (
          <div key={v.id} style={{ border: '1px solid var(--grey-200, #DDE3EC)', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <input
                value={v.nombre}
                onChange={e => updateVar(v.id, { nombre: e.target.value })}
                style={{ ...inputSt, flex: 1, minWidth: 120 }}
                placeholder="Nombre variable"
              />
              <select value={v.tipo} onChange={e => updateVar(v.id, { tipo: e.target.value as 'variable' | 'bonus' })} style={{ ...inputSt, width: 100 }}>
                <option value="variable">Variable</option>
                <option value="bonus">Bonus</option>
              </select>
              <select value={v.base} onChange={e => updateVar(v.id, { base: e.target.value as 'importe' | 'pct' })} style={{ ...inputSt, width: 140 }}>
                <option value="importe">Importe fijo €</option>
                <option value="pct">% sobre bruto</option>
              </select>
              {v.base === 'importe' ? (
                <input type="number" value={v.importe} onChange={e => updateVar(v.id, { importe: Number(e.target.value) })}
                  style={{ ...inputSt, width: 100, fontFamily: MONO }} placeholder="€" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" value={v.pct} onChange={e => updateVar(v.id, { pct: Number(e.target.value) })}
                    style={{ ...inputSt, width: 70, fontFamily: MONO }} placeholder="%" />
                  {v.pct > 0 && <span style={{ fontSize: 12, color: 'var(--teal-600, #1DA0BA)', fontFamily: MONO }}>= {fmtEur(brutoAnual * v.pct / 100)}</span>}
                </div>
              )}
              <select value={v.mes} onChange={e => updateVar(v.id, { mes: e.target.value })} style={{ ...inputSt, width: 120 }}>
                {MESES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button onClick={() => removeVar(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-400)' }}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        <button onClick={addVariable} style={{ ...ghostBtn, marginTop: 8, width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> Añadir variable / bonus
        </button>
      </div>

      {/* Plan pensiones */}
      <div style={cardSt}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tienePP ? 16 : 0, cursor: 'pointer' }}
          onClick={() => setTienePP(!tienePP)}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>Aportación a plan de pensiones</div>
            <div style={{ fontSize: 12, color: 'var(--grey-500, #6C757D)', fontFamily: FONT, marginTop: 2 }}>
              Tu aportación y la de la empresa van al mismo plan al confirmar en Tesorería
            </div>
          </div>
          <button
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: tienePP ? 'var(--teal-600, #1DA0BA)' : 'var(--grey-300, #C8D0DC)',
              position: 'relative', border: 'none', cursor: 'pointer',
              transition: 'background 150ms ease', flexShrink: 0, padding: 0, marginLeft: 16,
            }}
            onClick={(e) => { e.stopPropagation(); setTienePP(!tienePP); }}
          >
            <div style={{
              position: 'absolute', top: 2, left: tienePP ? 18 : 2,
              width: 16, height: 16, background: 'white', borderRadius: '50%',
              transition: 'left 150ms ease',
            }} />
          </button>
        </div>
        {tienePP && (
          <div>
            {planes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 12 }}>
                {planes.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1.5px solid ${ppPlanId === p.id ? 'var(--navy-900, #042C5E)' : 'var(--grey-200, #DDE3EC)'}`, borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>
                    <input type="radio" name="pp" checked={ppPlanId === p.id} onChange={() => setPpPlanId(p.id ?? null)} />
                    <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                    <span style={{ color: 'var(--grey-400)', fontSize: 11 }}>{p.tipo}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--grey-500)', fontSize: 13, fontFamily: FONT, marginBottom: 12 }}>No hay planes configurados.</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelSt}>Tu aportación mensual (€)</label>
                <input type="number" value={ppEmpleado} onChange={e => setPpEmpleado(Number(e.target.value))}
                  style={{ ...inputSt, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }} />
              </div>
              <div>
                <label style={labelSt}>Aportación empresa / mes (€)</label>
                <input type="number" value={ppEmpresa} onChange={e => setPpEmpresa(Number(e.target.value))}
                  style={{ ...inputSt, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Especie */}
      <div style={cardSt}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tieneEspecie ? 16 : 0, cursor: 'pointer' }}
          onClick={() => setTieneEspecie(!tieneEspecie)}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>Beneficios en especie</div>
            <div style={{ fontSize: 12, color: 'var(--grey-500, #6C757D)', fontFamily: FONT, marginTop: 2 }}>
              Retribución no dineraria que puede incrementar tu base IRPF
            </div>
          </div>
          <button
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: tieneEspecie ? 'var(--teal-600, #1DA0BA)' : 'var(--grey-300, #C8D0DC)',
              position: 'relative', border: 'none', cursor: 'pointer',
              transition: 'background 150ms ease', flexShrink: 0, padding: 0, marginLeft: 16,
            }}
            onClick={(e) => { e.stopPropagation(); setTieneEspecie(!tieneEspecie); }}
          >
            <div style={{
              position: 'absolute', top: 2, left: tieneEspecie ? 18 : 2,
              width: 16, height: 16, background: 'white', borderRadius: '50%',
              transition: 'left 150ms ease',
            }} />
          </button>
        </div>
        {tieneEspecie && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 12 }}>
              {['Seguro médico (exento)', 'Seguro de vida', 'Vehículo / gasolina', 'Teléfono móvil', 'Cheque restaurante', 'Guardería', 'Otro'].map(n => (
                <button key={n} onClick={() => addEspecie(n)}
                  style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid var(--grey-300, #C8D0DC)', background: '#fff', fontSize: 12, fontFamily: FONT, cursor: 'pointer', color: 'var(--navy-900, #042C5E)' }}>
                  {n}
                </button>
              ))}
            </div>
            {especie.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <input value={e.nombre} onChange={ev => updateEspecie(e.id, { nombre: ev.target.value })}
                  style={{ ...inputSt, flex: 1 }} />
                <input type="number" value={e.importeMensual} onChange={ev => updateEspecie(e.id, { importeMensual: Number(ev.target.value) })}
                  style={{ ...inputSt, width: 90, fontFamily: MONO }} placeholder="€/mes" />
                <select value={e.tributacion} onChange={ev => updateEspecie(e.id, { tributacion: ev.target.value as WizardEspecie['tributacion'] })}
                  style={{ ...inputSt, width: 150 }}>
                  <option value="Computa en IRPF">Computa en IRPF</option>
                  <option value="Exento IRPF">Exento IRPF</option>
                </select>
                <button onClick={() => removeEspecie(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-400)' }}><Trash2 size={16} /></button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--grey-400)', fontFamily: FONT, marginTop: 8 }}>
              La especie incrementa tu base IRPF pero no llega a tu cuenta
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => {
    const totalNeto = calendario.reduce((s, m) => s + m.liq, 0);
    const totalBrutoVar = calendario.reduce((s, m) => s + m.brutoVar, 0);
    const totalIRPF = calendario.reduce((s, m) => s + (m.brutoMes + m.brutoVar) * irpf / 100, 0);
    const totalSS = calendario.reduce((s, m) => s + Math.min(m.brutoMes, ssTope) * ssPct / 100 + solidaridadAnual / 12, 0);
    const totalPP = tienePP ? ppEmpleado * 12 : 0;
    const totalPPTotal = tienePP ? (ppEmpleado + ppEmpresa) * 12 : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
          <CheckCircle size={28} color="var(--teal-600, #1DA0BA)" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>
              Nómina configurada · {empresa ? empresa.charAt(0).toUpperCase() + empresa.slice(1) : '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--grey-500)', fontFamily: FONT }}>
              Lo que recibirás en tu cuenta cada mes
            </div>
          </div>
        </div>

        {/* Grid de 12 meses */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {calendario.map((m, i) => (
            <div key={m.mes} style={{ border: '1px solid var(--grey-200, #DDE3EC)', borderRadius: 10, padding: '12px 14px', background: m.esExtra ? 'rgba(4,44,94,0.04)' : '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--grey-500)', fontFamily: FONT, letterSpacing: '0.05em', marginBottom: 6 }}>
                {MESES_CORTO[i]}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                {m.liq > 0 ? fmtEur(m.liq) : '—'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                {m.esExtra && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(4,44,94,0.08)', color: 'var(--navy-900)', fontFamily: FONT }}>Paga extra</span>}
                {m.hasVar && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(4,44,94,0.08)', color: 'var(--navy-900)', fontFamily: FONT }}>
                  {m.varTipos.includes('bonus') ? 'Bonus' : 'Variable'}
                </span>}
                {tienePP && <div style={{ fontSize: 10, color: 'var(--grey-400)', fontFamily: FONT, width: '100%', marginTop: 2 }}>PP +{fmtEur(ppEmpleado)}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Resumen anual */}
        <div style={navyCard}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, marginBottom: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
            RESUMEN ANUAL
          </div>
          {[
            { label: 'Bruto anual fijo', val: brutoAnual, neg: false },
            { label: 'Variables / bonus estimados', val: totalBrutoVar, neg: false },
            { label: `IRPF retenido (${irpf.toFixed(2)}%)`, val: totalIRPF, neg: true },
            { label: 'SS + Solidaridad', val: totalSS, neg: true },
            ...(tienePP ? [{ label: `PP empleado → ${planes.find(p => p.id === ppPlanId)?.nombre || 'plan'}`, val: totalPP, neg: true }] : []),
          ].map(({ label, val, neg }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontFamily: FONT }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: neg ? 'rgba(255,255,255,0.7)' : '#fff' }}>
                {neg ? fmtNeg(val) : fmtEur(val)}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: '#fff', fontFamily: FONT }}>Total neto en cuenta</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 18, color: 'var(--teal-400, #4AC8E0)' }}>
              {fmtEur(totalNeto)}
            </span>
          </div>
          {tienePP && (
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: FONT }}>+ PP acumulado (tuyo + empresa)</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.6)' }}>{fmtEur(totalPPTotal)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const STEPS = ['Empresa y sueldo', 'Variables y extras', 'Confirmación'];

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--grey-200, #DDE3EC)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>{isEditing ? 'Editar nómina' : 'Nueva nómina'}</div>
          <div style={{ fontSize: 13, color: 'var(--grey-500)', fontFamily: FONT }}>{titularNombre}</div>
        </div>
        <button onClick={() => navigate('/gestion/personal')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-500)' }}>
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 24px 120px' }}>
        <Stepper step={step} steps={STEPS} />
        {step === 0 && renderStep1()}
        {step === 1 && renderStep2()}
        {step === 2 && renderStep3()}
      </div>

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid var(--grey-200, #DDE3EC)', padding: '16px 32px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', zIndex: 10 }}>
        <button
          onClick={() => setStep(s => s - 1)}
          style={{ ...ghostBtn, visibility: step > 0 ? 'visible' : 'hidden', justifySelf: 'start' }}
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        <span style={{ fontSize: 12, color: 'var(--grey-400, #9CA3AF)', fontFamily: FONT }}>
          Paso {step + 1} de {STEPS.length}
        </span>
        <div style={{ justifySelf: 'end' }}>
          {step < 2 ? (
            <button onClick={() => setStep(s => s + 1)} style={primaryBtn} disabled={step === 0 && !empresa}>
              Siguiente →
            </button>
          ) : (
            <button onClick={handleSave} style={primaryBtn} disabled={saving}>
              {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Guardar nómina'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NominaWizard;
