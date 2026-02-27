import React, { useState, useEffect, useCallback } from 'react';
import { otrosIngresosService } from '../../../services/otrosIngresosService';
import { personalDataService } from '../../../services/personalDataService';
import { OtrosIngresos, PersonalData } from '../../../types/personal';
import { Plus, Trash2, DollarSign, TrendingUp, Calendar, User, Heart, X } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIAS: { value: OtrosIngresos['tipo']; label: string }[] = [
  { value: 'prestacion-desempleo', label: 'Prestación por Desempleo' },
  { value: 'subsidio-ayuda', label: 'Subsidio / Ayuda Estatal' },
  { value: 'pension-alimenticia', label: 'Pensión Alimenticia / Compensatoria' },
  { value: 'devolucion-deuda', label: 'Devolución / Cobro de Deuda a favor' },
  { value: 'otro', label: 'Otro' },
];

const OtrosIngresosManager: React.FC = () => {
  const [ingresos, setIngresos] = useState<OtrosIngresos[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    titularidad: 'yo' as 'yo' | 'pareja',
    tipo: 'prestacion-desempleo' as OtrosIngresos['tipo'],
    importe: '',
    frecuencia: 'mensual' as OtrosIngresos['frecuencia'],
    fechaFin: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pData = await personalDataService.getPersonalData();
      setPersonalData(pData);
      if (pData?.id) {
        const ingresosData = await otrosIngresosService.getOtrosIngresos(pData.id);
        setIngresos(ingresosData);
      }
    } catch (error) {
      console.error('Error loading otros ingresos:', error);
      toast.error('Error al cargar otros ingresos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getTipoLabel = (tipo: OtrosIngresos['tipo']) => {
    return CATEGORIAS.find(c => c.value === tipo)?.label ?? tipo;
  };

  const getFrecuenciaLabel = (frecuencia: OtrosIngresos['frecuencia']) => {
    switch (frecuencia) {
      case 'mensual': return 'Mensual';
      case 'trimestral': return 'Trimestral';
      case 'semestral': return 'Semestral';
      case 'anual': return 'Anual';
      case 'unico': return 'Único';
      default: return frecuencia;
    }
  };

  const getTitularLabel = (titularidad: OtrosIngresos['titularidad']) => {
    if (titularidad === 'yo') return personalData?.nombre || 'Yo';
    if (titularidad === 'pareja') return personalData?.spouseName || 'Pareja';
    return 'Ambos';
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalData?.id) {
      toast.error('No se encontraron datos personales');
      return;
    }
    setSaving(true);
    try {
      await otrosIngresosService.saveIngreso({
        personalDataId: personalData.id,
        nombre: form.nombre,
        titularidad: form.titularidad,
        tipo: form.tipo,
        importe: parseFloat(form.importe),
        frecuencia: form.frecuencia,
        cuentaCobro: 0,
        reglasDia: { tipo: 'fijo', dia: 1 },
        activo: true,
        ...(form.fechaFin ? { fechaFin: form.fechaFin } : {}),
      });
      toast.success('Ingreso añadido correctamente');
      setForm({ nombre: '', titularidad: 'yo', tipo: 'prestacion-desempleo', importe: '', frecuencia: 'mensual', fechaFin: '' });
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Error saving ingreso:', error);
      toast.error('Error al guardar el ingreso');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await otrosIngresosService.deleteIngreso(id);
      toast.success('Ingreso eliminado');
      loadData();
    } catch (error) {
      console.error('Error deleting ingreso:', error);
      toast.error('Error al eliminar el ingreso');
    }
  };

  const activeIngresos = ingresos.filter(i => i.activo);
  const totalMensual = otrosIngresosService.calculateMonthlyIncome(activeIngresos);
  const totalAnual = otrosIngresosService.calculateAnnualIncome(activeIngresos);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
        <span className="ml-2 text-neutral-600">Cargando otros ingresos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Otros Ingresos</h3>
          <p className="text-gray-500">
            Gestiona prestaciones por desempleo, subsidios, indemnizaciones, cobro de deudas u otros ingresos personales.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Ingreso
        </button>
      </div>

      {/* New Income Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">Nuevo Ingreso</h4>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleFormChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Ej: Prestación SEPE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titular</label>
              <select
                name="titularidad"
                value={form.titularidad}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="yo">{personalData?.nombre || 'Yo'}</option>
                <option value="pareja">{personalData?.spouseName || 'Pareja'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                name="tipo"
                value={form.tipo}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {CATEGORIAS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importe (€)</label>
              <input
                type="number"
                name="importe"
                value={form.importe}
                onChange={handleFormChange}
                required
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
              <select
                name="frecuencia"
                value={form.frecuencia}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
                <option value="unico">Único</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin (opcional)</label>
              <input
                type="month"
                name="fechaFin"
                value={form.fechaFin}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Ingreso'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary Cards */}
      {activeIngresos.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h4 className="text-lg font-semibold text-emerald-900">
                Resumen de Otros Ingresos
              </h4>
            </div>
            <div className="flex items-center space-x-2 text-sm text-emerald-700">
              <TrendingUp className="w-4 h-4" />
              <span>{activeIngresos.length} fuentes activas</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 border border-emerald-100">
              <p className="text-sm text-emerald-600 font-medium">Ingresos Mensuales</p>
              <p className="text-xl font-bold text-emerald-900">
                {formatCurrency(totalMensual)}
              </p>
            </div>
            <div className="bg-white p-4 border border-emerald-100">
              <p className="text-sm text-emerald-600 font-medium">Ingresos Anuales</p>
              <p className="text-xl font-bold text-emerald-900">
                {formatCurrency(totalAnual)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Income Sources List */}
      <div className="bg-white border border-gray-200 p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Fuentes de Ingresos</h4>

        {ingresos.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay otros ingresos configurados</h3>
            <p className="mt-1 text-sm text-gray-500">
              Añade prestaciones por desempleo, subsidios, indemnizaciones u otros ingresos personales.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Añadir Primer Ingreso
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {ingresos.map((ingreso) => (
              <div key={ingreso.id} className="border p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="font-medium text-gray-900">{ingreso.nombre}</h5>
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                        {getTipoLabel(ingreso.tipo)}
                      </span>
                      <div className={`flex items-center space-x-1 ${ingreso.titularidad === 'yo' ? 'text-atlas-blue' : 'text-error-600'}`}>
                        {ingreso.titularidad === 'yo' ? <User className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                        <span className="text-xs font-medium">{getTitularLabel(ingreso.titularidad)}</span>
                      </div>
                      {!ingreso.activo && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-error-800">
                          Inactivo
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Titular</p>
                        <p className="font-medium">{getTitularLabel(ingreso.titularidad)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Categoría</p>
                        <p className="font-medium">{getTipoLabel(ingreso.tipo)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Importe</p>
                        <p className="font-medium">{formatCurrency(ingreso.importe)} / {getFrecuenciaLabel(ingreso.frecuencia)}</p>
                      </div>
                      {ingreso.fechaFin && (
                        <div>
                          <p className="text-gray-600">Fecha Fin</p>
                          <p className="font-medium flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{ingreso.fechaFin}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => ingreso.id !== undefined && handleDelete(ingreso.id)}
                      className="p-2 text-gray-400 hover:text-error-600"
                      title="Eliminar ingreso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Info */}
      <div className="btn-secondary-horizon atlas-atlas-atlas-atlas-atlas-atlas-btn-primary ">
        <p className="text-sm text-primary-700">
          <strong>Integración automática:</strong> Los ingresos recurrentes configurados se integrarán automáticamente
          con el módulo de Tesorería para el seguimiento de flujos de caja y con Proyecciones para la planificación financiera.
          La información fiscal se marcará automáticamente para facilitar la declaración de impuestos.
        </p>
      </div>
    </div>
  );
};

export default OtrosIngresosManager;