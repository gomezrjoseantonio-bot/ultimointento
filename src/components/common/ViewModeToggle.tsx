import React from 'react';
import { Sparkles, Settings } from 'lucide-react';

export type ViewMode = 'simple' | 'advanced';

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  className?: string;
}

/**
 * Sprint 4: View Mode Toggle Component
 * Allows users to switch between simple and advanced modes
 * Simple mode shows only essential fields
 * Advanced mode shows all fields including optional ones
 */
const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ 
  mode, 
  onModeChange, 
  className = '' 
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-gray-400 mr-2">Modo:</span>
      <div className="inline-flex rounded-lg bg-gray-800 p-1 border border-gray-700">
        <button
          onClick={() => onModeChange('simple')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            mode === 'simple'
              ? 'text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          style={{
            backgroundColor: mode === 'simple' ? 'var(--atlas-blue)' : 'transparent'
          }}
          aria-label="Modo simple"
          aria-pressed={mode === 'simple'}
        >
          <Sparkles className="w-4 h-4" />
          Simple
        </button>
        <button
          onClick={() => onModeChange('advanced')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            mode === 'advanced'
              ? 'text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          style={{
            backgroundColor: mode === 'advanced' ? 'var(--atlas-teal)' : 'transparent'
          }}
          aria-label="Modo avanzado"
          aria-pressed={mode === 'advanced'}
        >
          <Settings className="w-4 h-4" />
          Avanzado
        </button>
      </div>
      
      {/* Tooltip explaining the difference */}
      <div className="text-xs text-gray-500 ml-2">
        {mode === 'simple' ? (
          <span>📝 Mostrando solo campos esenciales</span>
        ) : (
          <span>⚙️ Mostrando todos los campos disponibles</span>
        )}
      </div>
    </div>
  );
};

export default ViewModeToggle;
