import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Banknote, Briefcase, Receipt, Coins } from 'lucide-react';
import PageLayout from '../../../components/common/PageLayout';
import NominaManager from '../../../components/personal/nomina/NominaManager';
import AutonomoManager from '../../../components/personal/autonomo/AutonomoManager';
import OtrosIngresosManager from '../../../components/personal/otros/OtrosIngresosManager';
import GastosManager from '../../../components/personal/gastos/GastosManager';
import { personalDataService } from '../../../services/personalDataService';
import { personalResumenService } from '../../../services/personalResumenService';
import { PersonalModuleConfig, ResumenPersonalMensual } from '../../../types/personal';

const Personal: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState<PersonalModuleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenPersonalMensual | null>(null);
  const [resumenLoading, setResumenLoading] = useState(true);
  
  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/resumen')) return 'resumen';
    if (path.includes('/nomina')) return 'nomina';
    if (path.includes('/autonomo')) return 'autonomo';
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
      const moduleConfig = await personalDataService.getModuleConfiguration();
      setConfig(moduleConfig);
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
  const getAllTabs = () => [
    { id: 'resumen', name: 'Resumen', icon: LayoutDashboard, href: '/personal/resumen', always: true },
    { id: 'nomina', name: 'Nómina', icon: Banknote, href: '/personal/nomina', condition: config?.seccionesActivas.nomina },
    { id: 'autonomo', name: 'Autónomo', icon: Briefcase, href: '/personal/autonomo', condition: config?.seccionesActivas.autonomo },
    { id: 'gastos', name: 'Gastos', icon: Receipt, href: '/personal/gastos', always: true },
    { id: 'otros-ingresos', name: 'Otros Ingresos', icon: Coins, href: '/personal/otros-ingresos', always: true },
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

    return (
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen Personal</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Ingresos del mes</p>
              <p className="text-2xl font-semibold text-gray-900">
                {new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'EUR'
                }).format(resumen?.ingresos.total || 0)}
              </p>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                {resumen && resumen.ingresos.nomina > 0 && (
                  <div>Nómina: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(resumen.ingresos.nomina)}</div>
                )}
                {resumen && resumen.ingresos.autonomo > 0 && (
                  <div>Autónomo: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(resumen.ingresos.autonomo)}</div>
                )}
                {resumen && resumen.ingresos.otros > 0 && (
                  <div>Otros: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(resumen.ingresos.otros)}</div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Gastos del mes</p>
              <p className="text-2xl font-semibold text-gray-900">
                {new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'EUR'
                }).format(resumen?.gastos.total || 0)}
              </p>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                {resumen && resumen.gastos.recurrentes > 0 && (
                  <div>Recurrentes: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(resumen.gastos.recurrentes)}</div>
                )}
                {resumen && resumen.gastos.puntuales > 0 && (
                  <div>Puntuales: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(resumen.gastos.puntuales)}</div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Ahorro del mes</p>
              <p className={`text-2xl font-semibold ${(resumen?.ahorro || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'EUR'
                }).format(resumen?.ahorro || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Active Sections Summary */}
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Secciones Activas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config?.seccionesActivas.nomina && (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Banknote className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Nómina configurada</span>
              </div>
            )}
            {config?.seccionesActivas.autonomo && (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Briefcase className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Autónomo configurado</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
      <AutonomoManager />
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