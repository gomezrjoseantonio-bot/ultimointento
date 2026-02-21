import React from 'react';
import { LucideIcon } from 'lucide-react';

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type IconColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'white' | 'inherit';

interface AtlasIconProps {
  icon: LucideIcon;
  size?: IconSize;
  color?: IconColor;
  className?: string;
}

const sizeMap: Record<IconSize, number> = {
  'xs': 12,
  'sm': 16,
  'md': 20,
  'lg': 24,
  'xl': 32
};

const colorClasses: Record<IconColor, string> = {
  'primary': 'text-atlas-blue',
  'secondary': 'text-text-gray',
  'success': 'text-ok',
  'warning': 'text-warn',
  'error': 'text-error',
  'white': 'text-white',
  'inherit': 'text-current'
};

export const AtlasIcon: React.FC<AtlasIconProps> = ({
  icon: Icon,
  size = 'md',
  color = 'inherit',
  className = ''
}) => {
  return (
    <Icon
      size={sizeMap[size]}
      strokeWidth={1.5}
      className={`${colorClasses[color]} ${className}`}
    />
  );
};
