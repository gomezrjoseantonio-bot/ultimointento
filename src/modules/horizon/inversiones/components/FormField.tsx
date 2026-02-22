// FormField.tsx
// ATLAS HORIZON: Reusable form field with label, error, helpText

import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, error, helpText, required, children }) => {
  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-inter)',
        fontSize: 'var(--text-caption)',
        fontWeight: 500,
        color: 'var(--atlas-navy-1)',
        marginBottom: '0.5rem',
      }}>
        {label}{required && ' *'}
      </label>
      {children}
      {helpText && !error && (
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-gray)', marginTop: '0.25rem', display: 'block' }}>
          {helpText}
        </span>
      )}
      {error && (
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--error)', marginTop: '0.25rem', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  );
};

export default FormField;
