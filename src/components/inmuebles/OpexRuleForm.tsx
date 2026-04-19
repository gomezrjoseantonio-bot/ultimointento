import React, { useState, useEffect } from 'react';
import { X, Sun, Snowflake, Minus } from 'lucide-react';
import {
  OpexRule,
  OpexCategory,
  OpexFrequency,
  OpexEstacionalidad,
  AsymmetricPayment,
  Account,
  initDB,
} from '../../services/db';
import {
  getOpexCategories,
  SUMINISTRO_SUBTYPES,
  type CategoryDef,
} from '../../services/categoryCatalog';

interface OpexRuleFormProps {
  propertyId: number;
  rule?: OpexRule;
  onSave: (rule: Omit<OpexRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => void;
  onCancel: () => void;
}

// PR5-HOTFIX v2 · las 6 categorías de OPEX vienen del catálogo canónico.
// Las opciones previas "Impuesto", "Gestión", "Otro" genéricas se eliminan;
// IBI y Basuras (ambas del catálogo) se persisten con `categoria: 'impuesto'`
// para no romper la fiscalidad existente, pero con `categoryKey` distinto.
const OPEX_CATEGORY_OPTIONS: CategoryDef[] = getOpexCategories();

/**
 * Mapea un `categoryKey` del catálogo al enum interno `OpexCategory` usado
 * por OpexRule. Mantiene retrocompatibilidad con datos existentes.
 */
function categoryKeyToOpexCategoria(categoryKey: string): OpexCategory {
  switch (categoryKey) {
    case 'comunidad_inmueble':
      return 'comunidad';
    case 'seguro_inmueble':
      return 'seguro';
    case 'suministro_inmueble':
      return 'suministro';
    case 'ibi_inmueble':
    case 'basuras_inmueble':
      return 'impuesto';
    case 'servicio_inmueble':
      return 'servicio';
    default:
      return 'otro';
  }
}

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
  diaCobro: 1,
  activo: true,
});

const OpexRuleForm: React.FC<OpexRuleFormProps> = ({ propertyId, rule, onSave, onCancel }) => {
  const [form, setForm] = useState<Omit<OpexRule, 'createdAt' | 'updatedAt'>>(
    rule ? { ...rule } : { ...defaultRule(propertyId) }
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

  const handleCategoryCardClick = (cat: CategoryDef) => {
    setForm((prev) => ({
      ...prev,
      categoryKey: cat.key,
      categoria: categoryKeyToOpexCategoria(cat.key),
      // Auto-rellenar casilla AEAT si el catálogo la provee y aún no hay una.
      casillaAEAT: prev.casillaAEAT || cat.casillaAEAT,
      // Al cambiar categoría, resetear sub-tipo.
      subtypeKey: cat.hasSubtype ? prev.subtypeKey : undefined,
      // Auto-rellenar concepto si está vacío.
      concepto: prev.concepto?.trim() ? prev.concepto : cat.label,
    }));
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

  const selectedCategory = OPEX_CATEGORY_OPTIONS.find((c) => c.key === form.categoryKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--n-300)]/60">
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

          {/* Categoría · cards del catálogo canónico */}
          <div>
            <label className={labelClass}>Categoría</label>
            <div className="grid grid-cols-3 gap-1.5">
              {OPEX_CATEGORY_OPTIONS.map((cat) => {
                const Icon = cat.icon;
                const isActive = form.categoryKey === cat.key;
                return (
                  <button
                    type="button"
                    key={cat.key}
                    onClick={() => handleCategoryCardClick(cat)}
                    className={`flex flex-col items-center gap-1 px-2 py-2 text-xs rounded-md border transition-colors ${
                      isActive
                        ? 'bg-[color:var(--n-700)] text-white border-[color:var(--n-700)]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-tipo de suministro · solo si categoría = suministro_inmueble */}
          {selectedCategory?.hasSubtype && (
            <div>
              <label className={labelClass}>Tipo de suministro</label>
              <div className="grid grid-cols-4 gap-1.5">
                {SUMINISTRO_SUBTYPES.map((st) => {
                  const Icon = st.icon;
                  const isActive = form.subtypeKey === st.key;
                  return (
                    <button
                      type="button"
                      key={st.key}
                      onClick={() => handleChange('subtypeKey', st.key)}
                      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                        isActive
                          ? 'bg-atlas-blue/10 border-atlas-blue text-atlas-blue'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          {/* Día de cobro */}
          <div>
            <label className={labelClass}>Día de cobro</label>
            <input
              type="number"
              className={inputClass}
              value={form.diaCobro ?? 1}
              min={1}
              max={31}
              onChange={(e) =>
                handleChange('diaCobro', Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))
              }
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
