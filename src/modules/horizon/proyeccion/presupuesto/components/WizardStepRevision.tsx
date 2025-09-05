import React, { useState } from 'react';
import { CheckCircle, Save, FileText, AlertCircle } from 'lucide-react';
import { WizardData } from './BudgetWizard';
import { createBudget, createBudgetLines, generateNextVersion, getBudgetsByYear, calculateBudgetTotals, calculateMonthlyAmounts } from '../services/budgetService';
import { formatEuro } from '../../../../../utils/formatUtils';

interface WizardStepRevisionProps {
  year: number;
  wizardData: WizardData;
  onComplete: () => void;
}

const WizardStepRevision: React.FC<WizardStepRevisionProps> = ({
  year,
  wizardData,
  onComplete
}) => {
  const [saving, setSaving] = useState(false);
  const [budgetName, setBudgetName] = useState(wizardData.name);

  // Calculate totals for review
  const totals = calculateBudgetTotals(wizardData.lines as any);
  const monthNames = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  const handleSaveBudget = async () => {
    try {
      setSaving(true);
      
      // Get existing budgets to determine version
      const existingBudgets = await getBudgetsByYear(year);
      const existingVersions = existingBudgets.map(b => b.version);
      const version = generateNextVersion(existingVersions);

      // Create budget
      const budgetId = await createBudget({
        year,
        version,
        name: budgetName,
        scope: wizardData.scope,
        status: 'confirmed',
        isLocked: true,
        lines: [],
        totals,
      });

      // Create budget lines with proper monthly calculations
      const linesWithBudgetId = wizardData.lines.map(line => ({
        ...line,
        budgetId,
        monthlyAmounts: calculateMonthlyAmounts(
          line.amount,
          line.frequency,
          line.startMonth,
          line.installments
        )
      }));

      await createBudgetLines(linesWithBudgetId);

      onComplete();
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Error al guardar el presupuesto. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const incomeLines = wizardData.lines.filter(l => l.category === 'ingresos-alquiler');
  const expenseLines = wizardData.lines.filter(l => l.category !== 'ingresos-alquiler');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Revisión y Confirmación</h2>
        <p className="text-gray-600">
          Revisa el presupuesto antes de guardarlo. Una vez confirmado, quedará bloqueado como versión estable.
        </p>
      </div>

      {/* Budget Name */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Nombre del presupuesto</h3>
        <input
          type="text"
          value={budgetName}
          onChange={(e) => setBudgetName(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder={`Presupuesto ${year}`}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-3">
            <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
            <h3 className="font-semibold text-green-900">Ingresos Anuales</h3>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {formatEuro(totals.annualIncome)}
          </div>
          <div className="text-sm text-green-700">
            {incomeLines.length} partidas de ingresos
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center mb-3">
            <AlertCircle className="h-6 w-6 text-red-600 mr-2" />
            <h3 className="font-semibold text-red-900">Gastos Anuales</h3>
          </div>
          <div className="text-2xl font-bold text-red-900">
            {formatEuro(totals.annualExpenses)}
          </div>
          <div className="text-sm text-red-700">
            {expenseLines.length} partidas de gastos
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center mb-3">
            <FileText className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="font-semibold text-blue-900">Resultado Anual</h3>
          </div>
          <div className={`text-2xl font-bold ${
            totals.annualIncome - totals.annualExpenses >= 0 
              ? 'text-green-900' 
              : 'text-red-900'
          }`}>
            {formatEuro(totals.annualIncome - totals.annualExpenses)}
          </div>
          <div className="text-sm text-blue-700">
            Beneficio/pérdida estimado
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Desglose Mensual</h3>
          <p className="text-sm text-gray-600">Distribución de ingresos y gastos por mes</p>
        </div>
        
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-sm font-medium text-gray-600 pb-2">Mes</th>
                  {monthNames.map((month, index) => (
                    <th key={index} className="text-right text-sm font-medium text-gray-600 pb-2 px-2">
                      {month}
                    </th>
                  ))}
                  <th className="text-right text-sm font-medium text-gray-600 pb-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                <tr className="border-b border-gray-100">
                  <td className="text-sm font-medium text-green-900 py-2">Ingresos</td>
                  {totals.monthlyBreakdown.income.map((amount, index) => (
                    <td key={index} className="text-right text-sm text-green-700 py-2 px-2">
                      {amount > 0 ? formatEuro(amount) : '-'}
                    </td>
                  ))}
                  <td className="text-right text-sm font-semibold text-green-900 py-2 px-2">
                    {formatEuro(totals.annualIncome)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="text-sm font-medium text-red-900 py-2">Gastos</td>
                  {totals.monthlyBreakdown.expenses.map((amount, index) => (
                    <td key={index} className="text-right text-sm text-red-700 py-2 px-2">
                      {amount > 0 ? formatEuro(amount) : '-'}
                    </td>
                  ))}
                  <td className="text-right text-sm font-semibold text-red-900 py-2 px-2">
                    {formatEuro(totals.annualExpenses)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="text-sm font-medium text-gray-900 py-2">Resultado</td>
                  {totals.monthlyBreakdown.result.map((amount, index) => (
                    <td key={index} className={`text-right text-sm font-medium py-2 px-2 ${
                      amount >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {formatEuro(amount)}
                    </td>
                  ))}
                  <td className={`text-right text-sm font-semibold py-2 px-2 ${
                    totals.annualIncome - totals.annualExpenses >= 0 ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {formatEuro(totals.annualIncome - totals.annualExpenses)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={handleSaveBudget}
          disabled={saving || !budgetName.trim()}
          className={`flex items-center px-8 py-3 rounded-lg font-medium transition-colors ${
            saving || !budgetName.trim()
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
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
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
          <div>
            <h4 className="font-medium text-yellow-900">Importante</h4>
            <p className="text-sm text-yellow-800 mt-1">
              Una vez confirmado, el presupuesto quedará bloqueado como versión estable. 
              Los cambios futuros en contratos no lo afectarán automáticamente. 
              Para incorporar cambios, deberás crear una nueva versión.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WizardStepRevision;