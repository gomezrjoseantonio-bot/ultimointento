import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

/**
 * ATLAS Prompt Service
 * Replaces browser prompts with ATLAS-compliant input modals
 * Following ATLAS Design Bible specifications
 */

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'number' | 'textarea';
  required?: boolean;
  confirmText?: string;
  cancelText?: string;
}

/**
 * Show input prompt as ATLAS modal
 * Returns a Promise that resolves to the input value, or null if cancelled
 */
export const showPrompt = (options: PromptOptions): Promise<string | null> => {
  return new Promise((resolve) => {
    const {
      title,
      message,
      defaultValue = '',
      placeholder,
      type = 'text',
      required = true,
      confirmText = 'Aceptar',
      cancelText = 'Cancelar'
    } = options;

    const PromptModal = (t: any) => {
      const [value, setValue] = useState(defaultValue);
      const [error, setError] = useState('');

      const handleSubmit = () => {
        if (required && !value.trim()) {
          setError('Este campo es obligatorio');
          return;
        }
        
        toast.dismiss(t.id);
        resolve(value);
      };

      const handleCancel = () => {
        toast.dismiss(t.id);
        resolve(null);
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && type !== 'textarea') {
          e.preventDefault();
          handleSubmit();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      };

      return (
        <div className="flex flex-col space-y-4 min-w-[400px] max-w-[500px]">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-base text-atlas-navy-1 mb-1">
                {title}
              </h3>
              {message && (
                <p className="text-sm text-text-gray">
                  {message}
                </p>
              )}
            </div>
            <button
              onClick={handleCancel}
              className="atlas-atlas-atlas-atlas-atlas-btn-ghost p-1 ml-2"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Input */}
          <div>
            {type === 'textarea' ? (
              <textarea
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="atlas-field w-full min-h-[100px]"
                autoFocus
              />
            ) : (
              <input
                type={type}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="atlas-field w-full"
                autoFocus
              />
            )}
            {error && (
              <p className="text-sm text-error mt-1">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              className="atlas-atlas-atlas-atlas-atlas-btn-secondary"
              onClick={handleCancel}
            >
              {cancelText}
            </button>
            <button
              className="atlas-atlas-atlas-atlas-atlas-btn-primary"
              onClick={handleSubmit}
            >
              {confirmText}
            </button>
          </div>
        </div>
      );
    };

    toast(
      (t) => <PromptModal {...t} />,
      {
        duration: Infinity,
        position: 'top-center',
        style: {
          background: 'var(--bg)',
          border: '1px solid var(--hz-neutral-300)',
          borderRadius: '12px',
          padding: '20px',
          minWidth: '400px',
          maxWidth: '500px'
        }
      }
    );
  });
};

/**
 * Quick prompt for text input
 */
export const promptText = (title: string, placeholder?: string, defaultValue?: string): Promise<string | null> => {
  return showPrompt({
    title,
    placeholder,
    defaultValue,
    type: 'text'
  });
};

/**
 * Quick prompt for date input
 */
export const promptDate = (title: string, defaultValue?: string): Promise<string | null> => {
  return showPrompt({
    title,
    type: 'date',
    defaultValue: defaultValue || new Date().toISOString().split('T')[0]
  });
};

/**
 * Quick prompt for multiline text
 */
export const promptTextarea = (title: string, placeholder?: string, defaultValue?: string): Promise<string | null> => {
  return showPrompt({
    title,
    placeholder,
    defaultValue,
    type: 'textarea'
  });
};
