import React, { useState, useRef } from 'react';
import { Banknote, Settings } from 'lucide-react';
import PageHeader from '../../../../components/common/PageHeader';
import BancosManagement, { BancosManagementRef } from './components/BancosManagement';
import ReglasAlertas from './components/ReglasAlertas';

/**
 * Cuentas - ATLAS Design System
 * 
 * Main container for account management with subtabs:
 * - Bancos: Bank account management
 * - Reglas y alertas: Rules and alerts configuration
 */
const Cuentas: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bancos' | 'reglas'>('bancos');
  const bancosRef = useRef<BancosManagementRef>(null);

  const tabs = [
    {
      id: 'bancos' as const,
      name: 'Bancos',
      icon: Banknote,
    },
    {
      id: 'reglas' as const,
      name: 'Reglas y alertas',
      icon: Settings,
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <PageHeader
        title="Cuentas"
        subtitle="Gestión de cuentas bancarias y reglas de clasificación"
        primaryAction={{
          label: activeTab === 'bancos' ? "Nueva cuenta" : "Nueva regla",
          onClick: () => {
            // Handle based on active tab
            if (activeTab === 'bancos') {
              bancosRef.current?.triggerNewAccount();
            } else {
              // Will be handled by ReglasAlertas component
            }
          }
        }}
      />

      {/* Subtabs Navigation */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6">
          <div className="flex flex-wrap gap-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-1 py-3 text-sm font-medium transition-colors duration-200 relative border-b-2 flex items-center gap-2
                    ${isActive 
                      ? 'border-atlas-blue text-atlas-blue'
                      : 'text-text-gray hover:text-atlas-navy-1 border-transparent hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-6 w-6" style={{ strokeWidth: 1.5 }} />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="py-8">
        {activeTab === 'bancos' && <BancosManagement ref={bancosRef} />}
        {activeTab === 'reglas' && <ReglasAlertas />}
      </div>
    </div>
  );
};

export default Cuentas;