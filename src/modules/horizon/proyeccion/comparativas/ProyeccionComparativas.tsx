import React, { useState, useEffect } from 'react';
import { Download, TrendingUp, Edit } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { formatEuro, formatPercentage } from '../../../../utils/formatUtils';

// Temporary mock data - in real implementation would come from scenario service
interface ComparisonScenario {
  id: number;
  name: string;
  mode: 'diy' | 'strategies' | 'objectives';
  kpis: {
    cashflow5Y: number;
    cashflow20Y: number;
    netWorth20Y: number;
    avgDSCR: number;
    minDSCR: number;
    assumedVacancy: number;
    assumedAppreciation: number;
    assumedRentGrowth: number;
    remainingDebt20Y: number;
  };
  yearlyData: Array<{
    year: number;
    netCashflow: number;
    netWorth: number;
  }>;
}

interface ProyeccionComparativasProps {
  isEmbedded?: boolean;
}

const ProyeccionComparativas: React.FC<ProyeccionComparativasProps> = ({ isEmbedded = false }): React.ReactElement => {
  const [markedScenarios, setMarkedScenarios] = useState<ComparisonScenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarkedScenarios();
  }, []);

  const loadMarkedScenarios = async () => {
    try {
      setLoading(true);
      
      // Temporary mock data - would be loaded from scenario service
      const mockScenarios: ComparisonScenario[] = [
        {
          id: 1,
          name: 'Escenario diy 1',
          mode: 'diy',
          kpis: {
            cashflow5Y: 15600,
            cashflow20Y: 48000,
            netWorth20Y: 650000,
            avgDSCR: 1.85,
            minDSCR: 1.42,
            assumedVacancy: 5.0,
            assumedAppreciation: 4.0,
            assumedRentGrowth: 3.5,
            remainingDebt20Y: 125000
          },
          yearlyData: Array.from({ length: 21 }, (_, i) => ({
            year: 2025 + i,
            netCashflow: 15000 + (i * 2000),
            netWorth: 300000 + (i * 17500)
          }))
        }
      ];
      
      setMarkedScenarios(mockScenarios);
    } catch (error) {
      console.error('Error loading marked scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export functionality
    alert('Exportar comparativa a PDF - Funcionalidad por implementar');
  };

  const handleEditScenario = (scenarioId: number) => {
    // Navigate to simulaciones tab with selected scenario
    window.location.href = `/proyeccion/simulaciones`;
  };

  if (loading) {
    const content = (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div>
      </div>
    );

    if (isEmbedded) return content;

    return (
      <PageLayout title="Comparativas" subtitle="Cargando comparativa...">
        {content}
      </PageLayout>
    );
  }

  // Show message when no scenarios are marked for comparison
  if (markedScenarios.length === 0) {
    const content = (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Proyección</h1>
          </div>
          <button
            onClick={handleExportPDF}
            disabled
            className="flex items-center space-x-2 bg-gray-300 text-gray-500 px-4 py-2 rounded-xl cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            <span>Exportar comparativa (PDF)</span>
          </button>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-xl border border-[#D7DEE7] p-12 shadow-sm text-center">
          <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-4">
            No hay escenarios para comparar
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Marca hasta 3 escenarios en Simulaciones para compararlos aquí. 
            Los escenarios marcados aparecerán automáticamente en esta vista.
          </p>
          <button
            onClick={() => window.location.href = '/proyeccion/simulaciones'}
            className="bg-primary-700 text-white px-6 py-3 rounded-xl hover:bg-[#1a365d] transition-colors"
          >
            Ir a Simulaciones
          </button>
        </div>
      </div>
    );

    if (isEmbedded) return content;

    return (
      <PageLayout title="Comparativas" subtitle="Comparar hasta 3 escenarios marcados en Simulaciones">
        {content}
      </PageLayout>
    );
  }

  // Show comparison when 1+ scenarios are marked
  const content = (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Proyección</h1>
          </div>
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-2 bg-primary-700 text-white px-4 py-2 rounded-xl hover:bg-[#1a365d] transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Exportar comparativa (PDF)</span>
          </button>
        </div>

        {/* Scenario Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markedScenarios.map((scenario, index) => (
            <div key={scenario.id} className="bg-white rounded-xl border border-[#D7DEE7] p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-neutral-900">{scenario.name}</h3>
                  <p className="text-sm text-gray-500">
                    {scenario.mode === 'diy' && 'DIY'}
                    {scenario.mode === 'strategies' && 'Estrategia'}
                    {scenario.mode === 'objectives' && 'Objetivo'}
                  </p>
                </div>
                <button
                  onClick={() => handleEditScenario(scenario.id)}
                  className="p-2 text-gray-500 hover:text-primary-700 hover:bg-[#F8F9FA] rounded-lg transition-colors"
                  title="Editar escenario"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-primary-700">
                  {formatEuro(scenario.kpis.netWorth20Y)}
                </div>
                <div className="text-sm text-gray-500">Patrimonio 20a</div>
              </div>
            </div>
          ))}
          
          {/* Show placeholders for remaining slots */}
          {Array.from({ length: 3 - markedScenarios.length }).map((_, index) => (
            <div 
              key={`placeholder-${index}`}
              className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-4 flex items-center justify-center"
            >
              <div className="text-center text-gray-500">
                <p className="text-sm">Escenario {markedScenarios.length + index + 1}</p>
                <p className="text-xs">Sin marcar</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cashflow Comparison Chart */}
          <div className="bg-white rounded-xl border border-[#D7DEE7] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Comparativa de Flujo Neto
            </h3>
            <div className="h-64 bg-[#F8F9FA] rounded-lg flex items-center justify-center border-2 border-dashed border-[#D7DEE7]">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Gráfico de flujo neto superpuesto</p>
                <p className="text-sm text-gray-400">20 años - {markedScenarios.length} escenarios</p>
              </div>
            </div>
          </div>

          {/* Net Worth Comparison Chart */}
          <div className="bg-white rounded-xl border border-[#D7DEE7] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Comparativa de Patrimonio Neto
            </h3>
            <div className="h-64 bg-[#F8F9FA] rounded-lg flex items-center justify-center border-2 border-dashed border-[#D7DEE7]">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Gráfico de patrimonio superpuesto</p>
                <p className="text-sm text-gray-400">20 años - {markedScenarios.length} escenarios</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Comparison Table */}
        <div className="bg-white rounded-xl border border-[#D7DEE7] p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900 mb-6">
            Tabla KPI Comparativa
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D7DEE7]">
                  <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">KPI</th>
                  {markedScenarios.map((scenario, index) => (
                    <th key={scenario.id} className="text-center text-sm font-medium text-gray-500 py-3 px-4">
                      Escenario {String.fromCharCode(65 + index)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#F3F4F6]">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">Cashflow 5a</td>
                  {markedScenarios.map(scenario => (
                    <td key={scenario.id} className="py-3 px-4 text-center text-sm text-neutral-900 tabular-nums">
                      {formatEuro(scenario.kpis.cashflow5Y)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#F3F4F6]">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">Cashflow 20a</td>
                  {markedScenarios.map(scenario => (
                    <td key={scenario.id} className="py-3 px-4 text-center text-sm text-neutral-900 tabular-nums">
                      {formatEuro(scenario.kpis.cashflow20Y)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#F3F4F6]">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">Patrimonio 20a</td>
                  {markedScenarios.map(scenario => (
                    <td key={scenario.id} className="py-3 px-4 text-center text-sm text-neutral-900 tabular-nums">
                      {formatEuro(scenario.kpis.netWorth20Y)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#F3F4F6]">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">DSCR mínimo</td>
                  {markedScenarios.map(scenario => (
                    <td key={scenario.id} className="py-3 px-4 text-center text-sm text-neutral-900 tabular-nums">
                      {scenario.kpis.minDSCR.toFixed(2)} x
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#F3F4F6]">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">% vacancia asumida</td>
                  {markedScenarios.map(scenario => (
                    <td key={scenario.id} className="py-3 px-4 text-center text-sm text-neutral-900 tabular-nums">
                      {formatPercentage(scenario.kpis.assumedVacancy / 100)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#F3F4F6]">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">% revalorización</td>
                  {markedScenarios.map(scenario => (
                    <td key={scenario.id} className="py-3 px-4 text-center text-sm text-neutral-900 tabular-nums">
                      {formatPercentage(scenario.kpis.assumedAppreciation / 100)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[#F3F4F6]">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">% rentas</td>
                  {markedScenarios.map(scenario => (
                    <td key={scenario.id} className="py-3 px-4 text-center text-sm text-neutral-900 tabular-nums">
                      {formatPercentage(scenario.kpis.assumedRentGrowth / 100)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">Deuda remanente 20a</td>
                  {markedScenarios.map(scenario => (
                    <td key={scenario.id} className="py-3 px-4 text-center text-sm text-neutral-900 tabular-nums">
                      {formatEuro(scenario.kpis.remainingDebt20Y)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Additional Actions */}
        <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#D7DEE7]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Comparando {markedScenarios.length} de 3 escenarios posibles
              </p>
              <p className="text-xs text-gray-500">
                Marca o desmarca escenarios en la sección Simulaciones para actualizar esta comparativa
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/proyeccion/simulaciones'}
              className="text-sm text-primary-700 hover:text-primary-800 font-medium"
            >
              Gestionar escenarios →
            </button>
          </div>
        </div>
      </div>
    );

    if (isEmbedded) return content;

    return (
      <PageLayout title="Comparativas" subtitle="Comparar hasta 3 escenarios marcados en Simulaciones">
        {content}
      </PageLayout>
    );
};

export default ProyeccionComparativas;