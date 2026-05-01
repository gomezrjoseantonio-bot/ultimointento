import { confirmDelete } from '../../../services/confirmationService';
import React, { useState, useEffect, useCallback } from 'react';
import { planesPensionesService } from '../../../services/planesPensionesService';
import { getFiscalContextSafe } from '../../../services/fiscalContextService';
import { traspasosPlanesService } from '../../../services/traspasosPlanesService';
import type { PlanPensiones } from '../../../types/planesPensiones';
import type { TraspasoPlan } from '../../../types/personal';
import PlanForm from './PlanForm';
import TraspasoForm, { PlanOrigenInput } from './TraspasoForm';
import TraspasosHistorial from './TraspasosHistorial';
import { Plus, Edit2, Trash2, PiggyBank, Target, User, Heart, ArrowLeftRight } from 'lucide-react';
import toast from 'react-hot-toast';

const PlanesManager: React.FC = () => {
  const [planes, setPlanes] = useState<PlanPensiones[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanPensiones | null>(null);
  const [activeFilter, setActiveFilter] = useState<'todos' | 'activos' | 'rescatados'>('todos');
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [traspasos, setTraspasos] = useState<TraspasoPlan[]>([]);
  const [traspasoOrigen, setTraspasoOrigen] = useState<PlanOrigenInput | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // T14.4 · migrado a fiscalContextService gateway
      const ctx = await getFiscalContextSafe();
      if (ctx) {
        setPersonalDataId(ctx.personalDataId);
        const planesData = await planesPensionesService.getAllPlanes({ personalDataId: ctx.personalDataId });
        setPlanes(planesData);
        const traspasosData = await traspasosPlanesService.getTraspasosByPersonal(ctx.personalDataId);
        setTraspasos(traspasosData);
      }
    } catch (error) {
      console.error('Error loading planes:', error);
      toast.error('Error al cargar los planes de pensiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const handleEditPlan = (plan: PlanPensiones) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleDeletePlan = async (id: string) => {
    const confirmed = await confirmDelete('este plan');
    if (!confirmed) return;
    try {
      await planesPensionesService.eliminarPlan(id);
      toast.success('Plan eliminado correctamente');
      loadData();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Error al eliminar el plan');
    }
  };

  const handlePlanSaved = (savedPlan: PlanPensiones) => {
    setShowForm(false);
    setEditingPlan(null);
    loadData();
    console.log('Plan saved:', savedPlan.id);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const getTipoLabel = (tipo: PlanPensiones['tipoAdministrativo']) => {
    switch (tipo) {
      case 'PPI': return 'Plan Individual';
      case 'PPE': return 'Plan Empleo';
      case 'PPES': return 'Plan Empleo Simplif.';
      case 'PPA': return 'Plan Asegurado';
      default: return tipo;
    }
  };

  const filteredPlanes = planes.filter(plan => {
    switch (activeFilter) {
      case 'activos': return plan.estado === 'activo';
      case 'rescatados': return plan.estado !== 'activo';
      default: return true;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
        <span className="ml-2 text-neutral-600">Cargando planes de pensiones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Planes de Pensiones</h3>
          <p className="text-gray-500">Gestiona tus planes de pensiones (PPI, PPE, PPES, PPA)</p>
        </div>
        <button
          onClick={handleCreatePlan}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Plan PP
        </button>
      </div>

      {/* Summary */}
      {planes.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-6 rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <PiggyBank className="w-5 h-5 text-indigo-600" />
            <h4 className="text-lg font-semibold text-indigo-900">Resumen</h4>
            <div className="ml-auto flex items-center space-x-1 text-sm text-indigo-700">
              <Target className="w-4 h-4" />
              <span>{planes.length} plan{planes.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 border border-indigo-100 rounded">
              <p className="text-sm text-indigo-600 font-medium">Valor total</p>
              <p className="text-xl font-bold text-indigo-900">
                {formatCurrency(planes.reduce((s, p) => s + (p.valorActual ?? 0), 0))}
              </p>
            </div>
            <div className="bg-white p-4 border border-indigo-100 rounded">
              <p className="text-sm text-indigo-600 font-medium">Activos</p>
              <p className="text-xl font-bold text-indigo-900">{planes.filter(p => p.estado === 'activo').length}</p>
            </div>
            <div className="bg-white p-4 border border-indigo-100 rounded">
              <p className="text-sm text-indigo-600 font-medium">Planes yo / pareja</p>
              <p className="text-xl font-bold text-indigo-900">
                {planes.filter(p => p.titular === 'yo').length} / {planes.filter(p => p.titular === 'pareja').length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white border border-gray-200 p-1 rounded">
        <div className="flex space-x-1">
          {[
            { key: 'todos', label: 'Todos', count: planes.length },
            { key: 'activos', label: 'Activos', count: planes.filter(p => p.estado === 'activo').length },
            { key: 'rescatados', label: 'Rescatados/Traspasados', count: planes.filter(p => p.estado !== 'activo').length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as typeof activeFilter)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded ${
                activeFilter === tab.key
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Plans List */}
      <div className="bg-white border border-gray-200 p-6 rounded-lg">
        {filteredPlanes.length === 0 ? (
          <div className="text-center py-8">
            <PiggyBank className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {activeFilter === 'todos' ? 'No hay planes configurados' : 'No hay planes en esta categoría'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeFilter === 'todos'
                ? 'Crea tu primer plan de pensiones o re-importa el XML de la AEAT si tenías planes previamente.'
                : 'Cambia el filtro para ver otros planes.'}
            </p>
            {activeFilter === 'todos' && (
              <div className="mt-6">
                <button onClick={handleCreatePlan} className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear primer plan
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPlanes.map((plan) => (
              <div key={plan.id} className="border border-gray-200 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <h5 className="font-medium text-gray-900">{plan.nombre}</h5>
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 rounded">
                        {getTipoLabel(plan.tipoAdministrativo)}
                      </span>
                      <div className={`flex items-center space-x-1 ${plan.titular === 'yo' ? 'text-blue-700' : 'text-pink-600'}`}>
                        {plan.titular === 'yo' ? <User className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
                        <span className="text-xs">{plan.titular === 'yo' ? 'Mío' : 'Pareja'}</span>
                      </div>
                      {plan.estado !== 'activo' && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                          {plan.estado.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {plan.gestoraActual}{plan.isinActual ? ` · ${plan.isinActual}` : ''} · desde {plan.fechaContratacion}
                    </div>
                    {plan.valorActual != null && (
                      <div className="mt-1 text-sm font-medium text-gray-800">
                        Valor actual: {formatCurrency(plan.valorActual)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setTraspasoOrigen({
                        id: plan.id,
                        store: 'planesPensiones',
                        nombre: plan.nombre,
                        entidad: plan.gestoraActual,
                        saldo: plan.valorActual ?? 0,
                      })}
                      className="p-2 text-gray-400 hover:text-indigo-600"
                      title="Traspasar a otro plan"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEditPlan(plan)} className="p-2 text-gray-400 hover:text-blue-700" title="Editar plan">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-gray-400 hover:text-red-600" title="Eliminar plan">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Traspasos */}
      <TraspasosHistorial traspasos={traspasos} onChanged={loadData} />

      {/* Plan Form Modal */}
      <PlanForm
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingPlan(null); }}
        plan={editingPlan}
        onSaved={handlePlanSaved}
      />

      {/* Traspaso Modal */}
      {personalDataId !== null && (
        <TraspasoForm
          isOpen={traspasoOrigen !== null}
          onClose={() => setTraspasoOrigen(null)}
          personalDataId={personalDataId}
          planOrigen={traspasoOrigen}
          onSaved={loadData}
        />
      )}
    </div>
  );
};

export default PlanesManager;
