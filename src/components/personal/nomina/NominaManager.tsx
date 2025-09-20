import React, { useState, useEffect } from 'react';
import { nominaService } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { Nomina, CalculoNominaResult } from '../../../types/personal';
import NominaForm from './NominaForm';
import { Plus, Edit2, Trash2, Calculator, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const NominaManager: React.FC = () => {
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [activaNomina, setActivaNomina] = useState<Nomina | null>(null);
  const [calculo, setCalculo] = useState<CalculoNominaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNomina, setEditingNomina] = useState<Nomina | null>(null);

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
        
        const activa = nominasData.find(n => n.activa);
        if (activa) {
          setActivaNomina(activa);
          const calculoResult = nominaService.calculateSalary(activa);
          setCalculo(calculoResult);
        }
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
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta nómina?')) {
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

  const handleNominaSaved = () => {
    setShowForm(false);
    setEditingNomina(null);
    loadData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatPaymentRule = (regla: Nomina['reglaCobroDia']) => {
    switch (regla.tipo) {
      case 'fijo':
        return `Día ${regla.dia} de cada mes`;
      case 'ultimo-habil':
        return 'Último día hábil del mes';
      case 'n-esimo-habil':
        const posicion = regla.posicion || -1;
        if (posicion === -1) return 'Último día hábil';
        if (posicion === -2) return 'Penúltimo día hábil';
        if (posicion === -3) return 'Antepenúltimo día hábil';
        return `${Math.abs(posicion)}º día hábil desde el final`;
      default:
        return 'No especificado';
    }
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

      {/* Active Nomina Summary */}
      {activaNomina && calculo && (
        <div className="btn-secondary-horizon bg-gradient-to-r from-blue-50 to-indigo-50 ">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <h4 className="text-lg font-semibold text-blue-900">
                {activaNomina.nombre} (Activa)
              </h4>
            </div>
            <div className="flex items-center space-x-2 text-sm text-blue-700">
              <Calendar className="w-4 h-4" />
              <span>Próximo pago: {getNextPaymentDate(activaNomina)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="btn-secondary-horizon bg-white p-4 ">
              <p className="text-sm text-blue-600 font-medium">Salario Bruto Anual</p>
              <p className="text-xl font-bold text-blue-900">
                {formatCurrency(activaNomina.salarioBrutoAnual)}
              </p>
            </div>

            <div className="btn-secondary-horizon bg-white p-4 ">
              <p className="text-sm text-blue-600 font-medium">Neto Mensual Promedio</p>
              <p className="text-xl font-bold text-blue-900">
                {formatCurrency(calculo.netoMensual)}
              </p>
            </div>

            <div className="btn-secondary-horizon bg-white p-4 ">
              <p className="text-sm text-blue-600 font-medium">Total Anual Neto</p>
              <p className="text-xl font-bold text-blue-900">
                {formatCurrency(calculo.totalAnualNeto)}
              </p>
            </div>

            <div className="btn-secondary-horizon bg-white p-4 ">
              <p className="text-sm text-blue-600 font-medium">Variables y Bonus</p>
              <p className="text-xl font-bold text-blue-900">
                {activaNomina.variables.length + activaNomina.bonus.length}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center space-x-4 text-sm text-blue-700">
            <div className="flex items-center space-x-1">
              <Calculator className="w-4 h-4" />
              <span>Distribución: {
                activaNomina.distribucion.tipo === 'doce' ? '12 meses' :
                activaNomina.distribucion.tipo === 'catorce' ? '14 meses' :
                `${activaNomina.distribucion.meses} meses (personalizado)`
              }</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>Regla de pago: {formatPaymentRule(activaNomina.reglaCobroDia)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Distribution Details */}
      {calculo && calculo.distribuccionMensual && (
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h4 className="text-lg font-medium text-gray-900">Distribución Mensual</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Mes</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Salario Base</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Variables</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Bonus</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Neto Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calculo.distribuccionMensual.map((mes) => (
                  <tr key={mes.mes} className="hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm text-gray-900">
                      {new Date(2024, mes.mes - 1).toLocaleDateString('es-ES', { month: 'long' })}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-900 text-right">
                      {formatCurrency(mes.salarioBase)}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-900 text-right">
                      {mes.variables > 0 ? formatCurrency(mes.variables) : '-'}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-900 text-right">
                      {mes.bonus > 0 ? formatCurrency(mes.bonus) : '-'}
                    </td>
                    <td className="py-2 px-3 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(mes.netoTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Nómina
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {nominas.map((nomina) => (
              <div
                key={nomina.id}
                className={`border p-4 ${
                  nomina.activa 
                    ? 'border-blue-200 bg-blue-50' 
                    : 'border-gray-200 bg-white
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h5 className={`font-medium ${nomina.activa ? 'text-blue-900' : 'text-gray-900'}`}>
                        {nomina.nombre}
                      </h5>
                      {nomina.activa && (
                        <span className="btn-primary-horizon inline-flex items-center px-2 py-1 text-xs font-medium text-blue-800">
                          Activa
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                      <span>
                        Bruto anual: {formatCurrency(nomina.salarioBrutoAnual)}
                      </span>
                      <span>
                        Distribución: {
                          nomina.distribucion.tipo === 'doce' ? '12 meses' :
                          nomina.distribucion.tipo === 'catorce' ? '14 meses' :
                          `${nomina.distribucion.meses} meses`
                        }
                      </span>
                      <span>
                        Variables: {nomina.variables.length}
                      </span>
                      <span>
                        Bonus: {nomina.bonus.length}
                      </span>
                    </div>
                    
                    <div className="mt-1 text-sm text-gray-500">
                      {formatPaymentRule(nomina.reglaCobroDia)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!nomina.activa && (
                      <button
                        onClick={() => handleActivateNomina(nomina)}
                        className="btn-secondary-horizon btn-primary-horizon px-3 py-1 text-sm text-blue-600 "
                      >
                        Activar
                      </button>
                    )}
                    <button
                      onClick={() => handleEditNomina(nomina)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNomina(nomina.id!)}
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