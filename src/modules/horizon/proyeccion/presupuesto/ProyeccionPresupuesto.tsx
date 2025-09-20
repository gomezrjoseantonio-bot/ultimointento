import React, { useState, useEffect } from 'react';
import { Calculator, Plus, FileText, TrendingUp } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import BudgetWizard from './components/BudgetWizard';
import BudgetList from './components/BudgetList';
import { Budget } from '../../../../services/db';
import { getBudgetsByYear } from './services/budgetService';

const ProyeccionPresupuesto: React.FC = () => {
  const [showWizard, setShowWizard] = useState(false);
  const [currentYear] = useState(new Date().getFullYear());
  const [existingBudgets, setExistingBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBudgets();
  }, [currentYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const budgets = await getBudgetsByYear(currentYear);
      setExistingBudgets(budgets);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    loadBudgets(); // Refresh budget list
  };

  const handleCreateBudget = () => {
    setShowWizard(true);
  };

  if (showWizard) {
    return (
      <BudgetWizard
        year={currentYear}
        onComplete={handleWizardComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <PageLayout 
      title="Presupuesto Anual" 
      subtitle="Gestión de presupuestos con gastos deducibles y frecuencias"
    >
      <div className="space-y-6">
        {renderPresupuestoContent()}
      </div>
    </PageLayout>
  );

  function renderPresupuestoContent() {
    return (
      <>
        {/* Header Action */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="btn-primary-horizon p-3">
              <Calculator className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Presupuesto {currentYear}
              </h1>
              <p className="text-gray-600">
                Presupuesto anual estable con partidas fiscales deducibles
              </p>
            </div>
          </div>
          
          <button
            onClick={handleCreateBudget}
            className="btn-primary-horizon flex items-center space-x-2 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            <span>Crear Presupuesto {currentYear}</span>
          </button>
        </div>

        {/* Budget List or Empty State */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="btn-secondary-horizon animate-spin h-8 w-8 "></div>
          </div>
        ) : existingBudgets.length > 0 ? (
          <BudgetList 
            budgets={existingBudgets} 
            onRefresh={loadBudgets}
          />
        ) : (
          <div className="text-center py-12 bg-gray-50">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay presupuestos para {currentYear}
            </h3>
            <p className="text-gray-600 mb-6">
              Crea tu primer presupuesto anual para gestionar ingresos y gastos deducibles
            </p>
            <button
              onClick={handleCreateBudget}
              className="btn-primary-horizon inline-flex items-center space-x-2 px-6 py-3"
            >
              <Plus className="h-5 w-5" />
              <span>Crear Presupuesto {currentYear}</span>
            </button>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 border border-gray-200">
            <div className="flex items-center space-x-3 mb-3">
              <Calculator className="h-5 w-5 text-success-600" />
              <h3 className="font-semibold text-gray-900">Categorías Fiscales</h3>
            </div>
            <p className="text-sm text-gray-600">
              Partidas alineadas con las categorías deducibles de Hacienda para una gestión fiscal óptima.
            </p>
          </div>

          <div className="bg-white p-6 border border-gray-200">
            <div className="flex items-center space-x-3 mb-3">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">Frecuencias de Pago</h3>
            </div>
            <p className="text-sm text-gray-600">
              Control preciso de periodicidad: mensual, trimestral, anual, fraccionado o único.
            </p>
          </div>

          <div className="bg-white p-6 border border-gray-200">
            <div className="flex items-center space-x-3 mb-3">
              <FileText className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Versionado</h3>
            </div>
            <p className="text-sm text-gray-600">
              Sistema de versiones estables. Una vez confirmado, el presupuesto se mantiene hasta crear una nueva versión.
            </p>
          </div>
        </div>
      </>
    );
  }
};

export default ProyeccionPresupuesto;