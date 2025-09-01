import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, AppModule } from '../../contexts/ThemeContext';

const ModuleSelector: React.FC = () => {
  const { currentModule, setCurrentModule } = useTheme();
  const navigate = useNavigate();

  const handleModuleChange = (module: AppModule) => {
    setCurrentModule(module);
    // Navigate to panel when switching modules to ensure valid route
    navigate('/panel');
  };

  return (
    <div className="flex items-center bg-gray-100 rounded-atlas p-1">
      <button
        className={`px-4 py-2 text-sm font-medium rounded-atlas transition-all duration-200 ${
          currentModule === 'horizon'
            ? 'bg-brand-navy text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        onClick={() => handleModuleChange('horizon' as AppModule)}
      >
        Horizon
      </button>
      <div className="w-px h-4 bg-gray-300 mx-1" />
      <button
        className={`px-4 py-2 text-sm font-medium rounded-atlas transition-all duration-200 ${
          currentModule === 'pulse'
            ? 'bg-brand-teal text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        onClick={() => handleModuleChange('pulse' as AppModule)}
      >
        Pulse
      </button>
    </div>
  );
};

export default ModuleSelector;