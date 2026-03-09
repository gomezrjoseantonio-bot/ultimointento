// Form Error Summary component for displaying all validation errors
// Sprint 2: UX Audit Implementation - October 31, 2024

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ValidationErrors } from '../../utils/formValidation';

interface FormErrorSummaryProps {
  errors: ValidationErrors;
  fieldLabels?: Record<string, string>;
  className?: string;
  onErrorClick?: (fieldName: string) => void;
}

const FormErrorSummary: React.FC<FormErrorSummaryProps> = ({
  errors,
  fieldLabels = {},
  className = '',
  onErrorClick
}) => {
  const errorEntries = Object.entries(errors);

  if (errorEntries.length === 0) {
    return null;
  }

  const getFieldLabel = (fieldName: string): string => {
    return fieldLabels[fieldName] || fieldName;
  };

  const handleErrorClick = (fieldName: string) => {
    if (onErrorClick) {
      onErrorClick(fieldName);
    } else {
      // Default behavior: try to focus the field
      // Sanitize fieldName to prevent CSS injection
      const sanitizedName = fieldName.replace(/[^\w-]/g, '');
      const element = document.querySelector(`[name="${sanitizedName}"]`) as HTMLElement;
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <div
      className={`rounded-lg border border-error-200 bg-error-50 p-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-error-600 flex-shrink-0 mt-0.5" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-error-800">
            {errorEntries.length === 1
              ? 'Hay 1 error en el formulario'
              : `Hay ${errorEntries.length} errores en el formulario`}
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-error-700 list-disc list-inside">
            {errorEntries.map(([fieldName, errorMessage]) => (
              <li key={fieldName}>
                <button
                  type="button"
                  onClick={() => handleErrorClick(fieldName)}
                  className="underline hover:text-error-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                >
                  <strong>{getFieldLabel(fieldName)}:</strong> {errorMessage}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FormErrorSummary;
