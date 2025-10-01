import React from 'react';
import toast from 'react-hot-toast';

/**
 * Atlas Treasury Toast Service
 * 
 * Provides consistent toast notifications with Atlas styling and behavior
 * Following Prompt 5 requirements for UX and error handling
 */

export interface ToastOptions {
  duration?: number;
  position?: 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right';
  actionLabel?: string;
  actionHandler?: () => void;
}

// Atlas Horizon corporate colors - Using CSS variables for consistency
const ATLAS_COLORS = {
  navy: 'var(--brand-navy)',       // Azul marino Horizon - color base principal
  turquoise: 'var(--brand-teal)',  // Turquesa Pulse - reservado solo para Pulse
  success: 'var(--hz-success)',    // Verde - OK, validado, conciliado
  warning: 'var(--hz-warning)',    // Amarillo - warning, pendiente de revisión
  error: 'var(--hz-error)',        // Rojo - error, descuadre
  info: 'var(--hz-info)'           // Info blue
};

/**
 * Success toast (green) - for completed actions
 */
export const showSuccess = (message: string, options: ToastOptions = {}): string => {
  const toastConfig: any = {
    duration: options.duration || 3000,
    position: options.position || 'top-right',
    style: {
      background: 'var(--bg)', // Use ATLAS background token
      color: ATLAS_COLORS.navy,
      border: `1px solid ${ATLAS_COLORS.success}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500'
    },
    iconTheme: {
      primary: ATLAS_COLORS.success,
      secondary: 'var(--bg)' // Use ATLAS background token
    }
  };

  // FIX PACK v1.0: Add CTA button support
  if (options.actionLabel && options.actionHandler) {
    return toast.success(
      (t) => (
        <div className="flex items-center justify-between w-full">
          <span>{message}</span>
          <button
            onClick={() => {
              options.actionHandler!();
              toast.dismiss(t.id);
            }}
            className="atlas-atlas-atlas-btn-primary ml-3 px-2 py-1 text-xs rounded"
          >
            {options.actionLabel}
          </button>
        </div>
      ),
      toastConfig
    );
  }

  return toast.success(message, toastConfig);
};

/**
 * Error toast (red) - for failed actions with suggested solutions
 */
export const showError = (message: string, suggestedAction?: string, options: ToastOptions = {}): string => {
  const fullMessage = suggestedAction 
    ? `${message}\n💡 ${suggestedAction}`
    : message;

  return toast.error(fullMessage, {
    duration: options.duration || 5000, // Longer duration for errors
    position: options.position || 'top-right',
    style: {
      background: 'var(--bg)', // Use ATLAS background token
      color: ATLAS_COLORS.navy,
      border: `1px solid ${ATLAS_COLORS.error}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      whiteSpace: 'pre-line' as const
    },
    iconTheme: {
      primary: ATLAS_COLORS.error,
      secondary: 'var(--bg)' // Use ATLAS background token
    }
  });
};

/**
 * Info toast (blue) - for informational messages
 */
export const showInfo = (message: string, options: ToastOptions = {}): string => {
  return toast(message, {
    duration: options.duration || 4000,
    position: options.position || 'top-right',
    icon: 'ℹ️',
    style: {
      background: 'var(--bg)', // Use ATLAS background token
      color: ATLAS_COLORS.navy,
      border: `1px solid ${ATLAS_COLORS.turquoise}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500'
    }
  });
};

/**
 * Warning toast (orange) - for warnings and cautions
 */
export const showWarning = (message: string, options: ToastOptions = {}): string => {
  return toast(message, {
    duration: options.duration || 4000,
    position: options.position || 'top-right',
    icon: '⚠️',
    style: {
      background: 'var(--bg)', // Use ATLAS background token
      color: ATLAS_COLORS.navy,
      border: `1px solid ${ATLAS_COLORS.warning}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500'
    }
  });
};

/**
 * Loading toast - for ongoing operations
 */
export const showLoading = (message: string, options: ToastOptions = {}): string => {
  return toast.loading(message, {
    position: options.position || 'top-right',
    style: {
      background: 'var(--bg)', // Use ATLAS background token
      color: ATLAS_COLORS.navy,
      border: `1px solid ${ATLAS_COLORS.turquoise}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500'
    }
  });
};

/**
 * Promise toast - for async operations with automatic success/error handling
 */
export const showPromise = (
  promise: Promise<any>,
  messages: {
    loading: string;
    success: string | ((data: any) => string);
    error: string | ((error: any) => string);
  },
  options: ToastOptions = {}
): Promise<any> => {
  return toast.promise(promise, messages, {
    position: options.position || 'top-right',
    style: {
      background: 'var(--bg)', // Use ATLAS background token
      color: ATLAS_COLORS.navy,
      border: `1px solid ${ATLAS_COLORS.turquoise}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500'
    },
    success: {
      style: {
        background: 'var(--bg)', // Use ATLAS background token
        border: `1px solid ${ATLAS_COLORS.success}`
      }
    },
    error: {
      style: {
        background: 'var(--bg)', // Use ATLAS background token
        border: `1px solid ${ATLAS_COLORS.error}`
      }
    }
  });
};

// Common error patterns with suggested actions
export const COMMON_ERRORS = {
  NETWORK_ERROR: {
    message: 'Error de conexión',
    suggestion: 'Verifica tu conexión a internet e inténtalo de nuevo'
  },
  VALIDATION_ERROR: {
    message: 'Datos incompletos o incorrectos',
    suggestion: 'Revisa los campos marcados y completa la información requerida'
  },
  PERMISSION_ERROR: {
    message: 'Sin permisos para realizar esta acción',
    suggestion: 'Contacta al administrador si necesitas acceso'
  },
  FILE_SIZE_ERROR: {
    message: 'Archivo demasiado grande',
    suggestion: 'Reduce el tamaño del archivo o divide en varios archivos más pequeños'
  },
  FILE_FORMAT_ERROR: {
    message: 'Formato de archivo no compatible',
    suggestion: 'Usa formatos PDF, CSV, XLS o XLSX'
  },
  PARSING_ERROR: {
    message: 'Error procesando el archivo',
    suggestion: 'Verifica que el archivo no esté corrupto y tenga el formato correcto'
  },
  BANK_IMPORT_ERROR: {
    message: 'Error importando movimientos bancarios',
    suggestion: 'Verifica que el extracto tenga el formato correcto de tu banco'
  },
  OCR_ERROR: {
    message: 'Error procesando documento con OCR',
    suggestion: 'Asegúrate de que el documento sea legible y esté bien escaneado'
  },
  SAVE_ERROR: {
    message: 'Error guardando cambios',
    suggestion: 'Verifica los datos e inténtalo de nuevo'
  }
};

/**
 * Utility function to show common errors with consistent messaging
 */
export const showCommonError = (
  errorType: keyof typeof COMMON_ERRORS,
  customMessage?: string,
  options: ToastOptions = {}
): string => {
  const error = COMMON_ERRORS[errorType];
  const message = customMessage || error.message;
  return showError(message, error.suggestion, options);
};

/**
 * Dismiss a specific toast
 */
export const dismissToast = (toastId: string): void => {
  toast.dismiss(toastId);
};

/**
 * Dismiss all toasts
 */
export const dismissAllToasts = (): void => {
  toast.dismiss();
};