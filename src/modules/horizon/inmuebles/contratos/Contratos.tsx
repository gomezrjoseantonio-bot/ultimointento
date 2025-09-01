import React, { useState } from 'react';
import { Plus, Calendar, CreditCard, List } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import ContractsLista from './components/ContractsLista';
import ContractsNuevo from './components/ContractsNuevo';
import ContractsCalendario from './components/ContractsCalendario';
import ContractsCobros from './components/ContractsCobros';

type TabId = 'lista' | 'nuevo' | 'calendario' | 'cobros';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { id: 'lista', label: 'Lista', icon: List },
  { id: 'nuevo', label: 'Nuevo', icon: Plus },
  { id: 'calendario', label: 'Calendario', icon: Calendar },
  { id: 'cobros', label: 'Cobros', icon: CreditCard },
];

const Contratos: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('lista');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleContractCreated = () => {
    setRefreshKey(prev => prev + 1);
    setActiveTab('lista');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'lista':
        return <ContractsLista key={refreshKey} onEditContract={() => setActiveTab('nuevo')} />;
      case 'nuevo':
        return <ContractsNuevo onContractCreated={handleContractCreated} onCancel={() => setActiveTab('lista')} />;
      case 'calendario':
        return <ContractsCalendario key={refreshKey} />;
      case 'cobros':
        return <ContractsCobros key={refreshKey} />;
      default:
        return <ContractsLista key={refreshKey} onEditContract={() => setActiveTab('nuevo')} />;
    }
  };

  return (
    <PageLayout 
      title="Contratos" 
      subtitle="Gestión de contratos de alquiler por inmueble completo o por unidades."
    >
      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-brand-navy text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        
        {/* Tab underline for active tab */}
        <div className="mt-2 h-0.5 bg-neutral-200">
          <div 
            className="h-full bg-brand-turquoise transition-all duration-200"
            style={{
              width: `${100 / tabs.length}%`,
              transform: `translateX(${tabs.findIndex(t => t.id === activeTab) * 100}%)`,
            }}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </PageLayout>
  );
};

export default Contratos;