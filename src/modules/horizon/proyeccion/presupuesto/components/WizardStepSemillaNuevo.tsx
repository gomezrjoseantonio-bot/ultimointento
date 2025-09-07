import React, { useState, useEffect } from 'react';
import { ChevronRight, Loader } from 'lucide-react';
import { PresupuestoLinea } from '../../../../../services/db';
import { generateScopeSeed, ScopeSeededData } from '../services/scopeSeedService';

interface WizardStepSemillaProps {
  year: number;
  scopes: ('PERSONAL' | 'INMUEBLES')[];
  startMonth: number;
  isFullYear: boolean;
  initialLines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[];
  onComplete: (lines: Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[]) => void;
}

const WizardStepSemilla: React.FC<WizardStepSemillaProps> = ({
  year,
  scopes,
  startMonth,
  isFullYear,
  initialLines,
  onComplete
}) => {
  const [lines, setLines] = useState<Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[]>(initialLines);
  const [loading, setLoading] = useState(false);
  const [seededData, setSeededData] = useState<ScopeSeededData[]>([]);

  useEffect(() => {
    if (lines.length === 0) {
      generateSeed();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generateSeed = async () => {
    try {
      setLoading(true);
      const seedData = await generateScopeSeed(year, scopes, isFullYear, startMonth);
      setSeededData(seedData);
      
      // Flatten all lines from all scopes
      const allLines = seedData.reduce((acc, scopeData) => {
        return [...acc, ...scopeData.lines];
      }, [] as Omit<PresupuestoLinea, 'id' | 'presupuestoId'>[]);
      
      setLines(allLines);
    } catch (error) {
      console.error('Error generating seed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    onComplete(lines);
  };

  const getScopeStats = (scope: 'PERSONAL' | 'INMUEBLES') => {
    const scopeLines = lines.filter(line => line.scope === scope);
    const incomeLines = scopeLines.filter(line => line.type === 'INGRESO');
    const expenseLines = scopeLines.filter(line => line.type === 'COSTE');
    
    const totalIncome = incomeLines.reduce((sum, line) => 
      sum + line.amountByMonth.reduce((lineSum, amount) => lineSum + (amount || 0), 0), 0
    );
    
    const totalExpenses = expenseLines.reduce((sum, line) => 
      sum + line.amountByMonth.reduce((lineSum, amount) => lineSum + (amount || 0), 0), 0
    );

    return {
      incomeLines: incomeLines.length,
      expenseLines: expenseLines.length,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader className="h-6 w-6 animate-spin text-primary-600" />
          <span className="text-gray-600">Generando semilla automática...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Semilla Automática</h2>
        <p className="text-gray-600">
          Hemos precargado automáticamente los datos base desde contratos, préstamos e históricos para los ámbitos seleccionados.
        </p>
      </div>

      {/* Scope-based breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {scopes.map(scope => {
          const stats = getScopeStats(scope);
          const scopeData = seededData.find(d => d.scope === scope);
          
          return (
            <div key={scope} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className={`p-3 rounded-lg ${
                  scope === 'PERSONAL' ? 'bg-primary-100' : 'bg-success-100'
                }`}>
                  <span className={`text-lg font-bold ${
                    scope === 'PERSONAL' ? 'text-primary-600' : 'text-success-600'
                  }`}>
                    {scope === 'PERSONAL' ? '👤' : '🏠'}
                  </span>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">{scope}</h3>
                  <p className="text-sm text-gray-600">
                    {stats.incomeLines} ingresos, {stats.expenseLines} gastos
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Ingresos:</span>
                  <span className="font-medium text-success-600">
                    {new Intl.NumberFormat('es-ES', { 
                      style: 'currency', 
                      currency: 'EUR',
                      minimumFractionDigits: 0
                    }).format(stats.totalIncome)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Gastos:</span>
                  <span className="font-medium text-error-600">
                    {new Intl.NumberFormat('es-ES', { 
                      style: 'currency', 
                      currency: 'EUR',
                      minimumFractionDigits: 0
                    }).format(stats.totalExpenses)}
                  </span>
                </div>
                
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium text-gray-900">Neto Anual:</span>
                  <span className={`font-bold ${
                    stats.net >= 0 ? 'text-success-600' : 'text-error-600'
                  }`}>
                    {new Intl.NumberFormat('es-ES', { 
                      style: 'currency', 
                      currency: 'EUR',
                      minimumFractionDigits: 0
                    }).format(stats.net)}
                  </span>
                </div>
              </div>

              {/* Sample lines preview */}
              {scopeData && scopeData.lines.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Líneas generadas (muestra):</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {scopeData.lines.slice(0, 5).map((line, index) => (
                      <div key={index} className="text-xs text-gray-600 flex justify-between">
                        <span className="truncate pr-2">{line.label}</span>
                        <span className={`font-medium ${
                          line.type === 'INGRESO' ? 'text-success-600' : 'text-error-600'
                        }`}>
                          {line.type === 'INGRESO' ? '+' : '-'}
                          {new Intl.NumberFormat('es-ES', { 
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(
                            line.amountByMonth.reduce((sum, amount) => sum + (amount || 0), 0)
                          )}€
                        </span>
                      </div>
                    ))}
                    {scopeData.lines.length > 5 && (
                      <div className="text-xs text-gray-500 italic">
                        ... y {scopeData.lines.length - 5} líneas más
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Information about next steps */}
      <div className="bg-info-50 border border-info-200 rounded-lg p-6 mb-8">
        <h4 className="font-semibold text-info-900 mb-2">Próximos pasos</h4>
        <div className="text-sm text-info-800 space-y-1">
          <p>• En el siguiente paso podrás ajustar importes y configurar cuentas de cargo/abono</p>
          <p>• Las líneas con importe 0 necesitarán ser completadas manualmente</p>
          <p>• Podrás añadir líneas adicionales o eliminar las que no necesites</p>
          {scopes.length === 2 && (
            <p>• Al final tendrás tres vistas: PERSONAL, INMUEBLES y CONSOLIDADO</p>
          )}
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Continuar a configuración
          <ChevronRight className="h-4 w-4 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default WizardStepSemilla;