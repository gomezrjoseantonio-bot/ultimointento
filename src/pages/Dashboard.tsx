import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Settings, Inbox } from 'lucide-react';
import { dashboardService, DashboardConfiguration, DashboardBlockType, DashboardPreset } from '../services/dashboardService';
import TreasuryBlock from '../components/dashboard/TreasuryBlock';
import IncomeExpensesBlock from '../components/dashboard/IncomeExpensesBlock';
import KPIsBlock from '../components/dashboard/KPIsBlock';
import TaxBlock from '../components/dashboard/TaxBlock';
import AlertsBlock from '../components/dashboard/AlertsBlock';
import HorizonVisualPanel from '../modules/horizon/panel/components/HorizonVisualPanel';
import DynamicImportDemo from '../components/DynamicImportDemo';
import PulseDashboardHero from '../components/dashboard/PulseDashboardHero';
import PulsePresetShowcase from '../components/dashboard/PulsePresetShowcase';

const Dashboard: React.FC = () => {
  const { currentModule } = useTheme();
  const navigate = useNavigate();
  const [config, setConfig] = useState<DashboardConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyCount, setPropertyCount] = useState(0);
  const [isResettingPreset, setIsResettingPreset] = useState(false);
  const [excludePersonal, setExcludePersonal] = useState(false);
  const [isUpdatingPersonalPreference, setIsUpdatingPersonalPreference] = useState(false);

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
      setExcludePersonal(dashboardConfig.preferences?.excludePersonalFromAnalytics ?? false);
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

  const handleResetPreset = async () => {
    try {
      setIsResettingPreset(true);
      const defaultConfig = await dashboardService.resetToDefault();
      setConfig(defaultConfig);
      setExcludePersonal(defaultConfig.preferences?.excludePersonalFromAnalytics ?? false);
    } catch (error) {
      console.error('Error resetting dashboard preset:', error);
    } finally {
      setIsResettingPreset(false);
    }
  };

  const handleToggleExcludePersonal = async () => {
    const nextValue = !excludePersonal;
    setExcludePersonal(nextValue);
    setIsUpdatingPersonalPreference(true);

    try {
      const updatedConfig = await dashboardService.setExcludePersonalPreference(nextValue);
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Error updating personal exclusion preference:', error);
      setExcludePersonal(!nextValue);
    } finally {
      setIsUpdatingPersonalPreference(false);
    }
  };

  const renderBlock = (blockConfig: any) => {
    const props = {
      config: blockConfig,
      onNavigate: handleNavigate,
      className: 'h-full',
      excludePersonal
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
          title: 'Atlas Horrizon',
          subtitle: 'Supervisión financiera en tiempo real',
          accentColor: 'brand-navy',
          description: 'Orquesta la salud financiera de tu cartera con perspectiva de inversor y métricas accionables.',
          badgeLabel: 'Atlas • Horrizon'
        };
      case 'pulse':
        return {
          title: 'Atlas Pulse',
          subtitle: 'Gestión activa de inmuebles',
          accentColor: 'brand-teal',
          description: 'Controla la operación diaria y conecta con Horrizon para supervisar el rendimiento financiero sin salir de Atlas.',
          badgeLabel: 'Atlas • Pulse'
        };
      default:
        return {
          title: 'Atlas',
          subtitle: 'Plataforma integral de gestión de cartera',
          accentColor: 'brand-navy',
          description: 'Centraliza operación y supervisión en un mismo panel.',
          badgeLabel: 'Atlas'
        };
    }
  };

  const moduleInfo = getModuleInfo();

  const getPresetCopy = (preset?: DashboardPreset) => {
    if (preset === 'preset-b') {
      return {
        label: 'Atlas Horrizon — Supervisión avanzada',
        description: 'Ideal para carteras consolidadas: tesorería extendida, KPIs y fiscalidad orientada al inversor.'
      };
    }

    return {
      label: 'Atlas Pulse — Operación esencial',
      description: 'Pensada para empezar con foco en liquidez operativa, ingresos/gastos y coordinación fiscal.'
    };
  };

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
              {' '}Comienza creando contratos y configurando automatizaciones.
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

  const { label: presetLabel, description: presetDescription } = getPresetCopy(config.preset);
  const lastUpdatedLabel = config.lastModified
    ? new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(config.lastModified))
    : undefined;

  return (
    <div className="space-y-10">
      {/* Bundle Optimization Demo */}
      <DynamicImportDemo />

      <PulseDashboardHero
        title={moduleInfo.title}
        subtitle={moduleInfo.subtitle}
        description={moduleInfo.description}
        propertyCount={propertyCount}
        presetLabel={presetLabel}
        presetDescription={presetDescription}
        activeBlocks={activeBlocks.length}
        lastUpdatedLabel={lastUpdatedLabel}
        onConfigure={handleConfigureClick}
        onReset={handleResetPreset}
        isResetting={isResettingPreset}
        badgeLabel={moduleInfo.badgeLabel}
        excludePersonal={excludePersonal}
        onToggleExcludePersonal={handleToggleExcludePersonal}
        isUpdatingPersonalPreference={isUpdatingPersonalPreference}
      />

      <PulsePresetShowcase
        blocks={activeBlocks}
        presetLabel={presetLabel}
        presetDescription={presetDescription}
        onConfigure={handleConfigureClick}
        excludePersonalActive={excludePersonal}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Resumen dinámico</h2>
          <p className="text-sm text-neutral-500">
            Revisa el pulso operativo y financiero de tu cartera desde Atlas con los bloques inteligentes seleccionados automáticamente.
          </p>
          </div>
          <button
            onClick={handleConfigureClick}
            className="inline-flex items-center gap-2 self-start rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:border-brand-teal/60 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Settings className="h-4 w-4" />
            Ajustar bloques
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {activeBlocks.map((blockConfig) => (
            <div key={blockConfig.id} className="h-full">
              {renderBlock(blockConfig)}
            </div>
          ))}
        </div>
      </section>

      <div className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/80 p-6 text-center text-sm text-neutral-600 shadow-[0_20px_60px_-40px_rgba(4,44,94,0.4)] backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(29,160,186,0.1),transparent_55%)]" />
        <div className="relative z-10 space-y-3">
          <p>
            Esta vista evoluciona con tu cartera. Personaliza bloques, orden y presets en el asistente de configuración.
          </p>
          <button
            onClick={handleConfigureClick}
            className="inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
          >
            <Settings className="h-4 w-4" />
            Abrir asistente de personalización
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;