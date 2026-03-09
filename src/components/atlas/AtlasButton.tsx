import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
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

const baseClasses = 'inline-flex min-h-11 items-center justify-center font-medium transition-all duration-150 ease-in-out rounded-[var(--r-md)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2 focus-visible:shadow-[0_0_0_4px_var(--focus-ring)]';

const variantClasses: Record<ButtonVariant, string> = {
  'primary': 'bg-[var(--blue)] text-[var(--white)] hover:bg-[var(--blue-hover)]',
  'secondary': 'border border-[var(--blue)] bg-[var(--white)] text-[var(--blue)] hover:bg-[var(--n-100)]',
  'danger': 'border border-[var(--s-neg)] bg-[var(--s-neg)] text-[var(--white)] hover:bg-[color-mix(in_srgb,var(--s-neg)_85%,black)]',
  'ghost': 'bg-transparent text-[var(--blue)] hover:bg-[var(--n-100)]',
  'icon': 'min-w-11 bg-transparent text-[var(--blue)] hover:bg-[var(--n-100)]'
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
