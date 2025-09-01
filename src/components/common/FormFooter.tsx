import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface FormFooterProps {
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  sticky?: boolean;
}

const FormFooter: React.FC<FormFooterProps> = ({ 
  onSave, 
  onCancel, 
  saveLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  isSubmitting = false,
  sticky = true
}) => {
  const { currentModule } = useTheme();
  
  const primaryButtonClass = currentModule === 'horizon' 
    ? 'bg-brand-navy hover:bg-navy-800' 
    : 'bg-brand-teal hover:bg-teal-600';

  return (
    <div className={`
      ${sticky ? 'sticky bottom-0' : ''} 
      bg-white border-t border-gray-200 px-6 py-4 mt-8
      ${sticky ? 'shadow-lg' : 'shadow-sm'}
    `}>
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onSave}
          disabled={isSubmitting}
          className={`
            px-4 py-2 text-sm font-medium text-white rounded-md transition-colors
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50
            ${primaryButtonClass}
            ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isSubmitting ? 'Guardando...' : saveLabel}
        </button>
      </div>
    </div>
  );
};

export default FormFooter;