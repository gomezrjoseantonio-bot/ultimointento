import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Plus } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import BudgetWizard from './components/BudgetWizard';
import ScopedBudgetView from './components/ScopedBudgetView';
import { Presupuesto, PresupuestoLinea } from '../../../../services/db';
import { getPresupuestosByYear, getPresupuestoLineas } from './services/presupuestoService';

const PresupuestoScopeView: React.FC = () => {
  const [showWizard, setShowWizard] = useState(false);
  const [currentYear] = useState(new Date().getFullYear());
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [allLines, setAllLines] = useState<PresupuestoLinea[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPresupuestos = useCallback(async () => {
    try {
      setLoading(true);
      const presupuestosAno = await getPresupuestosByYear(currentYear);
      setPresupuestos(presupuestosAno);
      
      // Load all lines for all presupuestos
      const allLineas: PresupuestoLinea[] = [];
      for (const presupuesto of presupuestosAno) {
        const lineas = await getPresupuestoLineas(presupuesto.id);
        allLineas.push(...lineas);
      }
      setAllLines(allLineas);
    } catch (error) {
      console.error('Error loading presupuestos:', error);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    loadPresupuestos();
  }, [loadPresupuestos]);

  const handleWizardComplete = () => {
    setShowWizard(false);
    loadPresupuestos(); // Refresh budget list
  };

  const handleCreateBudget = () => {
    setShowWizard(true);
  };

  const getAvailableScopes = (): ('PERSONAL' | 'INMUEBLES')[] => {
    const scopes = new Set<'PERSONAL' | 'INMUEBLES'>();
    allLines.forEach(line => {
      if (line.scope === 'PERSONAL' || line.scope === 'INMUEBLES') {
        scopes.add(line.scope);
      }
    });
    return Array.from(scopes);
  };

  const handleLinesChange = (updatedLines: PresupuestoLinea[]) => {
    setAllLines(updatedLines);
    // TODO: Save changes to database
  };

  const handleAddLine = (scope: 'PERSONAL' | 'INMUEBLES') => {
    const newLine: PresupuestoLinea = {
      id: `temp-${Date.now()}`,
      presupuestoId: 'temp', // Will be assigned when saved
      scope,
      type: 'COSTE',
      category: 'Otros',
      label: 'Nueva línea',
      amountByMonth: new Array(12).fill(0)
    };
    setAllLines([...allLines, newLine]);
  };

  const handleExport = (scope: string) => {
    const scopeLines = scope === 'CONSOLIDADO' 
      ? allLines 
      : allLines.filter(line => line.scope === scope);

    const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 
                       'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    let csv = 'Ámbito,Tipo,Categoría,Subcategoría,Descripción,Proveedor,Cuenta,' + 
              monthNames.join(',') + ',Total Anual\n';

    scopeLines.forEach(line => {
      const totalAnual = line.amountByMonth.reduce((sum, amount) => sum + (amount || 0), 0);
      const row = [
        line.scope,
        line.type,
        line.category,
        line.subcategory || '',
        line.label,
        line.counterpartyName || '',
        line.accountId || '',
        ...line.amountByMonth.map(amount => (amount || 0).toFixed(2)),
        totalAnual.toFixed(2)
      ].join(',');
      csv += row + '\n';
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `presupuesto_${scope}_${currentYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  if (loading) {
    return (
      <PageLayout 
        title="Presupuesto Anual" 
        subtitle="Gestión de presupuestos con ámbitos PERSONAL e INMUEBLES"
      >
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </PageLayout>
    );
  }

  // If no presupuestos exist, show create button
  if (presupuestos.length === 0) {
    return (
      <PageLayout 
        title="Presupuesto Anual" 
        subtitle="Gestión de presupuestos con ámbitos PERSONAL e INMUEBLES"
      >
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay presupuestos para {currentYear}
          </h3>
          <p className="text-gray-600 mb-6">
            Crea tu primer presupuesto anual con ámbitos PERSONAL e INMUEBLES
          </p>
          <button
            onClick={handleCreateBudget}
            className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Crear Presupuesto {currentYear}</span>
          </button>
        </div>
      </PageLayout>
    );
  }

  const availableScopes = getAvailableScopes();

  return (
    <PageLayout 
      title="Presupuesto Anual" 
      subtitle="Gestión de presupuestos con ámbitos PERSONAL e INMUEBLES"
    >
      <div className="space-y-6">
        {/* Main budget view */}
        {availableScopes.length > 0 ? (
          <ScopedBudgetView
            year={currentYear}
            scopes={availableScopes}
            lines={allLines}
            onLinesChange={handleLinesChange}
            onAddLine={handleAddLine}
            onExport={handleExport}
          />
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Presupuestos sin líneas
            </h3>
            <p className="text-gray-600 mb-6">
              Los presupuestos existen pero no tienen líneas de ingresos/gastos definidas
            </p>
            <button
              onClick={handleCreateBudget}
              className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Recrear Presupuesto {currentYear}</span>
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default PresupuestoScopeView;