import React from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

/**
 * ATLAS Confirmation Service
 * Replaces browser alerts with ATLAS-compliant toast confirmations
 * Following ATLAS Design Bible specifications
 */

export interface ConfirmationOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  duration?: number;
}

/**
 * Show confirmation dialog as ATLAS toast
 * Returns a Promise that resolves to true if confirmed, false if cancelled
 */
export const showConfirmation = (options: ConfirmationOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    const {
      title,
      message,
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      type = 'warning',
      duration = 0 // No auto-dismiss for confirmations
    } = options;

    const IconComponent = type === 'danger' ? AlertTriangle : 
                         type === 'info' ? Info : AlertTriangle;

    const colors = {
      warning: {
        bg: 'var(--bg)',
        border: 'var(--warn)',
        icon: 'var(--warn)',
        confirmBg: 'var(--warn)',
        confirmText: '#FFFFFF'
      },
      danger: {
        bg: 'var(--bg)',
        border: 'var(--error)',
        icon: 'var(--error)',
        confirmBg: 'var(--error)',
        confirmText: '#FFFFFF'
      },
      info: {
        bg: 'var(--bg)',
        border: 'var(--atlas-blue)',
        icon: 'var(--atlas-blue)',
        confirmBg: 'var(--atlas-blue)',
        confirmText: '#FFFFFF'
      }
    };

    const colorScheme = colors[type];

    const ConfirmationToast = (t: any) => (
      <div className="flex flex-col space-y-3 min-w-[300px]">
        <div className="flex items-start space-x-3">
          <IconComponent 
            className="h-5 w-5 mt-0.5 flex-shrink-0" 
            style={{ color: colorScheme.icon }}
          />
          <div className="flex-1">
            {title && (
              <div className="font-semibold text-sm text-atlas-navy-1 mb-1">
                {title}
              </div>
            )}
            <div className="text-sm text-atlas-navy-1">
              {message}
            </div>
          </div>
        </div>
        <div className="flex space-x-2 justify-end pt-2 border-t border-gray-200">
          <button
            onClick={() => {
              toast.dismiss(t.id);
              resolve(false);
            }}
            className="px-3 py-1.5 text-sm font-medium text-text-gray bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-atlas-blue focus:ring-offset-2 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              resolve(true);
            }}
            className="px-3 py-1.5 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
            style={{
              backgroundColor: colorScheme.confirmBg,
              color: colorScheme.confirmText,
              border: `1px solid ${colorScheme.border}`
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    );

    toast(
      (t) => <ConfirmationToast {...t} />,
      {
        duration,
        position: 'top-center',
        style: {
          background: colorScheme.bg,
          border: `1px solid ${colorScheme.border}`,
          borderRadius: '12px',
          padding: '16px',
          minWidth: '320px',
          maxWidth: '480px'
        }
      }
    );
  });
};

/**
 * Quick confirmation for common actions
 */
export const confirmDelete = (itemName?: string): Promise<boolean> => {
  return showConfirmation({
    title: 'Confirmar eliminación',
    message: itemName 
      ? `¿Estás seguro de que quieres eliminar "${itemName}"? Esta acción no se puede deshacer.`
      : '¿Estás seguro de que quieres eliminar este elemento? Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
};

/**
 * Quick confirmation for save/update actions
 */
export const confirmSave = (message?: string): Promise<boolean> => {
  return showConfirmation({
    title: 'Confirmar cambios',
    message: message || '¿Guardar los cambios realizados?',
    confirmText: 'Guardar',
    cancelText: 'Cancelar',
    type: 'info'
  });
};

/**
 * Quick confirmation for potentially destructive actions
 */
export const confirmAction = (action: string, consequence?: string): Promise<boolean> => {
  return showConfirmation({
    title: `Confirmar ${action}`,
    message: consequence 
      ? `¿Estás seguro de que quieres ${action}? ${consequence}`
      : `¿Estás seguro de que quieres ${action}?`,
    confirmText: 'Continuar',
    cancelText: 'Cancelar',
    type: 'warning'
  });
};