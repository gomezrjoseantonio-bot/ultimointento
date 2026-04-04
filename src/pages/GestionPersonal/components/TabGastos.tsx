import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Shield } from 'lucide-react';
import GastoRow from './GastoRow';
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

const fmtValue = (v: number | null | undefined): string =>
  v != null && v !== 0 ? `${fmt(v)} \u20AC` : '\u2014';

const CATEGORIA_LABEL: Record<PersonalExpenseCategory, string> = {
  vivienda: 'Vivienda',
  alimentacion: 'Alimentaci\u00F3n',
  transporte: 'Transporte',
  ocio: 'Ocio',
  salud: 'Salud',
  seguros: 'Seguros',
  educacion: 'Educaci\u00F3n',
  otros: 'Otros',
};

const CAT_COLORS: Record<string, string> = {
  vivienda: 'var(--navy-900, #042C5E)',
  alimentacion: 'var(--navy-800, #0A3A72)',
  transporte: 'var(--navy-700, #142C50)',
  seguros: 'var(--teal-600, #1DA0BA)',
  salud: 'var(--grey-700, #303A4C)',
  ocio: 'var(--grey-500, #6C757D)',
  educacion: 'var(--grey-400, #9CA3AF)',
  otros: 'var(--grey-300, #C8D0DC)',
};

const FRECUENCIA_OPTS: { value: PersonalExpenseFrequency; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'meses_especificos', label: 'Meses espec\u00EDficos' },
];

const CATEGORIAS_OPTS: { value: PersonalExpenseCategory; label: string }[] = [
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'alimentacion', label: 'Alimentaci\u00F3n' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'ocio', label: 'Ocio' },
  { value: 'salud', label: 'Salud' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'educacion', label: 'Educaci\u00F3n' },
  { value: 'otros', label: 'Otros' },
];

/* ── Suministros siempre presentes ── */
const SUMINISTROS_BASE = [
  { concepto: 'Luz', categoria: 'suministros' as const },
  { concepto: 'Gas', categoria: 'suministros' as const },
  { concepto: 'Agua', categoria: 'suministros' as const },
  { concepto: 'Internet + tel\u00E9fono', categoria: 'suministros' as const },
];

/* ── Delete confirmation modal ── */
const DeleteModal: React.FC<{
  concepto: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ concepto, onConfirm, onCancel }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div
      aria-hidden
      onClick={onCancel}
      style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.45)' }}
    />
    <div
      style={{
        position: 'relative',
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        width: 360,
        border: '1px solid var(--grey-200, #DDE3EC)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        fontFamily: FONT,
      }}
    >
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--grey-900)' }}>
        ¿Eliminar &ldquo;{concepto}&rdquo;?
      </p>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--grey-500)' }}>
        Esta acción no se puede deshacer.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '8px 12px',
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
            flex: 1,
            padding: '8px 12px',
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
          Eliminar
        </button>
      </div>
    </div>
  </div>
);

/* ── Expense drawer/form ── */
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
    diaPago: expense?.diaPago || undefined as number | undefined,
    accountId: expense?.accountId || undefined as number | undefined,
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
        opt.value === 'educacion' ? { ...opt, label: 'Hijos / Educaci\u00F3n' } : opt,
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        aria-hidden
        onClick={onCancel}
        style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.45)' }}
      />
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
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              color: 'var(--grey-400)',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Concepto */}
          <div>
            <label style={labelStyle}>Concepto</label>
            <input
              value={form.concepto}
              onChange={(e) => setForm({ ...form, concepto: e.target.value })}
              required
              style={inputStyle}
            />
          </div>

          {/* Categoria */}
          <div>
            <label style={labelStyle}>Categoría</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value as PersonalExpenseCategory })}
              style={inputStyle}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Importe */}
          <div>
            <label style={labelStyle}>Importe (€)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.importe || ''}
              onChange={(e) => setForm({ ...form, importe: parseFloat(e.target.value) || 0 })}
              required
              style={{ ...inputStyle, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}
            />
          </div>

          {/* Frecuencia */}
          <div>
            <label style={labelStyle}>Frecuencia</label>
            <select
              value={form.frecuencia}
              onChange={(e) => setForm({ ...form, frecuencia: e.target.value as PersonalExpenseFrequency })}
              style={inputStyle}
            >
              {FRECUENCIA_OPTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dia de pago */}
          <div>
            <label style={labelStyle}>Día de pago (opcional)</label>
            <input
              type="number"
              min={1}
              max={31}
              value={form.diaPago || ''}
              onChange={(e) => setForm({ ...form, diaPago: parseInt(e.target.value) || undefined })}
              style={inputStyle}
            />
          </div>

          {/* Cuenta de cargo */}
          {accounts.length > 0 && (
            <div>
              <label style={labelStyle}>Cuenta de cargo</label>
              <select
                value={form.accountId || ''}
                onChange={(e) => setForm({ ...form, accountId: e.target.value ? parseInt(e.target.value) : undefined })}
                style={inputStyle}
              >
                <option value="">Sin asignar</option>
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.alias || a.nombre || `Cuenta ${a.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '10px 14px',
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
              type="submit"
              disabled={!canSubmit}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: canSubmit ? 'var(--navy-900, #042C5E)' : 'var(--grey-300)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontFamily: FONT,
              }}
            >
              {expense ? 'Guardar' : 'Añadir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--grey-700, #303A4C)',
  marginBottom: 4,
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1.5px solid var(--grey-300, #C8D0DC)',
  fontSize: 13,
  color: 'var(--grey-900, #1A2332)',
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
};

/* ──────────────────────────────────────────────────────────── */
/*  TabGastos — main component                                 */
/* ──────────────────────────────────────────────────────────── */

interface Props {
  data: GestionPersonalData;
  onDataChange: () => void;
}

const TabGastos: React.FC<Props> = ({ data, onDataChange }) => {
  const { perfil, expenses, nominas, autonomos, prestamosPersonales, nominaCalcs } = data;

  const [editingExpense, setEditingExpense] = useState<PersonalExpense | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<PersonalExpense | null>(null);
  const [localExpenses, setLocalExpenses] = useState(expenses);
  const [desviaciones, setDesviaciones] = useState<DesviacionResumen[]>([]);

  // Keep local expenses in sync
  useEffect(() => {
    setLocalExpenses(expenses);
  }, [expenses]);

  // Fetch desviaciones (real vs estimated) for current year
  useEffect(() => {
    const year = new Date().getFullYear();
    if (perfil.id == null) return;
    gastosPersonalesRealService.getDesviaciones(perfil.id, year).then(setDesviaciones).catch(() => setDesviaciones([]));
  }, [perfil.id, expenses]);

  const hasHijos = (perfil.descendientes?.length ?? 0) > 0;

  // Build suggested expenses
  const sugeridos = useMemo(() => {
    const result: Array<{ concepto: string; categoria: string; motivo: string }> = [];
    const existingLower = new Set(localExpenses.map((e) => e.concepto.toLowerCase()));

    // Suministros base
    for (const s of SUMINISTROS_BASE) {
      if (!existingLower.has(s.concepto.toLowerCase())) {
        result.push({ concepto: s.concepto, categoria: 'vivienda', motivo: 'Suministro b\u00E1sico' });
      }
    }

    // Housing
    if (perfil.housingType === 'rent') {
      if (!existingLower.has('alquiler'))
        result.push({ concepto: 'Alquiler', categoria: 'vivienda', motivo: 'Perfil: vivienda en alquiler' });
      if (!existingLower.has('seguro hogar inquilino'))
        result.push({ concepto: 'Seguro hogar inquilino', categoria: 'seguros', motivo: 'Perfil: vivienda en alquiler' });
    }

    // Vehicle
    if (!perfil.hasVehicle) {
      if (!existingLower.has('abono transporte'))
        result.push({ concepto: 'Abono transporte', categoria: 'transporte', motivo: 'Perfil: sin veh\u00EDculo propio' });
    } else {
      if (!existingLower.has('gasolina'))
        result.push({ concepto: 'Gasolina', categoria: 'transporte', motivo: 'Perfil: veh\u00EDculo propio' });
      if (!existingLower.has('seguro veh\u00EDculo'))
        result.push({ concepto: 'Seguro veh\u00EDculo', categoria: 'seguros', motivo: 'Perfil: veh\u00EDculo propio' });
    }

    // Hijos
    if (hasHijos) {
      if (!existingLower.has('colegio / guarder\u00EDa') && !existingLower.has('colegio'))
        result.push({ concepto: 'Colegio / guarder\u00EDa', categoria: 'educacion', motivo: `Perfil: ${perfil.descendientes!.length} hijos` });
      if (!existingLower.has('actividades extraescolares'))
        result.push({ concepto: 'Actividades extraescolares', categoria: 'educacion', motivo: 'Perfil: hijos' });
    }

    return result;
  }, [localExpenses, perfil, hasHijos]);

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
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
  const maxCat = catBreakdown.length > 0 ? catBreakdown[0].val : 1;

  // Neto anual for excedente panel — includes all income sources minus retenciones
  const calcNeto = useCallback(() => {
    let neto = 0;
    // Nominas: bruto - retenciones
    for (const n of nominas) {
      const c = n.id != null ? nominaCalcs.get(n.id) : undefined;
      if (c) {
        neto += c.totalAnualNeto;
      }
    }
    // Autonomos: use rendimientoNeto (facturación - gastos - cuotas)
    if (autonomos.length > 0) {
      const { rendimientoNeto } = autonomoService_calc(autonomos);
      neto += rendimientoNeto;
    }
    // Pensiones
    for (const p of data.pensiones) {
      neto += p.pensionBrutaAnual * (1 - p.irpfPorcentaje / 100);
    }
    // Otros ingresos
    const otrosActivos = data.otrosIngresos.filter((o) => o.activo);
    neto += otrosIngresosService.calculateAnnualIncome(otrosActivos);
    return neto;
  }, [nominas, autonomos, nominaCalcs, data.pensiones, data.otrosIngresos]);

  const netoAnual = calcNeto();
  const gastosAnual = totalMensual * 12;
  const financiacionAnual = prestamosPersonales.reduce((s, p) => {
    const cuota = (p as any).cuotaMensual || (p as any).cuota || 0;
    return s + cuota * 12;
  }, 0);
  const excedente = netoAnual - gastosAnual - financiacionAnual;
  const tasaAhorro = netoAnual > 0 ? Math.round((excedente / netoAnual) * 100) : 0;

  // Handlers
  const handleOpenNew = () => {
    setEditingExpense(null);
    setShowDrawer(true);
  };

  const handleEdit = (e: PersonalExpense) => {
    setEditingExpense(e);
    setShowDrawer(true);
  };

  const handleDelete = (e: PersonalExpense) => {
    setDeletingExpense(e);
  };

  const confirmDelete = async () => {
    if (deletingExpense?.id) {
      await patronGastosPersonalesService.deletePatron(deletingExpense.id);
      setDeletingExpense(null);
      onDataChange();
    }
  };

  const handleSave = async (
    formData: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: number },
  ) => {
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
    // Pre-fill via the drawer — we use a workaround by setting a pseudo expense
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

  // Group: normal expenses, hijos expenses
  const normalExpenses = localExpenses.filter(
    (e) => e.activo && e.categoria !== 'educacion',
  );
  const hijosExpenses = localExpenses.filter(
    (e) => e.activo && e.categoria === 'educacion',
  );
  const totalHijos = hijosExpenses.reduce(
    (s, e) => s + patronGastosPersonalesService.calcularImporteMensual(e),
    0,
  );

  return (
    <div style={{ display: 'flex', gap: 32, fontFamily: FONT }}>
      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Add button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            onClick={handleOpenNew}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
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
            <Plus size={16} />
            Añadir gasto
          </button>
        </div>

        {/* Normal expenses */}
        <div
          style={{
            background: 'var(--white)',
            borderRadius: 10,
            border: '1px solid var(--grey-200, #DDE3EC)',
            padding: '4px 20px',
            marginBottom: 16,
          }}
        >
          {normalExpenses.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--grey-400)', fontSize: 13 }}>
              Sin gastos configurados. Añade tu primer gasto.
            </div>
          ) : (
            normalExpenses.map((e) => (
              <GastoRow key={e.id || e.concepto} expense={e} onEdit={handleEdit} onDelete={handleDelete} />
            ))
          )}
        </div>

        {/* Hijos section */}
        {hasHijos && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 0',
                borderBottom: '1px solid var(--grey-200)',
              }}
            >
              <Shield size={14} color="var(--navy-700, #142C50)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--grey-900)' }}>
                Gastos de hijos · {perfil.descendientes!.length} descendiente{perfil.descendientes!.length > 1 ? 's' : ''}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--grey-900)',
                }}
              >
                {fmtValue(Math.round(totalHijos))}/mes
              </span>
              <button
                onClick={() => handleAddSuggested('', 'educacion')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--grey-300)',
                  background: '#fff',
                  fontSize: 12,
                  color: 'var(--grey-700)',
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                Añadir
              </button>
            </div>
            <div
              style={{
                background: 'var(--white)',
                borderRadius: 10,
                border: '1px solid var(--grey-200)',
                padding: '4px 20px',
                marginTop: 8,
              }}
            >
              {hijosExpenses.length === 0 ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--grey-400)', fontSize: 13 }}>
                  Sin gastos de hijos configurados.
                </div>
              ) : (
                hijosExpenses.map((e) => (
                  <GastoRow key={e.id || e.concepto} expense={e} onEdit={handleEdit} onDelete={handleDelete} />
                ))
              )}
            </div>
          </div>
        )}

        {/* Suggested by profile */}
        {sugeridos.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--grey-500)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sugeridos por perfil
            </div>
            <div
              style={{
                background: 'var(--grey-50, #F8F9FA)',
                borderRadius: 10,
                border: '1px dashed var(--grey-300, #C8D0DC)',
                padding: '8px 20px',
              }}
            >
              {sugeridos.map((s) => (
                <div
                  key={s.concepto}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--grey-100)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--grey-700)' }}>{s.concepto}</div>
                    <div style={{ fontSize: 11, color: 'var(--grey-400)' }}>{s.motivo}</div>
                  </div>
                  <button
                    onClick={() => handleAddSuggested(s.concepto, s.categoria)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--teal-600)',
                      background: 'var(--teal-100, #E6F7FA)',
                      color: 'var(--teal-600)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    + Añadir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Panel lateral ── */}
      <div style={{ width: 280, flexShrink: 0 }}>
        {/* Categories breakdown */}
        <div
          style={{
            background: 'var(--white)',
            borderRadius: 10,
            border: '1px solid var(--grey-200)',
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--grey-500)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Por categoría
          </div>
          {catBreakdown.map((c) => (
            <div key={c.cat} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--grey-700)' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: CAT_COLORS[c.cat] || 'var(--grey-400)',
                    }}
                  />
                  {CATEGORIA_LABEL[c.cat as PersonalExpenseCategory] || c.cat}
                </span>
                <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: 'var(--grey-900)' }}>
                  {fmt(c.val)} €
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--grey-100)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    width: `${Math.round((c.val / maxCat) * 100)}%`,
                    background: CAT_COLORS[c.cat] || 'var(--grey-400)',
                  }}
                />
              </div>
            </div>
          ))}
          <div
            style={{
              borderTop: '1px solid var(--grey-200)',
              paddingTop: 10,
              marginTop: 10,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span style={{ color: 'var(--grey-700)' }}>Total / mes</span>
            <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: 'var(--grey-900)' }}>
              {fmt(totalMensual)} €
            </span>
          </div>
        </div>

        {/* Real vs Presupuesto panel */}
        {desviaciones.length > 0 && (
          <div
            style={{
              background: 'var(--white)',
              borderRadius: 10,
              border: '1px solid var(--grey-200)',
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--grey-500)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Real vs Presupuesto
            </div>
            {desviaciones.map((d) => {
              const isOver = d.desviacion > 0;
              return (
                <div key={d.patronId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: 'var(--grey-700)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.concepto}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontVariantNumeric: 'tabular-nums',
                      color: isOver ? '#DC2626' : '#16A34A',
                      fontWeight: 500,
                    }}
                  >
                    {isOver ? '+' : ''}{fmt(Math.round(d.desviacion))} {'\u20AC'}
                  </span>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: 'var(--grey-400)', marginTop: 4 }}>
              Datos confirmados en Tesorería · {new Date().getFullYear()}
            </div>
          </div>
        )}

        {/* Excedente panel */}
        <div
          style={{
            background: 'var(--white)',
            borderRadius: 10,
            border: '1px solid var(--grey-200)',
            padding: 20,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--grey-500)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Impacto en excedente
          </div>
          {[
            { label: 'Ingresos netos', value: netoAnual, color: 'var(--grey-900)' },
            { label: 'Gastos de vida', value: -gastosAnual, color: 'var(--grey-900)' },
            {
              label: 'Financiaci\u00F3n personal',
              value: -financiacionAnual,
              color: 'var(--teal-600, #1DA0BA)',
            },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              <span style={{ color: 'var(--grey-700)' }}>{row.label}</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums',
                  color: row.color,
                }}
              >
                {row.value !== 0
                  ? `${row.value < 0 ? '\u2212' : ''}${fmt(Math.abs(row.value))} \u20AC`
                  : '\u2014'}
              </span>
            </div>
          ))}
          <div
            style={{
              borderTop: '1px solid var(--grey-200)',
              paddingTop: 10,
              marginTop: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--grey-700)' }}>Excedente</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--grey-900)',
                }}
              >
                {excedente !== 0
                  ? `${excedente > 0 ? '+' : '\u2212'}${fmt(Math.abs(excedente))} \u20AC`
                  : '\u2014'}
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--teal-600, #1DA0BA)',
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {tasaAhorro}% tasa de ahorro
            </div>
          </div>
        </div>
      </div>

      {/* ── Drawer ── */}
      {showDrawer && (
        <ExpenseDrawer
          personalDataId={perfil.id!}
          expense={editingExpense || undefined}
          hasHijos={hasHijos}
          onSave={handleSave}
          onCancel={() => {
            setShowDrawer(false);
            setEditingExpense(null);
          }}
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

/* Helper re-export for autonomo calculations */
function autonomoService_calc(autonomos: GestionPersonalData['autonomos']) {
  return autonomoServiceInstance.calculateEstimatedAnnualForAutonomos(autonomos);
}

export default TabGastos;
