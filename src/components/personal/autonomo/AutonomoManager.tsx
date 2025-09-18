import React, { useState, useEffect, useCallback } from 'react';
import { autonomoService } from '../../../services/autonomoService';
import { personalDataService } from '../../../services/personalDataService';
import { Autonomo, CalculoAutonomoResult } from '../../../types/personal';
import AutonomoForm from './AutonomoForm';
import IngresoForm from './IngresoForm';
import GastoForm from './GastoForm';
import { Plus, Edit2, Trash2, Euro, TrendingUp, TrendingDown, Receipt, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

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
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta configuración de autónomo?')) {
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
    if (!activoAutonomo || !window.confirm('¿Eliminar este ingreso?')) return;
    
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
    if (!activoAutonomo || !window.confirm('¿Eliminar este gasto?')) return;
    
    try {
      await autonomoService.removeGasto(activoAutonomo.id!, gastoId);
      toast.success('Gasto eliminado');
      loadData();
    } catch (error) {
      console.error('Error removing gasto:', error);
      toast.error('Error al eliminar gasto');
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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
        <span className="ml-2 text-neutral-600">Cargando datos de autónomo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Gestión de Autónomo</h3>
          <p className="text-gray-500">
            Gestiona tus ingresos facturados, gastos deducibles y cuota de autónomos
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={handleCreateAutonomo}
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy-dark transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Configuración
          </button>
        </div>
      </div>

      {/* Active Autonomo Summary */}
      {activoAutonomo && calculo && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Euro className="w-5 h-5 text-green-600" />
              <h4 className="text-lg font-semibold text-green-900">
                {activoAutonomo.nombre} (Activo) - {selectedYear}
              </h4>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowIngresoForm(true)}
                className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Ingreso
              </button>
              <button
                onClick={() => setShowGastoForm(true)}
                className="inline-flex items-center px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Gasto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <p className="text-sm text-green-600 font-medium">Ingresos Brutos</p>
              <p className="text-xl font-bold text-green-900">
                {formatCurrency(calculo.ingresosBrutos)}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-100">
              <p className="text-sm text-green-600 font-medium">Gastos Deducibles</p>
              <p className="text-xl font-bold text-green-900">
                {formatCurrency(calculo.gastos)}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-100">
              <p className="text-sm text-green-600 font-medium">Cuota Autónomos</p>
              <p className="text-xl font-bold text-green-900">
                {formatCurrency(calculo.cuotaAutonomos)}
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-100">
              <p className="text-sm text-green-600 font-medium">Resultado Neto</p>
              <p className={`text-xl font-bold ${calculo.resultadoAnual >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {formatCurrency(calculo.resultadoAnual)}
              </p>
            </div>
          </div>

          <div className="mt-4 text-sm text-green-700">
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
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
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
                  <div key={ingreso.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{ingreso.descripcion}</p>
                      <p className="text-sm text-gray-600">
                        {formatDate(ingreso.fecha)} • {formatCurrency(ingreso.importe)}
                        {ingreso.conIva && ingreso.tipoIva && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            IVA {ingreso.tipoIva}%
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveIngreso(ingreso.id!)}
                      className="p-1 text-gray-400 hover:text-red-600"
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
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingDown className="w-5 h-5 text-red-600 mr-2" />
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
                  <div key={gasto.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
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
                      className="p-1 text-gray-400 hover:text-red-600"
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

      {/* All Autonomos List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy-dark"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Configuración
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {autonomos.map((autonomo) => (
              <div
                key={autonomo.id}
                className={`border rounded-lg p-4 ${
                  autonomo.activo 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h5 className={`font-medium ${autonomo.activo ? 'text-green-900' : 'text-gray-900'}`}>
                        {autonomo.nombre}
                      </h5>
                      {autonomo.activo && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Activo
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                      <span>
                        Cuota: {formatCurrency(autonomo.cuotaAutonomos)}/mes
                      </span>
                      <span>
                        Ingresos: {autonomo.ingresosFacturados.length}
                      </span>
                      <span>
                        Gastos: {autonomo.gastosDeducibles.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!autonomo.activo && (
                      <button
                        onClick={() => handleActivateAutonomo(autonomo)}
                        className="px-3 py-1 text-sm text-green-600 border border-green-600 rounded hover:bg-green-50"
                      >
                        Activar
                      </button>
                    )}
                    <button
                      onClick={() => handleEditAutonomo(autonomo)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAutonomo(autonomo.id!)}
                      className="p-2 text-gray-400 hover:text-red-600"
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