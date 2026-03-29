import React, { useState } from 'react';
// lucide-react icons removed – v4 underline tabs without icons
import PageHeader from '../../../../components/common/PageHeader';
import CuentasManagement, { CuentasManagementRef } from './components/CuentasManagement';
import AccountAnalytics from './components/AccountAnalytics';

/**
 * Mi Cuenta → Cuentas - ATLAS Design System
 * 
 * Enhanced account management container with complete model, validations and propagation
 */
const CuentasContainer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cuentas' | 'analytics'>('cuentas');
  const cuentasRef = React.useRef<CuentasManagementRef>(null);

  const tabs = [
    { id: 'cuentas' as const, name: 'Cuentas Bancarias' },
    { id: 'analytics' as const, name: 'Analítica' },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <PageHeader
        title="Mi Cuenta"
        subtitle="Gestión de cuentas bancarias con validaciones y propagación completa"
        primaryAction={activeTab === 'cuentas' ? {
          label: "Nueva cuenta",
          onClick: () => {
            cuentasRef.current?.triggerNewAccount();
          }
        } : undefined}
      />

      {/* Subtabs Navigation */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6">
          <div className="flex flex-wrap gap-6">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-1 py-3 text-sm font-medium transition-colors duration-200 relative border-b-2
                    ${isActive
                      ? 'border-atlas-blue text-atlas-blue'
                      : 'text-text-gray hover:text-atlas-navy-1 border-transparent hover:border-gray-300'
                    }
                  `}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="py-8">
        {activeTab === 'cuentas' && <CuentasManagement ref={cuentasRef} />}
        {activeTab === 'analytics' && <AccountAnalytics className="mx-6" />}
      </div>
    </div>
  );
};

export default CuentasContainer;