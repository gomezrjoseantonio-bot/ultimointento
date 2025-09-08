import React, { useState, useEffect } from 'react';
import { TrendingUp, Banknote, CreditCard, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Radar from './radar/Radar';
import CuentasPanel from './components/CuentasPanel';
import Movimientos from './movimientos/Movimientos';
import AutomatizacionesPanel from './components/AutomatizacionesPanel';
import PageHeader from '../../../components/common/PageHeader';

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
        return <Radar />;
      case 'cuentas':
        return <CuentasPanel />;
      case 'movimientos':
        return <Movimientos />;
      case 'automatizaciones':
        return <AutomatizacionesPanel />;
      default:
        return <Radar />;
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--hz-bg)' }}>
      {/* Standardized Page Header */}
      <PageHeader
        title="Tesorería"
        subtitle="Gestión centralizada de cuentas, movimientos y automatizaciones"
        primaryAction={{
          label: "Nueva cuenta",
          onClick: () => {
            // Navigate to specific tab action based on activeTab
            if (activeTab === 'cuentas') {
              // TODO: Open new account modal
            } else if (activeTab === 'movimientos') {
              // TODO: Open new movement modal  
            }
          }
        }}
      />

      {/* Custom Sub-tabs for Treasury (using internal navigation) */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6">
          <div className="flex flex-wrap gap-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    px-1 py-3 text-sm font-medium transition-colors duration-200 relative border-b-2 flex items-center gap-2
                    ${isActive 
                      ? 'border-hz-primary'
                      : 'text-neutral-600 hover:text-neutral-900 border-transparent hover:border-gray-300'
                    }
                  `}
                  style={isActive ? { color: 'var(--hz-primary)' } : {}}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="py-8">
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default Tesoreria;