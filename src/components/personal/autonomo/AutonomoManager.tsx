import React, { useState, useEffect, useCallback } from 'react';
import { autonomoService } from '../../../services/autonomoService';
import { personalDataService } from '../../../services/personalDataService';
import { Autonomo, FuenteIngreso, GastoRecurrenteActividad } from '../../../types/personal';
import AutonomoForm from './AutonomoForm';
import { Plus, Edit2, Trash2, Euro, TrendingUp, TrendingDown, Repeat, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';

const MESES_NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TODOS_LOS_MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface MonthSelectorProps {
  selected: number[];
  onChange: (meses: number[]) => void;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({ selected, onChange }) => {
  const toggleMes = (mes: number) => {
    if (selected.includes(mes)) {
      onChange(selected.filter(m => m !== mes));
    } else {
      onChange([...selected, mes].sort((a, b) => a - b));
    }
  };
  const allSelected = selected.length === 12;
  return (
    <div>
      <button
        type="button"
        onClick={() => onChange(allSelected ? [] : TODOS_LOS_MESES)}
        className={`text-xs px-2 py-1 border mb-2 ${allSelected ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-neutral-600 border-neutral-300'}`}
      >
        {allSelected ? 'Quitar todos' : 'Todos los meses'}
      </button>
      <div className="grid grid-cols-6 gap-1">
        {MESES_NOMBRES.map((nombre, i) => {
          const mes = i + 1;
          const active = selected.includes(mes);
          return (
            <button
              key={mes}
              type="button"
              onClick={() => toggleMes(mes)}
              className={`text-xs py-1 border rounded ${active ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'}`}
            >
              {nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AutonomoManager: React.FC = () => {
  const [autonomos, setAutonomos] = useState<Autonomo[]>([]);
  const [activoAutonomo, setActivoAutonomo] = useState<Autonomo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAutonomo, setEditingAutonomo] = useState<Autonomo | null>(null);

  // Inline form: fuente de ingreso
  const [showFuenteForm, setShowFuenteForm] = useState(false);
  const [fuenteFormData, setFuenteFormData] = useState({ nombre: '', importeEstimado: '', meses: TODOS_LOS_MESES as number[] });

  // Inline form: gasto recurrente actividad
  const [showGastoRecurrenteForm, setShowGastoRecurrenteForm] = useState(false);
  const [gastoRecurrenteFormData, setGastoRecurrenteFormData] = useState({
    descripcion: '',
    importe: '',
    categoria: 'asesoria',
    meses: TODOS_LOS_MESES as number[]
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        const autonomosData = await autonomoService.getAutonomos(personalData.id);
        setAutonomos(autonomosData);
        const activo = autonomosData.find(a => a.activo);
        setActivoAutonomo(activo || null);
      }
    } catch (error) {
      console.error('Error loading autonomos:', error);
      toast.error('Error al cargar los datos de autónomo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateAutonomo = () => { setEditingAutonomo(null); setShowForm(true); };
  const handleEditAutonomo = (autonomo: Autonomo) => { setEditingAutonomo(autonomo); setShowForm(true); };

  const handleDeleteAutonomo = async (id: number) => {
    const confirmed = await confirmDelete('esta configuración de autónomo');
    if (!confirmed) return;
    try {
      await autonomoService.deleteAutonomo(id);
      toast.success('Configuración de autónomo eliminada correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar la configuración');
    }
  };

  const handleActivateAutonomo = async (autonomo: Autonomo) => {
    try {
      await autonomoService.updateAutonomo(autonomo.id!, { activo: true });
      toast.success('Configuración activada correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al activar la configuración');
    }
  };

  const handleAddFuenteIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activoAutonomo) return;
    const importe = parseFloat(fuenteFormData.importeEstimado);
    if (!fuenteFormData.nombre || isNaN(importe) || importe <= 0) {
      toast.error('Completa todos los campos del concepto de ingreso');
      return;
    }
    if (fuenteFormData.meses.length === 0) {
      toast.error('Selecciona al menos un mes de impacto');
      return;
    }
    try {
      const fuente: Omit<FuenteIngreso, 'id'> = {
        nombre: fuenteFormData.nombre,
        importeEstimado: importe,
        meses: fuenteFormData.meses
      };
      await autonomoService.addFuenteIngreso(activoAutonomo.id!, fuente);
      toast.success('Concepto de ingreso añadido');
      setFuenteFormData({ nombre: '', importeEstimado: '', meses: TODOS_LOS_MESES });
      setShowFuenteForm(false);
      loadData();
    } catch (error) {
      toast.error('Error al añadir concepto de ingreso');
    }
  };

  const handleRemoveFuenteIngreso = async (fuenteId: string) => {
    if (!activoAutonomo) return;
    const confirmed = await confirmDelete('este concepto de ingreso');
    if (!confirmed) return;
    try {
      await autonomoService.removeFuenteIngreso(activoAutonomo.id!, fuenteId);
      toast.success('Concepto de ingreso eliminado');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar concepto de ingreso');
    }
  };

  const handleAddGastoRecurrente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activoAutonomo) return;
    const importe = parseFloat(gastoRecurrenteFormData.importe);
    if (!gastoRecurrenteFormData.descripcion || isNaN(importe) || importe <= 0) {
      toast.error('Completa todos los campos del concepto de gasto');
      return;
    }
    if (gastoRecurrenteFormData.meses.length === 0) {
      toast.error('Selecciona al menos un mes de impacto');
      return;
    }
    try {
      const gasto: Omit<GastoRecurrenteActividad, 'id'> = {
        descripcion: gastoRecurrenteFormData.descripcion,
        importe,
        categoria: gastoRecurrenteFormData.categoria,
        meses: gastoRecurrenteFormData.meses
      };
      await autonomoService.addGastoRecurrenteActividad(activoAutonomo.id!, gasto);
      toast.success('Concepto de gasto añadido');
      setGastoRecurrenteFormData({ descripcion: '', importe: '', categoria: 'asesoria', meses: TODOS_LOS_MESES });
      setShowGastoRecurrenteForm(false);
      loadData();
    } catch (error) {
      toast.error('Error al añadir concepto de gasto');
    }
  };

  const handleRemoveGastoRecurrente = async (gastoId: string) => {
    if (!activoAutonomo) return;
    const confirmed = await confirmDelete('este concepto de gasto');
    if (!confirmed) return;
    try {
      await autonomoService.removeGastoRecurrenteActividad(activoAutonomo.id!, gastoId);
      toast.success('Concepto de gasto eliminado');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar concepto de gasto');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

  const renderMesesBadges = (meses: number[]) => {
    if (meses.length === 12) return <span className="text-xs text-neutral-500">Todos los meses</span>;
    return (
      <span className="text-xs text-neutral-500">
        {meses.map(m => MESES_NOMBRES[m - 1]).join(', ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent rounded-full"></div>
        <span className="ml-2 text-neutral-600">Cargando datos de autónomo...</span>
      </div>
    );
  }

  const estimated = activoAutonomo ? autonomoService.calculateEstimatedAnnual(activoAutonomo) : null;
  const monthlyDist = activoAutonomo ? autonomoService.getMonthlyDistribution(activoAutonomo) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Gestión de Autónomos</h3>
          <p className="text-sm text-gray-500">Proyecta ingresos y gastos de tu actividad autónoma con temporalidad mensual</p>
        </div>
        <button
          onClick={handleCreateAutonomo}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Configuración
        </button>
      </div>

      {/* Annual Summary */}
      {activoAutonomo && estimated && (
        <div className="bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-900 flex items-center">
              <Euro className="w-5 h-5 mr-2 text-gray-500" />
              {activoAutonomo.nombre}
              {activoAutonomo.titular && (
                <span className="ml-2 text-sm font-normal text-gray-500">— {activoAutonomo.titular}</span>
              )}
            </h4>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              {activoAutonomo.irpfRetencionPorcentaje !== undefined && (
                <span className="px-2 py-1 bg-gray-100 rounded">IRPF {activoAutonomo.irpfRetencionPorcentaje}%</span>
              )}
              {activoAutonomo.ivaMedioPorcentaje !== undefined && (
                <span className="px-2 py-1 bg-gray-100 rounded">IVA {activoAutonomo.ivaMedioPorcentaje}%</span>
              )}
              <span className="px-2 py-1 bg-gray-100 rounded">SS {formatCurrency(activoAutonomo.cuotaAutonomos)}/mes</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Ingresos Previstos Anuales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(estimated.facturacionBruta)}</p>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Gastos Previstos Anuales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(estimated.totalGastos)}</p>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Rendimiento Neto Estimado</p>
              <p className={`text-2xl font-bold ${estimated.rendimientoNeto >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(estimated.rendimientoNeto)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Monthly distribution bar */}
      {activoAutonomo && monthlyDist && (
        <div className="bg-white border border-gray-200 shadow-sm p-6">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center mb-4">
            <BarChart2 className="w-4 h-4 mr-2 text-gray-500" />
            Distribución Mensual Prevista
          </h4>
          <div className="grid grid-cols-12 gap-1 text-center">
            {(() => {
              const maxIngresos = Math.max(...monthlyDist.map(d => d.ingresos)) || 1;
              const maxGastos = Math.max(...monthlyDist.map(d => d.gastos)) || 1;
              return monthlyDist.map(({ mes, ingresos, gastos, neto }) => (
                <div key={mes} className="flex flex-col items-center">
                  <span className="text-xs text-gray-400 mb-1">{MESES_NOMBRES[mes - 1]}</span>
                  <div className="w-full space-y-0.5">
                    {ingresos > 0 && (
                      <div
                        className="w-full bg-gray-700 rounded-sm"
                        style={{ height: `${Math.max(4, Math.round(ingresos / maxIngresos * 40))}px` }}
                        title={`Ingresos: ${formatCurrency(ingresos)}`}
                      />
                    )}
                    {gastos > 0 && (
                      <div
                        className="w-full bg-gray-300 rounded-sm"
                        style={{ height: `${Math.max(4, Math.round(gastos / maxGastos * 20))}px` }}
                        title={`Gastos: ${formatCurrency(gastos)}`}
                      />
                    )}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${neto >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {neto >= 0 ? '+' : ''}{Math.round(neto / 1000)}k
                  </span>
                </div>
              ));
            })()}
          </div>
          <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center"><span className="inline-block w-3 h-3 bg-gray-700 rounded-sm mr-1" />Ingresos</span>
            <span className="flex items-center"><span className="inline-block w-3 h-3 bg-gray-300 rounded-sm mr-1" />Gastos</span>
          </div>
        </div>
      )}

      {/* Conceptos de Ingreso */}
      {activoAutonomo && (
        <div className="bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-gray-500" />
              Conceptos de Ingreso Previstos
            </h4>
            <button
              onClick={() => setShowFuenteForm(!showFuenteForm)}
              className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir concepto
            </button>
          </div>

          {showFuenteForm && (
            <form onSubmit={handleAddFuenteIngreso} className="mb-4 p-4 border border-gray-200 bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Concepto / Descripción *</label>
                  <input
                    type="text"
                    value={fuenteFormData.nombre}
                    onChange={(e) => setFuenteFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    placeholder="Ej: Facturación Cliente A"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Importe por Ocurrencia (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fuenteFormData.importeEstimado}
                    onChange={(e) => setFuenteFormData(prev => ({ ...prev, importeEstimado: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    placeholder="5000.00"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-2">Meses de Impacto *</label>
                <MonthSelector
                  selected={fuenteFormData.meses}
                  onChange={(meses) => setFuenteFormData(prev => ({ ...prev, meses }))}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowFuenteForm(false)} className="px-3 py-1.5 text-sm text-neutral-700 border border-neutral-300">Cancelar</button>
                <button type="submit" className="px-3 py-1.5 text-sm bg-brand-navy text-white">Guardar</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {(activoAutonomo.fuentesIngreso || []).map((fuente) => {
              const meses = fuente.meses?.length ? fuente.meses : TODOS_LOS_MESES;
              const anual = fuente.importeEstimado * meses.length;
              return (
                <div key={fuente.id} className="flex items-center justify-between p-3 border border-gray-200">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{fuente.nombre}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-sm text-gray-600">{formatCurrency(fuente.importeEstimado)}/vez</span>
                      <span className="text-xs text-gray-400">·</span>
                      {renderMesesBadges(meses)}
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs font-medium text-gray-700">Total anual: {formatCurrency(anual)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveFuenteIngreso(fuente.id!)} className="p-1 text-gray-400 hover:text-red-600 ml-3 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {(activoAutonomo.fuentesIngreso || []).length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">No hay conceptos de ingreso registrados</p>
            )}
          </div>
        </div>
      )}

      {/* Conceptos de Gasto */}
      {activoAutonomo && (
        <div className="bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center">
              <TrendingDown className="w-4 h-4 mr-2 text-gray-500" />
              Conceptos de Gasto de la Actividad
            </h4>
            <button
              onClick={() => setShowGastoRecurrenteForm(!showGastoRecurrenteForm)}
              className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir concepto
            </button>
          </div>

          {/* Fixed: Cuota Autónomos */}
          <div className="flex items-center justify-between p-3 border border-gray-200 mb-2 bg-gray-50">
            <div>
              <p className="font-medium text-gray-900 text-sm flex items-center">
                <Repeat className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                Cuota de Autónomos (SS)
              </p>
              <span className="text-xs text-gray-500">Todos los meses</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">
              {formatCurrency(activoAutonomo.cuotaAutonomos)}/mes · {formatCurrency(activoAutonomo.cuotaAutonomos * 12)}/año
            </p>
          </div>

          {showGastoRecurrenteForm && (
            <form onSubmit={handleAddGastoRecurrente} className="mb-4 p-4 border border-gray-200 bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Descripción *</label>
                  <input
                    type="text"
                    value={gastoRecurrenteFormData.descripcion}
                    onChange={(e) => setGastoRecurrenteFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    placeholder="Ej: Licencia Software"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Importe por Ocurrencia (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gastoRecurrenteFormData.importe}
                    onChange={(e) => setGastoRecurrenteFormData(prev => ({ ...prev, importe: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    placeholder="300.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Categoría</label>
                  <select
                    value={gastoRecurrenteFormData.categoria}
                    onChange={(e) => setGastoRecurrenteFormData(prev => ({ ...prev, categoria: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  >
                    <option value="asesoria">Gestoría / Asesoría</option>
                    <option value="seguros">Seguros RC</option>
                    <option value="software">Software / Licencias</option>
                    <option value="telefono-internet">Teléfono e Internet</option>
                    <option value="alquiler">Alquiler de local</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-2">Meses de Impacto *</label>
                <MonthSelector
                  selected={gastoRecurrenteFormData.meses}
                  onChange={(meses) => setGastoRecurrenteFormData(prev => ({ ...prev, meses }))}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowGastoRecurrenteForm(false)} className="px-3 py-1.5 text-sm text-neutral-700 border border-neutral-300">Cancelar</button>
                <button type="submit" className="px-3 py-1.5 text-sm bg-brand-navy text-white">Guardar</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {(activoAutonomo.gastosRecurrentesActividad || []).map((gasto) => {
              const meses = gasto.meses?.length ? gasto.meses : TODOS_LOS_MESES;
              const anual = gasto.importe * meses.length;
              return (
                <div key={gasto.id} className="flex items-center justify-between p-3 border border-gray-200">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{gasto.descripcion}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-sm text-gray-600">{formatCurrency(gasto.importe)}/vez</span>
                      <span className="text-xs text-gray-400">·</span>
                      {renderMesesBadges(meses)}
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs font-medium text-gray-700">Total anual: {formatCurrency(anual)}</span>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveGastoRecurrente(gasto.id!)} className="p-1 text-gray-400 hover:text-red-600 ml-3 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {(activoAutonomo.gastosRecurrentesActividad || []).length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">No hay otros conceptos de gasto registrados</p>
            )}
          </div>
        </div>
      )}

      {/* All Configurations List */}
      <div className="bg-white border border-gray-200 shadow-sm p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Todas las Configuraciones</h4>

        {autonomos.length === 0 ? (
          <div className="text-center py-8">
            <Euro className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay configuraciones de autónomo</h3>
            <p className="mt-1 text-sm text-gray-500">Crea tu primera configuración para empezar a gestionar tu actividad.</p>
            <div className="mt-6">
              <button
                onClick={handleCreateAutonomo}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Configuración
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {autonomos.map((autonomo) => {
              const est = autonomoService.calculateEstimatedAnnual(autonomo);
              return (
                <div key={autonomo.id} className={`border p-4 ${autonomo.activo ? 'border-gray-400' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-medium text-gray-900 text-sm">{autonomo.nombre}</h5>
                        {autonomo.titular && <span className="text-sm text-gray-500">— {autonomo.titular}</span>}
                        {autonomo.activo && (
                          <span className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded">Activo</span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="text-center p-2 border border-gray-100">
                          <p className="text-xs text-gray-500">Ingresos Anuales Est.</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(est.facturacionBruta)}</p>
                        </div>
                        <div className="text-center p-2 border border-gray-100">
                          <p className="text-xs text-gray-500">Gastos Anuales Est.</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(est.totalGastos)}</p>
                        </div>
                        <div className="text-center p-2 border border-gray-100">
                          <p className="text-xs text-gray-500">Rendimiento Neto Est.</p>
                          <p className={`text-sm font-semibold ${est.rendimientoNeto >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(est.rendimientoNeto)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center space-x-3 text-xs text-gray-500">
                        <span>Cuota SS: {formatCurrency(autonomo.cuotaAutonomos)}/mes</span>
                        {autonomo.irpfRetencionPorcentaje !== undefined && <span>IRPF: {autonomo.irpfRetencionPorcentaje}%</span>}
                        {autonomo.ivaMedioPorcentaje !== undefined && <span>IVA: {autonomo.ivaMedioPorcentaje}%</span>}
                        <span>{(autonomo.fuentesIngreso || []).length} conceptos de ingreso</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      {!autonomo.activo && (
                        <button
                          onClick={() => handleActivateAutonomo(autonomo)}
                          className="px-3 py-1 text-xs border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Activar
                        </button>
                      )}
                      <button onClick={() => handleEditAutonomo(autonomo)} className="p-2 text-gray-400 hover:text-gray-700">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteAutonomo(autonomo.id!)} className="p-2 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <AutonomoForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingAutonomo(null); }}
        autonomo={editingAutonomo}
        onSaved={() => { setShowForm(false); setEditingAutonomo(null); loadData(); }}
      />
    </div>
  );
};

export default AutonomoManager;
