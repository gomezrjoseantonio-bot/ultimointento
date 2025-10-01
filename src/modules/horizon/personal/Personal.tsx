import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Banknote, User, PiggyBank, DollarSign } from 'lucide-react';
import PageLayout from '../../../components/common/PageLayout';
import NominaManager from '../../../components/personal/nomina/NominaManager';
import AutonomoManager from '../../../components/personal/autonomo/AutonomoManager';
import PlanesManager from '../../../components/personal/planes/PlanesManager';
import OtrosIngresosManager from '../../../components/personal/otros/OtrosIngresosManager';
import { personalDataService } from '../../../services/personalDataService';
import { PersonalModuleConfig } from '../../../types/personal';

const Personal: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState<PersonalModuleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/resumen')) return 'resumen';
    if (path.includes('/nomina')) return 'nomina';
    if (path.includes('/autonomo')) return 'autonomo';
    if (path.includes('/pensiones-inversiones')) return 'pensiones-inversiones';
    if (path.includes('/otros-ingresos')) return 'otros-ingresos';
    return 'resumen';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    setLoading(true);
    try {
      const moduleConfig = await personalDataService.getModuleConfiguration();
      setConfig(moduleConfig);
    } catch (error) {
      console.error('Error loading personal module configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic tabs based on personal data configuration
  const getAllTabs = () => [
    { id: 'resumen', name: 'Resumen', icon: Home, href: '/personal/resumen', always: true },
    { id: 'nomina', name: 'Nómina', icon: Banknote, href: '/personal/nomina', condition: config?.seccionesActivas.nomina },
    { id: 'autonomo', name: 'Autónomo', icon: User, href: '/personal/autonomo', condition: config?.seccionesActivas.autonomo },
    { id: 'pensiones-inversiones', name: 'Pensiones e Inversiones', icon: PiggyBank, href: '/personal/pensiones-inversiones', condition: config?.seccionesActivas.pensionesInversiones },
    { id: 'otros-ingresos', name: 'Otros Ingresos', icon: DollarSign, href: '/personal/otros-ingresos', condition: config?.seccionesActivas.otrosIngresos },
  ];

  const getActiveTabs = () => {
    return getAllTabs().filter(tab => tab.always || tab.condition);
  };

  const tabs = getActiveTabs();

  const handleTabClick = (tab: typeof tabs[0]) => {
    setActiveTab(tab.id);
    navigate(tab.href);
  };

  const renderTabContent = () => {
    if (!config) {
      return (
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración pendiente</h3>
          <p className="text-gray-500 mb-4">
            Para usar el módulo Personal, primero configura tus datos personales.
          </p>
          <button 
            onClick={() => navigate('/cuenta/perfil')}
            className="px-4 py-2 bg-brand-navy"
          >
            Configurar Datos Personales
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'resumen':
        return renderResumenSection();
      case 'nomina':
        return config.seccionesActivas.nomina ? renderNominaSection() : null;
      case 'autonomo':
        return config.seccionesActivas.autonomo ? renderAutonomoSection() : null;
      case 'pensiones-inversiones':
        return config.seccionesActivas.pensionesInversiones ? renderPensionesInversionesSection() : null;
      case 'otros-ingresos':
        return config.seccionesActivas.otrosIngresos ? renderOtrosIngresosSection() : null;
      default:
        return null;
    }
  };

  const renderResumenSection = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen Personal</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Ingresos del mes</p>
            <p className="text-2xl font-semibold text-gray-900">0,00 €</p>
          </div>
          <div className="bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Gastos del mes</p>
            <p className="text-2xl font-semibold text-gray-900">0,00 €</p>
          </div>
          <div className="bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Balance</p>
            <p className="text-2xl font-semibold text-gray-900">0,00 €</p>
          </div>
        </div>
      </div>

      {/* Active Sections Summary */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Secciones Activas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config?.seccionesActivas.nomina && (
            <div className="atlas-atlas-btn-primary flex items-center space-x-3 p-3">
              <Banknote className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Nómina configurada</span>
            </div>
          )}
          {config?.seccionesActivas.autonomo && (
            <div className="atlas-atlas-btn-primary flex items-center space-x-3 p-3">
              <User className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Autónomo configurado</span>
            </div>
          )}
          {config?.seccionesActivas.pensionesInversiones && (
            <div className="flex items-center space-x-3 p-3 bg-purple-50">
              <PiggyBank className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Pensiones e inversiones disponibles</span>
            </div>
          )}
          {config?.seccionesActivas.otrosIngresos && (
            <div className="flex items-center space-x-3 p-3 bg-yellow-50">
              <DollarSign className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">Otros ingresos disponibles</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderNominaSection = () => (
    <div className="space-y-6">
      <NominaManager />
    </div>
  );

  const renderAutonomoSection = () => (
    <div className="space-y-6">
      <AutonomoManager />
    </div>
  );

  const renderPensionesInversionesSection = () => (
    <div className="space-y-6">
      <PlanesManager />
    </div>
  );

  const renderOtrosIngresosSection = () => (
    <div className="space-y-6">
      <OtrosIngresosManager />
    </div>
  );

  if (loading) {
    return (
      <PageLayout 
        title="Personal" 
        subtitle="Gestión completa de finanzas personales"
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
          <span className="ml-2 text-neutral-600">Cargando configuración...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="Personal" 
      subtitle="Gestión completa de finanzas personales"
    >
      <div className="space-y-6">
        {/* Tab Navigation - Dynamic based on configuration */}
        <div className="bg-white border border-gray-200 p-1">
          <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
                    isActive
                      ? 'bg-gray-100 text-gray-900 border-b-2 border-gray-500'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </PageLayout>
  );
};

export default Personal;