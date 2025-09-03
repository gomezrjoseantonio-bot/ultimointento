import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Calculator } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import MovimientosPanel from './components/MovimientosPanel';
import GastosPanel from './components/GastosPanel';
import CAPEXPanel from './components/CAPEXPanel';
import IngresosPanel from './components/IngresosPanel';

type TabType = 'movimientos' | 'gastos' | 'capex' | 'ingresos';

const Tesoreria: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('movimientos');
  const location = useLocation();
  const navigate = useNavigate();

  // Handle URL hash for tab navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '') as TabType;
    if (['movimientos', 'gastos', 'capex', 'ingresos'].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    navigate(`/tesoreria#${tabId}`, { replace: true });
  };

  const tabs = [
    {
      id: 'movimientos' as TabType,
      name: 'Movimientos',
      icon: CreditCard,
      description: 'Movimientos bancarios importados'
    },
    {
      id: 'gastos' as TabType,
      name: 'Gastos',
      icon: CreditCard,
      description: 'Gastos deducibles (OPEX)'
    },
    {
      id: 'capex' as TabType,
      name: 'CAPEX',
      icon: Calculator,
      description: 'Inversiones amortizables'
    },
    {
      id: 'ingresos' as TabType,
      name: 'Ingresos',
      icon: DollarSign,
      description: 'Contratos, nóminas y recibos'
    }
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'movimientos':
        return <MovimientosPanel />;
      case 'gastos':
        return <GastosPanel />;
      case 'capex':
        return <CAPEXPanel />;
      case 'ingresos':
        return <IngresosPanel />;
      default:
        return <MovimientosPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Tesorería
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Gestión centralizada de ingresos, gastos y conciliación bancaria
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                    ${isActive
                      ? 'border-gray-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon 
                    className={`
                      -ml-0.5 mr-2 h-5 w-5
                      ${isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'}
                    `} 
                  />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default Tesoreria;