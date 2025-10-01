import { confirmDelete } from '../../../services/confirmationService';
import React, { useState, useEffect, useCallback } from 'react';
import { planesInversionService } from '../../../services/planesInversionService';
import { personalDataService } from '../../../services/personalDataService';
import { PlanPensionInversion } from '../../../types/personal';
import PlanForm from './PlanForm';
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, PiggyBank, Target, Users, User, Heart } from 'lucide-react';
import toast from 'react-hot-toast';

const PlanesManager: React.FC = () => {
  const [planes, setPlanes] = useState<PlanPensionInversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanPensionInversion | null>(null);
  const [activeFilter, setActiveFilter] = useState<'todos' | 'activos' | 'historicos'>('todos');
  const [portfolioSummary, setPortfolioSummary] = useState({
    totalInvertido: 0,
    valorActualTotal: 0,
    plusvaliasMinusvalias: 0,
    rentabilidadPromedio: 0,
    planesTotales: 0
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        const planesData = await planesInversionService.getPlanes(personalData.id);
        setPlanes(planesData);
        
        const summary = await planesInversionService.calculatePortfolioSummary(personalData.id);
        setPortfolioSummary(summary);
      }
    } catch (error) {
      console.error('Error loading planes:', error);
      toast.error('Error al cargar los planes de pensión e inversiones');
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

  const handleEditPlan = (plan: PlanPensionInversion) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleDeletePlan = async (id: number) => {
    const confirmed = await confirmDelete('este plan');
    if (!confirmed) {
      return;
    }

    try {
      await planesInversionService.deletePlan(id);
      toast.success('Plan eliminado correctamente');
      loadData();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Error al eliminar el plan');
    }
  };

  const handlePlanSaved = () => {
    setShowForm(false);
    setEditingPlan(null);
    loadData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const getTipoLabel = (tipo: PlanPensionInversion['tipo']) => {
    switch (tipo) {
      case 'plan-pensiones': return 'Plan de Pensiones';
      case 'inversion': return 'Inversión';
      case 'fondo-indexado': return 'Fondo Indexado';
      case 'acciones': return 'Acciones';
      case 'otros': return 'Otros';
      default: return tipo;
    }
  };

  const getTitularidadIcon = (titularidad: PlanPensionInversion['titularidad']) => {
    switch (titularidad) {
      case 'yo': return <User className="w-4 h-4" />;
      case 'pareja': return <Heart className="w-4 h-4" />;
      case 'ambos': return <Users className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getTitularidadColor = (titularidad: PlanPensionInversion['titularidad']) => {
    switch (titularidad) {
      case 'yo': return 'text-blue-600';
      case 'pareja': return 'text-red-600';
      case 'ambos': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const filteredPlanes = planes.filter(plan => {
    switch (activeFilter) {
      case 'activos':
        return !plan.esHistorico;
      case 'historicos':
        return plan.esHistorico;
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
        <span className="ml-2 text-neutral-600">Cargando planes de pensión e inversiones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Planes de Pensión e Inversiones</h3>
          <p className="text-gray-500">
            Gestiona tus inversiones, planes de pensión y sigue su evolución
          </p>
        </div>
        <button
          onClick={handleCreatePlan}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Plan
        </button>
      </div>

      {/* Portfolio Summary */}
      {portfolioSummary.planesTotales > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <PiggyBank className="w-5 h-5 text-indigo-600" />
              <h4 className="text-lg font-semibold text-indigo-900">
                Resumen del Portfolio
              </h4>
            </div>
            <div className="flex items-center space-x-2 text-sm text-indigo-700">
              <Target className="w-4 h-4" />
              <span>{portfolioSummary.planesTotales} productos</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 border border-indigo-100">
              <p className="text-sm text-indigo-600 font-medium">Total Invertido</p>
              <p className="text-xl font-bold text-indigo-900">
                {formatCurrency(portfolioSummary.totalInvertido)}
              </p>
            </div>

            <div className="bg-white p-4 border border-indigo-100">
              <p className="text-sm text-indigo-600 font-medium">Valor Actual</p>
              <p className="text-xl font-bold text-indigo-900">
                {formatCurrency(portfolioSummary.valorActualTotal)}
              </p>
            </div>

            <div className="bg-white p-4 border border-indigo-100">
              <p className="text-sm text-indigo-600 font-medium">Plusvalías/Pérdidas</p>
              <p className={`text-xl font-bold ${portfolioSummary.plusvaliasMinusvalias >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(portfolioSummary.plusvaliasMinusvalias)}
              </p>
            </div>

            <div className="bg-white p-4 border border-indigo-100">
              <p className="text-sm text-indigo-600 font-medium">Rentabilidad</p>
              <p className={`text-xl font-bold ${portfolioSummary.rentabilidadPromedio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(portfolioSummary.rentabilidadPromedio)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white border border-gray-200 p-1">
        <div className="flex space-x-1">
          {[
            { key: 'todos', label: 'Todos', count: planes.length },
            { key: 'activos', label: 'Con Aportaciones', count: planes.filter(p => !p.esHistorico).length },
            { key: 'historicos', label: 'Solo Seguimiento', count: planes.filter(p => p.esHistorico).length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as any)}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                activeFilter === tab.key
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'text-gray-600 hover:text-gray-900'              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Plans List */}
      <div className="bg-white border border-gray-200 p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Productos</h4>
        
        {filteredPlanes.length === 0 ? (
          <div className="text-center py-8">
            <PiggyBank className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {activeFilter === 'todos' ? 'No hay planes configurados' : 
               activeFilter === 'activos' ? 'No hay planes con aportaciones activas' : 
               'No hay planes solo de seguimiento'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeFilter === 'todos' ? 
                'Crea tu primer plan de pensión o inversión para empezar a hacer seguimiento.' :
                'Cambia el filtro para ver otros productos.'}
            </p>
            {activeFilter === 'todos' && (
              <div className="mt-6">
                <button
                  onClick={handleCreatePlan}
                  className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
              >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Plan
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPlanes.map((plan) => {
              const calculo = planesInversionService.calculateProfitLoss(plan);
              const taxInfo = planesInversionService.getTaxImplications(plan);
              
              return (
                <div key={plan.id} className="border p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="font-medium text-gray-900">{plan.nombre}</h5>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                          {getTipoLabel(plan.tipo)}
                        </span>
                        <div className={`flex items-center space-x-1 ${getTitularidadColor(plan.titularidad)}`}>
                          {getTitularidadIcon(plan.titularidad)}
                          <span className="text-xs font-medium">
                            {plan.titularidad === 'yo' ? 'Mío' : 
                             plan.titularidad === 'pareja' ? 'Pareja' : 'Ambos'}
                          </span>
                        </div>
                        {plan.esHistorico && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800">
                            Solo seguimiento
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Invertido</p>
                          <p className="font-medium">{formatCurrency(calculo.totalInvertido)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Valor Actual</p>
                          <p className="font-medium">{formatCurrency(calculo.valorActualTotal)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">P&L</p>
                          <p className={`font-medium flex items-center space-x-1 ${calculo.plusvaliaMinusvalia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calculo.plusvaliaMinusvalia >= 0 ? 
                              <TrendingUp className="w-3 h-3" /> : 
                              <TrendingDown className="w-3 h-3" />
                            }
                            <span>{formatCurrency(calculo.plusvaliaMinusvalia)}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Rentabilidad</p>
                          <p className={`font-medium ${calculo.porcentajeRentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercentage(calculo.porcentajeRentabilidad)}
                          </p>
                        </div>
                      </div>

                      {!plan.esHistorico && plan.aportacionPeriodica?.activa && (
                        <div className="mt-2 text-sm text-blue-600">
                          <p>
                            Aportación {plan.aportacionPeriodica.frecuencia}: {formatCurrency(plan.aportacionPeriodica.importe)}
                            {taxInfo.deducibleAnual > 0 && (
                              <span className="atlas-atlas-atlas-atlas-atlas-btn-primary ml-2 text-xs text-green-800 px-2 py-1 rounded">
                                Deducible: {formatCurrency(taxInfo.deducibleAnual)}/año
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Editar plan"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id!)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Eliminar plan"
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

      {/* Plan Form Modal */}
      <PlanForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingPlan(null);
        }}
        plan={editingPlan}
        onSaved={handlePlanSaved}
      />
    </div>
  );
};

export default PlanesManager;