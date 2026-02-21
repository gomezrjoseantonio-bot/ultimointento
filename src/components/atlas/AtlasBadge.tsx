import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface AtlasBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  'success': 'bg-ok-50 text-ok-700 border-ok-200',
  'warning': 'bg-warn-bg text-[#856404] border-[#ffeaa7]',
  'error': 'bg-error-50 text-error-700 border-error-200',
  'info': 'bg-primary-50 text-atlas-blue border-primary-200',
  'neutral': 'bg-gray-100 text-text-gray border-gray-300'
};

export const AtlasBadge: React.FC<AtlasBadgeProps> = ({
  variant = 'neutral',
  children,
  className = ''
}) => {
  return (
    <span className={`
      inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border
      ${variantClasses[variant]}
      ${className}
    `}>
      {children}
    </span>
  );
};
