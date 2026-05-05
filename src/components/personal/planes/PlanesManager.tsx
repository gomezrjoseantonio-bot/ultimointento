import { confirmDelete } from '../../../services/confirmationService';
import React, { useState, useEffect, useCallback } from 'react';
import { planesPensionesService } from '../../../services/planesPensionesService';
import { aportacionesPlanService } from '../../../services/aportacionesPlanService';
import { getRentabilidadTotal } from '../../../services/rentabilidadPlanService';
import { getFiscalContextSafe } from '../../../services/fiscalContextService';
import { traspasosPlanPensionesService } from '../../../services/traspasosPlanPensionesService';
import type { PlanPensiones, TraspasoPlanPensiones } from '../../../types/planesPensiones';
import PlanForm from './PlanForm';
import TraspasoForm, { PlanOrigenInput } from './TraspasoForm';
import TraspasosHistorial from './TraspasosHistorial';
import { Plus, Edit2, Trash2, PiggyBank, Target, User, Heart, ArrowLeftRight, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

// TAREA 13 v4 · Commit 8 (K) · estructura de KPIs por card.
interface KpisPlan {
  aportadoTotal: number;
  twr: number | null;
  rentabilidadAcumulada: number | null; // plusvalía relativa (tanto por uno)
}

const PlanesManager: React.FC = () => {
  const [planes, setPlanes] = useState<PlanPensiones[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanPensiones | null>(null);
  const [activeFilter, setActiveFilter] = useState<'todos' | 'activos' | 'rescatados'>('todos');
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  // TAREA 13 v4 · Commit 1 (C9) · historial leído del store V65.
  const [traspasos, setTraspasos] = useState<TraspasoPlanPensiones[]>([]);
  const [traspasoOrigen, setTraspasoOrigen] = useState<PlanOrigenInput | null>(null);
  // TAREA 13 v4 · Commit 8 · KPIs por plan (aportado, TWR, rentab. acumulada)
  const [kpisPorPlan, setKpisPorPlan] = useState<Record<string, KpisPlan>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // T14.4 · migrado a fiscalContextService gateway
      const ctx = await getFiscalContextSafe();
      if (ctx) {
        setPersonalDataId(ctx.personalDataId);
        const planesData = await planesPensionesService.getAllPlanes({ personalDataId: ctx.personalDataId });
        setPlanes(planesData);
        // TAREA 13 v4 · Commit 1 (C9) · lee del store V65 traspasosPlanPensiones
        // (antes leía del legacy traspasosPlanesService · resultado: traspasos
        // creados con TraspasoForm V65 no aparecían).
        const traspasosData = await traspasosPlanPensionesService.getTraspasosPorPersonalData(
          ctx.personalDataId,
        );
        setTraspasos(traspasosData);

        // TAREA 13 v4 · Commit 8 · cargar KPIs en paralelo. Si la
        // rentabilidad falla, se omite (el card no muestra el KPI).
        const ids = planesData.map((p) => p.id);
        const aportadoMap = await aportacionesPlanService.getMapaAportacionesAcumuladas(ids);
        const kpis: Record<string, KpisPlan> = {};
        await Promise.all(
          planesData.map(async (p) => {
            const aportadoTotal = aportadoMap.get(p.id) ?? 0;
            try {
              const r = await getRentabilidadTotal(p.id);
              kpis[p.id] = {
                aportadoTotal,
                twr: r.TWR,
                rentabilidadAcumulada: r.capitalAportadoTotal > 0 ? r.plusvaliaRelativa : null,
              };
            } catch {
              kpis[p.id] = { aportadoTotal, twr: null, rentabilidadAcumulada: null };
            }
          }),
        );
        setKpisPorPlan(kpis);
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

  const formatPct = (n: number): string =>
    `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;

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
            {filteredPlanes.map((plan) => {
              const k = kpisPorPlan[plan.id];
              const showEmpresa =
                (plan.tipoAdministrativo === 'PPE' || plan.tipoAdministrativo === 'PPES') &&
                plan.empresaPagadora?.nombre;
              return (
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
                    {/* TAREA 13 v4 · Commit 8 · empresa pagadora si PPE/PPES */}
                    {showEmpresa && (
                      <div className="mt-1 flex items-center space-x-1 text-xs text-gray-500">
                        <Briefcase className="w-3 h-3" />
                        <span>Empresa · {plan.empresaPagadora!.nombre}</span>
                      </div>
                    )}
                    {/* TAREA 13 v4 · Commit 8 · KPIs valor + aportado + rentabilidad + TWR/año */}
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      {plan.valorActual != null && (
                        <div className="text-gray-800">
                          <span className="text-gray-500 text-xs mr-1">Valor</span>
                          <span className="font-medium">{formatCurrency(plan.valorActual)}</span>
                        </div>
                      )}
                      {k && k.aportadoTotal > 0 && (
                        <div className="text-gray-800">
                          <span className="text-gray-500 text-xs mr-1">Aportado</span>
                          <span className="font-medium">{formatCurrency(k.aportadoTotal)}</span>
                        </div>
                      )}
                      {k && k.rentabilidadAcumulada != null && (
                        <div
                          className={
                            k.rentabilidadAcumulada >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }
                        >
                          <span className="text-gray-500 text-xs mr-1">Rentab. acum.</span>
                          <span className="font-medium">{formatPct(k.rentabilidadAcumulada)}</span>
                        </div>
                      )}
                      {k && k.twr != null && (
                        <div className={k.twr >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                          <span className="text-gray-500 text-xs mr-1">TWR/año</span>
                          <span className="font-medium">{formatPct(k.twr)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setTraspasoOrigen({
                        id: plan.id,
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
              );
            })}
          </div>
        )}
      </div>

      {/* Traspasos · V65 */}
      <TraspasosHistorial traspasos={traspasos} planes={planes} onChanged={loadData} />

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
