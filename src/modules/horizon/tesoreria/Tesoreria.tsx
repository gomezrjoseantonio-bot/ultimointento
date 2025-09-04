import React, { useState, useEffect } from 'react';
import { TrendingUp, Banknote, CreditCard, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import RadarPanel from './components/RadarPanel';
import CuentasPanel from './components/CuentasPanel';
import MovimientosPanel from './components/MovimientosPanel';
import AutomatizacionesPanel from './components/AutomatizacionesPanel';

type TabType = 'radar' | 'cuentas' | 'movimientos' | 'automatizaciones';

const Tesoreria: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('radar');
  const location = useLocation();
  const navigate = useNavigate();

  // Handle URL hash for tab navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '') as TabType;
    if (['radar', 'cuentas', 'movimientos', 'automatizaciones'].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    navigate(`/tesoreria#${tabId}`, { replace: true });
  };

  const tabs = [
    {
      id: 'radar' as TabType,
      name: 'Radar',
      icon: TrendingUp,
      description: 'Vista general y KPIs rápidos'
    },
    {
      id: 'cuentas' as TabType,
      name: 'Cuentas',
      icon: Banknote,
      description: 'Detalle de cuentas: alias, saldo, previsión'
    },
    {
      id: 'movimientos' as TabType,
      name: 'Movimientos',
      icon: CreditCard,
      description: 'Listado con importación y conciliación'
    },
    {
      id: 'automatizaciones' as TabType,
      name: 'Automatizaciones',
      icon: Settings,
      description: 'Reglas simples de alertas y sweeps'
    }
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'radar':
        return <RadarPanel />;
      case 'cuentas':
        return <CuentasPanel />;
      case 'movimientos':
        return <MovimientosPanel />;
      case 'automatizaciones':
        return <AutomatizacionesPanel />;
      default:
        return <RadarPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-navy-900">
                  Tesorería
                </h1>
                <p className="mt-1 text-sm text-neutral-500">
                  Gestión centralizada de cuentas, movimientos y automatizaciones
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-neutral-200">
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
                      ? 'border-brand-navy text-brand-navy'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                    }
                  `}
                >
                  <Icon 
                    className={`
                      -ml-0.5 mr-2 h-5 w-5
                      ${isActive ? 'text-brand-navy' : 'text-neutral-400 group-hover:text-neutral-500'}
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