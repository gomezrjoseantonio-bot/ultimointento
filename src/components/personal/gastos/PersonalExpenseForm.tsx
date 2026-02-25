import React, { useState, useEffect } from 'react';
import { X, Home, ShoppingCart, Car, Smile, Heart, Shield, GraduationCap, MoreHorizontal } from 'lucide-react';
import { PersonalExpense, PersonalExpenseCategory, PersonalExpenseFrequency } from '../../../types/personal';
import { Account, initDB } from '../../../services/db';

interface PersonalExpenseFormProps {
  personalDataId: number;
  expense?: PersonalExpense;
  onSave: (expense: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => void;
  onCancel: () => void;
}

const CATEGORY_OPTIONS: { value: PersonalExpenseCategory; label: string; Icon: React.ElementType }[] = [
  { value: 'vivienda', label: 'Vivienda', Icon: Home },
  { value: 'alimentacion', label: 'Alimentación', Icon: ShoppingCart },
  { value: 'transporte', label: 'Transporte', Icon: Car },
  { value: 'ocio', label: 'Ocio', Icon: Smile },
  { value: 'salud', label: 'Salud', Icon: Heart },
  { value: 'seguros', label: 'Seguros', Icon: Shield },
  { value: 'educacion', label: 'Educación', Icon: GraduationCap },
  { value: 'otros', label: 'Otros', Icon: MoreHorizontal },
];

const FREQUENCY_OPTIONS: { value: PersonalExpenseFrequency; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

const defaultExpense = (personalDataId: number): Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> => ({
  personalDataId,
  concepto: '',
  categoria: 'otros',
  importe: 0,
  frecuencia: 'mensual',
  activo: true,
});

const PersonalExpenseForm: React.FC<PersonalExpenseFormProps> = ({ personalDataId, expense, onSave, onCancel }) => {
  const [form, setForm] = useState<Omit<PersonalExpense, 'createdAt' | 'updatedAt'>>(
    expense ? { ...expense } : { ...defaultExpense(personalDataId) }
  );
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    initDB().then((db) => {
      db.getAll('accounts').then((all) => {
        setAccounts(all.filter((a) => a.activa && a.status !== 'DELETED'));
      });
    });
  }, []);

  const handleChange = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {expense?.id ? 'Editar gasto' : 'Nuevo gasto'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Categoría */}
          <div>
            <label className={labelClass}>Categoría</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORY_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => handleChange('categoria', value)}
                  className={`flex flex-col items-center gap-1 px-2 py-2 text-xs rounded-md border transition-colors ${
                    form.categoria === value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Concepto */}
          <div>
            <label className={labelClass}>Concepto</label>
            <input
              type="text"
              className={inputClass}
              value={form.concepto}
              onChange={(e) => handleChange('concepto', e.target.value)}
              placeholder="Ej: Alquiler, Supermercado, Gimnasio..."
              required
            />
          </div>

          {/* Importe */}
          <div>
            <label className={labelClass}>Importe (€ por ciclo)</label>
            <input
              type="number"
              className={inputClass}
              value={form.importe}
              min={0}
              step="0.01"
              onChange={(e) => handleChange('importe', parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Frecuencia */}
          <div>
            <label className={labelClass}>Frecuencia</label>
            <select
              className={inputClass}
              value={form.frecuencia}
              onChange={(e) => handleChange('frecuencia', e.target.value as PersonalExpenseFrequency)}
            >
              {FREQUENCY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Cuenta bancaria */}
          <div>
            <label className={labelClass}>Cuenta bancaria</label>
            <select
              className={inputClass}
              value={form.accountId ?? ''}
              onChange={(e) =>
                handleChange('accountId', e.target.value ? parseInt(e.target.value) : undefined)
              }
            >
              <option value="">Sin vincular</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.alias ?? acc.banco?.name ?? `Cuenta …${acc.iban.slice(-4)}`} – {acc.ibanMasked ?? acc.iban}
                </option>
              ))}
            </select>
          </div>

          {/* Activo */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activo"
              checked={form.activo}
              onChange={(e) => handleChange('activo', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="activo" className="text-sm text-gray-700">
              Gasto activo
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-atlas-blue rounded-md hover:bg-atlas-blue/90"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonalExpenseForm;
