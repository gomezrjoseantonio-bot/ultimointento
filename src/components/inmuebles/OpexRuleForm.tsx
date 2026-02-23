import React, { useState, useEffect } from 'react';
import { X, Sun, Snowflake, Minus } from 'lucide-react';
import {
  OpexRule,
  OpexCategory,
  OpexFrequency,
  OpexEstacionalidad,
  AsymmetricPayment,
} from '../../services/db';

interface OpexRuleFormProps {
  propertyId: number;
  rule?: OpexRule;
  onSave: (rule: Omit<OpexRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => void;
  onCancel: () => void;
}

const CATEGORY_LABELS: Record<OpexCategory, string> = {
  impuesto: 'Impuesto',
  suministro: 'Suministro',
  comunidad: 'Comunidad',
  seguro: 'Seguro',
  servicio: 'Servicio',
  gestion: 'Gestión',
  otro: 'Otro',
};

const FREQUENCY_LABELS: Record<OpexFrequency, string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  meses_especificos: 'Meses específicos',
};

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const defaultRule = (propertyId: number): Omit<OpexRule, 'id' | 'createdAt' | 'updatedAt'> => ({
  propertyId,
  categoria: 'otro',
  concepto: '',
  importeEstimado: 0,
  frecuencia: 'mensual',
  activo: true,
});

const OpexRuleForm: React.FC<OpexRuleFormProps> = ({ propertyId, rule, onSave, onCancel }) => {
  const [form, setForm] = useState<Omit<OpexRule, 'createdAt' | 'updatedAt'>>(
    rule ? { ...rule } : { ...defaultRule(propertyId) }
  );

  // Keep asymmetricPayments in sync with mesesCobro
  const mesesCobro = form.mesesCobro;
  const frecuencia = form.frecuencia;
  useEffect(() => {
    if (frecuencia === 'meses_especificos' && mesesCobro) {
      setForm((prev) => {
        const current = prev.asymmetricPayments ?? [];
        const updated: AsymmetricPayment[] = mesesCobro.map((mes) => {
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

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {rule?.id ? 'Editar regla OPEX' : 'Nueva regla OPEX'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Concepto */}
          <div>
            <label className={labelClass}>Concepto</label>
            <input
              type="text"
              className={inputClass}
              value={form.concepto}
              onChange={(e) => handleChange('concepto', e.target.value)}
              placeholder="Ej: IBI, Comunidad, Seguro..."
              required
            />
          </div>

          {/* Categoría */}
          <div>
            <label className={labelClass}>Categoría</label>
            <select
              className={inputClass}
              value={form.categoria}
              onChange={(e) => handleChange('categoria', e.target.value as OpexCategory)}
            >
              {(Object.entries(CATEGORY_LABELS) as [OpexCategory, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Importe */}
          <div>
            <label className={labelClass}>Importe estimado (€ por ciclo)</label>
            <input
              type="number"
              className={inputClass}
              value={form.importeEstimado}
              min={0}
              step="0.01"
              onChange={(e) => handleChange('importeEstimado', parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Frecuencia */}
          <div>
            <label className={labelClass}>Frecuencia</label>
            <select
              className={inputClass}
              value={form.frecuencia}
              onChange={(e) => {
                handleChange('frecuencia', e.target.value as OpexFrequency);
                // Reset frequency-specific fields
                handleChange('mesesCobro', undefined);
                handleChange('diaDeLaSemana', undefined);
                handleChange('mesInicio', undefined);
                handleChange('asymmetricPayments', undefined);
              }}
            >
              {(Object.entries(FREQUENCY_LABELS) as [OpexFrequency, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
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

          {/* Mensual/Bimestral/etc: mes de inicio */}
          {['mensual', 'bimestral', 'trimestral', 'semestral'].includes(form.frecuencia) && (
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

          {/* Meses específicos: checkboxes */}
          {form.frecuencia === 'meses_especificos' && (
            <div>
              <label className={labelClass}>Meses de cobro</label>
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

          {/* Pagos asimétricos (si hay meses específicos seleccionados) */}
          {form.frecuencia === 'meses_especificos' &&
            (form.mesesCobro ?? []).length > 0 && (
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
                        placeholder="0.00 €"
                      />
                      <span className="text-sm text-gray-500">€</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Estacionalidad (solo para suministros) */}
          {form.categoria === 'suministro' && (
            <div>
              <label className={labelClass}>Estacionalidad</label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'plana', label: 'Plana', Icon: Minus },
                    { value: 'invierno', label: 'Invierno', Icon: Snowflake },
                    { value: 'verano', label: 'Verano', Icon: Sun },
                  ] as { value: OpexEstacionalidad; label: string; Icon: React.ElementType }[]
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
          )}

          {/* Cuenta bancaria */}
          <div>
            <label className={labelClass}>
              Cuenta bancaria{' '}
              <span className="font-normal text-gray-500">(ID opcional)</span>
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.accountId ?? ''}
              min={1}
              onChange={(e) =>
                handleChange(
                  'accountId',
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
              placeholder="Sin vincular"
            />
          </div>

          {/* Activo */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activo"
              checked={form.activo}
              onChange={(e) => handleChange('activo', e.target.checked)}
              className="h-4 w-4 text-atlas-blue rounded border-gray-300"
            />
            <label htmlFor="activo" className="text-sm text-gray-700">
              Regla activa
            </label>
          </div>

          {/* Actions */}
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

export default OpexRuleForm;
