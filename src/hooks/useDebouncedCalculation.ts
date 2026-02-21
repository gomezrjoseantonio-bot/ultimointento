import { useState, useEffect } from 'react';
import { PrestamoFinanciacion, CalculoLive } from '../types/financiacion';
import { LiveCalculationService } from '../services/liveCalculationService';

/**
 * Debounced live calculation hook to avoid recalculating on every keystroke.
 * @param formData - Partial loan form data
 * @param delay - Debounce delay in milliseconds (default 300ms)
 */
export const useDebouncedCalculation = (
  formData: Partial<PrestamoFinanciacion>,
  delay: number = 300
): CalculoLive | null => {
  const [calculation, setCalculation] = useState<CalculoLive | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      // calculateFromPrestamo returns null when required fields are missing
      setCalculation(LiveCalculationService.calculateFromPrestamo(formData as PrestamoFinanciacion));
    }, delay);

    return () => clearTimeout(timer);
  }, [formData, delay]);

  return calculation;
};
