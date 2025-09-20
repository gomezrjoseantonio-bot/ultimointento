import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  className?: string;
  onClick?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = '',
  onClick
}) => {
  const isClickable = !!onClick;

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 p-6 
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon && (
              <div className="flex-shrink-0" style={{ color: 'var(--hz-primary)' }}>
                {icon}
              </div>
            )}
            <h3 className="text-sm font-medium text-gray-600 truncate">
              {title}
            </h3>
          </div>
          
          <div className="mb-1">
            <p 
              className="text-2xl font-semibold"
              >
              style={{ color: 'var(--hz-text)' }}
            >
              {value}
            </p>
          </div>
          
          {subtitle && (
            <p className="text-sm text-gray-500 mb-2">
              {subtitle}
            </p>
          )}
          
          {trend && (
            <div className="flex items-center gap-1">
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-hz-success' : 'text-hz-error'
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-sm text-gray-500">
                  {trend.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KpiCard;