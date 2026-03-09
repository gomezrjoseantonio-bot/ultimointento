import React from 'react';
import { AlertCircle } from 'lucide-react';

interface AtlasInputProps {
  type?: 'text' | 'number' | 'email' | 'password' | 'date';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  suffix?: string;
}

export const AtlasInput: React.FC<AtlasInputProps> = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  error,
  disabled = false,
  className = '',
  suffix
}) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-atlas-navy-1 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full rounded-atlas border px-4 py-2
            focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-error-500 ring-2 ring-error-200 bg-error-50' : 'border-gray-300'}
            ${suffix ? 'pr-12' : ''}
          `}
        />

        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-text-gray text-sm">{suffix}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1 text-error-600 text-sm mt-1">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
