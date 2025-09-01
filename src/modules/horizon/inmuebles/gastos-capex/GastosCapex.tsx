import React, { useState, useEffect } from 'react';
import { PlusIcon, FileTextIcon, CogIcon, BarChart3Icon } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import GastosTab from './components/GastosTab';
import CapexTab from './components/CapexTab';
import ResumenTab from './components/ResumenTab';

type TabType = 'gastos' | 'capex' | 'resumen';

const GastosCapex: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('gastos');
  const [triggerAddExpense, setTriggerAddExpense] = useState(false);

  const tabs = [
    {
      id: 'gastos' as TabType,
      name: 'Gastos',
      icon: FileTextIcon
    },
    {
      id: 'capex' as TabType,
      name: 'CAPEX',
      icon: CogIcon
    },
    {
      id: 'resumen' as TabType,
      name: 'Resumen',
      icon: BarChart3Icon
    }
  ];

  const handleAddExpense = () => {
    setActiveTab('gastos');
    setTriggerAddExpense(true);
  };

  // Reset trigger after it's been used
  useEffect(() => {
    if (triggerAddExpense) {
      const timer = setTimeout(() => setTriggerAddExpense(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerAddExpense]);

  return (
    <PageLayout 
      title="Gastos & CAPEX" 
      subtitle="Capturar, clasificar y prorratear gastos según AEAT; modelar reformas (CAPEX)"
    >
      {/* Action Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handleAddExpense}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-navy-800 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Añadir gasto
        </button>
      </div>

      {/* Segmented Control */}
      <div className="mb-6">
        <div role="tablist" className="flex bg-gray-100 rounded-lg p-1 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`
                  inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-white text-brand-navy shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <Icon className={`-ml-0.5 mr-2 h-4 w-4 ${
                  activeTab === tab.id ? 'text-brand-navy' : 'text-gray-400'
                }`} />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'gastos' && <GastosTab triggerAddExpense={triggerAddExpense} />}
        {activeTab === 'capex' && <CapexTab />}
        {activeTab === 'resumen' && <ResumenTab />}
      </div>
    </PageLayout>
  );
};

export default GastosCapex;