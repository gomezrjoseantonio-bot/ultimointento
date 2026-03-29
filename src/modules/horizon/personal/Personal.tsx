import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Settings } from 'lucide-react';
import PageHeader, { HeaderSecondaryButton } from '../../../components/shared/PageHeader';
import GastosManager from '../../../components/personal/gastos/GastosManager';
import IngresosUnifiedManager from '../../../components/personal/ingresos/IngresosUnifiedManager';
import { personalDataService } from '../../../services/personalDataService';
import { personalResumenService } from '../../../services/personalResumenService';
import { PersonalData, PersonalModuleConfig, ResumenPersonalMensual } from '../../../types/personal';
import PersonalResumenView from './PersonalResumenView';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'ingresos', label: 'Ingresos' },
  { id: 'gastos', label: 'Gastos' },
];

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
    if (path.includes('/ingresos') || path.includes('/nomina') || path.includes('/autonomo') || path.includes('/pension') || path.includes('/otros-ingresos')) return 'ingresos';
    if (path.includes('/gastos')) return 'gastos';
    return 'resumen';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  useEffect(() => {
    loadConfiguration();
  }, []);

  useEffect(() => {
    if (activeTab === 'resumen') {
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

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    navigate(`/personal/${tabId}`);
  };

  const hasProfile = !!(config && personalData);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'resumen':
        return renderResumenSection();
      case 'ingresos':
        return <IngresosUnifiedManager />;
      case 'gastos':
        return <GastosManager />;
      default:
        return null;
    }
  };

  const renderResumenSection = () => {
    if (resumenLoading && config) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div className="animate-spin h-8 w-8 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--navy-900)', borderTopColor: 'transparent' }} />
          <span style={{ marginLeft: 8, color: 'var(--grey-500)' }}>Cargando resumen...</span>
        </div>
      );
    }
    return (
      <PersonalResumenView
        resumen={resumen}
        config={config}
        hasProfile={hasProfile}
        onConfigure={() => navigate('/cuenta/perfil')}
        gastosTabLabel="Gastos"
      />
    );
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
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        actions={<HeaderSecondaryButton icon={Settings} label="Configurar" onClick={() => navigate('/cuenta/perfil')} />}
      />

      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Personal;
