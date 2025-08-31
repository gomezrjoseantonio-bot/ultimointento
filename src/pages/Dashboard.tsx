import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Inbox } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { currentModule } = useTheme();

  const getModuleInfo = () => {
    switch (currentModule) {
      case 'horizon':
        return {
          title: 'Horizon — Invest',
          subtitle: 'Plataforma de Inversión Inmobiliaria',
          accentColor: 'brand-navy',
          description: 'Gestiona tu cartera inmobiliaria, rastrea el rendimiento y monitorea inversiones.',
        };
      case 'pulse':
        return {
          title: 'Pulse — Personal',
          subtitle: 'Gestión de Finanzas Personales',
          accentColor: 'brand-teal',
          description: 'Controla tus finanzas personales, rastrea gastos y planifica tu futuro financiero.',
        };
      default:
        return {
          title: 'ATLAS',
          subtitle: 'Plataforma de Gestión Financiera',
          accentColor: 'brand-navy',
          description: 'Bienvenido a ATLAS',
        };
    }
  };

  const moduleInfo = getModuleInfo();

  return (
    <div className="space-y-8">
      {/* Module Header */}
      <div className="text-center py-12">
        <h1 className={`text-4xl font-semibold mb-2 ${
          currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal'
        }`}>
          {moduleInfo.title}
        </h1>
        <p className="text-xl text-gray-600 mb-4">{moduleInfo.subtitle}</p>
        <p className="text-gray-500 max-w-2xl mx-auto">{moduleInfo.description}</p>
      </div>

      {/* Empty State */}
      <div className="bg-white shadow rounded-atlas border border-gray-200">
        <div className="text-center py-16 px-6">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            currentModule === 'horizon' 
              ? 'bg-brand-navy bg-opacity-10' 
              : 'bg-brand-teal bg-opacity-10'
          }`}>
            <Inbox className={`w-8 h-8 ${
              currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal'
            }`} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Empezar</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Tu {currentModule === 'horizon' ? 'cartera de inversiones' : 'panel de finanzas personales'} está vacío. 
            {' '}Comienza importando tus datos o agregando nuevas entradas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              className={`px-6 py-2 rounded-atlas hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                currentModule === 'horizon' 
                  ? 'bg-brand-navy text-white focus:ring-brand-navy' 
                  : 'bg-brand-teal text-white focus:ring-brand-teal'
              }`}
            >
              Importar Datos
            </button>
            <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-atlas hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2">
              Saber Más
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;