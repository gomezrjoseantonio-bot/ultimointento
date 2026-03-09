import React, { useState, useEffect } from 'react';
import { parseEsNumber, formatEsPercentage } from '../../utils/numberUtils';

interface PercentInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
  'aria-label'?: string;
}

/**
 * PercentInput component for Spanish percentage formatting
 * 
 * Rules:
 * - Spanish format: 3,50 % (comma for decimal, space before %)
 * - Input accepts: 3.5 or 3,5 and normalizes to 3,50 %
 * - Up to 2 decimal places
 * - No extra symbols; the "%" is added by the component
 * - Right-aligned display
 */
const PercentInput: React.FC<PercentInputProps> = ({
  value,
  onChange,
  placeholder = "0,00",
  className = "",
  disabled = false,
  error = false,
  'aria-label': ariaLabel
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Update display value when prop value changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatDisplayValue(value));
    }
  }, [value, isFocused]);

  // Format value for display (with % symbol and Spanish formatting)
  const formatDisplayValue = (val: string): string => {
    if (!val || val === '') return '';
    
    const numValue = parseSpanishPercentInput(val);
    if (numValue === null) return val; // Keep original if can't parse
    
    return formatPercentSpanish(numValue);
  };

  // Parse Spanish percent input - accept both 3.5 and 3,5
  const parseSpanishPercentInput = (input: string): number | null => {
    const result = parseEsNumber(input, { allowPercent: true });
    return result.value;
  };

  // Format number to Spanish percentage format
  const formatPercentSpanish = (amount: number): string => {
    // Convert to percentage rate (0.035 for 3.5%)
    return formatEsPercentage(amount / 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    
    // Always call onChange with the raw input for state management
    onChange(inputValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw value for editing (without % symbol)
    const numValue = parseSpanishPercentInput(value);
    if (numValue !== null) {
      // Format without % symbol for editing
      const rawDisplay = new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numValue);
      setDisplayValue(rawDisplay);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    const parsedValue = parseSpanishPercentInput(displayValue);
    if (parsedValue !== null) {
      // Valid input - update with properly formatted value
      const formattedValue = parsedValue.toString();
      onChange(formattedValue);
      setDisplayValue(formatDisplayValue(formattedValue));
    } else if (displayValue === '') {
      // Empty input is valid
      onChange('');
      setDisplayValue('');
    } else {
      // Invalid input - revert to previous valid value
      setDisplayValue(formatDisplayValue(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, home, end, left, right
    if ([8, 9, 27, 13, 46, 35, 36, 37, 39].indexOf(e.keyCode) !== -1 ||
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true)) {
      return;
    }
    
    // Allow: digits, minus sign (for negative differentials), comma, dot
    if ((e.keyCode >= 48 && e.keyCode <= 57) || // 0-9
        (e.keyCode >= 96 && e.keyCode <= 105) || // numpad 0-9
        e.keyCode === 109 || // minus (numpad)
        e.keyCode === 173 || // minus (regular)
        e.keyCode === 189 || // minus (regular)
        e.keyCode === 188 || // comma
        e.keyCode === 190) { // dot
      return;
    }
    
    e.preventDefault();
  };

  const baseClassName = `w-full px-3 py-2 pr-8 border rounded-md text-right focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent ${
    error ? 'border-error-300' : 'border-neutral-300'
  } ${disabled ? 'bg-neutral-50 text-neutral-500' : ''}`;

  return (
    <div className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onWheel={(e) => e.currentTarget.blur()} // Prevent wheel changes
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || 'Porcentaje'}
        className={`${baseClassName} ${className}`}
        inputMode="decimal" // Show numeric keyboard on mobile
      />
      {!isFocused && (
        <span className="absolute right-3 top-2 text-neutral-500 pointer-events-none">
          {displayValue ? '' : '%'}
        </span>
      )}
    </div>
  );
};

export default PercentInput;