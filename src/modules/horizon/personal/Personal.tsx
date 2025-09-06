import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Banknote, CreditCard, TrendingUp, Settings } from 'lucide-react';
import PageLayout from '../../../components/common/PageLayout';

const Personal: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/resumen')) return 'resumen';
    if (path.includes('/cuentas')) return 'cuentas';
    if (path.includes('/movimientos')) return 'movimientos';
    if (path.includes('/presupuesto')) return 'presupuesto';
    if (path.includes('/reglas')) return 'reglas';
    return 'resumen';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  const tabs = [
    { id: 'resumen', name: 'Resumen', icon: Home, href: '/personal/resumen' },
    { id: 'cuentas', name: 'Cuentas', icon: Banknote, href: '/personal/cuentas' },
    { id: 'movimientos', name: 'Movimientos', icon: CreditCard, href: '/personal/movimientos' },
    { id: 'presupuesto', name: 'Presupuesto', icon: TrendingUp, href: '/personal/presupuesto' },
    { id: 'reglas', name: 'Reglas', icon: Settings, href: '/personal/reglas' },
  ];

  const handleTabClick = (tab: typeof tabs[0]) => {
    setActiveTab(tab.id);
    navigate(tab.href);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'resumen':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen Personal</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Ingresos del mes</p>
                  <p className="text-2xl font-semibold text-gray-900">0,00 €</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Gastos del mes</p>
                  <p className="text-2xl font-semibold text-gray-900">0,00 €</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Balance</p>
                  <p className="text-2xl font-semibold text-gray-900">0,00 €</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'cuentas':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Cuentas Personales</h3>
              <p className="text-gray-500">Gestiona tus cuentas bancarias personales y saldos.</p>
              <div className="mt-4">
                <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
                  Añadir Cuenta
                </button>
              </div>
            </div>
          </div>
        );
      case 'movimientos':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Movimientos</h3>
              <p className="text-gray-500">Registro manual básico de movimientos financieros personales.</p>
              <div className="mt-4">
                <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
                  Nuevo Movimiento
                </button>
              </div>
            </div>
          </div>
        );
      case 'presupuesto':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Presupuesto</h3>
              <p className="text-gray-500">Planifica y compara tu presupuesto personal (plan vs real).</p>
              <div className="mt-4">
                <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
                  Configurar Presupuesto
                </button>
              </div>
            </div>
          </div>
        );
      case 'reglas':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reglas de Automatización</h3>
              <p className="text-gray-500">Configura alertas ligeras y categorización automática.</p>
              <div className="mt-4">
                <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
                  Nueva Regla
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <PageLayout 
      title="Personal" 
      subtitle="Gestión ligera de finanzas personales"
    >
      <div className="space-y-6">
        {/* Tab Navigation - Neutral Styling */}
        <div className="bg-white rounded-lg border border-gray-200 p-1">
          <div className="grid grid-cols-5 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900 border-b-2 border-gray-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </PageLayout>
  );
};

export default Personal;