import React from 'react';

type TextVariant = 'caption' | 'body' | 'body-strong' | 'subtitle' | 'kpi' | 'kpi-large';
type TextColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'white';

interface AtlasTextProps {
  variant?: TextVariant;
  color?: TextColor;
  className?: string;
  children: React.ReactNode;
  as?: 'p' | 'span' | 'div' | 'label';
}

const variantClasses: Record<TextVariant, string> = {
  'caption': 'text-[0.875rem] leading-5',
  'body': 'text-[1rem] leading-6',
  'body-strong': 'text-[1rem] leading-6 font-semibold',
  'subtitle': 'text-[1.125rem] leading-7 font-medium',
  'kpi': 'text-[1.5rem] leading-8 font-semibold tabular-nums',
  'kpi-large': 'text-[1.75rem] leading-9 font-bold tabular-nums',
};

const colorClasses: Record<TextColor, string> = {
  'primary': 'text-atlas-navy-1',
  'secondary': 'text-text-gray',
  'success': 'text-ok',
  'warning': 'text-warn',
  'error': 'text-error',
  'white': 'text-white'
};

export const AtlasText: React.FC<AtlasTextProps> = ({
  variant = 'body',
  color = 'primary',
  className = '',
  children,
  as: Component = 'p'
}) => {
  return (
    <Component className={`${variantClasses[variant]} ${colorClasses[color]} ${className}`}>
      {children}
    </Component>
  );
};
