import React from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

/**
 * ATLAS ProgressBar Component
 * Sprint 3: UX improvement for uploads and imports
 * 
 * Provides visual feedback during long-running operations
 */

interface ProgressBarProps {
  progress: number; // 0-100
  status?: 'loading' | 'success' | 'error' | 'idle';
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  indeterminate?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status = 'loading',
  label,
  showPercentage = true,
  size = 'md',
  className = '',
  indeterminate = false,
}) => {
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3',
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'var(--hz-success)';
      case 'error':
        return 'var(--hz-error)';
      case 'loading':
        return 'var(--hz-primary)';
      default:
        return 'var(--hz-neutral-400)';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4" style={{ color: 'var(--hz-success)' }} />;
      case 'error':
        return <AlertCircle className="h-4 w-4" style={{ color: 'var(--hz-error)' }} />;
      case 'loading':
        return <Loader className="h-4 w-4 animate-spin" style={{ color: 'var(--hz-primary)' }} />;
      default:
        return null;
    }
  };

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      {/* Label and percentage */}
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm font-medium" style={{ color: 'var(--hz-text)' }}>
                {label}
              </span>
            </div>
          )}
          {showPercentage && !indeterminate && (
            <span className="text-sm font-medium" style={{ color: 'var(--hz-neutral-600)' }}>
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div
        className={`w-full rounded-full overflow-hidden ${sizeClasses[size]}`}
        style={{ backgroundColor: 'var(--hz-neutral-200)' }}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            indeterminate ? 'animate-pulse' : ''
          }`}
          style={{
            width: indeterminate ? '100%' : `${clampedProgress}%`,
            backgroundColor: getStatusColor(),
          }}
        />
      </div>
    </div>
  );
};

/**
 * Upload Progress Component
 * Specialized component for file upload progress
 */
interface UploadProgressProps {
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  fileName,
  progress,
  status,
  error,
  onCancel,
  onRetry,
}) => {
  const getStatusLabel = () => {
    switch (status) {
      case 'uploading':
        return 'Subiendo...';
      case 'success':
        return 'Completado';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  };

  return (
    <div className="border rounded-lg p-4" style={{ borderColor: 'var(--hz-neutral-300)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--hz-text)' }}>
            {fileName}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--hz-neutral-600)' }}>
            {getStatusLabel()}
          </p>
        </div>
        {status === 'uploading' && onCancel && (
          <button
            onClick={onCancel}
            className="ml-3 text-sm text-gray-500 hover:text-gray-700"
            aria-label="Cancelar subida"
          >
            Cancelar
          </button>
        )}
      </div>

      <ProgressBar
        progress={progress}
        status={status === 'uploading' ? 'loading' : status}
        showPercentage={status === 'uploading'}
      />

      {error && status === 'error' && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--hz-error)' }}>
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-3 text-sm font-medium hover:underline"
              style={{ color: 'var(--hz-primary)' }}
            >
              Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Batch Progress Component
 * Shows progress for multiple items being processed
 */
interface BatchProgressProps {
  total: number;
  completed: number;
  label?: string;
  className?: string;
}

export const BatchProgress: React.FC<BatchProgressProps> = ({
  total,
  completed,
  label = 'Procesando',
  className = '',
}) => {
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className={className}>
      <ProgressBar
        progress={progress}
        status={completed === total ? 'success' : 'loading'}
        label={`${label} (${completed} de ${total})`}
        showPercentage
      />
    </div>
  );
};

export default ProgressBar;
