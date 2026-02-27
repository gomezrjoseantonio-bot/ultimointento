import React, { useState, useEffect } from 'react';
import { nominaService } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { Nomina, CalculoNominaResult } from '../../../types/personal';
import NominaForm from './NominaForm';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';

const NominaManager: React.FC = () => {
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [calculos, setCalculos] = useState<Map<number, CalculoNominaResult>>(new Map());
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

  const handleNominaSaved = () => {
    setShowForm(false);
    setEditingNomina(null);
    loadData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getPagasCount = (nomina: Nomina): number => {
    if (nomina.distribucion.tipo === 'doce') return 12;
    if (nomina.distribucion.tipo === 'catorce') return 14;
    return nomina.distribucion.meses;
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
          <h3 className="text-lg font-semibold text-gray-900">Gestión de Nóminas</h3>
          <p className="text-sm text-gray-500">
            Configura y gestiona tus nóminas con distribución, variables y bonus
          </p>
        </div>
        <button
          onClick={handleCreateNomina}
          className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Nómina
        </button>
      </div>

      {/* Empty state */}
      {nominas.length === 0 && (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay nóminas configuradas</h3>
          <p className="mt-1 text-sm text-gray-500">
            Crea tu primera nómina para empezar a gestionar tus ingresos salariales.
          </p>
          <div className="mt-6">
            <button
              onClick={handleCreateNomina}
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera Nómina
            </button>
          </div>
        </div>
      )}

      {/* Nominas list */}
      <div className="space-y-4">
        {nominas.map((nomina) => {
          const calculo = nomina.id ? calculos.get(nomina.id) : null;
          const pagasCount = getPagasCount(nomina);

          return (
            <div key={nomina.id}>
              {/* Header bar */}
              <div className="bg-white border border-gray-200 rounded-t-lg px-5 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-900 tracking-wide uppercase">
                    {nomina.nombre}
                  </span>
                  <span className="px-2 py-0.5 text-xs text-gray-500 bg-gray-100 rounded">
                    {pagasCount} pagas
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEditNomina(nomina)}
                    className="p-2 text-gray-400 hover:text-gray-700"
                    title="Editar nómina"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteNomina(nomina.id!)}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Eliminar nómina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary card */}
              <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Bruto Anual</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(nomina.salarioBrutoAnual)}</p>
                  </div>
                  <div className="bg-white border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Neto Mensual Promedio</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {calculo ? formatCurrency(calculo.netoMensual) : '-'}
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Neto Anual</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {calculo ? formatCurrency(calculo.totalAnualNeto) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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