import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PageLayout from '../../components/common/PageLayout';
import { useTheme } from '../../contexts/ThemeContext';
import { User, Shield, CreditCard, Database } from 'lucide-react';

type AccountTab = 'perfil' | 'seguridad' | 'plan' | 'privacidad';

const AccountPage: React.FC = () => {
  const { currentModule } = useTheme();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AccountTab>('perfil');
  
  // Update active tab based on current path
  useEffect(() => {
    const pathSegments = location.pathname.split('/');
    const tabFromPath = pathSegments[2] as AccountTab;
    if (['perfil', 'seguridad', 'plan', 'privacidad'].includes(tabFromPath)) {
      setActiveTab(tabFromPath);
    }
  }, [location.pathname]);
  
  const accentColor = currentModule === 'horizon' ? 'brand-navy' : 'brand-teal';

  const tabs = [
    { key: 'perfil', label: 'Perfil', icon: User },
    { key: 'seguridad', label: 'Seguridad', icon: Shield },
    { key: 'plan', label: 'Plan & Facturación', icon: CreditCard },
    { key: 'privacidad', label: 'Privacidad & Datos', icon: Database },
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
                  ? `text-${accentColor} bg-transparent`
                  : 'text-neutral-600 bg-transparent hover:bg-neutral-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.key && (
                <div className={`absolute -bottom-px left-1/2 transform -translate-x-1/2 w-full h-0.5 bg-${accentColor}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'perfil' && (
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Perfil de Usuario</h2>
          <p className="text-neutral-600">
            En construcción. Próximo hito: configuración de perfil de usuario.
          </p>
        </div>
      )}

      {activeTab === 'seguridad' && (
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Seguridad</h2>
          <p className="text-neutral-600">
            En construcción. Próximo hito: configuración de seguridad y autenticación.
          </p>
        </div>
      )}

      {activeTab === 'plan' && (
        <div>
          {/* Render the existing Plan & Facturación component but without PageLayout wrapper */}
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Plan & Facturación</h2>
            <p className="text-neutral-600">
              En construcción. Próximo hito: funcionalidades.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'privacidad' && (
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Privacidad & Datos</h2>
          <p className="text-neutral-600 mb-4">
            Configuración de privacidad y gestión de datos personales.
          </p>
          <div className="space-y-4">
            <div className="border border-neutral-200 rounded-lg p-4">
              <h3 className="font-medium text-neutral-900 mb-2">Exportación de datos</h3>
              <p className="text-sm text-neutral-600 mb-3">
                Exporta todos tus datos personales en un formato legible.
              </p>
              <button className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg hover:bg-neutral-800 transition-colors">
                Solicitar exportación
              </button>
            </div>
            
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <h3 className="font-medium text-red-900 mb-2">Eliminación de cuenta</h3>
              <p className="text-sm text-red-700 mb-3">
                Elimina permanentemente tu cuenta y todos los datos asociados.
              </p>
              <button className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
                Eliminar cuenta
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default AccountPage;