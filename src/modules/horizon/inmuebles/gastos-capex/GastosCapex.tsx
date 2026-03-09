import React, { useState, useEffect } from 'react';
import { FileTextIcon, BarChart3Icon } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { useTheme } from '../../../../contexts/ThemeContext';
import GastosTab from './components/GastosTab';
import ResumenTab from './components/ResumenTab';

type TabType = 'gastos' | 'resumen';

const GastosCapex: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('gastos');
  const [triggerAddExpense, setTriggerAddExpense] = useState(false);
  const { currentModule } = useTheme();

  const tabs = [
    {
      id: 'gastos' as TabType,
      name: 'Gastos',
      icon: FileTextIcon
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
      title="Gastos" 
      subtitle="Capturar, clasificar y conciliar gastos por tipo; incluye amortizables (mejora/mobiliario)"
      showInfoIcon={true}
      primaryAction={{
        label: "Añadir gasto",
        onClick: handleAddExpense
      }}
    >
      {/* Segmented Control - Row 3 with proper spacing */}
      <div className="mb-3">
        <div role="tablist" className="flex bg-gray-100 rounded-lg p-1 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const activeColor = currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal';
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={isActive}
                className={`
                  inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                  ${isActive
                    ? `bg-white ${activeColor} shadow-sm`
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <Icon className={`-ml-0.5 mr-2 h-4 w-4 ${
                  isActive ? activeColor : 'text-gray-400'
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
        {activeTab === 'resumen' && <ResumenTab />}
      </div>
    </PageLayout>
  );
};

export default GastosCapex;