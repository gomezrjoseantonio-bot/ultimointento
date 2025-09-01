import React, { useState, useEffect } from 'react';
import { PlusIcon, FileTextIcon, CogIcon, BarChart3Icon } from 'lucide-react';
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
      icon: FileTextIcon,
      component: GastosTab
    },
    {
      id: 'capex' as TabType,
      name: 'CAPEX',
      icon: CogIcon,
      component: CapexTab
    },
    {
      id: 'resumen' as TabType,
      name: 'Resumen',
      icon: BarChart3Icon,
      component: ResumenTab
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos & CAPEX</h1>
          <p className="text-gray-600">
            Capturar, clasificar y prorratear gastos según AEAT; modelar reformas (CAPEX)
          </p>
        </div>
        <button
          onClick={handleAddExpense}
          className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-navy-800 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Añadir gasto
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-brand-navy text-brand-navy'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className={`-ml-0.5 mr-2 h-5 w-5 ${
                  activeTab === tab.id
                    ? 'text-brand-navy'
                    : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'gastos' && <GastosTab triggerAddExpense={triggerAddExpense} />}
        {activeTab === 'capex' && <CapexTab />}
        {activeTab === 'resumen' && <ResumenTab />}
      </div>
    </div>
  );
};

export default GastosCapex;