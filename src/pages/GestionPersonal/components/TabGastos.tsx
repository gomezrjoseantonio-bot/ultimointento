import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Shield, X } from 'lucide-react';
import { patronGastosPersonalesService } from '../../../services/patronGastosPersonalesService';
import { gastosPersonalesRealService } from '../../../services/gastosPersonalesRealService';
import { autonomoService as autonomoServiceInstance } from '../../../services/autonomoService';
import { otrosIngresosService } from '../../../services/otrosIngresosService';
import type { GestionPersonalData } from '../GestionPersonalPage';
import type {
  PersonalExpense,
  PersonalExpenseCategory,
  PersonalExpenseFrequency,
  DesviacionResumen,
} from '../../../types/personal';
import { Account, initDB } from '../../../services/db';

const FONT = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const CATEGORIA_LABEL: Record<string, string> = {
  vivienda: 'Vivienda',
  alimentacion: 'Alimentación',
  transporte: 'Transporte',
  ocio: 'Ocio',
  salud: 'Salud',
  seguros: 'Seguros',
  educacion: 'Educación',
  suministros: 'Suministros',
  otros: 'Otros',
};

const CATEGORIA_COLOR: Record<string, string> = {
  vivienda:    '#042C5E',
  suministros: '#1A4A8A',
  alimentacion:'#1DA0BA',
  salud:       '#303A4C',
  transporte:  '#6C757D',
  ocio:        '#9CA3AF',
  seguros:     '#303A4C',
  hijos:       '#042C5E',
  educacion:   '#1A4A8A',
  otros:       '#9CA3AF',
};

function colorCategoria(cat: string): string {
  return CATEGORIA_COLOR[cat.toLowerCase()] ?? '#9CA3AF';
}

const FREQ_LABEL: Record<string, string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  meses_especificos: 'Meses específicos',
};

const FRECUENCIA_OPTS: { value: PersonalExpenseFrequency; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'meses_especificos', label: 'Meses específicos' },
];

const CATEGORIAS_OPTS: { value: PersonalExpenseCategory; label: string }[] = [
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'alimentacion', label: 'Alimentación' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'ocio', label: 'Ocio' },
  { value: 'salud', label: 'Salud' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'educacion', label: 'Educación' },
  { value: 'otros', label: 'Otros' },
];

const SUMINISTROS_BASE = [
  { concepto: 'Luz', categoria: 'suministros' as const },
  { concepto: 'Gas', categoria: 'suministros' as const },
  { concepto: 'Agua', categoria: 'suministros' as const },
  { concepto: 'Internet + teléfono', categoria: 'suministros' as const },
];

/* ─── FilaImpacto ─── */
const FilaImpacto: React.FC<{
  label: string;
  valor: number;
  negativo?: boolean;
  teal?: boolean;
}> = ({ label, valor, negativo = false, teal = false }) => {
  if (!valor)
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: 'var(--grey-700)' }}>{label}</span>
        <span style={{ fontFamily: MONO, color: 'var(--grey-400)' }}>—</span>
      </div>
    );
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: teal ? 'var(--teal-600)' : 'var(--grey-700)' }}>{label}</span>
      <span style={{ fontFamily: MONO, color: teal ? 'var(--teal-600)' : 'var(--grey-700)' }}>
        {negativo ? '−' : ''}{fmt(Math.abs(valor))} €
      </span>
    </div>
  );
};

/* ─── DeleteModal ─── */
const DeleteModal: React.FC<{
  concepto: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ concepto, onConfirm, onCancel }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      fontFamily: FONT,
    }}
  >
    <div
      style={{
        background: 'var(--white, #fff)',
        border: '1px solid var(--grey-200)',
        borderRadius: 12,
        padding: 24,
        maxWidth: 400,
        width: '100%',
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--grey-900)', marginBottom: 8, marginTop: 0 }}>
        Eliminar gasto
      </h3>
      <p style={{ fontSize: 14, color: 'var(--grey-500)', marginBottom: 20 }}>
        ¿Eliminar &ldquo;{concepto}&rdquo;? Esta acción no se puede deshacer.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1.5px solid var(--grey-300)',
            background: '#fff',
            color: 'var(--grey-700)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--navy-900, #042C5E)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          Eliminar gasto
        </button>
      </div>
    </div>
  </div>
);

/* ─── ExpenseDrawer ─── */
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--grey-700)',
  marginBottom: 4,
  fontFamily: FONT,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1.5px solid var(--grey-300)',
  fontSize: 13,
  color: 'var(--grey-900)',
  fontFamily: FONT,
  outline: 'none',
  boxSizing: 'border-box',
};

const ExpenseDrawer: React.FC<{
  personalDataId: number;
  expense?: PersonalExpense;
  hasHijos: boolean;
  onSave: (data: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => void;
  onCancel: () => void;
}> = ({ personalDataId, expense, hasHijos, onSave, onCancel }) => {
  const [form, setForm] = useState({
    concepto: expense?.concepto || '',
    categoria: expense?.categoria || ('vivienda' as PersonalExpenseCategory),
    importe: expense?.importe || 0,
    frecuencia: expense?.frecuencia || ('mensual' as PersonalExpenseFrequency),
    diaPago: expense?.diaPago || undefined,
    accountId: expense?.accountId || undefined,
  });
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    initDB().then((db) => db.getAll('accounts')).then((all) => {
      setAccounts(all.filter((a: any) => a.activa && a.status !== 'DELETED'));
    });
  }, []);

  const canSubmit = form.concepto.trim().length > 0 && form.importe > 0;

  const categories = hasHijos
    ? CATEGORIAS_OPTS.map((opt) =>
        opt.value === 'educacion' ? { ...opt, label: 'Hijos / Educación' } : opt,
      )
    : CATEGORIAS_OPTS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      personalDataId,
      concepto: form.concepto,
      categoria: form.categoria,
      importe: form.importe,
      frecuencia: form.frecuencia,
      diaPago: form.diaPago,
      accountId: form.accountId,
      activo: true,
      ...(expense?.id ? { id: expense.id } : {}),
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div aria-hidden onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.45)' }} />
      <div
        style={{
          position: 'relative',
          width: 420,
          maxWidth: '95vw',
          background: '#fff',
          height: '100%',
          overflow: 'auto',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--grey-200)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--grey-900)' }}>
            {expense ? 'Editar gasto' : 'Nuevo gasto'}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--grey-400)', cursor: 'pointer' }}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Concepto</label>
            <input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Categoría</label>
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as PersonalExpenseCategory })} style={inputStyle}>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Importe (€)</label>
            <input type="number" min={0} step={0.01} value={form.importe || ''} onChange={(e) => setForm({ ...form, importe: parseFloat(e.target.value) || 0 })} required style={{ ...inputStyle, fontFamily: MONO }} />
          </div>
          <div>
            <label style={labelStyle}>Frecuencia</label>
            <select value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value as PersonalExpenseFrequency })} style={inputStyle}>
              {FRECUENCIA_OPTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Día de pago (opcional)</label>
            <input type="number" min={1} max={31} value={form.diaPago || ''} onChange={(e) => setForm({ ...form, diaPago: parseInt(e.target.value) || undefined })} style={inputStyle} />
          </div>
          {accounts.length > 0 && (
            <div>
              <label style={labelStyle}>Cuenta de cargo</label>
              <select value={form.accountId || ''} onChange={(e) => setForm({ ...form, accountId: e.target.value ? parseInt(e.target.value) : undefined })} style={inputStyle}>
                <option value="">Sin asignar</option>
                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.alias || a.nombre || `Cuenta ${a.id}`}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onCancel} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--grey-300)', background: '#fff', color: 'var(--grey-700)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
              Cancelar
            </button>
            <button type="submit" disabled={!canSubmit} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: canSubmit ? 'var(--navy-900, #042C5E)' : 'var(--grey-300)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: FONT }}>
              {expense ? 'Guardar' : 'Añadir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Shared row button style ─── */
const rbStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 7,
  border: '1px solid var(--grey-200)',
  background: 'var(--white, #fff)',
  cursor: 'pointer',
  color: 'var(--grey-400)',
};

/* ─── GastoRow inline component ─── */
const GrowRow: React.FC<{
  gasto: PersonalExpense;
  accounts: Account[];
  onEdit: (e: PersonalExpense) => void;
  onDelete: (e: PersonalExpense) => void;
}> = ({ gasto, accounts, onEdit, onDelete }) => {
  const mensual = patronGastosPersonalesService.calcularImporteMensual(gasto);
  const origen = (gasto as any).origen as string | undefined;

  const cuentaNombre = (id: number) => {
    const acc = accounts.find((a) => a.id === id);
    return acc ? (acc.alias || acc.banco?.name || `Cuenta ${id}`) : `Cuenta ${id}`;
  };

  let metaParts: string[] = [CATEGORIA_LABEL[gasto.categoria] || capitalizar(gasto.categoria)];
  if (gasto.frecuencia !== 'mensual') metaParts.push(FREQ_LABEL[gasto.frecuencia] || gasto.frecuencia);
  if (gasto.diaPago) metaParts.push(`día ${gasto.diaPago}`);
  if (gasto.accountId) metaParts.push(cuentaNombre(gasto.accountId));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 16px',
        borderBottom: '1px solid var(--grey-50, #F8F9FA)',
        fontFamily: FONT,
      }}
    >
      {/* Color dot — 9×9px square */}
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: 2,
          background: colorCategoria(gasto.categoria),
          flexShrink: 0,
        }}
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--grey-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {gasto.concepto}
          {origen === 'perfil' && (
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal-600)', background: 'var(--teal-100, #E6F7FA)', padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>
              Perfil
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--grey-400)', marginTop: 1 }}>
          {metaParts.join(' · ')}
        </div>
      </div>

      {/* Importes */}
      <div style={{ textAlign: 'right', marginRight: 4 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: 'var(--grey-900)' }}>
          {fmt(Math.round(mensual))} €
          <span style={{ fontSize: 10, color: 'var(--grey-400)', fontWeight: 400, marginLeft: 2 }}>/mes</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--grey-400)' }}>
          {fmt(Math.round(mensual * 12))} € / año
        </div>
      </div>

      {/* Botones siempre visibles */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
        <button type="button" aria-label="Editar gasto" style={rbStyle} onClick={() => onEdit(gasto)}>
          <Pencil size={13} />
        </button>
        <button type="button" aria-label="Eliminar gasto" style={rbStyle} onClick={() => onDelete(gasto)}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

/* ─── Card container ─── */
const cardStyle: React.CSSProperties = {
  background: 'var(--white, #fff)',
  borderRadius: 10,
  border: '1px solid var(--grey-200)',
  overflow: 'hidden',
  marginBottom: 4,
};

/* ─── Section header ─── */
const SecHeader: React.FC<{ label: React.ReactNode; right?: React.ReactNode }> = ({ label, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 20 }}>
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--grey-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
      {label}
    </span>
    {right}
  </div>
);

/* ══════════════════════════════════════════════════════════════ */
/*  TabGastos                                                     */
/* ══════════════════════════════════════════════════════════════ */

interface Props {
  data: GestionPersonalData;
  onDataChange: () => void;
}

const TabGastos: React.FC<Props> = ({ data, onDataChange }) => {
  const { perfil, expenses, nominas, autonomos, nominaCalcs } = data;

  const [editingExpense, setEditingExpense] = useState<PersonalExpense | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<PersonalExpense | null>(null);
  const [localExpenses, setLocalExpenses] = useState(expenses);
  const [desviaciones, setDesviaciones] = useState<DesviacionResumen[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [descartados, setDescartados] = useState<Set<string>>(new Set());

  useEffect(() => { setLocalExpenses(expenses); }, [expenses]);

  useEffect(() => {
    const year = new Date().getFullYear();
    if (perfil.id == null) return;
    gastosPersonalesRealService.getDesviaciones(perfil.id, year).then(setDesviaciones).catch(() => setDesviaciones([]));
  }, [perfil.id, expenses]);

  useEffect(() => {
    initDB()
      .then((db) => db.getAll('accounts'))
      .then((all) => {
        setAccounts(all.filter((a: any) => a.activa && a.status !== 'DELETED'));
      })
      .catch(() => setAccounts([]));
  }, []);

  const hasHijos = (perfil.descendientes?.length ?? 0) > 0;

  const sugeridos = useMemo(() => {
    const result: Array<{ concepto: string; categoria: string; motivo: string }> = [];
    const existingLower = new Set(localExpenses.map((e) => e.concepto.toLowerCase()));

    for (const s of SUMINISTROS_BASE) {
      if (!existingLower.has(s.concepto.toLowerCase()))
        result.push({ concepto: s.concepto, categoria: s.categoria, motivo: 'Suministro básico' });
    }
    if (perfil.housingType === 'rent') {
      if (!existingLower.has('alquiler'))
        result.push({ concepto: 'Alquiler', categoria: 'vivienda', motivo: 'Perfil: vivienda en alquiler' });
      if (!existingLower.has('seguro hogar inquilino'))
        result.push({ concepto: 'Seguro hogar inquilino', categoria: 'seguros', motivo: 'Perfil: vivienda en alquiler' });
    }
    if (!perfil.hasVehicle) {
      if (!existingLower.has('abono transporte'))
        result.push({ concepto: 'Abono transporte', categoria: 'transporte', motivo: 'Perfil: sin vehículo propio' });
    } else {
      if (!existingLower.has('gasolina'))
        result.push({ concepto: 'Gasolina', categoria: 'transporte', motivo: 'Perfil: vehículo propio' });
      if (!existingLower.has('seguro vehículo'))
        result.push({ concepto: 'Seguro vehículo', categoria: 'seguros', motivo: 'Perfil: vehículo propio' });
    }
    if (hasHijos) {
      if (!existingLower.has('colegio / guardería') && !existingLower.has('colegio'))
        result.push({ concepto: 'Colegio / guardería', categoria: 'educacion', motivo: `Perfil: ${perfil.descendientes!.length} hijos` });
      if (!existingLower.has('actividades extraescolares'))
        result.push({ concepto: 'Actividades extraescolares', categoria: 'educacion', motivo: 'Perfil: hijos' });
    }
    return result.filter((s) => !descartados.has(s.concepto));
  }, [localExpenses, perfil, hasHijos, descartados]);

  const catBreakdown = useMemo(() => {
    const map = new Map<PersonalExpenseCategory, number>();
    for (const e of localExpenses) {
      if (!e.activo || e.importe <= 0) continue;
      const m = patronGastosPersonalesService.calcularImporteMensual(e);
      map.set(e.categoria, (map.get(e.categoria) || 0) + m);
    }
    return Array.from(map.entries())
      .map(([cat, val]) => ({ cat, val: Math.round(val) }))
      .sort((a, b) => b.val - a.val);
  }, [localExpenses]);

  const totalMensual = catBreakdown.reduce((s, c) => s + c.val, 0);

  const calcNeto = useCallback(() => {
    let neto = 0;
    for (const n of nominas) {
      const c = n.id != null ? nominaCalcs.get(n.id) : undefined;
      if (c) neto += c.totalAnualNeto;
    }
    if (autonomos.length > 0) {
      const { rendimientoNeto } = autonomoService_calc(autonomos);
      neto += rendimientoNeto;
    }
    for (const p of data.pensiones) {
      neto += p.pensionBrutaAnual * (1 - p.irpfPorcentaje / 100);
    }
    const otrosActivos = data.otrosIngresos.filter((o) => o.activo);
    neto += otrosIngresosService.calculateAnnualIncome(otrosActivos);
    return neto;
  }, [nominas, autonomos, nominaCalcs, data.pensiones, data.otrosIngresos]);

  const netoAnual = calcNeto();
  const gastosAnual = totalMensual * 12;
  const financiacionAnual = data.financiacionPersonalAnual;
  const excedente = netoAnual - gastosAnual - financiacionAnual;
  const tasaAhorro = netoAnual > 0 ? Math.round((excedente / netoAnual) * 100) : 0;

  const handleOpenNew = () => { setEditingExpense(null); setShowDrawer(true); };
  const handleEdit = (e: PersonalExpense) => { setEditingExpense(e); setShowDrawer(true); };
  const handleDelete = (e: PersonalExpense) => { setDeletingExpense(e); };

  const confirmDelete = async () => {
    if (deletingExpense?.id) {
      await patronGastosPersonalesService.deletePatron(deletingExpense.id);
      setDeletingExpense(null);
      onDataChange();
    }
  };

  const handleSave = async (formData: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => {
    const { id, ...rest } = formData;
    if (id) {
      await patronGastosPersonalesService.updatePatron(id, rest);
    } else {
      await patronGastosPersonalesService.savePatron(rest);
    }
    setShowDrawer(false);
    setEditingExpense(null);
    onDataChange();
  };

  const handleAddSuggested = (concepto: string, categoria: string) => {
    setEditingExpense(null);
    setShowDrawer(true);
    setEditingExpense({
      personalDataId: perfil.id!,
      concepto,
      categoria: categoria as PersonalExpenseCategory,
      importe: 0,
      frecuencia: 'mensual',
      activo: true,
      createdAt: '',
      updatedAt: '',
    } as PersonalExpense);
  };

  const normalExpenses = localExpenses.filter((e) => e.activo && (hasHijos ? e.categoria !== 'educacion' : true));
  const hijosExpenses = localExpenses.filter((e) => e.activo && e.categoria === 'educacion');
  const totalHijos = hijosExpenses.reduce((s, e) => s + patronGastosPersonalesService.calcularImporteMensual(e), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, fontFamily: FONT }}>

      {/* ── Columna izquierda ── */}
      <div>
        {/* Gastos del hogar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--grey-400)' }}>
            Gastos del hogar
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--grey-500)' }}>
              Total:{' '}
              <strong style={{ fontFamily: MONO, color: 'var(--grey-900)' }}>
                {fmt(totalMensual)} €/mes
              </strong>
            </span>
            <button
              onClick={handleOpenNew}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: 'var(--navy-900, #042C5E)', color: '#fff',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              <Plus size={12} /> Añadir gasto
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          {normalExpenses.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--grey-400)', fontSize: 13 }}>
              Sin gastos configurados. Añade tu primer gasto.
            </div>
          ) : (
            normalExpenses.map((e) => (
              <GrowRow key={e.id || e.concepto} gasto={e} accounts={accounts} onEdit={handleEdit} onDelete={handleDelete} />
            ))
          )}
        </div>

        {/* Gastos de hijos */}
        {hasHijos && (
          <>
            <SecHeader
              label={<><Shield size={14} /> Gastos de hijos · {perfil.descendientes!.length} descendiente{perfil.descendientes!.length > 1 ? 's' : ''}</>}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong style={{ fontFamily: MONO, fontSize: 12, color: 'var(--grey-900)' }}>
                    {fmt(Math.round(totalHijos))} €/mes
                  </strong>
                  <button
                    onClick={() => handleAddSuggested('', 'educacion')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--navy-900, #042C5E)', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}
                  >
                    <Plus size={12} /> Añadir
                  </button>
                </div>
              }
            />
            <div style={cardStyle}>
              {hijosExpenses.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--grey-400)', fontSize: 13 }}>
                  Sin gastos de hijos configurados.
                </div>
              ) : (
                hijosExpenses.map((e) => (
                  <GrowRow key={e.id || e.concepto} gasto={e} accounts={accounts} onEdit={handleEdit} onDelete={handleDelete} />
                ))
              )}
            </div>
          </>
        )}

        {/* Sugeridos por perfil */}
        {sugeridos.length > 0 && (
          <>
            <SecHeader label="Sugeridos por perfil" />
            <div style={{ ...cardStyle, background: 'var(--navy-50, #EEF3FA)' }}>
              {sugeridos.map((s) => (
                <div
                  key={s.concepto}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 16px',
                    borderBottom: '1px solid var(--grey-50, #F8F9FA)',
                    background: 'var(--navy-50, #EEF3FA)',
                  }}
                >
                  {/* Dashed dot */}
                  <div style={{ width: 9, height: 9, borderRadius: 2, border: '1.5px dashed var(--grey-300)', flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--grey-500)' }}>{s.concepto}</div>
                    <div style={{ fontSize: 11, color: 'var(--grey-400)' }}>{s.motivo}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    <button
                      onClick={() => handleAddSuggested(s.concepto, s.categoria)}
                      style={{ ...rbStyle, width: 'auto', padding: '0 10px', gap: 4, fontSize: 12, fontWeight: 500, color: 'var(--navy-900, #042C5E)', borderColor: 'var(--navy-900, #042C5E)' }}
                    >
                      <Plus size={12} /> Añadir
                    </button>
                    <button type="button" aria-label="Descartar sugerencia" title="Descartar sugerencia" style={rbStyle} onClick={() => setDescartados((prev) => new Set([...prev, s.concepto]))}>
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Panel derecho ── */}
      <div>
        {/* Por categoría */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--grey-400)' }}>
            Por categoría
          </span>
        </div>

        <div style={{ ...cardStyle, padding: '14px 16px', marginBottom: 14 }}>
          {catBreakdown.map(({ cat, val }) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: colorCategoria(cat), display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--grey-700)' }}>{CATEGORIA_LABEL[cat] || capitalizar(cat)}</span>
                </span>
                <span style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--grey-900)' }}>
                  {fmt(val)} €
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--grey-100)', borderRadius: 2 }}>
                <div style={{ height: 3, background: colorCategoria(cat), borderRadius: 2, width: `${totalMensual > 0 ? Math.round((val / totalMensual) * 100) : 0}%` }} />
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--grey-100)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--grey-900)' }}>Total / mes</span>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: 'var(--navy-900, #042C5E)' }}>
              {fmt(totalMensual)} €
            </span>
          </div>
        </div>

        {/* Impacto en excedente */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--grey-400)' }}>
            Impacto en excedente
          </span>
        </div>

        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <FilaImpacto label="Ingresos netos" valor={netoAnual} />
          <FilaImpacto label="Gastos de vida" valor={gastosAnual} negativo />
          <FilaImpacto label="Financiación personal" valor={financiacionAnual} negativo teal />

          <div style={{ height: 1, background: 'var(--grey-200)', margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: 'var(--grey-900)' }}>Excedente</span>
            <span style={{ fontFamily: MONO, fontWeight: 700, color: 'var(--navy-900, #042C5E)' }}>
              {excedente !== 0 ? `${excedente > 0 ? '+' : '−'}${fmt(Math.abs(excedente))} €` : '—'}
            </span>
          </div>
          {netoAnual > 0 && (
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--teal-600)' }}>
              {tasaAhorro}% tasa de ahorro
            </div>
          )}
        </div>
      </div>

      {/* ── Drawer ── */}
      {showDrawer && (
        <ExpenseDrawer
          personalDataId={perfil.id!}
          expense={editingExpense || undefined}
          hasHijos={hasHijos}
          onSave={handleSave}
          onCancel={() => { setShowDrawer(false); setEditingExpense(null); }}
        />
      )}

      {/* ── Delete modal ── */}
      {deletingExpense && (
        <DeleteModal
          concepto={deletingExpense.concepto}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingExpense(null)}
        />
      )}
    </div>
  );
};

function autonomoService_calc(autonomos: GestionPersonalData['autonomos']) {
  return autonomoServiceInstance.calculateEstimatedAnnualForAutonomos(autonomos);
}

export default TabGastos;
