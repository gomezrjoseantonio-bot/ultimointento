import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Settings } from 'lucide-react';
import PageHeader, { HeaderSecondaryButton } from '../../../components/shared/PageHeader';
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
      const data = await personalResumenService.getResumenMensual(config.personalDataId, mes, anio);
      setResumen(data);
    } catch (error) {
      console.error('Error loading resumen:', error);
    } finally {
      setResumenLoading(false);
    }
  };

  const getAllTabs = () => {
    const situacion = personalData?.situacionLaboral ?? [];
    const isEmployed = config?.seccionesActivas.nomina ?? situacion.includes('asalariado');
    const isSelfEmployed = config?.seccionesActivas.autonomo ?? situacion.includes('autonomo');
    const isRetired = situacion.includes('jubilado') || (personalData?.situacionLaboralConyugue ?? []).includes('jubilado');
    return [
      { id: 'resumen', name: 'Resumen', href: '/personal/resumen', show: true },
      { id: 'nomina', name: 'Nómina', href: '/personal/nomina', show: isEmployed },
      { id: 'autonomo', name: 'Autónomos', href: '/personal/autonomo', show: isSelfEmployed },
      { id: 'pension', name: 'Pensión', href: '/personal/pension', show: isRetired },
      {
        id: 'gastos',
        name: personalData?.maritalStatus === 'single' && !personalData?.hasChildren ? 'Gastos' : 'Gastos',
        href: '/personal/gastos',
        show: true,
      },
      { id: 'otros-ingresos', name: 'Ingresos', href: '/personal/otros-ingresos', show: true },
    ];
  };

  const getActiveTabs = () => getAllTabs().filter(tab => tab.show);
  const tabs = getActiveTabs();

  const handleTabClick = (tab: typeof tabs[0]) => {
    setActiveTab(tab.id);
    navigate(tab.href);
  };

  const renderTabContent = () => {
    if (!config) {
      return (
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderRadius: 'var(--r-lg)',
          padding: 24,
        }}>
          <h3 style={{ fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--grey-700)', marginBottom: 8 }}>
            Configuración pendiente
          </h3>
          <p style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-500)', marginBottom: 16 }}>
            Para usar el módulo Personal, primero configura tus datos personales.
          </p>
          <button onClick={() => navigate('/cuenta/perfil')} className="atlas-btn-primary">
            Configurar Datos Personales
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'resumen':
        return renderResumenSection();
      case 'nomina':
        return config?.seccionesActivas.nomina ? <NominaManager /> : null;
      case 'autonomo':
        return config?.seccionesActivas.autonomo ? <AutonomoView /> : null;
      case 'pension':
        return <PensionTab />;
      case 'gastos':
        return <GastosManager />;
      case 'otros-ingresos':
        return <OtrosIngresosManager />;
      default:
        return null;
    }
  };

  const renderResumenSection = () => {
    if (resumenLoading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div className="animate-spin h-8 w-8 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--navy-900)', borderTopColor: 'transparent' }} />
          <span style={{ marginLeft: 8, color: 'var(--grey-500)' }}>Cargando resumen...</span>
        </div>
      );
    }
    const gastosTabLabel = tabs.find(tab => tab.id === 'gastos')?.name ?? 'Gastos';
    return <PersonalResumenView resumen={resumen} config={config} gastosTabLabel={gastosTabLabel} />;
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          icon={User}
          title="Personal"
          subtitle="Gestión de finanzas personales"
        />
        <div className="p-6">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div className="animate-spin h-8 w-8 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--navy-900)', borderTopColor: 'transparent' }} />
            <span style={{ marginLeft: 8, color: 'var(--grey-500)' }}>Cargando configuración...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={User}
        title="Personal"
        subtitle="Gestión de finanzas personales"
        tabs={tabs.map((tab) => ({ id: tab.id, label: tab.name }))}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          const tab = tabs.find((t) => t.id === tabId);
          if (tab) handleTabClick(tab);
        }}
        actions={<HeaderSecondaryButton icon={Settings} label="Configurar" onClick={() => navigate('/cuenta/perfil')} />}
      />

      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Personal;
