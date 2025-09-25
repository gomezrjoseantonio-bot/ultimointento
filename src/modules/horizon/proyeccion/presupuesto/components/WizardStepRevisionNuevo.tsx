import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Download } from 'lucide-react';
import { PresupuestoLinea } from '../../../../../services/db';
import { createPresupuesto, createPresupuestoLinea } from '../services/presupuestoService';
import ScopedBudgetView from './ScopedBudgetView';

interface WizardStepRevisionProps {
  year: number;
  wizardData: {
    scopes: ('PERSONAL' | 'INMUEBLES')[];
    startMonth: number;
    isFullYear: boolean;
    lines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[];
    name: string;
  };
  onComplete: () => void;
}

const WizardStepRevision: React.FC<WizardStepRevisionProps> = ({
  year,
  wizardData,
  onComplete
}) => {
  const [saving, setSaving] = useState(false);
  const [budgetName, setBudgetName] = useState(wizardData.name);

  // Add temporary IDs for display
  const linesWithIds = wizardData.lines.map((line, index) => ({
    ...line,
    id: `temp-${index}`,
    presupuestoId: 'temp'
  })) as PresupuestoLinea[];

  const handleSaveBudget = async () => {
    try {
      setSaving(true);

      // Validate budget name
      if (!budgetName.trim()) {
        toast.error('El nombre del presupuesto es obligatorio');
        return;
      }

      // Validate account assignments
      const linesWithoutAccount = wizardData.lines.filter(line => !line.accountId);
      if (linesWithoutAccount.length > 0) {
        const shouldContinue = window.confirm(
          `Hay ${linesWithoutAccount.length} líneas sin cuenta asignada. ¿Deseas continuar?`
        );
        if (!shouldContinue) return;
      }

      // Create presupuesto(s) based on selected scopes
      for (const scope of wizardData.scopes) {
        const presupuestoId = await createPresupuesto(year);
        
        // Filter lines for this scope
        const scopeLines = wizardData.lines.filter(line => line.scope === scope);
        
        // Create lines for this presupuesto
        for (const line of scopeLines) {
          await createPresupuestoLinea({
            ...line,
            presupuestoId
          });
        }

        console.log(`Created ${scope} presupuesto with ${scopeLines.length} lines`);
      }

      // Success
      toast.error('Presupuesto creado exitosamente');
      onComplete();
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error('Error al guardar el presupuesto. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = (scope: string) => {
    const scopeLines = scope === 'CONSOLIDADO' 
      ? wizardData.lines 
      : wizardData.lines.filter(line => line.scope === scope);

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
    link.setAttribute('download', `presupuesto_${scope}_${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateTotals = () => {
    const totalIncome = linesWithIds
      .filter(line => line.type === 'INGRESO')
      .reduce((sum, line) => sum + line.amountByMonth.reduce((lineSum, amount) => lineSum + (amount || 0), 0), 0);
    
    const totalExpenses = linesWithIds
      .filter(line => line.type === 'COSTE')
      .reduce((sum, line) => sum + line.amountByMonth.reduce((lineSum, amount) => lineSum + (amount || 0), 0), 0);

    return {
      income: totalIncome,
      expenses: totalExpenses,
      net: totalIncome - totalExpenses
    };
  };

  const totals = calculateTotals();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Revisión y Confirmación</h2>
        <p className="text-gray-600">
          Revisa el presupuesto antes de guardarlo. Una vez confirmado, se crearán los presupuestos para cada ámbito.
        </p>
      </div>

      {/* Budget Name */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Nombre del presupuesto</h3>
        <input
          type="text"
          value={budgetName}
          onChange={(e) => setBudgetName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Nombre del presupuesto"
          />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-success-50 border border-success-200 rounded-lg p-6">
          <h4 className="font-semibold text-success-900 mb-2">Total Ingresos</h4>
          <p className="text-2xl font-bold text-success-600">
            {new Intl.NumberFormat('es-ES', { 
              style: 'currency', 
              currency: 'EUR',
              minimumFractionDigits: 0
            }).format(totals.income)}
          </p>
        </div>

        <div className="bg-error-50 border border-error-200 rounded-lg p-6">
          <h4 className="font-semibold text-error-900 mb-2">Total Gastos</h4>
          <p className="text-2xl font-bold text-error-600">
            {new Intl.NumberFormat('es-ES', { 
              style: 'currency', 
              currency: 'EUR',
              minimumFractionDigits: 0
            }).format(totals.expenses)}
          </p>
        </div>

        <div className={`border rounded-lg p-6 ${
          totals.net >= 0 ? 'bg-primary-50 border-primary-200' : 'bg-warning-50 border-warning-200'
        }`}>
          <h4 className={`font-semibold mb-2 ${
            totals.net >= 0 ? 'text-primary-900' : 'text-warning-900'
          }`}>
            Neto Anual
          </h4>
          <p className={`text-2xl font-bold ${
            totals.net >= 0 ? 'text-primary-600' : 'text-warning-600'
          }`}>
            {new Intl.NumberFormat('es-ES', { 
              style: 'currency', 
              currency: 'EUR',
              minimumFractionDigits: 0
            }).format(totals.net)}
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="mb-8">
        <ScopedBudgetView
          year={year}
          scopes={wizardData.scopes}
          lines={linesWithIds}
          onExport={handleExportCSV}
        />
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => handleExportCSV('CONSOLIDADO')}
          className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Previsualizar CSV
        </button>

        <button
          onClick={handleSaveBudget}
          disabled={saving || !budgetName.trim()}
          className={`flex items-center px-8 py-3 rounded-lg font-medium transition-colors ${
            saving || !budgetName.trim()
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Confirmar Presupuesto
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-info-50 border border-info-200 rounded-lg p-4 mt-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 rounded-full bg-info-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">i</span>
            </div>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-info-900">Resultado de la creación</h4>
            <div className="text-sm text-info-800 mt-1">
              {wizardData.scopes.length === 1 && (
                <p>Se creará 1 presupuesto para {wizardData.scopes[0]}.</p>
              )}
              {wizardData.scopes.length === 2 && (
                <p>Se crearán 2 presupuestos: uno para PERSONAL, otro para INMUEBLES, y tendrás la vista CONSOLIDADO disponible.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WizardStepRevision;