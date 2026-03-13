import React from 'react';

interface TaxFieldRowProps {
  label: string;
  value: number | string;
  onChange?: (value: number | string) => void;
  type?: 'number' | 'text';
  readOnly?: boolean;
}

const TaxFieldRow: React.FC<TaxFieldRowProps> = ({ label, value, onChange, type = 'number', readOnly = false }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange || readOnly) return;
    onChange(type === 'number' ? Number(event.target.value) : event.target.value);
  };

  return (
    <div className="tax-field-row">
      <label>{label}</label>
      <input className="tax-field-row__input" type={type} value={value} onChange={handleChange} readOnly={readOnly} />
    </div>
  );
};

export default TaxFieldRow;
