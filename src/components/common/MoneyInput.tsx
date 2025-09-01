import React, { useState, useEffect, useCallback } from 'react';

interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
  'aria-label'?: string;
}

/**
 * MoneyInput component for Spanish Euro formatting
 * 
 * Rules:
 * - Spanish format: 1.234,56 € (dots for thousands, comma for decimal)
 * - Input accepts: digits, spaces, "." and "," and "€" symbol
 * - Interpretation: comma = decimal, dots = thousands (if no comma)
 * - Storage: exact decimal arithmetic using cents internally
 * - Validation: rejects ambiguous Anglo-Saxon formats like "95,678.21"
 */
const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder = "0,00",
  className = "",
  disabled = false,
  error = false,
  'aria-label': ariaLabel
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Parse Spanish Euro input - strict Spanish format interpretation
  const parseSpanishEuroInput = useCallback((input: string): number | null => {
    if (!input || input.trim() === '') {
      return null;
    }
    
    // Remove currency symbols and spaces
    let cleaned = input.replace(/[€\s]/g, '');
    
    // Check for Anglo-Saxon format (comma before dot near end)
    if (/\d,\d{3}\.\d{1,2}$/.test(cleaned)) {
      return null; // Will trigger validation error
    }
    
    // Handle the case where we get a decimal number as string (e.g., "9567.8" from calculations)
    // If it looks like a simple decimal number without formatting, treat the dot as decimal separator
    if (/^\d+\.\d+$/.test(cleaned) && !cleaned.includes(',')) {
      return parseFloat(cleaned);
    }
    
    // Split by comma to check for decimal part
    const parts = cleaned.split(',');
    
    if (parts.length > 2) {
      return null; // Multiple commas not allowed
    }
    
    if (parts.length === 2) {
      // Has decimal part
      const [integerPart, decimalPart] = parts;
      
      // Decimal part should be 1-2 digits
      if (decimalPart.length > 2) {
        return null;
      }
      
      // Remove dots from integer part (thousands separators)
      const cleanInteger = integerPart.replace(/\./g, '');
      const cleanDecimal = decimalPart.padEnd(2, '0'); // Pad to 2 digits
      
      if (!/^\d+$/.test(cleanInteger) || !/^\d{1,2}$/.test(decimalPart)) {
        return null;
      }
      
      return parseFloat(`${cleanInteger}.${cleanDecimal}`);
    } else {
      // No decimal part - dots are thousands separators
      const cleanInteger = cleaned.replace(/\./g, '');
      
      if (!/^\d+$/.test(cleanInteger)) {
        return null;
      }
      
      return parseFloat(cleanInteger);
    }
  }, []);

  // Format number to Spanish Euro format
  const formatEuroSpanish = useCallback((amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  // Format value for display (with Euro symbol and Spanish formatting)
  const formatDisplayValue = useCallback((val: string): string => {
    if (!val || val === '') return '';
    
    const numValue = parseSpanishEuroInput(val);
    if (numValue === null) return val; // Keep original if can't parse
    
    return formatEuroSpanish(numValue);
  }, [parseSpanishEuroInput, formatEuroSpanish]);

  // Update display value when prop value changes
  useEffect(() => {
    if (!isFocused) {
      const formatted = formatDisplayValue(value);
      setDisplayValue(formatted);
    }
  }, [value, isFocused, formatDisplayValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    setValidationError('');
    
    // Parse and validate on every change for immediate feedback
    const parsedValue = parseSpanishEuroInput(inputValue);
    if (inputValue && parsedValue === null) {
      // Check if it looks like Anglo-Saxon format
      if (/\d,\d{3}\.\d{1,2}$/.test(inputValue.replace(/[€\s]/g, ''))) {
        setValidationError('Usa formato español: 1.234,56');
      } else {
        setValidationError('Formato no válido');
      }
    }
    
    // Always call onChange with the raw input for state management
    onChange(inputValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw value for editing (without currency symbol)
    const numValue = parseSpanishEuroInput(value);
    if (numValue !== null) {
      // Format without currency symbol for editing
      const rawDisplay = new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numValue);
      setDisplayValue(rawDisplay);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    const parsedValue = parseSpanishEuroInput(displayValue);
    if (parsedValue !== null) {
      // Valid input - update with properly formatted value
      const formattedValue = parsedValue.toString();
      onChange(formattedValue);
      setDisplayValue(formatDisplayValue(formattedValue));
      setValidationError('');
    } else if (displayValue === '') {
      // Empty input is valid
      onChange('');
      setDisplayValue('');
      setValidationError('');
    } else {
      // Invalid input - keep showing validation error
      if (!validationError) {
        setValidationError('Formato no válido');
      }
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
    
    // Allow: digits, comma, dot, euro symbol
    if ((e.keyCode >= 48 && e.keyCode <= 57) || // 0-9
        (e.keyCode >= 96 && e.keyCode <= 105) || // numpad 0-9
        e.keyCode === 188 || // comma
        e.keyCode === 190 || // dot
        e.keyCode === 32) { // space
      return;
    }
    
    e.preventDefault();
  };

  const baseClassName = `w-full px-3 py-2 pr-8 border rounded-md text-right focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent ${
    error || validationError ? 'border-red-300' : 'border-neutral-300'
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
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || 'Importe en euros'}
        className={`${baseClassName} ${className}`}
      />
      {!isFocused && (
        <span className="absolute right-3 top-2 text-neutral-500 pointer-events-none">
          {displayValue ? '' : '€'}
        </span>
      )}
      {validationError && (
        <p className="text-sm text-red-600 mt-1">{validationError}</p>
      )}
    </div>
  );
};

export default MoneyInput;