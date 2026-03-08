import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PageLayout from '../../components/common/PageLayout';
import ProfileView from '../../modules/personal/components/ProfileView';
import PlanFacturacion from '../../modules/horizon/configuracion/plan-facturacion/PlanFacturacion';
import MigracionTab from './MigracionTab';
import Cuentas from '../../modules/horizon/configuracion/cuentas/CuentasContainer';
import { User, CreditCard, Settings, Upload } from 'lucide-react';

const PandaDocTemplateBuilder = React.lazy(() => import('../../modules/pulse/firmas/plantillas/PandaDocTemplateBuilder'));

type AccountTab = 'perfil' | 'plan' | 'cuentas' | 'configuracion' | 'migracion';

const AccountPage: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AccountTab>('perfil');
  
  // Update active tab based on current path
  useEffect(() => {
    const pathSegments = location.pathname.split('/');
    const tabFromPath = pathSegments[2] as AccountTab;
    if (['perfil', 'plan', 'cuentas', 'configuracion', 'migracion'].includes(tabFromPath)) {
      setActiveTab(tabFromPath);
    }
  }, [location.pathname]);

  const tabs = [
    { key: 'perfil', label: 'Perfil', icon: User },
    { key: 'plan', label: 'Plan & Facturación', icon: CreditCard },
    { key: 'cuentas', label: 'Métodos de pago', icon: CreditCard },
    { key: 'configuracion', label: 'Configuración', icon: Settings },
    { key: 'migracion', label: 'Migración de Datos', icon: Upload },
  ];

  return (
    <PageLayout title="Cuenta" subtitle="Configuración de tu cuenta y preferencias globales.">
      {/* Account Sub-tabs */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as AccountTab)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 relative ${
                activeTab === tab.key
                  ? 'text-atlas-blue bg-transparent'
                  : 'text-hz-neutral-700 bg-transparent hover:bg-hz-neutral-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute -bottom-px left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-atlas-blue" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'perfil' && (
        <ProfileView />
      )}

      {activeTab === 'plan' && (
        <PlanFacturacion />
      )}

      {activeTab === 'cuentas' && <Cuentas />}

      {activeTab === 'configuracion' && (
        <React.Suspense fallback={
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-atlas-blue border-t-transparent"></div>
            <span className="ml-2 text-hz-neutral-700">Cargando...</span>
          </div>
        }>
          <PandaDocTemplateBuilder />
        </React.Suspense>
      )}

      {activeTab === 'migracion' && (
        <MigracionTab />
      )}
    </PageLayout>
  );
};

export default AccountPage;
