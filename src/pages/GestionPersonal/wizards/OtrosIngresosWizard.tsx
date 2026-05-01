import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Monitor, FileText, Users, AlertCircle, Home, TrendingUp, Heart, PlusCircle, X, Pencil, Trash2 } from 'lucide-react';
import { otrosIngresosService } from '../../../services/otrosIngresosService';
import { personalDataService } from '../../../services/personalDataService';
import { cuentasService } from '../../../services/cuentasService';
import type { OtrosIngresos } from '../../../types/personal';
import type { Account } from '../../../services/db';

const FONT = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

type TipoIngreso = 'pension' | 'prestacion' | 'alimenticia' | 'indemnizacion' | 'alquiler' | 'dividendo' | 'subsidio' | 'otro';

const TIPOS: { tipo: TipoIngreso; label: string; icon: React.ReactNode; existingTipo: OtrosIngresos['tipo']; hasPagador: boolean; hasIRPF: boolean; hasFrecuencia: boolean; }[] = [
  { tipo: 'pension', label: 'Pensión', icon: <Monitor size={16} />, existingTipo: 'otro', hasPagador: true, hasIRPF: true, hasFrecuencia: true },
  { tipo: 'prestacion', label: 'Prestación', icon: <FileText size={16} />, existingTipo: 'prestacion-desempleo', hasPagador: true, hasIRPF: false, hasFrecuencia: true },
  { tipo: 'alimenticia', label: 'Pensión alimenticia', icon: <Users size={16} />, existingTipo: 'pension-alimenticia', hasPagador: false, hasIRPF: false, hasFrecuencia: true },
  { tipo: 'indemnizacion', label: 'Indemnización', icon: <AlertCircle size={16} />, existingTipo: 'otro', hasPagador: true, hasIRPF: true, hasFrecuencia: false },
  { tipo: 'alquiler', label: 'Alquiler personal', icon: <Home size={16} />, existingTipo: 'otro', hasPagador: false, hasIRPF: false, hasFrecuencia: true },
  { tipo: 'dividendo', label: 'Dividendo / interés', icon: <TrendingUp size={16} />, existingTipo: 'otro', hasPagador: true, hasIRPF: true, hasFrecuencia: true },
  { tipo: 'subsidio', label: 'Subsidio / beca', icon: <Heart size={16} />, existingTipo: 'subsidio-ayuda', hasPagador: true, hasIRPF: false, hasFrecuencia: true },
  { tipo: 'otro', label: 'Otro ingreso', icon: <PlusCircle size={16} />, existingTipo: 'otro', hasPagador: true, hasIRPF: true, hasFrecuencia: true },
];

const fmtEur = (v: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '\u00A0\u20AC';

function calcAnual(item: OtrosIngresos): number {
  const mults: Record<string, number> = { mensual: 12, trimestral: 4, semestral: 2, anual: 1, unico: 1 };
  return item.importe * (mults[item.frecuencia] ?? 0);
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

interface ModalState {
  tipo: TipoIngreso;
  pagador: string;
  descripcion: string;
  importe: number;
  cuentaId: number;
  fechaInicio: string;
  fechaFin: string;
  frecuencia: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'unico' | 'meses-concretos';
  mesesActivos: boolean[];
  tieneIRPF: boolean;
  irpfPct: number;
  editingId?: number;
}

const defaultModal = (tipo: TipoIngreso, cuentaId: number): ModalState => ({
  tipo, pagador: '', descripcion: '', importe: 0, cuentaId,
  fechaInicio: '', fechaFin: '', frecuencia: 'mensual',
  mesesActivos: Array(12).fill(true), tieneIRPF: false, irpfPct: 15,
});

const OtrosIngresosWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const titularParam = (searchParams.get('titular') || 'yo') as 'yo' | 'pareja';

  const [pid, setPid] = useState<number | null>(null);
  const [titularNombre, setTitularNombre] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<OtrosIngresos[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      // T14.4 · EXCEPCIÓN documentada · NO migra al gateway · necesita
      // `spouseName` (campo UI no fiscal). Lectura directa para evitar
      // dual-read.
      const perfil = await personalDataService.getPersonalData();
      if (perfil?.id) {
        setPid(perfil.id);
        setTitularNombre(titularParam === 'pareja' ? (perfil.spouseName || 'Pareja') : `${perfil.nombre} ${perfil.apellidos}`.trim());
        const [accs, existingItems] = await Promise.all([
          cuentasService.list(),
          otrosIngresosService.getOtrosIngresos(perfil.id),
        ]);
        setAccounts(accs.filter(a => !a.deleted_at && a.activa));
        setItems(existingItems.filter(i => i.titularidad === titularParam || i.titularidad === 'ambos'));
      }
    })();
  }, [titularParam]);

  const defaultCuentaId = accounts[0]?.id ?? 0;

  const openModal = (tipo: TipoIngreso) => setModal(defaultModal(tipo, defaultCuentaId));
  const closeModal = () => setModal(null);

  const tipoConfig = (tipo: TipoIngreso) => TIPOS.find(t => t.tipo === tipo)!;

  const handleSave = async () => {
    if (!pid || !modal) return;
    setSaving(true);
    try {
      const cfg = tipoConfig(modal.tipo);
      const obj: Omit<OtrosIngresos, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        personalDataId: pid,
        nombre: modal.pagador || modal.descripcion || cfg.label,
        tipo: cfg.existingTipo,
        importe: modal.importe,
        frecuencia: modal.frecuencia === 'meses-concretos' ? 'mensual' : modal.frecuencia,
        titularidad: titularParam,
        cuentaCobro: modal.cuentaId || defaultCuentaId,
        reglasDia: { tipo: 'fijo', dia: 1 },
        activo: true,
        fechaInicio: modal.fechaInicio || undefined,
        fechaFin: modal.fechaFin || undefined,
      };
      if (modal.editingId != null) {
        await otrosIngresosService.updateIngreso(modal.editingId, obj);
        setItems(prev => prev.map(i => i.id === modal.editingId ? { ...i, ...obj } : i));
      } else {
        const saved = await otrosIngresosService.saveIngreso(obj);
        setItems(prev => [...prev, saved]);
      }
      closeModal();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await otrosIngresosService.deleteIngreso(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (item: OtrosIngresos) => {
    const cfg = TIPOS.find(t => t.existingTipo === item.tipo) || TIPOS[TIPOS.length - 1];
    const frecModal: ModalState['frecuencia'] =
      item.frecuencia === 'mensual' || item.frecuencia === 'trimestral' ||
      item.frecuencia === 'semestral' || item.frecuencia === 'anual' || item.frecuencia === 'unico'
        ? item.frecuencia
        : 'mensual';
    setModal({
      tipo: cfg.tipo,
      pagador: item.nombre,
      descripcion: '',
      importe: item.importe,
      cuentaId: item.cuentaCobro || defaultCuentaId,
      fechaInicio: item.fechaInicio || '',
      fechaFin: item.fechaFin || '',
      frecuencia: frecModal,
      mesesActivos: Array(12).fill(true),
      tieneIRPF: false,
      irpfPct: 15,
      editingId: item.id,
    });
  };

  const totalAnual = useMemo(() => items.filter(i => i.activo).reduce((s, i) => s + calcAnual(i), 0), [items]);

  const modalPreview = useMemo(() => {
    if (!modal || modal.importe <= 0) return null;
    const ahora = new Date();
    const mesInicio = modal.fechaInicio ? new Date(modal.fechaInicio + '-01') : ahora;
    const mesFin = modal.fechaFin ? new Date(modal.fechaFin + '-01') : new Date(ahora.getFullYear(), 11, 1);
    const meses = Math.max(1, Math.round((mesFin.getTime() - mesInicio.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const mults: Record<string, number> = { mensual: 12, trimestral: 4, semestral: 2, anual: 1, unico: 1, 'meses-concretos': 12 };
    const brutoAnual = modal.importe * (mults[modal.frecuencia] ?? 12);
    return { meses, brutoAnual, porCobro: modal.importe };
  }, [modal]);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--grey-200, #DDE3EC)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>Otros ingresos</div>
          <div style={{ fontSize: 13, color: 'var(--grey-500)', fontFamily: FONT }}>{titularNombre}</div>
        </div>
        <button onClick={() => navigate('/gestion/personal')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-500)' }}>
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 100px' }}>
        {/* Type grid */}
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT, marginBottom: 16 }}>
          Añadir ingreso
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 32 }}>
          {TIPOS.map(t => (
            <button key={t.tipo} onClick={() => openModal(t.tipo)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 10, border: '1.5px solid var(--grey-200, #DDE3EC)', background: '#fff', cursor: 'pointer', fontFamily: FONT, color: 'var(--navy-900, #042C5E)', textAlign: 'left' as const }}>
              <span style={{ color: 'var(--navy-900, #042C5E)', flexShrink: 0 }}>{t.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Existing items */}
        {items.length > 0 && (
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT, marginBottom: 12 }}>
              Ingresos configurados
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {items.map(item => {
                const cfg = TIPOS.find(t => t.existingTipo === item.tipo) || TIPOS[TIPOS.length - 1];
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: '#fff', border: '1px solid var(--grey-200, #DDE3EC)', borderRadius: 10 }}>
                    <span style={{ color: 'var(--navy-900)', flexShrink: 0 }}>{cfg.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)', fontFamily: FONT }}>{item.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--grey-500)', fontFamily: FONT }}>{cfg.label} · {item.frecuencia}</div>
                    </div>
                    <div style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, color: 'var(--navy-900)', marginRight: 8 }}>
                      {fmtEur(item.importe)}<span style={{ color: 'var(--grey-400)', fontSize: 11 }}>/mes</span>
                    </div>
                    <button onClick={() => handleEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-400)', padding: 4 }}><Pencil size={14} /></button>
                    <button onClick={() => item.id != null && handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-400)', padding: 4 }}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div style={{ background: 'var(--navy-900, #042C5E)', borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, marginBottom: 4 }}>Total estimado / año</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtEur(totalAnual)}</div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, marginBottom: 4 }}>Media mensual</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--teal-400, #4AC8E0)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtEur(totalAnual / 12)}</div>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--grey-400)', fontSize: 14, fontFamily: FONT }}>
            Sin otros ingresos configurados. Selecciona un tipo arriba para añadir.
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (() => {
        const cfg = tipoConfig(modal.tipo);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)' }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', margin: '0 16px' }}>
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--grey-100)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--navy-900)' }}>{cfg.icon}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900, #042C5E)', fontFamily: FONT }}>{cfg.label}</span>
                </div>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey-400)' }}><X size={18} /></button>
              </div>

              {/* Modal body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelSt}>Importe (€)</label>
                  <input type="number" value={modal.importe || ''} onChange={e => setModal(m => m ? { ...m, importe: Number(e.target.value) } : m)}
                    style={{ ...inputSt, fontSize: 20, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }} placeholder="0,00" />
                </div>

                <div>
                  <label style={labelSt}>Cuenta de cobro</label>
                  <select value={modal.cuentaId} onChange={e => setModal(m => m ? { ...m, cuentaId: Number(e.target.value) } : m)} style={inputSt}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.alias || a.iban.slice(-4)}</option>)}
                  </select>
                </div>

                {cfg.hasPagador && (
                  <div>
                    <label style={labelSt}>Pagador</label>
                    <input value={modal.pagador} onChange={e => setModal(m => m ? { ...m, pagador: e.target.value } : m)} style={inputSt} placeholder="Nombre del pagador" />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelSt}>Fecha inicio <span style={{ color: 'var(--grey-400)', fontWeight: 400 }}>Mes desde el que se percibe</span></label>
                    <input type="month" value={modal.fechaInicio} onChange={e => setModal(m => m ? { ...m, fechaInicio: e.target.value } : m)} style={inputSt} />
                  </div>
                  <div>
                    <label style={labelSt}>Fecha fin <span style={{ color: 'var(--grey-400)', fontWeight: 400 }}>Vacío = indefinido</span></label>
                    <input type="month" value={modal.fechaFin} onChange={e => setModal(m => m ? { ...m, fechaFin: e.target.value } : m)} style={inputSt} />
                  </div>
                </div>

                {cfg.hasFrecuencia && (
                  <div>
                    <label style={labelSt}>Frecuencia</label>
                    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--grey-300, #C8D0DC)' }}>
                      {([
                        { value: 'mensual', label: 'Mensual' },
                        { value: 'trimestral', label: 'Trimestral' },
                        { value: 'semestral', label: 'Semestral' },
                        { value: 'anual', label: 'Anual' },
                        { value: 'unico', label: 'Único' },
                      ] as const).map(({ value, label }, i, arr) => (
                        <button
                          key={value}
                          onClick={() => setModal(m => m ? { ...m, frecuencia: value } : m)}
                          aria-pressed={modal.frecuencia === value}
                          style={{
                            flex: 1,
                            padding: '8px 4px',
                            border: 'none',
                            borderLeft: i > 0 ? '1px solid var(--grey-300, #C8D0DC)' : 'none',
                            background: modal.frecuencia === value ? 'var(--navy-900, #042C5E)' : '#fff',
                            color: modal.frecuencia === value ? '#fff' : 'var(--grey-700, #303A4C)',
                            fontSize: 12,
                            fontWeight: modal.frecuencia === value ? 600 : 400,
                            fontFamily: FONT,
                            cursor: 'pointer',
                            transition: 'background 100ms ease, color 100ms ease',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {cfg.hasIRPF && (
                  <div style={{ fontSize: 12, color: 'var(--grey-500)', fontFamily: FONT, padding: '8px 12px', background: 'var(--grey-100, #EEF1F5)', borderRadius: 8 }}>
                    Si este ingreso tiene retención IRPF, el pagador la retiene directamente. El importe registrado aquí es el bruto; la retención se reflejará en tu declaración.
                  </div>
                )}

                {/* Preview */}
                {modalPreview && (
                  <div style={{ background: 'var(--navy-900, #042C5E)', borderRadius: 10, padding: '16px', marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, marginBottom: 10, fontWeight: 700 }}>ESTIMACIÓN CON ESTOS DATOS</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: FONT, marginBottom: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>Total estimado / año</span>
                      <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(modalPreview.brutoAnual)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: FONT, marginBottom: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>Por cobro</span>
                      <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: 'var(--teal-400, #4AC8E0)' }}>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(modalPreview.porCobro)} €</span>
                    </div>
                  </div>
                )}

                {/* Save button */}
                <button onClick={handleSave} disabled={saving || modal.importe <= 0}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'var(--navy-900, #042C5E)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: modal.importe > 0 ? 'pointer' : 'not-allowed', opacity: modal.importe > 0 ? 1 : 0.5, marginTop: 4 }}>
                  {saving ? 'Guardando...' : modal.editingId != null ? 'Actualizar ingreso' : 'Añadir ingreso'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid var(--grey-200, #DDE3EC)', padding: '16px 32px', display: 'flex', justifyContent: 'flex-end', zIndex: 10 }}>
        <button
          onClick={() => navigate('/gestion/personal')}
          style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--navy-900, #042C5E)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
};

export default OtrosIngresosWizard;
