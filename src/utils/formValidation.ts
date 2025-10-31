// Real-time form validation utility for standardized validation across forms
// Sprint 2: UX Audit Implementation - October 31, 2024

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  message?: string;
}

export interface ValidationRules {
  [field: string]: ValidationRule;
}

export interface ValidationErrors {
  [field: string]: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

/**
 * Validates a single field value against its rules
 */
export function validateField(
  fieldName: string,
  value: any,
  rule: ValidationRule
): string | null {
  // Required validation
  if (rule.required && (value === null || value === undefined || value === '')) {
    return rule.message || `${fieldName} es obligatorio`;
  }

  // Skip other validations if field is empty and not required
  if (!rule.required && (value === null || value === undefined || value === '')) {
    return null;
  }

  // String length validations
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) {
      return rule.message || `Debe tener al menos ${rule.minLength} caracteres`;
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return rule.message || `No puede exceder ${rule.maxLength} caracteres`;
    }
  }

  // Number range validations
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return rule.message || `Debe ser al menos ${rule.min}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return rule.message || `No puede exceder ${rule.max}`;
    }
  }

  // Pattern validation (for strings)
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return rule.message || 'Formato inválido';
  }

  // Custom validation
  if (rule.custom) {
    return rule.custom(value);
  }

  return null;
}

/**
 * Validates all fields in a form data object
 */
export function validateForm(
  formData: Record<string, any>,
  rules: ValidationRules
): ValidationResult {
  const errors: ValidationErrors = {};

  Object.keys(rules).forEach((fieldName) => {
    const value = formData[fieldName];
    const rule = rules[fieldName];
    const error = validateField(fieldName, value, rule);
    
    if (error) {
      errors[fieldName] = error;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(\+34|0034|34)?[6789]\d{8}$/,
  postalCode: /^\d{5}$/,
  iban: /^ES\d{22}$/,
  cadastralRef: /^\d{14}[A-Z]{2}$/,
  // Spanish DNI/NIE
  nif: /^[0-9]{8}[A-Z]$/,
  nie: /^[XYZ][0-9]{7}[A-Z]$/,
  cif: /^[A-Z][0-9]{7}[A-Z0-9]$/
};

/**
 * Common validation rules for frequently used fields
 */
export const CommonValidationRules = {
  alias: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'El alias debe tener entre 2 y 100 caracteres'
  },
  address: {
    required: true,
    minLength: 5,
    maxLength: 200,
    message: 'La dirección debe tener entre 5 y 200 caracteres'
  },
  postalCode: {
    required: true,
    pattern: ValidationPatterns.postalCode,
    message: 'Código postal debe tener 5 dígitos'
  },
  email: {
    required: true,
    pattern: ValidationPatterns.email,
    message: 'Email inválido'
  },
  phone: {
    pattern: ValidationPatterns.phone,
    message: 'Teléfono español inválido'
  },
  iban: {
    pattern: ValidationPatterns.iban,
    message: 'IBAN español inválido (debe empezar con ES y tener 24 caracteres)'
  },
  cadastralRef: {
    pattern: ValidationPatterns.cadastralRef,
    message: 'Referencia catastral inválida (14 dígitos + 2 letras)'
  },
  price: {
    required: true,
    min: 0,
    message: 'El precio debe ser mayor o igual a 0'
  },
  squareMeters: {
    required: true,
    min: 1,
    max: 100000,
    message: 'Los metros cuadrados deben estar entre 1 y 100000'
  }
};

/**
 * Hook-friendly validation function that returns touched state helper
 */
export function createFormValidator(rules: ValidationRules) {
  return {
    validateField: (fieldName: string, value: any) => {
      const rule = rules[fieldName];
      if (!rule) return null;
      return validateField(fieldName, value, rule);
    },
    validateForm: (formData: Record<string, any>) => {
      return validateForm(formData, rules);
    }
  };
}

/**
 * Utility to get user-friendly field names for error messages
 */
export function getFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    alias: 'Alias',
    address: 'Dirección',
    postalCode: 'Código Postal',
    email: 'Email',
    phone: 'Teléfono',
    iban: 'IBAN',
    cadastralRef: 'Referencia Catastral',
    price: 'Precio',
    squareMeters: 'Metros Cuadrados',
    bedrooms: 'Habitaciones',
    bathrooms: 'Baños',
    // Add more as needed
  };
  return labels[fieldName] || fieldName;
}
