import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Settings, Trash2, Copy, Star, StarOff } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { formatEuro } from '../../../../utils/formatUtils';
import { confirmDelete } from '../../../../services/confirmationService';

// Temporary types until we create the service
interface Scenario {
  id?: number;
  name: string;
  mode: 'diy' | 'strategies' | 'objectives';
  markedForComparison: boolean;
  createdAt: string;
  parameters?: any;
}

type ScenarioMode = 'diy' | 'strategies' | 'objectives';

interface ProyeccionSimulacionesProps {
  isEmbedded?: boolean;
}

const ProyeccionSimulaciones: React.FC<ProyeccionSimulacionesProps> = ({ isEmbedded = false }): React.ReactElement => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ScenarioMode>('diy');

  const handleCreateScenario = async (mode: ScenarioMode) => {
    setModalMode(mode);
    setShowModal(true);
  };

  const handleSaveScenario = async (scenario: Scenario) => {
    // Temporary implementation
    const newScenario = {
      ...scenario,
      id: Date.now(),
      createdAt: new Date().toISOString()
    };
    setScenarios([...scenarios, newScenario]);
    setSelectedScenario(newScenario);
    setShowModal(false);
  };

  const handleToggleComparison = async (scenario: Scenario) => {
    const markedCount = scenarios.filter(s => s.markedForComparison).length;
    
    if (!scenario.markedForComparison && markedCount >= 3) {
      toast.error('Ya tienes 3 escenarios en comparativa. Desmarca uno para añadir otro.');
      return;
    }

    const updatedScenarios = scenarios.map(s => 
      s.id === scenario.id 
        ? { ...s, markedForComparison: !s.markedForComparison }
        : s
    );
    setScenarios(updatedScenarios);
    
    if (selectedScenario?.id === scenario.id) {
      setSelectedScenario({ ...scenario, markedForComparison: !scenario.markedForComparison });
    }
  };

  const handleDuplicateScenario = async (scenario: Scenario) => {
    const duplicated = {
      ...scenario,
      id: Date.now(),
      name: `${scenario.name} (copia)`,
      markedForComparison: false,
      createdAt: new Date().toISOString()
    };
    setScenarios([...scenarios, duplicated]);
    setSelectedScenario(duplicated);
  };

  const handleDeleteScenario = async (scenario: Scenario) => {
    const confirmed = await confirmDelete('este escenario');
    if (confirmed) {
      const updatedScenarios = scenarios.filter(s => s.id !== scenario.id);
      setScenarios(updatedScenarios);
      
      if (selectedScenario?.id === scenario.id) {
        setSelectedScenario(updatedScenarios.length > 0 ? updatedScenarios[0] : null);
      }
    }
  };

  // Show creation cards if no scenarios exist
  if (scenarios.length === 0) {
    const content = (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Proyección</h1>
          </div>
          <button
            onClick={() => handleCreateScenario('diy')}
            className="atlas-atlas-atlas-atlas-btn-primary flex items-center space-x-2 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva simulación</span>
          </button>
        </div>

        {/* Creation Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* DIY Mode */}
          <div 
            onClick={() => handleCreateScenario('diy')}
            className="bg-white border border-[#D7DEE7] p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-[#F8F9FA] group-hover:bg-[#E5E7EB]">
                <Settings className="h-6 w-6 text-primary-700" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">Configurar yo mismo</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Sliders globales para rentas, gastos, vacancia y revalorización. 
              Hasta 3 acciones simples (amortizar, comprar, vender).
            </p>
            <div className="text-primary-700 text-sm font-medium">DIY →</div>
          </div>

          {/* Strategies Mode */}
          <div 
            onClick={() => handleCreateScenario('strategies')}
            className="bg-white border border-[#D7DEE7] p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-[#F8F9FA] group-hover:bg-[#E5E7EB]">
                <Star className="h-6 w-6 text-primary-700" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">Estrategias predefinidas</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Optimizar lo que tienes, mejorar yield, amortizar vs reinvertir, 
              optimización de hipotecas.
            </p>
            <div className="text-primary-700 text-sm font-medium">Estrategias →</div>
          </div>

          {/* Objectives Mode */}
          <div 
            onClick={() => handleCreateScenario('objectives')}
            className="bg-white border border-[#D7DEE7] p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-[#F8F9FA] group-hover:bg-[#E5E7EB]">
                <Plus className="h-6 w-6 text-primary-700" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">Objetivos</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Define metas (+1.000 €/mes en 5 años) y el sistema propone 
              3 rutas: Conservadora/Equilibrada/Agresiva.
            </p>
            <div className="text-primary-700 text-sm font-medium">Objetivos →</div>
          </div>
        </div>

        {/* Simple Modal Placeholder */}
        {showModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div 
                className="fixed inset-0 bg-gray-500 transition-opacity"
                onClick={() => setShowModal(false)}
              />
              <div className="relative inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white shadow-xl sm:my-8 sm:align-middle sm:p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                    Crear nuevo escenario
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Modo: {modalMode === 'diy' ? 'DIY' : modalMode === 'strategies' ? 'Estrategias' : 'Objetivos'}
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        handleSaveScenario({
                          name: `Escenario ${modalMode} ${scenarios.length + 1}`,
                          mode: modalMode,
                          markedForComparison: false,
                          createdAt: new Date().toISOString()
                        });
                      }}
                      className="atlas-atlas-atlas-atlas-btn-primary w-full px-4 py-2"
                    >
                      Crear escenario de prueba
                    </button>
                    <button
                      onClick={() => setShowModal(false)}
                      className="w-full px-4 py-2 text-gray-500 hover:text-primary-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );

    if (isEmbedded) return content;

    return (
      <PageLayout title="Simulaciones" subtitle="Crear y guardar escenarios para análisis de hipótesis">
        {content}
      </PageLayout>
    );
  }

  const content = (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Proyección</h1>
          </div>
          <button
            onClick={() => handleCreateScenario('diy')}
            className="atlas-atlas-atlas-atlas-btn-primary flex items-center space-x-2 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva simulación</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Scenarios List */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-[#D7DEE7] p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Escenarios guardados
              </h3>
              <div className="space-y-2">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                    className={`p-3 border cursor-pointer ${
                      selectedScenario?.id === scenario.id
                        ? 'border-primary-700 bg-primary-50 text-primary-700'
                        : 'border-[#D7DEE7] hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">{scenario.name}</div>
                      {scenario.markedForComparison && (
                        <div className="atlas-atlas-atlas-atlas-btn-primary inline-flex items-center px-2 py-1 text-xs">
                          Para comparar
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {scenario.mode === 'diy' && 'DIY'}
                      {scenario.mode === 'strategies' && 'Estrategia'}
                      {scenario.mode === 'objectives' && 'Objetivo'}
                      {' • '}
                      {new Date(scenario.createdAt).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Scenario Detail */}
          <div className="lg:col-span-3">
            {selectedScenario ? (
              <div className="bg-white border border-[#D7DEE7] p-6 shadow-sm">
                {/* Scenario Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">{selectedScenario.name}</h2>
                    <p className="text-gray-500 text-sm">
                      {selectedScenario.mode === 'diy' && 'Configuración DIY'}
                      {selectedScenario.mode === 'strategies' && 'Estrategia predefinida'}
                      {selectedScenario.mode === 'objectives' && 'Basado en objetivos'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleComparison(selectedScenario)}
                      className={`flex items-center space-x-2 px-3 py-2 text-sm ${
                        selectedScenario.markedForComparison
                          ? 'bg-primary-700'
                          : 'bg-[#F8F9FA] text-gray-500'                      }`}
                    >
                      {selectedScenario.markedForComparison ? (
                        <StarOff className="h-4 w-4" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                      <span>
                        {selectedScenario.markedForComparison ? 'Quitar comparar' : 'Marcar para comparar'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDuplicateScenario(selectedScenario)}
                      className="flex items-center space-x-2 px-3 py-2 bg-[#F8F9FA] text-gray-500 text-sm"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Duplicar</span>
                    </button>
                    <button
                      onClick={() => handleDeleteScenario(selectedScenario)}
                      className="flex items-center space-x-2 px-3 py-2 bg-[#FEF2F2] text-error-500 text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>

                {/* KPI Preview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-[#F8F9FA]">
                    <div className="text-2xl font-bold text-primary-700">{formatEuro(15600)}</div>
                    <div className="text-sm text-gray-500">Cashflow 5a</div>
                  </div>
                  <div className="text-center p-4 bg-[#F8F9FA]">
                    <div className="text-2xl font-bold text-primary-700">{formatEuro(48000)}</div>
                    <div className="text-sm text-gray-500">Cashflow 20a</div>
                  </div>
                  <div className="text-center p-4 bg-[#F8F9FA]">
                    <div className="text-2xl font-bold text-primary-700">{formatEuro(650000)}</div>
                    <div className="text-sm text-gray-500">Patrimonio 20a</div>
                  </div>
                  <div className="text-center p-4 bg-[#F8F9FA]">
                    <div className="text-2xl font-bold text-primary-700">1,85 x</div>
                    <div className="text-sm text-gray-500">DSCR medio</div>
                  </div>
                </div>

                {/* Chart Placeholder */}
                <div className="h-64 bg-[#F8F9FA] flex items-center justify-center border-2 border-dashed border-[#D7DEE7] mb-6">
                  <div className="text-center">
                    <Settings className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Gráfico de proyección 20 años</p>
                    <p className="text-sm text-gray-400">Flujo neto y patrimonio neto por año</p>
                  </div>
                </div>

                {/* Actions Assumed */}
                <div className="bg-[#F8F9FA] p-4">
                  <h4 className="font-medium text-neutral-900 mb-3">Acciones asumidas</h4>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div>• Crecimiento rentas: 3,5% anual</div>
                    <div>• Inflación gastos: 2,5% anual</div>
                    <div>• Vacancia: 5,0%</div>
                    <div>• Revalorización: 4,0% anual</div>
                    {selectedScenario.mode === 'diy' && (
                      <>
                        <div>• Amortizar 10.000 € en 2026</div>
                        <div>• Comprar 100.000 € en 2028</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#D7DEE7] p-12 shadow-sm text-center">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  Selecciona un escenario
                </h3>
                <p className="text-gray-500">
                  Elige un escenario de la lista para ver sus detalles y resultados
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Simple Modal for creating scenarios */}
        {showModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div 
                className="fixed inset-0 bg-gray-500 transition-opacity"
                onClick={() => setShowModal(false)}
              />
              <div className="relative inline-block w-full max-w-md px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white shadow-xl sm:my-8 sm:align-middle sm:p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                    Crear nuevo escenario
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Modo: {modalMode === 'diy' ? 'DIY' : modalMode === 'strategies' ? 'Estrategias' : 'Objetivos'}
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        handleSaveScenario({
                          name: `Escenario ${modalMode} ${scenarios.length + 1}`,
                          mode: modalMode,
                          markedForComparison: false,
                          createdAt: new Date().toISOString()
                        });
                      }}
                      className="atlas-atlas-atlas-atlas-btn-primary w-full px-4 py-2"
                    >
                      Crear escenario de prueba
                    </button>
                    <button
                      onClick={() => setShowModal(false)}
                      className="w-full px-4 py-2 text-gray-500 hover:text-primary-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );

    if (isEmbedded) return content;

    return (
      <PageLayout title="Simulaciones" subtitle="Crear y guardar escenarios para análisis de hipótesis">
        {content}
      </PageLayout>
    );
};

export default ProyeccionSimulaciones;