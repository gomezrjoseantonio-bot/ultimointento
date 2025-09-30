import React from 'react';
import { DashboardBlockConfig } from '../../services/dashboardService';

export interface DashboardBlockProps {
  config: DashboardBlockConfig;
  onNavigate?: (route: string, filters?: Record<string, any>) => void;
  className?: string;
}

export interface DashboardBlockData {
  value: string | number;
  formattedValue: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  isLoading?: boolean;
  error?: string;
}

const DashboardBlockBase: React.FC<{
  title: string;
  subtitle?: string;
  data: DashboardBlockData;
  icon: React.ReactNode;
  onNavigate?: () => void;
  className?: string;
  children?: React.ReactNode;
}> = ({ title, subtitle, data, icon, onNavigate, className = '', children }) => {
  const getTrendIcon = () => {
    if (!data.trend || data.trend === 'neutral') return null;
    
    return (
      <span className={`inline-flex items-center text-sm font-medium ${
        data.trend === 'up' ? 'text-success-600' : 'text-error-600'
      }`}>
        {data.trend === 'up' ? '↗' : '↘'}
        {data.trendValue && <span className="ml-1">{data.trendValue}</span>}
      </span>
    );
  };

  if (data.isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-neutral-200 p-6 shadow-sm ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-neutral-200 rounded w-1/3"></div>
            <div className="h-6 w-6 bg-neutral-200 rounded"></div>
          </div>
          <div className="h-8 bg-neutral-200 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className={`bg-white rounded-lg border border-error-200 p-6 shadow-sm ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
          <div className="text-neutral-400">{icon}</div>
        </div>
        <div className="text-error-600 text-sm">{data.error}</div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-neutral-200 p-6 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
          {subtitle && <p className="text-xs text-neutral-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-neutral-400">{icon}</div>
      </div>
      
      <div className="mb-2">
        <div className="text-2xl font-semibold text-neutral-900 mb-1">
          {data.formattedValue}
        </div>
        {getTrendIcon()}
      </div>

      {children}

      {onNavigate && (
        <button
          onClick={onNavigate}
          className="mt-4 text-sm text-brand-navy hover:text-brand-navy- light font-medium flex items-center group"
        >
          Ver detalles
          <svg 
            className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default DashboardBlockBase;