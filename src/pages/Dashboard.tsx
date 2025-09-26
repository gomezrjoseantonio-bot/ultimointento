import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Settings, Inbox } from 'lucide-react';
import { dashboardService, DashboardConfiguration, DashboardBlockType } from '../services/dashboardService';
import TreasuryBlock from '../components/dashboard/TreasuryBlock';
import IncomeExpensesBlock from '../components/dashboard/IncomeExpensesBlock';
import KPIsBlock from '../components/dashboard/KPIsBlock';
import TaxBlock from '../components/dashboard/TaxBlock';
import AlertsBlock from '../components/dashboard/AlertsBlock';
import HorizonVisualPanel from '../modules/horizon/panel/components/HorizonVisualPanel';
import DynamicImportDemo from '../components/DynamicImportDemo';

const Dashboard: React.FC = () => {
  const { currentModule } = useTheme();
  const navigate = useNavigate();
  const [config, setConfig] = useState<DashboardConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyCount, setPropertyCount] = useState(0);

  useEffect(() => {
    loadDashboardConfig();
  }, []);

  const loadDashboardConfig = async () => {
    try {
      setIsLoading(true);
      const [dashboardConfig, propCount] = await Promise.all([
        dashboardService.loadConfiguration(),
        dashboardService.getPropertyCount()
      ]);
      
      setConfig(dashboardConfig);
      setPropertyCount(propCount);
    } catch (error) {
      console.error('Error loading dashboard config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (route: string, filters?: Record<string, any>) => {
    navigate(route);
  };

  const handleConfigureClick = () => {
    navigate('/configuracion/preferencias-datos#panel');
  };

  const renderBlock = (blockConfig: any) => {
    const props = {
      config: blockConfig,
      onNavigate: handleNavigate,
      className: ''
    };

    switch (blockConfig.id as DashboardBlockType) {
      case 'treasury':
        return <TreasuryBlock {...props} />;
      case 'income-expenses':
        return <IncomeExpensesBlock {...props} />;
      case 'kpis':
        return <KPIsBlock {...props} />;
      case 'tax':
        return <TaxBlock {...props} />;
      case 'alerts':
        return <AlertsBlock {...props} />;
      default:
        return null;
    }
  };

  const getModuleInfo = () => {
    switch (currentModule) {
      case 'horizon':
        return {
          title: 'Horizon — Invest',
          subtitle: 'Plataforma de Inversión Inmobiliaria',
          accentColor: 'brand-navy',
          description: 'Gestiona tu cartera inmobiliaria, rastrea el rendimiento y monitorea inversiones.',
        };
      case 'pulse':
        return {
          title: 'Pulse — Gestión',
          subtitle: 'Plataforma de Gestión Operativa',
          accentColor: 'brand-teal',
          description: 'Gestiona contratos, firmas digitales, cobros, automatizaciones y tareas operativas.',
        };
      default:
        return {
          title: 'ATLAS',
          subtitle: 'Plataforma de Gestión Financiera',
          accentColor: 'brand-navy',
          description: 'Bienvenido a ATLAS',
        };
    }
  };

  const moduleInfo = getModuleInfo();

  // Use HorizonVisualPanel for Horizon module
  if (currentModule === 'horizon') {
    return (
      <div className="space-y-8">
        {/* Bundle Optimization Demo */}
        <DynamicImportDemo />
        
        {/* Horizon Visual Panel */}
        <HorizonVisualPanel />
      </div>
    );
  }

  // For Pulse module, continue with the existing dashboard logic
  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Bundle Optimization Demo */}
        <DynamicImportDemo />
        
        <div className="text-center py-8">
          <h1 className="text-3xl font-semibold mb-2 text-navy-900">
            {moduleInfo.title}
          </h1>
          <p className="text-lg text-neutral-600 mb-4">{moduleInfo.subtitle}</p>
        </div>
        
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-neutral-200 p-6 h-40">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-neutral-200 rounded w-1/3"></div>
                  <div className="h-8 bg-neutral-200 rounded w-2/3"></div>
                  <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no properties and no custom configuration
  if (propertyCount === 0 && config?.preset === 'preset-a') {
    return (
      <div className="space-y-8">
        {/* Bundle Optimization Demo */}
        <DynamicImportDemo />
        
        {/* Module Header */}
        <div className="text-center py-8">
          <h1 className="text-3xl font-semibold mb-2 text-navy-900">
            {moduleInfo.title}
          </h1>
          <p className="text-lg text-neutral-600 mb-4">{moduleInfo.subtitle}</p>
          <p className="text-neutral-500 max-w-2xl mx-auto">{moduleInfo.description}</p>
        </div>

        {/* Empty State */}
        <div className="bg-white shadow rounded-lg border border-neutral-200">
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-navy-900">
              <Inbox className="w-8 h-8 text-navy-900" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Empezar</h3>
            <p className="text-neutral-500 mb-6 max-w-md mx-auto">
              Tu plataforma de gestión está vacía. 
              {' '} Comienza creando contratos y configurando automatizaciones.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button 
                onClick={() => navigate('/inmuebles/cartera/nuevo')}
                className="px-6 py-3 rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 bg-navy-900 text-white focus:ring-navy-900 w-full sm:w-auto"
              >
                Agregar Inmueble
              </button>
              <button 
                onClick={() => navigate('/inbox')}
                className="px-6 py-3 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2 w-full sm:w-auto"
              >
                Importar Datos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-8">
        {/* Bundle Optimization Demo */}
        <DynamicImportDemo />
        
        <div className="text-center py-8">
          <h1 className="text-3xl font-semibold mb-2 text-navy-900">
            {moduleInfo.title}
          </h1>
          <p className="text-lg text-neutral-600">Error al cargar el dashboard</p>
        </div>
      </div>
    );
  }

  const activeBlocks = config.blocks
    .filter(block => block.isActive)
    .sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-8">
      {/* Bundle Optimization Demo */}
      <DynamicImportDemo />
      
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-navy-900">
            {moduleInfo.title}
          </h1>
          <p className="text-base sm:text-lg text-neutral-600 mt-1">{moduleInfo.subtitle}</p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-neutral-500">
            <span>{propertyCount} inmueble{propertyCount !== 1 ? 's' : ''}</span>
            <span className="hidden sm:inline">•</span>
            <span>Preset {config.preset === 'preset-a' ? 'A' : 'B'}</span>
            <span className="hidden sm:inline">•</span>
            <span>{activeBlocks.length} bloque{activeBlocks.length !== 1 ? 's' : ''} activos</span>
          </div>
        </div>
        
        <button
          onClick={handleConfigureClick}
          className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors self-start sm:self-center"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Configurar Panel</span>
          <span className="sm:hidden">Configurar</span>
        </button>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {activeBlocks.map((blockConfig) => (
          <div key={blockConfig.id}>
            {renderBlock(blockConfig)}
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-neutral-400 pt-4 border-t border-neutral-200">
        <p>
          Dashboard configurado automáticamente según tu cartera. 
          <button 
            onClick={handleConfigureClick}
            className="text-navy-900 hover:underline ml-1"
          >
            Personalizar dashboard
          </button>
        </p>
      </div>
    </div>
  );
};

export default Dashboard;