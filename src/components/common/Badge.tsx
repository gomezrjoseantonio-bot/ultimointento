import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant, 
  size = 'md', 
  className = '' 
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'horizon-badge-success';
      case 'warning':
        return 'horizon-badge-warning';
      case 'error':
        return 'horizon-badge-error';
      case 'info':
        return 'horizon-badge-info';
      case 'neutral':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'md':
        return 'px-2.5 py-0.5 text-sm';
      default:
        return 'px-2.5 py-0.5 text-sm';
    }
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${getVariantClasses()}
        ${getSizeClasses()}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export default Badge;