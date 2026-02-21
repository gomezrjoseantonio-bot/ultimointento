import React from 'react';

interface AtlasCardProps {
  className?: string;
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const paddingClasses: Record<string, string> = {
  'none': '',
  'sm': 'p-3',
  'md': 'p-4',
  'lg': 'p-6'
};

export const AtlasCard: React.FC<AtlasCardProps> = ({
  className = '',
  children,
  padding = 'md',
  hoverable = false
}) => {
  return (
    <div className={`
      bg-white border border-gray-200 rounded-atlas
      ${paddingClasses[padding]}
      ${hoverable ? 'hover:shadow-card transition-shadow cursor-pointer' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};
