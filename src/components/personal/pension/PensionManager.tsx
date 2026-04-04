import React, { useState, useEffect } from 'react';
import { pensionService } from '../../../services/pensionService';
import { personalDataService } from '../../../services/personalDataService';
import { PensionIngreso, CalculoPensionResult } from '../../../types/personal';
import PensionForm from './PensionForm';
import { Plus, Edit2, Trash2, PiggyBank } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../../services/confirmationService';

const TIPO_PENSION_LABELS: Record<string, string> = {
  jubilacion: 'Jubilación',
  viudedad: 'Viudedad',
  incapacidad: 'Incapacidad',
  orfandad: 'Orfandad',
};

const PensionManager: React.FC = () => {
  const [pensiones, setPensiones] = useState<PensionIngreso[]>([]);
  const [calculos, setCalculos] = useState<Map<number, CalculoPensionResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPension, setEditingPension] = useState<PensionIngreso | null>(null);
  const [userName, setUserName] = useState<string>('Yo');
  const [spouseName, setSpouseName] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        const data = await pensionService.getPensiones(personalData.id);
        setPensiones(data);

        const calculosMap = new Map<number, CalculoPensionResult>();
        data.forEach(p => {
          if (p.id) {
            calculosMap.set(p.id, pensionService.calculatePension(p));
          }
        });
        setCalculos(calculosMap);

        setUserName(personalData.nombre || 'Yo');
        if (personalData.spouseName) {
          setSpouseName(personalData.spouseName);
        }
      }
    } catch (error) {
      console.error('Error loading pensiones:', error);
      toast.error('Error al cargar las pensiones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPension(null);
    setShowForm(true);
  };

  const handleEdit = (pension: PensionIngreso) => {
    setEditingPension(pension);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDelete('esta pensión');
    if (!confirmed) return;

    try {
      await pensionService.deletePension(id);
      toast.success('Pensión eliminada correctamente');
      loadData();
    } catch (error) {
      console.error('Error deleting pension:', error);
      toast.error('Error al eliminar la pensión');
    }
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingPension(null);
    loadData();
  };

  const getTitularLabel = (titular: 'yo' | 'pareja') => {
    if (titular === 'yo') return userName;
    return spouseName || 'Pareja';
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

  const activasPensiones = pensiones.filter(p => p.activa);

  const getTotals = () => {
    let brutoAnual = 0;
    let netoAnual = 0;
    activasPensiones.forEach(p => {
      brutoAnual += p.pensionBrutaAnual;
      if (p.id) {
        const calc = calculos.get(p.id);
        if (calc) netoAnual += calc.netoAnual;
      }
    });
    return { brutoAnual, netoAnual, netoMensual: netoAnual / 12 };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
        <span className="ml-2 text-neutral-600">Cargando pensiones...</span>
      </div>
    );
  }

  const totals = getTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Gestión de Pensiones</h3>
          <p className="text-gray-500">Configura y gestiona tus ingresos por pensiones</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 btn-primary text-white text-sm font-medium rounded-md shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Pensión
        </button>
      </div>

      {/* Summary for active pensions */}
      {activasPensiones.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-gradient-to-r from-primary-50 to-primary-100 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <PiggyBank className="w-5 h-5 text-atlas-blue" />
            <h4 className="text-lg font-semibold text-primary-900">Resumen de Pensiones</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-md bg-white p-4 shadow-sm border border-neutral-100">
              <p className="text-xs uppercase text-atlas-blue font-medium tracking-wide">Bruto Anual</p>
              <p className="text-2xl font-bold text-primary-900 mt-1">{formatCurrency(totals.brutoAnual)}</p>
            </div>
            <div className="rounded-md bg-white p-4 shadow-sm" style={{ border: '2px solid var(--teal-600, #1DA0BA)' }}>
              <p className="text-xs uppercase text-atlas-blue font-medium tracking-wide">Neto Mensual Promedio</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--teal-600, #1DA0BA)' }}>{formatCurrency(totals.netoMensual)}</p>
              <p className="text-xs text-neutral-500 mt-1">Total anual neto / 12</p>
            </div>
            <div className="rounded-md bg-white p-4 shadow-sm border border-neutral-100">
              <p className="text-xs uppercase text-atlas-blue font-medium tracking-wide">Neto Anual</p>
              <p className="text-2xl font-bold text-primary-900 mt-1">{formatCurrency(totals.netoAnual)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pension list */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Todas las Pensiones</h4>

        {pensiones.length === 0 ? (
          <div className="text-center py-8">
            <PiggyBank className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pensiones configuradas</h3>
            <p className="mt-1 text-sm text-gray-500">
              Crea tu primera pensión para registrar tus ingresos de pensión.
            </p>
            <div className="mt-6">
              <button
                onClick={handleCreate}
                className="inline-flex items-center px-4 py-2 btn-primary text-white text-sm font-medium rounded-md shadow-sm hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Pensión
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pensiones.map(pension => {
              const calc = pension.id ? calculos.get(pension.id) : null;
              return (
                <div
                  key={pension.id}
                  className={`rounded-md border ${pension.activa ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-white'}`}
                >
                  <div className="flex items-center px-4 py-3 space-x-4">
                    {/* Type and titular */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h5 className={`font-medium text-sm ${pension.activa ? 'text-primary-900' : 'text-gray-900'}`}>
                          {TIPO_PENSION_LABELS[pension.tipoPension] || pension.tipoPension}
                        </h5>
                        {pension.activa && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-primary-800 bg-primary-200 rounded">
                            Activa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Titular: {getTitularLabel(pension.titular)}</p>
                    </div>

                    {/* Bruto anual */}
                    <div className="flex-shrink-0 w-32 text-sm">
                      <span className="text-gray-900 font-medium">{formatCurrency(pension.pensionBrutaAnual)}</span>
                      <p className="text-xs text-gray-500">bruto/año</p>
                    </div>

                    {/* Neto mensual */}
                    <div className="flex-shrink-0 w-32 text-sm">
                      <span className="text-gray-600">{calc ? formatCurrency(calc.netoMensual) : '-'}/mes</span>
                      <p className="text-xs text-gray-500">neto estimado</p>
                    </div>

                    {/* Pagas */}
                    <div className="flex-shrink-0 w-20 text-sm text-gray-600">
                      {pension.numeroPagas} pagas
                    </div>

                    {/* IRPF */}
                    <div className="flex-shrink-0 w-20 text-sm text-gray-600">
                      IRPF {pension.irpfPorcentaje}%
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(pension)}
                        className="p-2 text-gray-400 hover:text-atlas-blue"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(pension.id!)}
                        className="p-2 text-gray-400 hover:text-error-600"
                        title="Eliminar"
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

      {/* Form modal */}
      <PensionForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingPension(null);
        }}
        pension={editingPension}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default PensionManager;
