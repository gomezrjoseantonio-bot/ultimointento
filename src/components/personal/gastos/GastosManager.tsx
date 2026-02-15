import React, { useState, useEffect } from 'react';
import { Plus, Receipt, Calendar } from 'lucide-react';
import { gastosPersonalesService } from '../../../services/gastosPersonalesService';
import { personalDataService } from '../../../services/personalDataService';
import { GastoRecurrente, GastoPuntual } from '../../../types/personal';
import GastoRecurrenteForm from './GastoRecurrenteForm';
import GastoPuntualForm from './GastoPuntualForm';
import GastoRecurrenteList from './GastoRecurrenteList';
import GastoPuntualList from './GastoPuntualList';
import toast from 'react-hot-toast';

const GastosManager: React.FC = () => {
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'recurrentes' | 'puntuales'>('recurrentes');
  const [gastosRecurrentes, setGastosRecurrentes] = useState<GastoRecurrente[]>([]);
  const [gastosPuntuales, setGastosPuntuales] = useState<GastoPuntual[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMesActual, setTotalMesActual] = useState(0);
  
  // Form modals
  const [showRecurrenteForm, setShowRecurrenteForm] = useState(false);
  const [showPuntualForm, setShowPuntualForm] = useState(false);
  const [editingRecurrente, setEditingRecurrente] = useState<GastoRecurrente | null>(null);

  useEffect(() => {
    loadPersonalDataId();
  }, []);

  useEffect(() => {
    if (personalDataId) {
      loadGastos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalDataId]);

  const loadPersonalDataId = async () => {
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        setPersonalDataId(personalData.id);
      }
    } catch (error) {
      console.error('Error loading personal data ID:', error);
      toast.error('Error al cargar datos personales');
    }
  };

  const loadGastos = async () => {
    if (!personalDataId) return;
    
    setLoading(true);
    try {
      // Load recurring expenses
      const recurrentes = await gastosPersonalesService.getGastosRecurrentes(personalDataId);
      setGastosRecurrentes(recurrentes);

      // Load one-time expenses for current month
      const now = new Date();
      const mes = now.getMonth() + 1;
      const anio = now.getFullYear();
      const puntuales = await gastosPersonalesService.getGastosPuntuales(personalDataId, mes, anio);
      setGastosPuntuales(puntuales);

      // Calculate total for current month
      const total = await gastosPersonalesService.calcularTotalGastosMes(personalDataId, mes, anio);
      setTotalMesActual(total.total);
    } catch (error) {
      console.error('Error loading gastos:', error);
      toast.error('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecurrente = async (gasto: GastoRecurrente) => {
    try {
      if (gasto.id) {
        await gastosPersonalesService.updateGastoRecurrente(gasto.id, gasto);
        toast.success('Gasto recurrente actualizado');
      } else {
        await gastosPersonalesService.saveGastoRecurrente(gasto);
        toast.success('Gasto recurrente creado');
      }
      loadGastos();
      setShowRecurrenteForm(false);
      setEditingRecurrente(null);
    } catch (error) {
      console.error('Error saving gasto recurrente:', error);
      toast.error('Error al guardar gasto recurrente');
    }
  };

  const handleDeleteRecurrente = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este gasto recurrente?')) {
      return;
    }

    try {
      await gastosPersonalesService.deleteGastoRecurrente(id);
      toast.success('Gasto recurrente eliminado');
      loadGastos();
    } catch (error) {
      console.error('Error deleting gasto recurrente:', error);
      toast.error('Error al eliminar gasto recurrente');
    }
  };

  const handleToggleActivo = async (id: number) => {
    try {
      await gastosPersonalesService.toggleGastoRecurrenteActivo(id);
      toast.success('Estado actualizado');
      loadGastos();
    } catch (error) {
      console.error('Error toggling gasto recurrente:', error);
      toast.error('Error al actualizar estado');
    }
  };

  const handleSavePuntual = async (gasto: GastoPuntual) => {
    try {
      await gastosPersonalesService.saveGastoPuntual(gasto);
      toast.success('Gasto puntual registrado');
      loadGastos();
      setShowPuntualForm(false);
    } catch (error) {
      console.error('Error saving gasto puntual:', error);
      toast.error('Error al registrar gasto puntual');
    }
  };

  const handleDeletePuntual = async (id: number) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este gasto puntual?')) {
      return;
    }

    try {
      await gastosPersonalesService.deleteGastoPuntual(id);
      toast.success('Gasto puntual eliminado');
      loadGastos();
    } catch (error) {
      console.error('Error deleting gasto puntual:', error);
      toast.error('Error al eliminar gasto puntual');
    }
  };

  const handleEditRecurrente = (gasto: GastoRecurrente) => {
    setEditingRecurrente(gasto);
    setShowRecurrenteForm(true);
  };

  const handleCloseRecurrenteForm = () => {
    setShowRecurrenteForm(false);
    setEditingRecurrente(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent rounded-full"></div>
        <span className="ml-2 text-neutral-600">Cargando gastos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Gastos Personales</h2>
            <p className="text-sm text-gray-500 mt-1">
              Gestiona tus gastos recurrentes y puntuales
            </p>
          </div>
          <button
            onClick={() => activeTab === 'recurrentes' ? setShowRecurrenteForm(true) : setShowPuntualForm(true)}
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-md hover:bg-opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Gasto
          </button>
        </div>

        {/* Total del mes actual */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total mes actual</p>
          <p className="text-2xl font-semibold text-gray-900">
            {new Intl.NumberFormat('es-ES', { 
              style: 'currency', 
              currency: 'EUR' 
            }).format(totalMesActual)}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-white border border-gray-200">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('recurrentes')}
            className={`flex-1 px-6 py-3 text-sm font-medium ${
              activeTab === 'recurrentes'
                ? 'bg-gray-100 text-gray-900 border-b-2 border-gray-500'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Receipt className="w-4 h-4" />
              Recurrentes
            </div>
          </button>
          <button
            onClick={() => setActiveTab('puntuales')}
            className={`flex-1 px-6 py-3 text-sm font-medium ${
              activeTab === 'puntuales'
                ? 'bg-gray-100 text-gray-900 border-b-2 border-gray-500'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" />
              Puntuales
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'recurrentes' ? (
            <GastoRecurrenteList
              gastos={gastosRecurrentes}
              onEdit={handleEditRecurrente}
              onDelete={handleDeleteRecurrente}
              onToggleActivo={handleToggleActivo}
            />
          ) : (
            <GastoPuntualList
              gastos={gastosPuntuales}
              onDelete={handleDeletePuntual}
            />
          )}
        </div>
      </div>

      {/* Forms */}
      {showRecurrenteForm && personalDataId && (
        <GastoRecurrenteForm
          isOpen={showRecurrenteForm}
          onClose={handleCloseRecurrenteForm}
          onSave={handleSaveRecurrente}
          gasto={editingRecurrente}
          personalDataId={personalDataId}
        />
      )}

      {showPuntualForm && personalDataId && (
        <GastoPuntualForm
          isOpen={showPuntualForm}
          onClose={() => setShowPuntualForm(false)}
          onSave={handleSavePuntual}
          personalDataId={personalDataId}
        />
      )}
    </div>
  );
};

export default GastosManager;
