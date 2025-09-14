import React, { forwardRef, ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';

// ATLAS Button Components - Exact specifications
interface AtlasButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

export const AtlasButton = forwardRef<HTMLButtonElement, AtlasButtonProps>(
  ({ variant = 'primary', size = 'md', children, loading, className = '', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm rounded-md',
      md: 'px-4 py-2 text-sm rounded-lg',
      lg: 'px-6 py-3 text-base rounded-lg',
    };
    
    const variantClasses = {
      primary: 'bg-atlas-blue text-white hover:opacity-90 focus:ring-atlas-blue',
      secondary: 'border border-atlas-blue text-atlas-blue bg-white hover:bg-gray-50 focus:ring-atlas-blue',
      destructive: 'bg-error text-white hover:opacity-90 focus:ring-error',
      ghost: 'text-atlas-blue bg-transparent hover:bg-gray-50 focus:ring-atlas-blue',
    };
    
    return (
      <button
        ref={ref}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        style={{
          backgroundColor: variant === 'primary' ? 'var(--atlas-blue)' : 
                          variant === 'destructive' ? 'var(--error)' : undefined,
          borderColor: variant === 'secondary' ? 'var(--atlas-blue)' : undefined,
          color: variant === 'secondary' || variant === 'ghost' ? 'var(--atlas-blue)' : undefined,
        }}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

// ATLAS Card Component
interface AtlasCardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export const AtlasCard: React.FC<AtlasCardProps> = ({ 
  children, 
  className = '', 
  padding = 'md' 
}) => {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`bg-white border rounded-lg shadow-sm ${paddingClasses[padding]} ${className}`}
      style={{
        borderColor: 'var(--hz-neutral-300)',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      {children}
    </div>
  );
};

// ATLAS Chip/Badge Components
interface AtlasChipProps {
  children: ReactNode;
  variant?: 'neutral' | 'pulse' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
}

export const AtlasChip: React.FC<AtlasChipProps> = ({ 
  children, 
  variant = 'neutral', 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  const variantStyles = {
    neutral: {
      backgroundColor: 'var(--chip-bg)',
      color: 'var(--chip-text)',
    },
    pulse: {
      backgroundColor: 'rgba(29, 160, 186, 0.1)',
      color: 'var(--atlas-teal)',
    },
    success: {
      backgroundColor: 'rgba(40, 167, 69, 0.1)',
      color: 'var(--ok)',
    },
    warning: {
      backgroundColor: 'rgba(255, 193, 7, 0.1)',
      color: 'var(--warn)',
    },
    error: {
      backgroundColor: 'rgba(220, 53, 69, 0.1)',
      color: 'var(--error)',
    },
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md ${sizeClasses[size]}`}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  );
};

// ATLAS Input Component
interface AtlasInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const AtlasInput = forwardRef<HTMLInputElement, AtlasInputProps>(
  ({ label, error, helper, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium" style={{ color: 'var(--atlas-navy-1)' }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`block w-full rounded-md border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
            error ? 'border-error' : 'border-gray-300'
          } ${className}`}
          style={{
            fontFamily: 'var(--font-sans)',
            borderColor: error ? 'var(--error)' : 'var(--hz-neutral-300)',
            backgroundColor: 'white',
            color: 'var(--atlas-navy-1)',
          }}
          {...props}
        />
        {helper && !error && (
          <p className="text-xs" style={{ color: 'var(--text-gray)' }}>
            {helper}
          </p>
        )}
        {error && (
          <p className="text-xs" style={{ color: 'var(--error)' }}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

// ATLAS Help Pattern Components (SUA - Sistema Único de Ayuda)

// 1. EmptyState (≤160c, 1–2 CTAs)
interface AtlasEmptyStateProps {
  title: string;
  description: string; // Max 160 characters
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
}

export const AtlasEmptyState: React.FC<AtlasEmptyStateProps> = ({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon
}) => {
  if (description.length > 160) {
    console.warn('ATLAS EmptyState: Description exceeds 160 character limit');
  }

  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mb-4 flex justify-center" style={{ color: 'var(--text-gray)' }}>
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--atlas-navy-1)' }}>
        {title}
      </h3>
      <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--text-gray)' }}>
        {description}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {primaryAction && (
          <AtlasButton onClick={primaryAction.onClick}>
            {primaryAction.label}
          </AtlasButton>
        )}
        {secondaryAction && (
          <AtlasButton variant="secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </AtlasButton>
        )}
      </div>
    </div>
  );
};

// 2. InlineHint (≤90c, texto gris)
interface AtlasInlineHintProps {
  children: string; // Max 90 characters
}

export const AtlasInlineHint: React.FC<AtlasInlineHintProps> = ({ children }) => {
  if (children.length > 90) {
    console.warn('ATLAS InlineHint: Text exceeds 90 character limit');
  }

  return (
    <p className="text-sm" style={{ color: 'var(--text-gray)' }}>
      {children}
    </p>
  );
};

// 3. InfoTooltip (≤200c, icono Lucide info)
interface AtlasInfoTooltipProps {
  content: string; // Max 200 characters
  children: ReactNode;
}

export const AtlasInfoTooltip: React.FC<AtlasInfoTooltipProps> = ({ content, children }) => {
  if (content.length > 200) {
    console.warn('ATLAS InfoTooltip: Content exceeds 200 character limit');
  }

  return (
    <div className="relative inline-flex items-center group">
      {children}
      <button className="ml-1 p-0.5 rounded hover:bg-gray-100">
        <Info size={16} style={{ color: 'var(--text-gray)' }} />
      </button>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-white border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 w-64">
        <p className="text-xs" style={{ color: 'var(--atlas-navy-1)' }}>
          {content}
        </p>
      </div>
    </div>
  );
};

// 4. HelperBanner (1 por vista, descartable, persistente)
interface AtlasHelperBannerProps {
  children: ReactNode;
  onDismiss?: () => void;
  variant?: 'info' | 'warning';
}

export const AtlasHelperBanner: React.FC<AtlasHelperBannerProps> = ({ 
  children, 
  onDismiss, 
  variant = 'info' 
}) => {
  const variantStyles = {
    info: {
      backgroundColor: '#E8F0FF',
      borderColor: 'var(--atlas-blue)',
      color: 'var(--atlas-navy-1)',
    },
    warning: {
      backgroundColor: '#FFF7E6',
      borderColor: 'var(--warn)',
      color: 'var(--atlas-navy-1)',
    },
  };

  const variantIcons = {
    info: <Info size={20} style={{ color: 'var(--atlas-blue)' }} />,
    warning: <AlertTriangle size={20} style={{ color: 'var(--warn)' }} />,
  };

  return (
    <div
      className="flex items-start p-4 rounded-lg border-l-4 mb-6"
      style={variantStyles[variant]}
    >
      <div className="flex-shrink-0 mr-3">
        {variantIcons[variant]}
      </div>
      <div className="flex-1">
        {children}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 ml-3 p-1 rounded hover:bg-black hover:bg-opacity-5"
        >
          <X size={16} style={{ color: 'var(--text-gray)' }} />
        </button>
      )}
    </div>
  );
};

// ATLAS Modal Component (light theme only)
interface AtlasModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AtlasModal: React.FC<AtlasModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Light overlay - no dark overlays per ATLAS */}
      <div 
        className="absolute inset-0 bg-white bg-opacity-75"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div 
        className={`relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]}`}
        style={{ 
          border: '1px solid var(--hz-neutral-300)',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        {title && (
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--hz-neutral-300)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100"
            >
              <X size={20} style={{ color: 'var(--text-gray)' }} />
            </button>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};