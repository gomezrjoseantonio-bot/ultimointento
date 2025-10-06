import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PageLayout from '../../components/common/PageLayout';
import PersonalDataForm from '../../components/personal/PersonalDataForm';
import PlanFacturacion from '../../modules/horizon/configuracion/plan-facturacion/PlanFacturacion';
import { User, Shield, CreditCard, Database, Settings } from 'lucide-react';

const PandaDocTemplateBuilder = React.lazy(() => import('../../modules/pulse/firmas/plantillas/PandaDocTemplateBuilder'));

type AccountTab = 'perfil' | 'seguridad' | 'plan' | 'privacidad' | 'configuracion';

const AccountPage: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AccountTab>('perfil');
  
  // Update active tab based on current path
  useEffect(() => {
    const pathSegments = location.pathname.split('/');
    const tabFromPath = pathSegments[2] as AccountTab;
    if (['perfil', 'seguridad', 'plan', 'privacidad', 'configuracion'].includes(tabFromPath)) {
      setActiveTab(tabFromPath);
    }
  }, [location.pathname]);

  const tabs = [
    { key: 'perfil', label: 'Perfil', icon: User },
    { key: 'seguridad', label: 'Seguridad', icon: Shield },
    { key: 'plan', label: 'Plan & Facturación', icon: CreditCard },
    { key: 'privacidad', label: 'Privacidad & Datos', icon: Database },
    { key: 'configuracion', label: 'Configuración', icon: Settings },
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
        <PersonalDataForm />
      )}

      {activeTab === 'seguridad' && (
        <div className="bg-white rounded-lg border border-hz-neutral-300 p-6">
          <h2 className="text-lg font-semibold text-atlas-navy-1 mb-4">Seguridad</h2>
          <p className="text-hz-neutral-700">
            En construcción. Próximo hito: configuración de seguridad y autenticación.
          </p>
        </div>
      )}

      {activeTab === 'plan' && (
        <PlanFacturacion />
      )}

      {activeTab === 'privacidad' && (
        <div className="bg-white rounded-lg border border-hz-neutral-300 p-6">
          <h2 className="text-lg font-semibold text-atlas-navy-1 mb-4">Privacidad & Datos</h2>
          <p className="text-hz-neutral-700 mb-4">
            Configuración de privacidad y gestión de datos personales.
          </p>
          <div className="space-y-4">
            <div className="border border-hz-neutral-300 rounded-lg p-4">
              <h3 className="font-medium text-atlas-navy-1 mb-2">Exportación de datos</h3>
              <p className="text-sm text-hz-neutral-700 mb-3">
                Exporta todos tus datos personales en un formato legible.
              </p>
              <button className="px-4 py-2 bg-hz-neutral-700 text-white text-sm rounded-lg hover:bg-atlas-navy-1 transition-colors">
                Solicitar exportación
              </button>
            </div>
            
            <div className="border border-error rounded-lg p-4 bg-error-50">
              <h3 className="font-medium text-error-900 mb-2">Eliminación de cuenta</h3>
              <p className="text-sm text-error-700 mb-3">
                Elimina permanentemente tu cuenta y todos los datos asociados.
              </p>
              <button className="px-4 py-2 bg-error text-white text-sm rounded-lg hover:bg-error-700 transition-colors">
                Eliminar cuenta
              </button>
            </div>
          </div>
        </div>
      )}

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
    </PageLayout>
  );
};

export default AccountPage;