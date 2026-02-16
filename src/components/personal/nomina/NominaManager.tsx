import React, { useState, useEffect } from 'react';
import { nominaService } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { Nomina, CalculoNominaResult } from '../../../types/personal';
import NominaForm from './NominaForm';
import { Plus, Edit2, Trash2, Calendar, DollarSign, ChevronDown, ChevronUp, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';

const NominaManager: React.FC = () => {
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [nominasActivas, setNominasActivas] = useState<Nomina[]>([]);
  const [calculos, setCalculos] = useState<Map<number, CalculoNominaResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNomina, setEditingNomina] = useState<Nomina | null>(null);
  const [expandedNomina, setExpandedNomina] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {        
        const nominasData = await nominaService.getNominas(personalData.id);
        setNominas(nominasData);
        
        // Filter all active nominas
        const activas = nominasData.filter(n => n.activa);
        setNominasActivas(activas);
        
        // Calculate salary for ALL nominas (not just active ones)
        const calculosMap = new Map<number, CalculoNominaResult>();
        nominasData.forEach(nomina => {
          if (nomina.id) {
            const calculoResult = nominaService.calculateSalary(nomina);
            calculosMap.set(nomina.id, calculoResult);
          }
        });
        setCalculos(calculosMap);
      }
    } catch (error) {
      console.error('Error loading nominas:', error);
      toast.error('Error al cargar las nóminas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNomina = () => {
    setEditingNomina(null);
    setShowForm(true);
  };

  const handleEditNomina = (nomina: Nomina) => {
    setEditingNomina(nomina);
    setShowForm(true);
  };

  const handleDeleteNomina = async (id: number) => {
    const confirmed = await confirmDelete('esta nómina');
    if (!confirmed) {
      return;
    }

    try {
      await nominaService.deleteNomina(id);
      toast.success('Nómina eliminada correctamente');
      loadData();
    } catch (error) {
      console.error('Error deleting nomina:', error);
      toast.error('Error al eliminar la nómina');
    }
  };

  const handleActivateNomina = async (nomina: Nomina) => {
    try {
      await nominaService.updateNomina(nomina.id!, { activa: true });
      toast.success('Nómina activada correctamente');
      loadData();
    } catch (error) {
      console.error('Error activating nomina:', error);
      toast.error('Error al activar la nómina');
    }
  };

  const handleDeactivateNomina = async (nominaId: number) => {
    try {
      await nominaService.updateNomina(nominaId, { activa: false });
      toast.success('Nómina desactivada correctamente');
      loadData();
    } catch (error) {
      console.error('Error deactivating nomina:', error);
      toast.error('Error al desactivar la nómina');
    }
  };

  const handleNominaSaved = () => {
    setShowForm(false);
    setEditingNomina(null);
    loadData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getCombinedTotals = () => {
    if (nominasActivas.length === 0) {
      return { brutoAnual: 0, netoMensual: 0, netoAnual: 0 };
    }

    let brutoAnual = 0;
    let netoAnual = 0;

    nominasActivas.forEach(nomina => {
      brutoAnual += nomina.salarioBrutoAnual;
      if (nomina.id) {
        const calculo = calculos.get(nomina.id);
        if (calculo) {
          netoAnual += calculo.totalAnualNeto;
        }
      }
    });

    const netoMensual = netoAnual / 12;

    return { brutoAnual, netoMensual, netoAnual };
  };

  const getMonthName = (mes: number) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[mes - 1];
  };

  const toggleExpanded = (nominaId: number) => {
    setExpandedNomina(expandedNomina === nominaId ? null : nominaId);
  };

  const getNextPaymentDate = (nomina: Nomina) => {
    const nextDate = nominaService.getNextPaymentDate(nomina.reglaCobroDia);
    return nextDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
        <span className="ml-2 text-neutral-600">Cargando nóminas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Gestión de Nóminas</h3>
          <p className="text-gray-500">
            Configura y gestiona tus nóminas con distribución, variables y bonus
          </p>
        </div>
        <button
          onClick={handleCreateNomina}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Nómina
        </button>
      </div>

      {/* Combined Summary for Active Nominas */}
      {nominasActivas.length > 0 && (
        <div className="btn-secondary-horizon bg-gradient-to-r from-primary-50 to-primary-100 ">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-atlas-blue" />
              <h4 className="text-lg font-semibold text-primary-900">
                Resumen de Ingresos
              </h4>
              {nominasActivas.length > 1 && (
                <div className="flex items-center space-x-1 text-sm text-primary-700">
                  <Users className="w-4 h-4" />
                  <span>Ingresos combinados de {nominasActivas.length} nóminas</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="btn-secondary-horizon bg-white p-4 ">
              <p className="text-xs uppercase text-atlas-blue font-medium">Bruto Anual</p>
              <p className="text-2xl font-bold text-primary-900">
                {formatCurrency(getCombinedTotals().brutoAnual)}
              </p>
            </div>

            <div className="btn-secondary-horizon bg-white p-4 border-2 border-green-400">
              <p className="text-xs uppercase text-atlas-blue font-medium">Neto Mensual</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(getCombinedTotals().netoMensual)}
              </p>
            </div>

            <div className="btn-secondary-horizon bg-white p-4 ">
              <p className="text-xs uppercase text-atlas-blue font-medium">Neto Anual</p>
              <p className="text-2xl font-bold text-primary-900">
                {formatCurrency(getCombinedTotals().netoAnual)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All Nominas List */}
      <div className="bg-white border border-gray-200 p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Todas las Nóminas</h4>
        
        {nominas.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay nóminas configuradas</h3>
            <p className="mt-1 text-sm text-gray-500">
              Crea tu primera nómina para empezar a gestionar tus ingresos salariales.
            </p>
            <div className="mt-6">
              <button
                onClick={handleCreateNomina}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-sm font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Nómina
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {nominas.map((nomina) => {
              const calculo = nomina.id ? calculos.get(nomina.id) : null;
              const isExpanded = expandedNomina === nomina.id;
              const hasExtras = nomina.variables.length > 0 || nomina.bonus.length > 0;
              
              return (
                <div
                  key={nomina.id}
                  className={`border ${
                    nomina.activa 
                      ? 'border-primary-200 bg-primary-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Compact Row */}
                  <div className="flex items-center px-4 py-3 space-x-4">
                    {/* Name and Status */}
                    <div className="flex-shrink-0 w-48">
                      <div className="flex items-center space-x-2">
                        <h5 className={`font-medium text-sm ${nomina.activa ? 'text-primary-900' : 'text-gray-900'}`}>
                          {nomina.nombre}
                        </h5>
                        {nomina.activa && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-primary-800 bg-primary-200 rounded">
                            Activa
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bruto */}
                    <div className="flex-shrink-0 w-32 text-sm">
                      <span className="text-gray-900 font-medium">
                        {formatCurrency(nomina.salarioBrutoAnual)}
                      </span>
                    </div>

                    {/* Neto/mes */}
                    <div className="flex-shrink-0 w-32 text-sm">
                      <span className="text-gray-600">
                        {calculo ? formatCurrency(calculo.netoMensual) : '-'}/mes
                      </span>
                    </div>

                    {/* Pagas */}
                    <div className="flex-shrink-0 w-24 text-sm text-gray-600">
                      {nomina.distribucion.tipo === 'doce' ? '12' :
                       nomina.distribucion.tipo === 'catorce' ? '14' :
                       nomina.distribucion.meses} pagas
                    </div>

                    {/* Extras */}
                    <div className="flex-shrink-0 w-20 text-sm text-gray-600">
                      {hasExtras ? (
                        <span className="text-green-600">
                          +{nomina.variables.length + nomina.bonus.length}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </div>

                    {/* Próximo pago */}
                    <div className="flex-1 min-w-0 text-sm text-gray-600 flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span className="truncate">{getNextPaymentDate(nomina)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center space-x-2">
                      {calculo && (
                        <button
                          onClick={() => toggleExpanded(nomina.id!)}
                          className="p-2 text-gray-400 hover:text-atlas-blue"
                          title="Ver distribución mensual"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {nomina.activa ? (
                        <button
                          onClick={() => handleDeactivateNomina(nomina.id!)}
                          className="btn-secondary-horizon px-3 py-1 text-sm text-gray-600"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivateNomina(nomina)}
                          className="btn-secondary-horizon px-3 py-1 text-sm text-atlas-blue"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() => handleEditNomina(nomina)}
                        className="p-2 text-gray-400 hover:text-atlas-blue"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNomina(nomina.id!)}
                        className="p-2 text-gray-400 hover:text-error-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Monthly Distribution Grid */}
                  {isExpanded && calculo && calculo.distribuccionMensual && (
                    <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                      <h5 className="text-sm font-medium text-gray-700 mb-3">Distribución Mensual</h5>
                      <div className="grid grid-cols-6 gap-2">
                        {calculo.distribuccionMensual.map((mes) => {
                          const hasMonthExtras = mes.variables > 0 || mes.bonus > 0;
                          return (
                            <div
                              key={mes.mes}
                              className={`p-2 rounded text-sm ${
                                hasMonthExtras ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200'
                              }`}
                            >
                              <div className="font-medium text-gray-900">{getMonthName(mes.mes)}</div>
                              <div className="text-xs text-gray-600 font-semibold">
                                {formatCurrency(mes.netoTotal)}
                              </div>
                              {hasMonthExtras && (
                                <div className="text-xs text-green-600 mt-0.5">
                                  +extras
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nomina Form Modal */}
      <NominaForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingNomina(null);
        }}
        nomina={editingNomina}
        onSaved={handleNominaSaved}
      />
    </div>
  );
};

export default NominaManager;