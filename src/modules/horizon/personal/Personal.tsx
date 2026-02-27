import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Banknote, Briefcase, Receipt, Coins, PiggyBank } from 'lucide-react';
import PageLayout from '../../../components/common/PageLayout';
import NominaManager from '../../../components/personal/nomina/NominaManager';
import AutonomoView from '../../personal/components/AutonomoView';
import PensionTab from '../../../components/personal/PensionTab';
import OtrosIngresosManager from '../../../components/personal/otros/OtrosIngresosManager';
import GastosManager from '../../../components/personal/gastos/GastosManager';
import { personalDataService } from '../../../services/personalDataService';
import { personalResumenService } from '../../../services/personalResumenService';
import { PersonalData, PersonalModuleConfig, ResumenPersonalMensual } from '../../../types/personal';
import PersonalResumenView from './PersonalResumenView';

const Personal: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState<PersonalModuleConfig | null>(null);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenPersonalMensual | null>(null);
  const [resumenLoading, setResumenLoading] = useState(true);
  
  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/resumen')) return 'resumen';
    if (path.includes('/nomina')) return 'nomina';
    if (path.includes('/autonomo')) return 'autonomo';
    if (path.includes('/pension')) return 'pension';
    if (path.includes('/gastos')) return 'gastos';
    if (path.includes('/otros-ingresos')) return 'otros-ingresos';
    return 'resumen';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  useEffect(() => {
    loadConfiguration();
  }, []);

  useEffect(() => {
    if (config && activeTab === 'resumen') {
      loadResumen();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, activeTab]);

  const loadConfiguration = async () => {
    setLoading(true);
    try {
      const [moduleConfig, profile] = await Promise.all([
        personalDataService.getModuleConfiguration(),
        personalDataService.getPersonalData(),
      ]);
      setConfig(moduleConfig);
      setPersonalData(profile);
    } catch (error) {
      console.error('Error loading personal module configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResumen = async () => {
    if (!config) return;
    
    setResumenLoading(true);
    const now = new Date();
    const mes = now.getMonth() + 1;
    const anio = now.getFullYear();
    
    try {
      const data = await personalResumenService.getResumenMensual(
        config.personalDataId,
        mes,
        anio
      );
      setResumen(data);
    } catch (error) {
      console.error('Error loading resumen:', error);
    } finally {
      setResumenLoading(false);
    }
  };

  // Dynamic tabs based on personal data configuration
  const getAllTabs = () => {
    const situacion = personalData?.situacionLaboral ?? [];
    const isEmployed = config?.seccionesActivas.nomina ?? situacion.includes('asalariado');
    const isSelfEmployed = config?.seccionesActivas.autonomo ?? situacion.includes('autonomo');
    const isRetired = situacion.includes('jubilado') || (personalData?.situacionLaboralConyugue ?? []).includes('jubilado');
    return [
      { id: 'resumen', name: 'Resumen', icon: LayoutDashboard, href: '/personal/resumen', show: true },
      { id: 'nomina', name: 'Nómina', icon: Banknote, href: '/personal/nomina', show: isEmployed },
      { id: 'autonomo', name: 'Autónomos', icon: Briefcase, href: '/personal/autonomo', show: isSelfEmployed },
      { id: 'pension', name: 'Pensión', icon: PiggyBank, href: '/personal/pension', show: isRetired },
      {
        id: 'gastos',
        name: personalData?.maritalStatus === 'single' && !personalData?.hasChildren
          ? 'Gastos Personales'
          : 'Gastos Familiares',
        icon: Receipt,
        href: '/personal/gastos',
        show: true,
      },
      { id: 'otros-ingresos', name: 'Otros Ingresos', icon: Coins, href: '/personal/otros-ingresos', show: true },
    ];
  };

  const getActiveTabs = () => {
    return getAllTabs().filter(tab => tab.show);
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
        return config?.seccionesActivas.nomina ? renderNominaSection() : null;
      case 'autonomo':
        return config?.seccionesActivas.autonomo ? renderAutonomoSection() : null;
      case 'pension':
        return renderPensionSection();
      case 'gastos':
        return renderGastosSection();
      case 'otros-ingresos':
        return renderOtrosIngresosSection();
      default:
        return null;
    }
  };

  const renderResumenSection = () => {
    if (resumenLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent rounded-full"></div>
          <span className="ml-2 text-neutral-600">Cargando resumen...</span>
        </div>
      );
    }

    return <PersonalResumenView resumen={resumen} config={config} />;
  };

  const renderGastosSection = () => (
    <div className="space-y-6">
      <GastosManager />
    </div>
  );

  const renderNominaSection = () => (
    <div className="space-y-6">
      <NominaManager />
    </div>
  );

  const renderAutonomoSection = () => (
    <div className="space-y-6">
      <AutonomoView />
    </div>
  );

  const renderPensionSection = () => (
    <div className="space-y-6">
      <PensionTab />
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