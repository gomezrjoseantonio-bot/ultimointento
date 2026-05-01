import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, X, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { autonomoService } from '../../../services/autonomoService';
import { personalDataService } from '../../../services/personalDataService';
import { cuentasService } from '../../../services/cuentasService';
import type { Account } from '../../../services/db';

const FONT = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

const TRAMOS_SS_2026 = [
  { label: '<670 €/mes', cuotaMin: 200 },
  { label: '670–900 €/mes', cuotaMin: 220 },
  { label: '900–1.167 €/mes', cuotaMin: 260 },
  { label: '1.167–1.300 €/mes', cuotaMin: 275 },
  { label: '1.300–1.500 €/mes', cuotaMin: 291 },
  { label: '1.500–1.700 €/mes', cuotaMin: 294 },
  { label: '1.700–1.850 €/mes', cuotaMin: 350 },
  { label: '1.850–2.030 €/mes', cuotaMin: 370 },
  { label: '2.030–2.330 €/mes', cuotaMin: 390 },
  { label: '2.330–2.760 €/mes', cuotaMin: 415 },
  { label: '2.760–3.190 €/mes', cuotaMin: 440 },
  { label: '3.190–3.620 €/mes', cuotaMin: 465 },
  { label: '3.620–4.050 €/mes', cuotaMin: 490 },
  { label: '4.050–6.000 €/mes', cuotaMin: 530 },
  { label: '>6.000 €/mes', cuotaMin: 590 },
];

interface WizardCliente {
  id: string;
  nombre: string;
  nif: string;
  retencion: number;
  tipo: 'mensual' | 'irregular';
  importeMensual: number;
  meses: { activo: boolean; importe: number }[];
  expanded: boolean;
}

interface WizardGasto {
  id: string;
  nombre: string;
  importe: number;
  frecuencia: 'mensual' | 'anual';
  editable: boolean;
  tipo: 'ss' | 'asesoria' | 'material' | 'otro';
}

const fmtEur = (v: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '\u00A0\u20AC';
const fmtNeg = (v: number) =>
  '\u2212\u00A0' + new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '\u00A0\u20AC';

function uid() { return Math.random().toString(36).slice(2, 10); }

function clienteTotal(c: WizardCliente): number {
  if (c.tipo === 'mensual') return c.importeMensual * 12;
  return c.meses.reduce((s, m) => s + (m.activo ? m.importe : 0), 0);
}

function clienteMesImporte(c: WizardCliente, mesIdx: number): number {
  if (c.tipo === 'mensual') return c.importeMensual;
  return c.meses[mesIdx]?.activo ? c.meses[mesIdx].importe : 0;
}

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
  border: 'none', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8,
  background: 'transparent', color: 'var(--navy-900, #042C5E)',
  border: '1.5px solid var(--grey-300, #C8D0DC)',
  fontSize: 13, fontWeight: 500, fontFamily: FONT, cursor: 'pointer',
};

const Stepper: React.FC<{ step: number; steps: string[] }> = ({ step, steps }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
    {steps.map((label, i) => {
      const done = i < step; const active = i === step;
      return (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done || active ? 'var(--navy-900, #042C5E)' : 'var(--grey-200, #DDE3EC)', color: done || active ? '#fff' : 'var(--grey-500, #6C757D)', fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
              {done ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? 'var(--navy-900)' : 'var(--grey-500)', fontFamily: FONT, whiteSpace: 'nowrap' as const }}>{label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, margin: '0 8px', marginBottom: 20, background: i < step ? 'var(--navy-900, #042C5E)' : 'var(--grey-200, #DDE3EC)' }} />}
        </React.Fragment>
      );
    })}
  </div>
);

const AutonomoWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const titularParam = (searchParams.get('titular') || 'yo') as 'yo' | 'pareja';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pid, setPid] = useState<number | null>(null);
  const [titularNombre, setTitularNombre] = useState('');

  // Step 1
  const [actividad, setActividad] = useState('');
  const [iae, setIae] = useState('');
  const [modalidad, setModalidad] = useState<'simplificada' | 'normal'>('simplificada');
  const [cuentaId, setCuentaId] = useState(0);
  const [clientes, setClientes] = useState<WizardCliente[]>([]);

  // Step 2
  const [tramoSS, setTramoSS] = useState(2);
  const [gastos, setGastos] = useState<WizardGasto[]>([
    { id: 'ss', nombre: 'Cuota SS autónomo', importe: TRAMOS_SS_2026[2].cuotaMin, frecuencia: 'mensual', editable: false, tipo: 'ss' },
    { id: 'asesoria', nombre: 'Asesoría fiscal', importe: 0, frecuencia: 'mensual', editable: true, tipo: 'asesoria' },
    { id: 'material', nombre: 'Material y suscripciones', importe: 0, frecuencia: 'mensual', editable: true, tipo: 'material' },
  ]);

  useEffect(() => {
    void (async () => {
      // T14.4 · EXCEPCIÓN documentada · NO migra al gateway · necesita
      // `spouseName` (campo UI no fiscal). Lectura directa para evitar
      // dual-read. NB · `comunidadAutonoma` (mencionado en spec) ya NO se
      // lee aquí · esta versión del wizard usa solo nombre/spouseName.
      const perfil = await personalDataService.getPersonalData();
      if (perfil?.id) {
        setPid(perfil.id);
        setTitularNombre(titularParam === 'pareja' ? (perfil.spouseName || 'Pareja') : `${perfil.nombre} ${perfil.apellidos}`.trim());
        const accs = await cuentasService.list();
        setAccounts(accs.filter(a => !a.deleted_at && a.activa));
        if (accs.length > 0 && accs[0].id) setCuentaId(accs[0].id);
      }
    })();
  }, [titularParam]);

  const addCliente = () => setClientes(c => [...c, {
    id: uid(), nombre: '', nif: '', retencion: 15, tipo: 'mensual', importeMensual: 0,
    meses: Array(12).fill(null).map(() => ({ activo: true, importe: 0 })), expanded: true,
  }]);

  const updateCliente = (id: string, patch: Partial<WizardCliente>) =>
    setClientes(c => c.map(x => x.id === id ? { ...x, ...patch } : x));

  const removeCliente = (id: string) => setClientes(c => c.filter(x => x.id !== id));

  const facturacionBruta = useMemo(() => clientes.reduce((s, c) => s + clienteTotal(c), 0), [clientes]);
  const retenciones = useMemo(() => clientes.reduce((s, c) => s + clienteTotal(c) * c.retencion / 100, 0), [clientes]);
  const cobradoEnCuenta = facturacionBruta - retenciones;

  const totalGastosAnual = useMemo(() =>
    gastos.reduce((s, g) => s + (g.frecuencia === 'mensual' ? g.importe * 12 : g.importe), 0),
    [gastos]
  );
  const rendimientoNeto = facturacionBruta - totalGastosAnual;
  const cuotaSSAnual = TRAMOS_SS_2026[tramoSS].cuotaMin * 12;
  const enCuentaAnual = cobradoEnCuenta - cuotaSSAnual;

  const updateGasto = (id: string, patch: Partial<WizardGasto>) =>
    setGastos(g => g.map(x => x.id === id ? { ...x, ...patch } : x));

  const selectTramo = (idx: number) => {
    setTramoSS(idx);
    setGastos(g => g.map(x => x.tipo === 'ss' ? { ...x, importe: TRAMOS_SS_2026[idx].cuotaMin } : x));
  };

  const addGasto = () => setGastos(g => [...g, { id: uid(), nombre: '', importe: 0, frecuencia: 'mensual', editable: true, tipo: 'otro' }]);
  const removeGasto = (id: string) => setGastos(g => g.filter(x => x.id !== id || !x.editable));

  const suggestedTramo = useMemo(() => {
    if (rendimientoNeto <= 0) return 0;
    const mesRend = rendimientoNeto / 12;
    if (mesRend < 670) return 0;
    if (mesRend < 900) return 1;
    if (mesRend < 1167) return 2;
    if (mesRend < 1300) return 3;
    if (mesRend < 1500) return 4;
    if (mesRend < 1700) return 5;
    if (mesRend < 1850) return 6;
    if (mesRend < 2030) return 7;
    if (mesRend < 2330) return 8;
    if (mesRend < 2760) return 9;
    if (mesRend < 3190) return 10;
    if (mesRend < 3620) return 11;
    if (mesRend < 4050) return 12;
    if (mesRend < 6000) return 13;
    return 14;
  }, [rendimientoNeto]);

  const handleSave = async () => {
    if (!pid) return;
    setSaving(true);
    try {
      const fuentesIngreso = clientes.map(c => ({
        id: c.id,
        nombre: c.nombre || 'Cliente',
        importeEstimado: c.tipo === 'mensual' ? c.importeMensual : clienteTotal(c) / Math.max(1, c.meses.filter(m => m.activo).length),
        meses: c.tipo === 'mensual' ? [1,2,3,4,5,6,7,8,9,10,11,12] : c.meses.map((m, i) => m.activo ? i + 1 : null).filter(Boolean) as number[],
        aplIrpf: c.retencion > 0,
      }));
      const gastosRec = gastos.map(g => ({
        id: g.id,
        descripcion: g.nombre,
        importe: g.frecuencia === 'mensual' ? g.importe : g.importe / 12,
        categoria: g.tipo,
      }));
      const avgRetencion = facturacionBruta > 0
        ? clientes.reduce((s, c) => s + clienteTotal(c) * c.retencion / 100, 0) / facturacionBruta * 100
        : 0;

      await autonomoService.saveAutonomo({
        personalDataId: pid,
        nombre: actividad,
        titular: titularParam === 'pareja' ? titularNombre : undefined,
        epigrafeIAE: iae,
        descripcionActividad: actividad,
        modalidad: modalidad,
        cuotaAutonomos: TRAMOS_SS_2026[tramoSS].cuotaMin,
        cuotaAutonomosCompartida: false,
        irpfRetencionPorcentaje: Math.round(avgRetencion),
        cuentaCobro: cuentaId || 0,
        cuentaPago: cuentaId || 0,
        reglaCobroDia: { tipo: 'fijo', dia: 5 },
        reglaPagoDia: { tipo: 'fijo', dia: 5 },
        ingresosFacturados: [],
        gastosDeducibles: [],
        fuentesIngreso: fuentesIngreso,
        gastosRecurrentesActividad: gastosRec,
        activo: true,
      });
      navigate('/gestion/personal');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={cardSt}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>Datos de la actividad</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelSt}>Descripción actividad</label>
            <input style={inputSt} value={actividad} onChange={e => setActividad(e.target.value)} placeholder="Consultoría tecnológica" />
          </div>
          <div>
            <label style={labelSt}>IAE / epígrafe</label>
            <input style={inputSt} value={iae} onChange={e => setIae(e.target.value)} placeholder="724" />
          </div>
          <div>
            <label style={labelSt}>Modalidad IRPF</label>
            <select style={inputSt} value={modalidad} onChange={e => setModalidad(e.target.value as typeof modalidad)}>
              <option value="simplificada">Estimación directa simplificada</option>
              <option value="normal">Estimación directa normal</option>
            </select>
          </div>
          <div>
            <label style={labelSt}>Cuenta de cobro</label>
            <select style={inputSt} value={cuentaId} onChange={e => setCuentaId(Number(e.target.value))}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.alias || a.iban.slice(-4)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={cardSt}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>Clientes y fuentes de facturación</h3>
        {clientes.map(c => (
          <div key={c.id} style={{ border: '1px solid var(--grey-200, #DDE3EC)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: 'var(--grey-50, #F8FAFC)' }}
              onClick={() => updateCliente(c.id, { expanded: !c.expanded })}
            >
              <div style={{ flex: 1, fontSize: 13, fontFamily: FONT }}>
                <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{c.nombre || 'Nuevo cliente'}</span>
                {c.nif && <span style={{ color: 'var(--grey-400)', marginLeft: 8 }}>{c.nif}</span>}
                <span style={{ color: 'var(--grey-400)', marginLeft: 8 }}>Ret. {c.retencion}%</span>
                <span style={{ color: 'var(--grey-500)', marginLeft: 8, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtEur(clienteTotal(c))}</span>
              </div>
              <button onClick={ev => { ev.stopPropagation(); removeCliente(c.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-400)' }}><Trash2 size={14} /></button>
            </div>
            {c.expanded && (
              <div style={{ padding: '16px', borderTop: '1px solid var(--grey-100)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelSt}>Nombre cliente</label>
                    <input style={inputSt} value={c.nombre} onChange={e => updateCliente(c.id, { nombre: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelSt}>NIF cliente</label>
                    <input style={inputSt} value={c.nif} onChange={e => updateCliente(c.id, { nif: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelSt}>% Retención IRPF <span style={{ color: 'var(--grey-400)', fontWeight: 400 }}>15% / 7% primer año</span></label>
                    <input type="number" style={inputSt} value={c.retencion} onChange={e => updateCliente(c.id, { retencion: Number(e.target.value) })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {(['mensual', 'irregular'] as const).map(t => (
                    <button key={t} onClick={() => updateCliente(c.id, { tipo: t })}
                      style={{ padding: '6px 16px', borderRadius: 8, border: '1.5px solid var(--grey-300)', background: c.tipo === t ? 'var(--navy-900, #042C5E)' : '#fff', color: c.tipo === t ? '#fff' : 'var(--navy-900)', fontSize: 13, fontFamily: FONT, cursor: 'pointer' }}>
                      {t === 'mensual' ? 'Mensual fijo' : 'Por meses / irregular'}
                    </button>
                  ))}
                </div>
                {c.tipo === 'mensual' ? (
                  <div>
                    <label style={labelSt}>Importe mensual (€)</label>
                    <input type="number" style={{ ...inputSt, width: 160, fontFamily: MONO }} value={c.importeMensual} onChange={e => updateCliente(c.id, { importeMensual: Number(e.target.value) })} />
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--grey-400)', fontFamily: FONT }}>= {fmtEur(c.importeMensual * 12)} / año</span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {MESES.map((mes, i) => (
                      <div key={mes} style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: FONT }}>
                          <input type="checkbox" checked={c.meses[i]?.activo || false}
                            onChange={ev => {
                              const mArr = [...c.meses];
                              mArr[i] = { ...mArr[i], activo: ev.target.checked };
                              updateCliente(c.id, { meses: mArr });
                            }} />
                          {mes.slice(0, 3)}
                        </label>
                        {c.meses[i]?.activo && (
                          <input type="number" style={{ ...inputSt, fontSize: 12, padding: '4px 8px', fontFamily: MONO }}
                            value={c.meses[i].importe} placeholder="€"
                            onChange={ev => {
                              const mArr = [...c.meses];
                              mArr[i] = { ...mArr[i], importe: Number(ev.target.value) };
                              updateCliente(c.id, { meses: mArr });
                            }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={addCliente} style={{ flex: 1, padding: '10px', border: '2px dashed var(--navy-900, #042C5E)', borderRadius: 8, background: 'transparent', color: 'var(--navy-900)', fontSize: 13, fontFamily: FONT, cursor: 'pointer' }}>
            + Añadir cliente
          </button>
        </div>
      </div>

      {facturacionBruta > 0 && (
        <div style={navyCard}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, marginBottom: 12 }}>Total ingresos estimados</div>
          {[
            { label: 'Facturación bruta anual', val: facturacionBruta, neg: false },
            { label: 'Retenciones a cuenta IRPF', val: retenciones, neg: true },
          ].map(({ label, val, neg }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontFamily: FONT }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: neg ? 'rgba(255,255,255,0.7)' : '#fff' }}>
                {neg ? fmtNeg(val) : fmtEur(val)}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 8, paddingTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: '#fff', fontFamily: FONT }}>Cobrado en cuenta / año</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 16, color: 'var(--teal-400, #4AC8E0)' }}>{fmtEur(cobradoEnCuenta)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: FONT }}>Media mensual en cuenta</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{fmtEur(cobradoEnCuenta / 12)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={cardSt}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>Cuota SS autónomo 2026</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--grey-600)', fontFamily: FONT }}>Tramo de cotización</span>
          <button
            onClick={() => selectTramo(suggestedTramo)}
            style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(29,160,186,0.12)', color: 'var(--teal-600, #1DA0BA)', fontSize: 12, fontWeight: 600, fontFamily: FONT, border: 'none', cursor: 'pointer' }}>
            ATLAS sugiere: {TRAMOS_SS_2026[suggestedTramo].cuotaMin} €/mes
          </button>
        </div>
        {rendimientoNeto > 0 && (
          <div style={{ fontSize: 11, color: 'var(--grey-400)', fontFamily: FONT, marginBottom: 12 }}>
            Rendimiento neto estimado: {fmtEur(rendimientoNeto / 12)}/mes · Puedes cambiar hasta 6 veces al año
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {TRAMOS_SS_2026.map((t, i) => (
            <button key={i} onClick={() => selectTramo(i)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid', textAlign: 'left' as const, cursor: 'pointer', fontFamily: FONT,
                borderColor: tramoSS === i ? 'var(--navy-900, #042C5E)' : 'var(--grey-200, #DDE3EC)',
                background: tramoSS === i ? 'var(--navy-900, #042C5E)' : '#fff',
                color: tramoSS === i ? '#fff' : 'var(--navy-900, #042C5E)' }}>
              <div style={{ fontSize: 11, marginBottom: 2, opacity: 0.8 }}>{t.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO }}>{t.cuotaMin} €/mes</div>
            </button>
          ))}
        </div>
      </div>

      <div style={cardSt}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>Gastos deducibles</h3>
        {gastos.map(g => (
          <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            {g.editable ? (
              <input value={g.nombre} onChange={e => updateGasto(g.id, { nombre: e.target.value })} style={{ ...inputSt, flex: 2 }} placeholder="Nombre del gasto" />
            ) : (
              <span style={{ flex: 2, fontSize: 13, fontFamily: FONT, color: 'var(--navy-900)', fontWeight: 600 }}>{g.nombre}</span>
            )}
            <input type="number" value={g.importe} onChange={e => updateGasto(g.id, { importe: Number(e.target.value) })}
              style={{ ...inputSt, width: 100, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }} />
            <select value={g.frecuencia} onChange={e => updateGasto(g.id, { frecuencia: e.target.value as 'mensual' | 'anual' })} style={{ ...inputSt, width: 110 }}>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
            {g.editable ? (
              <button onClick={() => removeGasto(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-400)' }}><Trash2 size={16} /></button>
            ) : <div style={{ width: 20 }} />}
          </div>
        ))}
        <button onClick={addGasto} style={{ ...ghostBtn, width: '100%', justifyContent: 'center', marginTop: 8 }}>
          <Plus size={14} /> Añadir gasto deducible
        </button>
        <div style={{ fontSize: 11, color: 'var(--grey-400)', fontFamily: FONT, marginTop: 12 }}>
          Estimación directa simplificada: puedes añadir además un 5% por gastos de difícil justificación (máx. 2.000 €/año).
        </div>
      </div>

      <div style={navyCard}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, marginBottom: 12 }}>Resultado estimado de la actividad</div>
        {[
          { label: 'Facturación anual', val: facturacionBruta, neg: false },
          { label: '− Gastos deducibles', val: totalGastosAnual, neg: true },
        ].map(({ label, val, neg }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontFamily: FONT }}>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: neg ? 'rgba(255,255,255,0.7)' : '#fff' }}>{neg ? fmtNeg(val) : fmtEur(val)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', margin: '8px 0', paddingTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, fontFamily: FONT }}>
            <span style={{ fontWeight: 600, color: '#fff' }}>Rendimiento neto (base IRPF)</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: '#fff', fontWeight: 600 }}>{fmtEur(rendimientoNeto)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: FONT }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>Rendimiento neto / mes</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.6)' }}>{fmtEur(rendimientoNeto / 12)}</span>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 8, paddingTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, fontFamily: FONT }}>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>Cobrado neto de retención / año</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{fmtEur(cobradoEnCuenta)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, fontFamily: FONT }}>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>− SS autónomo ({TRAMOS_SS_2026[tramoSS].cuotaMin} €/mes)</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)' }}>{fmtNeg(cuotaSSAnual)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT }}>
            <span style={{ fontWeight: 700, color: '#fff' }}>En cuenta cada mes</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 16, color: 'var(--teal-400, #4AC8E0)' }}>{fmtEur(enCuentaAnual / 12)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const calendario = MESES.map((mes, i) => {
      const ingresoMes = clientes.reduce((s, c) => s + clienteMesImporte(c, i), 0);
      const retencionMes = clientes.reduce((s, c) => s + clienteMesImporte(c, i) * c.retencion / 100, 0);
      const cuotaMes = TRAMOS_SS_2026[tramoSS].cuotaMin;
      const netoMes = ingresoMes - retencionMes - cuotaMes;
      return { mes, idx: i, ingresoMes, retencionMes, netoMes };
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
          <CheckCircle size={28} color="var(--teal-600, #1DA0BA)" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>
              Actividad configurada · {actividad || '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--grey-500)', fontFamily: FONT }}>
              Estimación de ingresos mensuales netos
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {calendario.map((m, i) => (
            <div key={m.mes} style={{ border: '1px solid var(--grey-200, #DDE3EC)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--grey-500)', fontFamily: FONT, letterSpacing: '0.05em', marginBottom: 6 }}>{MESES_CORTO[i]}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: m.ingresoMes > 0 ? 'var(--navy-900, #042C5E)' : 'var(--grey-300)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                {m.ingresoMes > 0 ? fmtEur(m.netoMes) : '—'}
              </div>
            </div>
          ))}
        </div>
        <div style={navyCard}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, marginBottom: 12, fontWeight: 700, letterSpacing: '0.04em' }}>RESUMEN ANUAL</div>
          {[
            { label: 'Facturación bruta anual', val: facturacionBruta, neg: false },
            { label: '− Retenciones IRPF', val: retenciones, neg: true },
            { label: '− Gastos deducibles', val: totalGastosAnual, neg: true },
          ].map(({ label, val, neg }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontFamily: FONT }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: neg ? 'rgba(255,255,255,0.7)' : '#fff' }}>{neg ? fmtNeg(val) : fmtEur(val)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 8, paddingTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, fontFamily: FONT }}>
              <span style={{ fontWeight: 600, color: '#fff' }}>Rendimiento neto</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#fff' }}>{fmtEur(rendimientoNeto)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, fontFamily: FONT }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>SS autónomo ({TRAMOS_SS_2026[tramoSS].cuotaMin} €/mes)</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)' }}>{fmtNeg(cuotaSSAnual)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: '#fff', fontFamily: FONT }}>En cuenta / año</span>
              <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 18, color: 'var(--teal-400, #4AC8E0)' }}>{fmtEur(enCuentaAnual)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const STEPS = ['Ingresos', 'Gastos y SS', 'Confirmación'];

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: FONT }}>
      <div style={{ background: '#fff', borderBottom: '1px solid var(--grey-200, #DDE3EC)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>Nueva actividad autónoma</div>
          <div style={{ fontSize: 13, color: 'var(--grey-500)', fontFamily: FONT }}>{titularNombre}</div>
        </div>
        <button onClick={() => navigate('/gestion/personal')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-500)' }}>
          <X size={20} />
        </button>
      </div>
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '32px 24px 120px' }}>
        <Stepper step={step} steps={STEPS} />
        {step === 0 && renderStep1()}
        {step === 1 && renderStep2()}
        {step === 2 && renderStep3()}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid var(--grey-200, #DDE3EC)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={ghostBtn}>
              <ChevronLeft size={14} /> Anterior
            </button>
          )}
        </div>
        <div>
          {step < 2 ? (
            <button onClick={() => setStep(s => s + 1)} style={primaryBtn} disabled={step === 0 && !actividad}>
              Siguiente →
            </button>
          ) : (
            <button onClick={handleSave} style={primaryBtn} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar actividad'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutonomoWizard;
