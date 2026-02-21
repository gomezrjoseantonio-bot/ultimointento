import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface AtlasButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
}

const baseClasses = 'inline-flex items-center justify-center font-medium transition-all rounded-atlas disabled:opacity-50 disabled:cursor-not-allowed';

const variantClasses: Record<ButtonVariant, string> = {
  'primary': 'bg-atlas-blue text-white hover:bg-atlas-blue-dark active:bg-[#021530]',
  'secondary': 'bg-white text-atlas-blue border-2 border-atlas-blue hover:bg-primary-50',
  'danger': 'bg-error text-white hover:bg-[#b02a37] active:bg-[#8b1f2a]',
  'ghost': 'bg-transparent text-atlas-blue hover:bg-primary-50'
};

const sizeClasses: Record<ButtonSize, string> = {
  'sm': 'px-3 py-1.5 text-sm h-8',
  'md': 'px-4 py-2 text-base h-10',
  'lg': 'px-6 py-3 text-base h-12'
};

export const AtlasButton: React.FC<AtlasButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  onClick,
  type = 'button',
  children
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && (
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
      )}
      {children}
    </button>
  );
};
