import React, { useState, useEffect, useCallback } from 'react';
import { autonomoService } from '../../../services/autonomoService';
import { personalDataService } from '../../../services/personalDataService';
import { Autonomo, CalculoAutonomoResult, FuenteIngreso, GastoRecurrenteActividad } from '../../../types/personal';
import AutonomoForm from './AutonomoForm';
import IngresoForm from './IngresoForm';
import GastoForm from './GastoForm';
import { Plus, Edit2, Trash2, Euro, TrendingUp, TrendingDown, Receipt, FileText, Users, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';

const AutonomoManager: React.FC = () => {
  const [autonomos, setAutonomos] = useState<Autonomo[]>([]);
  const [activoAutonomo, setActivoAutonomo] = useState<Autonomo | null>(null);
  const [calculo, setCalculo] = useState<CalculoAutonomoResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showIngresoForm, setShowIngresoForm] = useState(false);
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [editingAutonomo, setEditingAutonomo] = useState<Autonomo | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Inline form state for fuentes de ingreso
  const [showFuenteForm, setShowFuenteForm] = useState(false);
  const [fuenteFormData, setFuenteFormData] = useState({ nombre: '', importeEstimado: '', frecuencia: 'mensual' as 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' });

  // Inline form state for gastos recurrentes actividad
  const [showGastoRecurrenteForm, setShowGastoRecurrenteForm] = useState(false);
  const [gastoRecurrenteFormData, setGastoRecurrenteFormData] = useState({
    descripcion: '',
    importe: '',
    categoria: 'asesoria'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {        
        const autonomosData = await autonomoService.getAutonomos(personalData.id);
        setAutonomos(autonomosData);
        
        const activo = autonomosData.find(a => a.activo);
        if (activo) {
          setActivoAutonomo(activo);
          const calculoResult = autonomoService.calculateAutonomoResults(activo, selectedYear);
          setCalculo(calculoResult);
        }
      }
    } catch (error) {
      console.error('Error loading autonomos:', error);
      toast.error('Error al cargar los datos de autónomo');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateAutonomo = () => {
    setEditingAutonomo(null);
    setShowForm(true);
  };

  const handleEditAutonomo = (autonomo: Autonomo) => {
    setEditingAutonomo(autonomo);
    setShowForm(true);
  };

  const handleDeleteAutonomo = async (id: number) => {
    const confirmed = await confirmDelete('esta configuración de autónomo');
    if (!confirmed) {
      return;
    }

    try {
      await autonomoService.deleteAutonomo(id);
      toast.success('Configuración de autónomo eliminada correctamente');
      loadData();
    } catch (error) {
      console.error('Error deleting autonomo:', error);
      toast.error('Error al eliminar la configuración');
    }
  };

  const handleActivateAutonomo = async (autonomo: Autonomo) => {
    try {
      await autonomoService.updateAutonomo(autonomo.id!, { activo: true });
      toast.success('Configuración de autónomo activada correctamente');
      loadData();
    } catch (error) {
      console.error('Error activating autonomo:', error);
      toast.error('Error al activar la configuración');
    }
  };

  const handleAutonomoSaved = () => {
    setShowForm(false);
    setEditingAutonomo(null);
    loadData();
  };

  const handleIngresoAdded = () => {
    setShowIngresoForm(false);
    loadData();
  };

  const handleGastoAdded = () => {
    setShowGastoForm(false);
    loadData();
  };

  const handleRemoveIngreso = async (ingresoId: string) => {
    if (!activoAutonomo) return;
    
    const confirmed = await confirmDelete('este ingreso');
    if (!confirmed) return;
    
    try {
      await autonomoService.removeIngreso(activoAutonomo.id!, ingresoId);
      toast.success('Ingreso eliminado');
      loadData();
    } catch (error) {
      console.error('Error removing ingreso:', error);
      toast.error('Error al eliminar ingreso');
    }
  };

  const handleRemoveGasto = async (gastoId: string) => {
    if (!activoAutonomo) return;
    
    const confirmed = await confirmDelete('este gasto');
    if (!confirmed) return;
    
    try {
      await autonomoService.removeGasto(activoAutonomo.id!, gastoId);
      toast.success('Gasto eliminado');
      loadData();
    } catch (error) {
      console.error('Error removing gasto:', error);
      toast.error('Error al eliminar gasto');
    }
  };

  const handleAddFuenteIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activoAutonomo) return;
    const importe = parseFloat(fuenteFormData.importeEstimado);
    if (!fuenteFormData.nombre || isNaN(importe) || importe <= 0) {
      toast.error('Completa todos los campos de la fuente de ingreso');
      return;
    }
    try {
      const fuente: Omit<FuenteIngreso, 'id'> = { nombre: fuenteFormData.nombre, importeEstimado: importe, frecuencia: fuenteFormData.frecuencia };
      await autonomoService.addFuenteIngreso(activoAutonomo.id!, fuente);
      toast.success('Fuente de ingreso añadida');
      setFuenteFormData({ nombre: '', importeEstimado: '', frecuencia: 'mensual' });
      setShowFuenteForm(false);
      loadData();
    } catch (error) {
      toast.error('Error al añadir fuente de ingreso');
    }
  };

  const handleRemoveFuenteIngreso = async (fuenteId: string) => {
    if (!activoAutonomo) return;
    const confirmed = await confirmDelete('esta fuente de ingreso');
    if (!confirmed) return;
    try {
      await autonomoService.removeFuenteIngreso(activoAutonomo.id!, fuenteId);
      toast.success('Fuente de ingreso eliminada');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar fuente de ingreso');
    }
  };

  const handleAddGastoRecurrente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activoAutonomo) return;
    const importe = parseFloat(gastoRecurrenteFormData.importe);
    if (!gastoRecurrenteFormData.descripcion || isNaN(importe) || importe <= 0) {
      toast.error('Completa todos los campos del gasto recurrente');
      return;
    }
    try {
      const gasto: Omit<GastoRecurrenteActividad, 'id'> = {
        descripcion: gastoRecurrenteFormData.descripcion,
        importe,
        categoria: gastoRecurrenteFormData.categoria
      };
      await autonomoService.addGastoRecurrenteActividad(activoAutonomo.id!, gasto);
      toast.success('Gasto recurrente añadido');
      setGastoRecurrenteFormData({ descripcion: '', importe: '', categoria: 'asesoria' });
      setShowGastoRecurrenteForm(false);
      loadData();
    } catch (error) {
      toast.error('Error al añadir gasto recurrente');
    }
  };

  const handleRemoveGastoRecurrente = async (gastoId: string) => {
    if (!activoAutonomo) return;
    const confirmed = await confirmDelete('este gasto recurrente');
    if (!confirmed) return;
    try {
      await autonomoService.removeGastoRecurrenteActividad(activoAutonomo.id!, gastoId);
      toast.success('Gasto recurrente eliminado');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar gasto recurrente');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
        <span className="ml-2 text-neutral-600">Cargando datos de autónomo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Gestión de Autónomos</h3>
          <p className="text-gray-500">
            Gestiona tus actividades autónomas, fuentes de ingreso y gastos deducibles
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={handleCreateAutonomo}
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Configuración
          </button>
        </div>
      </div>

      {/* Active Autonomo Summary */}
      {activoAutonomo && calculo && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-success-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Euro className="w-5 h-5 text-success-600" />
              <h4 className="text-lg font-semibold text-success-900">
                {activoAutonomo.nombre} (Activo) - {selectedYear}
                {activoAutonomo.titular && (
                  <span className="ml-2 text-sm font-normal text-success-700">— {activoAutonomo.titular}</span>
                )}
              </h4>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowIngresoForm(true)}
                className="atlas-atlas-atlas-atlas-atlas-atlas-btn-primary inline-flex items-center px-3 py-1 text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Ingreso
              </button>
              <button
                onClick={() => setShowGastoForm(true)}
                className="atlas-atlas-atlas-atlas-atlas-atlas-btn-destructive inline-flex items-center px-3 py-1 text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Gasto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 border border-green-100">
              <p className="text-sm text-success-600 font-medium">Ingresos Brutos</p>
              <p className="text-xl font-bold text-success-900">
                {formatCurrency(calculo.ingresosBrutos)}
              </p>
            </div>

            <div className="bg-white p-4 border border-green-100">
              <p className="text-sm text-success-600 font-medium">Gastos Deducibles</p>
              <p className="text-xl font-bold text-success-900">
                {formatCurrency(calculo.gastos)}
              </p>
            </div>

            <div className="bg-white p-4 border border-green-100">
              <p className="text-sm text-success-600 font-medium">Cuota Autónomos</p>
              <p className="text-xl font-bold text-success-900">
                {formatCurrency(calculo.cuotaAutonomos)}
              </p>
            </div>

            <div className="bg-white p-4 border border-green-100">
              <p className="text-sm text-success-600 font-medium">Resultado Neto</p>
              <p className={`text-xl font-bold ${calculo.resultadoAnual >= 0 ? 'text-success-900' : 'text-error-900'}`}>
                {formatCurrency(calculo.resultadoAnual)}
              </p>
            </div>
          </div>

          <div className="mt-4 text-sm text-success-700">
            <p>
              Resultado neto mensual promedio: <strong>{formatCurrency(calculo.resultadoNetoMensual)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Ingresos and Gastos sections */}
      {activoAutonomo && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ingresos */}
          <div className="bg-white border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="w-5 h-5 text-success-600 mr-2" />
                Ingresos {selectedYear}
              </h4>
              <span className="text-sm text-gray-500">
                {activoAutonomo.ingresosFacturados.filter(i => new Date(i.fecha).getFullYear() === selectedYear).length} facturas
              </span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {activoAutonomo.ingresosFacturados
                .filter(i => new Date(i.fecha).getFullYear() === selectedYear)
                .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                .map((ingreso) => (
                  <div key={ingreso.id} className="atlas-atlas-atlas-atlas-atlas-atlas-btn-primary flex items-center justify-between p-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{ingreso.descripcion}</p>
                      <p className="text-sm text-gray-600">
                        {formatDate(ingreso.fecha)} • {formatCurrency(ingreso.importe)}
                        {ingreso.conIva && ingreso.tipoIva && (
                          <span className="atlas-atlas-atlas-atlas-atlas-atlas-btn-primary ml-2 text-xs text-primary-800 px-2 py-1 rounded">
                            IVA {ingreso.tipoIva}%
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveIngreso(ingreso.id!)}
                      className="p-1 text-gray-400 hover:text-error-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              
              {activoAutonomo.ingresosFacturados.filter(i => new Date(i.fecha).getFullYear() === selectedYear).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Receipt className="mx-auto h-8 w-8 mb-2" />
                  <p>No hay ingresos registrados para {selectedYear}</p>
                </div>
              )}
            </div>
          </div>

          {/* Gastos */}
          <div className="bg-white border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingDown className="w-5 h-5 text-error-600 mr-2" />
                Gastos Deducibles {selectedYear}
              </h4>
              <span className="text-sm text-gray-500">
                {activoAutonomo.gastosDeducibles.filter(g => new Date(g.fecha).getFullYear() === selectedYear).length} gastos
              </span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {activoAutonomo.gastosDeducibles
                .filter(g => new Date(g.fecha).getFullYear() === selectedYear)
                .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                .map((gasto) => (
                  <div key={gasto.id} className="atlas-atlas-atlas-atlas-atlas-atlas-btn-destructive flex items-center justify-between p-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{gasto.descripcion}</p>
                      <p className="text-sm text-gray-600">
                        {formatDate(gasto.fecha)} • {formatCurrency(gasto.importe)}
                        <span className="ml-2 text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          {gasto.categoria}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveGasto(gasto.id!)}
                      className="p-1 text-gray-400 hover:text-error-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              
              {activoAutonomo.gastosDeducibles.filter(g => new Date(g.fecha).getFullYear() === selectedYear).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="mx-auto h-8 w-8 mb-2" />
                  <p>No hay gastos registrados para {selectedYear}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fuentes de Ingreso (Clientes Habituales) */}
      {activoAutonomo && (
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900 flex items-center">
              <Users className="w-5 h-5 text-blue-600 mr-2" />
              Clientes Habituales / Fuentes de Ingreso
            </h4>
            <button
              onClick={() => setShowFuenteForm(!showFuenteForm)}
              className="inline-flex items-center px-3 py-1 text-sm border border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir
            </button>
          </div>

          {showFuenteForm && (
            <form onSubmit={handleAddFuenteIngreso} className="mb-4 p-4 bg-blue-50 border border-blue-100 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Nombre / Cliente *</label>
                  <input
                    type="text"
                    value={fuenteFormData.nombre}
                    onChange={(e) => setFuenteFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    placeholder="Ej: Empresa ABC"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Importe Estimado (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fuenteFormData.importeEstimado}
                    onChange={(e) => setFuenteFormData(prev => ({ ...prev, importeEstimado: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    placeholder="1500.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Frecuencia</label>
                  <select
                    value={fuenteFormData.frecuencia}
                    onChange={(e) => setFuenteFormData(prev => ({ ...prev, frecuencia: e.target.value as 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                  >
                    <option value="mensual">Mensual</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowFuenteForm(false)} className="px-3 py-1 text-sm text-neutral-700 border border-neutral-300">Cancelar</button>
                <button type="submit" className="px-3 py-1 text-sm bg-brand-navy text-white">Guardar</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {(activoAutonomo.fuentesIngreso || []).map((fuente) => (
              <div key={fuente.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100">
                <div>
                  <p className="font-medium text-gray-900">{fuente.nombre}</p>
                  <p className="text-sm text-gray-600">
                    {formatCurrency(fuente.importeEstimado)}/{fuente.frecuencia || 'mensual'} estimado
                  </p>
                </div>
                <button onClick={() => handleRemoveFuenteIngreso(fuente.id!)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(activoAutonomo.fuentesIngreso || []).length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">No hay clientes / fuentes de ingreso registradas</p>
            )}
          </div>
        </div>
      )}

      {/* Gastos Recurrentes de Actividad */}
      {activoAutonomo && (
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900 flex items-center">
              <Repeat className="w-5 h-5 text-orange-600 mr-2" />
              Gastos Recurrentes de la Actividad
            </h4>
            <button
              onClick={() => setShowGastoRecurrenteForm(!showGastoRecurrenteForm)}
              className="inline-flex items-center px-3 py-1 text-sm border border-orange-600 text-orange-600 hover:bg-orange-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir
            </button>
          </div>

          {/* Fixed item: Cuota de autónomos */}
          <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 mb-2">
            <div>
              <p className="font-medium text-gray-900">Cuota de Autónomos</p>
              <p className="text-xs text-gray-500">Pago mensual a la Seguridad Social</p>
            </div>
            <p className="font-semibold text-gray-900">{formatCurrency(activoAutonomo.cuotaAutonomos)}/mes</p>
          </div>

          {showGastoRecurrenteForm && (
            <form onSubmit={handleAddGastoRecurrente} className="mb-4 p-4 bg-orange-50 border border-orange-100 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Descripción *</label>
                  <input
                    type="text"
                    value={gastoRecurrenteFormData.descripcion}
                    onChange={(e) => setGastoRecurrenteFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    placeholder="Ej: Gestoría mensual"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Importe Mensual (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gastoRecurrenteFormData.importe}
                    onChange={(e) => setGastoRecurrenteFormData(prev => ({ ...prev, importe: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
                    placeholder="80.00"
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
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowGastoRecurrenteForm(false)} className="px-3 py-1 text-sm text-neutral-700 border border-neutral-300">Cancelar</button>
                <button type="submit" className="px-3 py-1 text-sm bg-brand-navy text-white">Guardar</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {(activoAutonomo.gastosRecurrentesActividad || []).map((gasto) => (
              <div key={gasto.id} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100">
                <div>
                  <p className="font-medium text-gray-900">{gasto.descripcion}</p>
                  <p className="text-sm text-gray-500">{gasto.categoria}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <p className="font-semibold text-gray-900">{formatCurrency(gasto.importe)}/mes</p>
                  <button onClick={() => handleRemoveGastoRecurrente(gasto.id!)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {(activoAutonomo.gastosRecurrentesActividad || []).length === 0 && (
              <p className="text-sm text-gray-500 py-4 text-center">No hay otros gastos recurrentes registrados</p>
            )}
          </div>
        </div>
      )}

      {/* All Autonomos List */}
      <div className="bg-white border border-gray-200 p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Todas las Configuraciones</h4>
        
        {autonomos.length === 0 ? (
          <div className="text-center py-8">
            <Euro className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay configuraciones de autónomo</h3>
            <p className="mt-1 text-sm text-gray-500">
              Crea tu primera configuración para empezar a gestionar tus ingresos como autónomo.
            </p>
            <div className="mt-6">
              <button
                onClick={handleCreateAutonomo}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Configuración
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {autonomos.map((autonomo) => {
              const estimated = autonomoService.calculateEstimatedAnnual(autonomo);
              return (
              <div
                key={autonomo.id}
                className={`border p-4 ${
                  autonomo.activo 
                    ? 'border-success-200 bg-success-50' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h5 className={`font-medium ${autonomo.activo ? 'text-success-900' : 'text-gray-900'}`}>
                        {autonomo.nombre}
                      </h5>
                      {autonomo.titular && (
                        <span className="text-sm text-gray-500">— {autonomo.titular}</span>
                      )}
                      {autonomo.activo && (
                        <span className="atlas-atlas-atlas-atlas-atlas-atlas-btn-primary inline-flex items-center px-2 py-1 text-xs font-medium text-success-800">
                          Activo
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="text-center p-2 bg-white border border-gray-100 rounded">
                        <p className="text-xs text-gray-500">Facturación Bruta Anual</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(estimated.facturacionBruta)}</p>
                      </div>
                      <div className="text-center p-2 bg-white border border-gray-100 rounded">
                        <p className="text-xs text-gray-500">Gastos Deducibles Anuales</p>
                        <p className="text-sm font-semibold text-error-700">{formatCurrency(estimated.totalGastos)}</p>
                      </div>
                      <div className="text-center p-2 bg-white border border-gray-100 rounded">
                        <p className="text-xs text-gray-500">Rendimiento Neto Est.</p>
                        <p className={`text-sm font-semibold ${estimated.rendimientoNeto >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                          {formatCurrency(estimated.rendimientoNeto)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span>Cuota SS: {formatCurrency(autonomo.cuotaAutonomos)}/mes</span>
                      {autonomo.irpfRetencionPorcentaje !== undefined && (
                        <span>IRPF: {autonomo.irpfRetencionPorcentaje}%</span>
                      )}
                      <span>{(autonomo.fuentesIngreso || []).length} fuentes de ingreso</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {!autonomo.activo && (
                      <button
                        onClick={() => handleActivateAutonomo(autonomo)}
                        className="atlas-atlas-atlas-atlas-atlas-atlas-btn-primary px-3 py-1 text-sm text-success-600 border border-green-600 rounded hover: "
                      >
                        Activar
                      </button>
                    )}
                    <button
                      onClick={() => handleEditAutonomo(autonomo)}
                      className="p-2 text-gray-400 hover:text-atlas-blue"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAutonomo(autonomo.id!)}
                      className="p-2 text-gray-400 hover:text-error-600"
                    >
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

      {/* Modals */}
      <AutonomoForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingAutonomo(null);
        }}
        autonomo={editingAutonomo}
        onSaved={handleAutonomoSaved}
      />

      {activoAutonomo && (
        <>
          <IngresoForm
            isOpen={showIngresoForm}
            onClose={() => setShowIngresoForm(false)}
            autonomoId={activoAutonomo.id!}
            onSaved={handleIngresoAdded}
          />

          <GastoForm
            isOpen={showGastoForm}
            onClose={() => setShowGastoForm(false)}
            autonomoId={activoAutonomo.id!}
            onSaved={handleGastoAdded}
          />
        </>
      )}
    </div>
  );
};

export default AutonomoManager;