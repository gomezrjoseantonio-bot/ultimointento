import React, { useEffect, useMemo, useState } from 'react';
import { Home, ShoppingCart, Car, PlayCircle, Heart, Shield, GraduationCap, Box } from 'lucide-react';
import {
  PersonalExpense,
  PersonalExpenseCategory,
  PersonalExpenseFrequency,
} from '../../../types/personal';
import { Account, initDB } from '../../../services/db';

interface PersonalExpenseFormProps {
  personalDataId: number;
  expense?: PersonalExpense;
  onSave: (expense: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => void;
  onCancel: () => void;
}

const CATEGORIES: { value: PersonalExpenseCategory; label: string; Icon: React.ElementType }[] = [
  { value: 'alimentacion', label: 'Alimentación', Icon: ShoppingCart },
  { value: 'vivienda', label: 'Vivienda', Icon: Home },
  { value: 'salud', label: 'Salud', Icon: Heart },
  { value: 'ocio', label: 'Ocio', Icon: PlayCircle },
  { value: 'seguros', label: 'Seguros', Icon: Shield },
  { value: 'otros', label: 'Otros', Icon: Box },
  { value: 'transporte', label: 'Transporte', Icon: Car },
  { value: 'educacion', label: 'Educación', Icon: GraduationCap },
];

const FREQUENCY_OPTIONS: { value: PersonalExpenseFrequency; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TEMPLATE_EXPENSES: Array<{ concepto: string; categoria: PersonalExpenseCategory; importe: number }> = [
  { concepto: 'Supermercado', categoria: 'alimentacion', importe: 400 },
  { concepto: 'Gimnasio', categoria: 'salud', importe: 35 },
  { concepto: 'Spotify', categoria: 'ocio', importe: 11.99 },
  { concepto: 'Netflix', categoria: 'ocio', importe: 17.99 },
  { concepto: 'Seguro Vida', categoria: 'seguros', importe: 30 },
  { concepto: 'Móvil', categoria: 'otros', importe: 20 },
  { concepto: 'ChatGPT', categoria: 'ocio', importe: 22.99 },
  { concepto: 'Comunidad', categoria: 'vivienda', importe: 80 },
];

const defaultExpense = (personalDataId: number): Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> => ({
  personalDataId,
  concepto: '',
  categoria: 'alimentacion',
  importe: 0,
  frecuencia: 'mensual',
  diaPago: 1,
  activo: true,
});

const PersonalExpenseForm: React.FC<PersonalExpenseFormProps> = ({ personalDataId, expense, onSave, onCancel }) => {
  const [form, setForm] = useState<Omit<PersonalExpense, 'createdAt' | 'updatedAt'>>(expense ? { ...expense } : { ...defaultExpense(personalDataId) });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mode, setMode] = useState<'plantillas' | 'manual'>(expense ? 'manual' : 'plantillas');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    initDB().then((db) => db.getAll('accounts')).then((all) => {
      setAccounts(all.filter((a) => a.activa && a.status !== 'DELETED'));
    });
  }, []);

  const canSubmit = useMemo(() => {
    if (mode === 'plantillas') return Boolean(selectedTemplate);
    return form.concepto.trim().length > 0 && form.importe > 0;
  }, [form.concepto, form.importe, mode, selectedTemplate]);

  const chipClass = (active: boolean) => `px-3 py-2 rounded-xl border text-sm flex items-center gap-2 ${active ? 'border-atlas-blue text-atlas-blue bg-cyan-50' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`;

  const saveTemplate = () => {
    const template = TEMPLATE_EXPENSES.find((t) => t.concepto === selectedTemplate);
    if (!template) return;
    onSave({
      ...form,
      concepto: template.concepto,
      categoria: template.categoria,
      importe: template.importe,
      frecuencia: 'mensual',
      diaPago: form.diaPago ?? 1,
      activo: true,
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-6 py-5 border-b border-gray-200">
        <h2 className="text-4xl font-semibold text-[#1E2B42]">Añadir gasto recurrente</h2>
        <div className="mt-4 bg-gray-100 rounded-xl p-1 grid grid-cols-2 gap-1">
          <button type="button" onClick={() => setMode('plantillas')} className={`rounded-lg py-2 font-medium ${mode === 'plantillas' ? 'bg-white text-atlas-blue shadow-sm' : 'text-gray-500'}`}>Plantillas</button>
          <button type="button" onClick={() => setMode('manual')} className={`rounded-lg py-2 font-medium ${mode === 'manual' ? 'bg-white text-atlas-blue shadow-sm' : 'text-gray-500'}`}>Manual</button>
        </div>
      </div>

      {mode === 'plantillas' ? (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-gray-500 mb-4">Selecciona un gasto habitual y ajusta el importe a tu situación.</p>
          <div className="space-y-3">
            {TEMPLATE_EXPENSES.map((t) => (
              <button
                key={t.concepto}
                type="button"
                onClick={() => {
                  setSelectedTemplate(t.concepto);
                  setForm((prev) => ({ ...prev, concepto: t.concepto, categoria: t.categoria, importe: t.importe }));
                }}
                className={`w-full border rounded-2xl px-4 py-4 text-left flex items-center justify-between ${selectedTemplate === t.concepto ? 'border-atlas-blue bg-blue-50/40' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div>
                  <div className="text-xl font-semibold text-[#1E2B42]">{t.concepto}</div>
                  <div className="text-sm text-gray-500">{CATEGORIES.find((c) => c.value === t.categoria)?.label} · Mensual</div>
                </div>
                <div className="text-xl font-semibold text-[#1E2B42]">{t.importe.toFixed(2)} €</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form id="manual-expense-form" onSubmit={handleManualSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-lg font-medium text-[#1E2B42] block mb-2">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ value, label, Icon }) => (
                <button type="button" key={value} onClick={() => setForm((prev) => ({ ...prev, categoria: value }))} className={chipClass(form.categoria === value)}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-lg font-medium text-[#1E2B42] block mb-2">Concepto</label>
            <input value={form.concepto} onChange={(e) => setForm((prev) => ({ ...prev, concepto: e.target.value }))} placeholder="ej. Seguro hogar" className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-700" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-lg font-medium text-[#1E2B42] block mb-2">Importe</label>
              <input type="number" min={0} step="0.01" value={form.importe} onChange={(e) => setForm((prev) => ({ ...prev, importe: parseFloat(e.target.value) || 0 }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5" />
            </div>
            <div>
              <label className="text-lg font-medium text-[#1E2B42] block mb-2">Día de cobro</label>
              <select value={form.diaPago ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, diaPago: Number(e.target.value) || undefined }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5">
                <option value={0}>Sin especificar</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-lg font-medium text-[#1E2B42] block mb-2">Cuenta / Tarjeta</label>
            <select className="w-full rounded-xl border border-gray-300 px-4 py-2.5" value={form.accountId ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value ? Number(e.target.value) : undefined }))}>
              <option value="">Sin vincular</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.alias ?? acc.ibanMasked ?? acc.iban}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-lg font-medium text-[#1E2B42] block mb-2">Frecuencia</label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map((f) => (
                <button key={f.value} type="button" onClick={() => setForm((prev) => ({ ...prev, frecuencia: f.value }))} className={`rounded-xl py-2 border ${form.frecuencia === f.value ? 'border-atlas-blue text-atlas-blue font-semibold' : 'border-gray-300 text-gray-500'}`}>{f.label}</button>
              ))}
            </div>
          </div>

          {(form.frecuencia === 'semestral' || form.frecuencia === 'anual' || form.frecuencia === 'bimestral' || form.frecuencia === 'trimestral') && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <label className="text-base font-medium text-[#1E2B42] block mb-2">Mes de inicio del ciclo</label>
              <select value={form.mesInicio ?? 1} onChange={(e) => setForm((prev) => ({ ...prev, mesInicio: Number(e.target.value) }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5">
                {MONTHS.map((month, idx) => <option key={month} value={idx + 1}>{month}</option>)}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))} /> Gasto activo
          </label>
        </form>
      )}

      <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-gray-500">Cancelar</button>
        <button
          type={mode === 'manual' ? 'submit' : 'button'}
          form={mode === 'manual' ? 'manual-expense-form' : undefined}
          onClick={mode === 'plantillas' ? saveTemplate : undefined}
          disabled={!canSubmit}
          className="flex-1 rounded-xl py-2.5 bg-atlas-blue text-white font-semibold disabled:opacity-40"
        >
          Añadir gasto
        </button>
      </div>
    </div>
  );
};

export default PersonalExpenseForm;
