import React, { useState, useEffect } from 'react';
import { X, Home, ShoppingCart, Car, Smile, Heart, Shield, GraduationCap, MoreHorizontal, Minus, Snowflake, Sun } from 'lucide-react';
import { PersonalExpense, PersonalExpenseCategory, PersonalExpenseFrequency, PersonalExpenseEstacionalidad, AsymmetricPaymentPersonal } from '../../../types/personal';
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
  { value: 'meses_especificos', label: 'Meses específicos' },
];

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const defaultExpense = (personalDataId: number): Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> => ({
  personalDataId,
  concepto: '',
  categoria: 'otros',
  importe: 0,
  frecuencia: 'mensual',
  diaPago: 1,
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

  // Keep asymmetricPayments in sync with mesesCobro
  const mesesCobro = form.mesesCobro;
  const frecuencia = form.frecuencia;
  useEffect(() => {
    if (frecuencia === 'meses_especificos' && mesesCobro) {
      setForm((prev) => {
        const current = prev.asymmetricPayments ?? [];
        const updated: AsymmetricPaymentPersonal[] = mesesCobro.map((mes) => {
          const existing = current.find((p) => p.mes === mes);
          return existing ?? { mes, importe: 0 };
        });
        return { ...prev, asymmetricPayments: updated };
      });
    }
  }, [mesesCobro, frecuencia]);

  const handleChange = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMes = (mes: number) => {
    const current = form.mesesCobro ?? [];
    const next = current.includes(mes)
      ? current.filter((m) => m !== mes)
      : [...current, mes].sort((a, b) => a - b);
    handleChange('mesesCobro', next);
  };

  const handleAsymmetricChange = (mes: number, importe: number) => {
    const current = form.asymmetricPayments ?? [];
    const updated = current.map((p) => (p.mes === mes ? { ...p, importe } : p));
    handleChange('asymmetricPayments', updated);
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
              onChange={(e) => {
                handleChange('frecuencia', e.target.value as PersonalExpenseFrequency);
                handleChange('mesesCobro', undefined);
                handleChange('diaDeLaSemana', undefined);
                handleChange('mesInicio', undefined);
                handleChange('asymmetricPayments', undefined);
              }}
            >
              {FREQUENCY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Semanal: día de la semana */}
          {form.frecuencia === 'semanal' && (
            <div>
              <label className={labelClass}>Día de la semana</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleChange('diaDeLaSemana', idx)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      form.diaDeLaSemana === idx
                        ? 'bg-atlas-blue text-white border-atlas-blue'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-atlas-blue'
                    }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bimestral/Trimestral/Semestral/Anual: mes de inicio */}
          {(['bimestral', 'trimestral', 'semestral', 'anual'] as PersonalExpenseFrequency[]).includes(form.frecuencia) && (
            <div>
              <label className={labelClass}>Mes de inicio</label>
              <select
                className={inputClass}
                value={form.mesInicio ?? ''}
                onChange={(e) =>
                  handleChange('mesInicio', e.target.value ? parseInt(e.target.value) : undefined)
                }
              >
                <option value="">Sin especificar</option>
                {MESES.map((mes, idx) => (
                  <option key={idx} value={idx + 1}>{mes}</option>
                ))}
              </select>
            </div>
          )}

          {/* Día de pago */}
          <div>
            <label className={labelClass}>Día de pago</label>
            <input
              type="number"
              className={inputClass}
              value={form.diaPago ?? 1}
              min={1}
              max={31}
              onChange={(e) =>
                handleChange('diaPago', Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))
              }
            />
          </div>

          {/* Meses específicos: checkboxes */}
          {form.frecuencia === 'meses_especificos' && (
            <div>
              <label className={labelClass}>Meses de pago</label>
              <div className="grid grid-cols-4 gap-2">
                {MESES.map((mes, idx) => {
                  const mesNum = idx + 1;
                  const checked = (form.mesesCobro ?? []).includes(mesNum);
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-atlas-blue/10 border-atlas-blue text-atlas-blue'
                          : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleMes(mesNum)}
                      />
                      {mes.slice(0, 3)}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagos asimétricos */}
          {form.frecuencia === 'meses_especificos' && (form.mesesCobro ?? []).length > 0 && (
            <div>
              <label className={labelClass}>
                Importes por mes{' '}
                <span className="font-normal text-gray-500">(pagos asimétricos)</span>
              </label>
              <div className="space-y-2">
                {(form.asymmetricPayments ?? []).map((p) => (
                  <div key={p.mes} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{MESES[p.mes - 1]}</span>
                    <input
                      type="number"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue"
                      value={p.importe}
                      min={0}
                      step="0.01"
                      onChange={(e) =>
                        handleAsymmetricChange(p.mes, parseFloat(e.target.value) || 0)
                      }
                    />
                    <span className="text-sm text-gray-500">€</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estacionalidad */}
          <div>
            <label className={labelClass}>Estacionalidad</label>
            <div className="flex gap-2">
              {(
                [
                  { value: 'plana', label: 'Plana', Icon: Minus },
                  { value: 'invierno', label: 'Invierno', Icon: Snowflake },
                  { value: 'verano', label: 'Verano', Icon: Sun },
                ] as { value: PersonalExpenseEstacionalidad; label: string; Icon: React.ElementType }[]
              ).map(({ value, label, Icon }) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => handleChange('estacionalidad', value)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md border transition-colors ${
                    (form.estacionalidad ?? 'plana') === value
                      ? 'bg-atlas-blue text-white border-atlas-blue'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-atlas-blue'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
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
                  {acc.alias ?? acc.banco?.name ?? (acc.tipo === 'TARJETA_CREDITO' ? 'Tarjeta de crédito' : `Cuenta …${acc.iban.slice(-4)}`)}
                  {' – '}
                  {acc.tipo === 'TARJETA_CREDITO' ? 'Tarjeta diferida' : (acc.ibanMasked ?? acc.iban)}
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
