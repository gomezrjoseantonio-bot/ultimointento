import React, { useState, useEffect, useCallback } from 'react';
import { otrosIngresosService } from '../../../services/otrosIngresosService';
import { personalDataService } from '../../../services/personalDataService';
import { OtrosIngresos, PersonalData } from '../../../types/personal';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIAS: { value: OtrosIngresos['tipo']; label: string }[] = [
  { value: 'prestacion-desempleo', label: 'Prestación por Desempleo' },
  { value: 'subsidio-ayuda', label: 'Subsidio / Ayuda Estatal' },
  { value: 'pension-alimenticia', label: 'Pensión Alimenticia / Compensatoria' },
  { value: 'devolucion-deuda', label: 'Devolución / Cobro de Deuda a favor' },
  { value: 'otro', label: 'Otro' },
];

const EMPTY_FORM = {
  nombre: '',
  titularidad: 'yo' as OtrosIngresos['titularidad'],
  tipo: 'prestacion-desempleo' as OtrosIngresos['tipo'],
  importe: '',
  frecuencia: 'mensual' as OtrosIngresos['frecuencia'],
  fechaFin: '',
};

const OtrosIngresosManager: React.FC = () => {
  const [ingresos, setIngresos] = useState<OtrosIngresos[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);

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

  const formatFechaFin = (fechaFin: string): string => {
    // fechaFin is stored as "YYYY-MM"
    const [year, month] = fechaFin.split('-');
    if (!year || !month) return fechaFin;
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
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
      const payload = {
        personalDataId: personalData.id,
        nombre: form.nombre,
        titularidad: form.titularidad,
        tipo: form.tipo,
        importe: parseFloat(form.importe),
        frecuencia: form.frecuencia,
        cuentaCobro: 0,
        reglasDia: { tipo: 'fijo' as const, dia: 1 },
        activo: true,
        ...(form.fechaFin ? { fechaFin: form.fechaFin } : { fechaFin: undefined }),
      };
      if (editingId !== null) {
        await otrosIngresosService.updateIngreso(editingId, payload);
        toast.success('Ingreso actualizado correctamente');
      } else {
        await otrosIngresosService.saveIngreso(payload);
        toast.success('Ingreso añadido correctamente');
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Error saving ingreso:', error);
      toast.error('Error al guardar el ingreso');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ingreso: OtrosIngresos) => {
    setForm({
      nombre: ingreso.nombre,
      titularidad: ingreso.titularidad,
      tipo: ingreso.tipo,
      importe: String(ingreso.importe),
      frecuencia: ingreso.frecuencia,
      fechaFin: ingreso.fechaFin ?? '',
    });
    setEditingId(ingreso.id ?? null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
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
          onClick={() => { setShowForm(!showForm); if (showForm) { setEditingId(null); setForm(EMPTY_FORM); } }}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Ingreso
        </button>
      </div>

      {/* Form (create / edit) */}
      {showForm && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">
              {editingId !== null ? 'Editar Ingreso' : 'Nuevo Ingreso'}
            </h4>
            <button onClick={handleCloseForm} className="text-gray-400 hover:text-gray-600">
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
                <option value="ambos">Ambos</option>
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
                onClick={handleCloseForm}
                className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingId !== null ? 'Actualizar Ingreso' : 'Guardar Ingreso'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary */}
      {activeIngresos.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 font-medium">Ingresos Mensuales</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalMensual)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Ingresos Anuales</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAnual)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Income Sources List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Fuentes de Ingresos</h4>

        {ingresos.length === 0 ? (
          <div className="text-center py-8">
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay otros ingresos configurados</h3>
            <p className="mt-1 text-sm text-gray-500">
              Añade prestaciones por desempleo, subsidios, indemnizaciones u otros ingresos personales.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded"
              >
                <Plus className="w-4 h-4 mr-2" />
                Añadir Primer Ingreso
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {ingresos.map((ingreso) => (
              <div key={ingreso.id} className="flex items-center justify-between py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ingreso.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getTipoLabel(ingreso.tipo)} · {getTitularLabel(ingreso.titularidad)}
                    {ingreso.fechaFin && ` · Hasta ${formatFechaFin(ingreso.fechaFin)}`}
                  </p>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(ingreso.importe)}</p>
                    <p className="text-xs text-gray-500">{getFrecuenciaLabel(ingreso.frecuencia)}</p>
                  </div>
                  <button
                    onClick={() => handleEdit(ingreso)}
                    className="p-2 text-gray-400 hover:text-atlas-blue"
                    title="Editar ingreso"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => ingreso.id !== undefined && handleDelete(ingreso.id)}
                    className="p-2 text-gray-400 hover:text-error-600"
                    title="Eliminar ingreso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OtrosIngresosManager;