// H8: AutoSave Toggle Component
import React, { useState, useEffect } from 'react';
import { getAutoSaveConfig, setAutoSaveConfig } from '../../services/autoSaveService';

interface AutoSaveToggleProps {
  onConfigChange?: (enabled: boolean) => void;
}

const AutoSaveToggle: React.FC<AutoSaveToggleProps> = ({ onConfigChange }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const config = getAutoSaveConfig();
    setIsEnabled(config.enabled);
  }, []);

  const handleToggle = async () => {
    setIsLoading(true);
    
    try {
      const newEnabled = !isEnabled;
      setAutoSaveConfig({ enabled: newEnabled });
      setIsEnabled(newEnabled);
      
      // Notify parent component
      onConfigChange?.(newEnabled);
      
      if (process.env.NODE_ENV === 'development') {
        console.info('AutoSave toggle changed:', { enabled: newEnabled });
      }
    } catch (error) {
      console.error('Error toggling autosave:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-neutral-200">
      <div className="flex items-center">
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`
            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2
            ${isEnabled ? 'bg-teal-500 focus:ring-teal-400' : 'bg-gray-200 focus:ring-gray-400'}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          role="switch"
          aria-checked={isEnabled}
          aria-label="Toggle autosave"
        >
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
              transition duration-200 ease-in-out
              ${isEnabled ? 'translate-x-5' : 'translate-x-0'}
            `}
          />
        </button>
      </div>
      
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-900">
          Autoguardado
        </label>
        <p className="text-xs text-gray-500">
          {isEnabled 
            ? 'ON: Los documentos se mueven automáticamente a su carpeta destino'
            : 'OFF: Los documentos quedan pendientes para revisión manual'
          }
        </p>
      </div>
      
      <div className="flex items-center">
        <span className={`
          inline-flex px-3 py-1 text-xs font-medium rounded-full
          ${isEnabled 
            ? 'bg-teal-100 text-teal-800' 
            : 'bg-warning-100 text-yellow-800'
          }
        `}>
          {isEnabled ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  );
};

export default AutoSaveToggle;