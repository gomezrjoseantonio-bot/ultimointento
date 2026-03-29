import React, { useState, useEffect } from 'react';
// lucide-react icons removed – v4 underline tabs without icons
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
    { id: 'gastos' as TabType, name: 'Gastos' },
    { id: 'resumen' as TabType, name: 'Resumen' },
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
      {/* v4 Underline tabs — sin iconos */}
      <div className="mb-3" style={{ borderBottom: '1px solid var(--grey-200, #e5e7eb)' }}>
        <div role="tablist" className="flex" style={{ gap: 0 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={isActive}
                style={{
                  padding: '10px 0',
                  marginRight: 32,
                  fontSize: 'var(--t-base, 0.875rem)',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--atlas-blue, #2563EB)' : 'var(--grey-500, #6B7280)',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--atlas-blue, #2563EB)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 150ms ease',
                  marginBottom: -1,
                }}
              >
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