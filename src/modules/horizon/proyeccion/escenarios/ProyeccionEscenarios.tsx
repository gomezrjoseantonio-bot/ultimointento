import React, { useState } from 'react';
import { Calculator, TrendingUp, Save, Plus, BarChart3, Sliders } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';

const ProyeccionEscenarios: React.FC = () => {
  const [scenarios, setScenarios] = useState([
    { 
      id: 1, 
      name: 'Base', 
      vacancia: 5, 
      ipc: 2.5, 
      inflacionGastos: 3.0, 
      tiposInteres: 4.5,
      saved: true
    },
    { 
      id: 2, 
      name: 'Optimista', 
      vacancia: 2, 
      ipc: 3.0, 
      inflacionGastos: 2.5, 
      tiposInteres: 3.5,
      saved: true
    }
  ]);
  
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);

  const formatEuro = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <PageLayout 
      title="Escenarios" 
      subtitle="Sandbox de hipótesis a 3–20 años sin modificar Budget ni Forecast"
    >
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BarChart3 className="h-6 w-6 text-[#0B2B5C]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Simulación de Escenarios
              </h1>
              <p className="text-gray-600">
                Modela diferentes hipótesis sin impactar presupuestos confirmados
              </p>
            </div>
          </div>
          
          <button
            className="flex items-center space-x-2 bg-[#0B2B5C] text-white px-4 py-2 rounded-lg hover:bg-[#083044] transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Escenario</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Scenario Selection & Parameters */}
          <div className="lg:col-span-1 space-y-6">
            {/* Scenario Selector */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Sliders className="h-5 w-5 text-[#0B2B5C] mr-2" />
                Escenarios Guardados
              </h3>
              <div className="space-y-2">
                {scenarios.map(scenario => (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedScenario.id === scenario.id
                        ? 'border-[#0B2B5C] bg-blue-50 text-[#0B2B5C]'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{scenario.name}</div>
                    <div className="text-sm text-gray-500">
                      Vacancia: {formatPercentage(scenario.vacancia)} • IPC: {formatPercentage(scenario.ipc)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Parameters Panel */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Parámetros Ajustables
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vacancia: {formatPercentage(selectedScenario.vacancia)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={selectedScenario.vacancia}
                    onChange={(e) => setSelectedScenario({
                      ...selectedScenario,
                      vacancia: parseFloat(e.target.value),
                      saved: false
                    })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IPC: {formatPercentage(selectedScenario.ipc)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="0.1"
                    value={selectedScenario.ipc}
                    onChange={(e) => setSelectedScenario({
                      ...selectedScenario,
                      ipc: parseFloat(e.target.value),
                      saved: false
                    })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inflación Gastos: {formatPercentage(selectedScenario.inflacionGastos)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={selectedScenario.inflacionGastos}
                    onChange={(e) => setSelectedScenario({
                      ...selectedScenario,
                      inflacionGastos: parseFloat(e.target.value),
                      saved: false
                    })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipos de Interés: {formatPercentage(selectedScenario.tiposInteres)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="0.1"
                    value={selectedScenario.tiposInteres}
                    onChange={(e) => setSelectedScenario({
                      ...selectedScenario,
                      tiposInteres: parseFloat(e.target.value),
                      saved: false
                    })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {!selectedScenario.saved && (
                  <button
                    onClick={() => {
                      const updatedScenarios = scenarios.map(s => 
                        s.id === selectedScenario.id ? { ...selectedScenario, saved: true } : s
                      );
                      setScenarios(updatedScenarios);
                      setSelectedScenario({ ...selectedScenario, saved: true });
                    }}
                    className="w-full flex items-center justify-center space-x-2 bg-[#0B2B5C] text-white px-4 py-2 rounded-lg hover:bg-[#083044] transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    <span>Guardar Cambios</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Results & Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* KPIs Preview */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calculator className="h-5 w-5 text-[#0B2B5C] mr-2" />
                KPIs Proyectados - {selectedScenario.name}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-[#0B2B5C]">8.2%</div>
                  <div className="text-sm text-gray-600">Cash Yield</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-[#0B2B5C]">12.5%</div>
                  <div className="text-sm text-gray-600">TIR</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-[#0B2B5C]">15.8%</div>
                  <div className="text-sm text-gray-600">ROE</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-[#0B2B5C]">{formatEuro(125000)}</div>
                  <div className="text-sm text-gray-600">NOI Anual</div>
                </div>
              </div>
            </div>

            {/* Cash Flow Projection */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 text-[#0B2B5C] mr-2" />
                Curvas de Caja Plurianual
              </h3>
              
              {/* Time horizon selector */}
              <div className="flex space-x-2 mb-4">
                {[3, 5, 10, 20].map(years => (
                  <button
                    key={years}
                    className="px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-[#0B2B5C] focus:border-[#0B2B5C]"
                  >
                    {years} años
                  </button>
                ))}
              </div>

              {/* Placeholder for chart */}
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Gráfico de proyección de flujo de caja</p>
                  <p className="text-sm text-gray-400">Se mostraría aquí la curva temporal del escenario seleccionado</p>
                </div>
              </div>
            </div>

            {/* Comparison Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Comparativa de Escenarios
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-green-800">Escenario Base</span>
                    <span className="text-green-600 font-semibold">{formatEuro(120000)} NOI</span>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-800">Escenario Optimista</span>
                    <span className="text-blue-600 font-semibold">{formatEuro(145000)} NOI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-amber-800">!</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Solo simulación:</span> Los escenarios no modifican el Budget ni Forecast confirmados.
                Son herramientas de análisis para toma de decisiones estratégicas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ProyeccionEscenarios;