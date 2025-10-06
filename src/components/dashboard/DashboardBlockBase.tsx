import React from 'react';
import { DashboardBlockConfig } from '../../services/dashboardService';

export interface DashboardBlockProps {
  config: DashboardBlockConfig;
  onNavigate?: (route: string, filters?: Record<string, any>) => void;
  className?: string;
  excludePersonal?: boolean;
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
  filterLabel?: string;
}> = ({ title, subtitle, data, icon, onNavigate, className = '', children, filterLabel }) => {
  const getTrendBadge = () => {
    if (!data.trend || data.trend === 'neutral') return null;

    const isUp = data.trend === 'up';
    const colorClasses = isUp
      ? 'bg-success-50 text-success-700'
      : 'bg-error-50 text-error-700';

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${colorClasses}`}
      >
        <span className="inline-flex h-2.5 w-2.5 items-center justify-center">
          <svg
            className="h-2.5 w-2.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            {isUp ? (
              <path d="M10 3l6.5 11h-13L10 3z" />
            ) : (
              <path d="M10 17L3.5 6h13L10 17z" />
            )}
          </svg>
        </span>
        {data.trendValue ?? (isUp ? 'En aumento' : 'En descenso')}
      </span>
    );
  };

  if (data.isLoading) {
    return (
      <div
        className={`relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/80 p-6 shadow-[0_20px_65px_-32px_rgba(4,44,94,0.45)] backdrop-blur ${className}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(4,44,94,0.06),transparent_55%)]" />
        <div className="relative z-10 animate-pulse space-y-5">
          <div className="flex items-center justify-between">
            <div className="h-4 w-1/3 rounded-full bg-neutral-200" />
            <div className="h-10 w-10 rounded-2xl bg-neutral-200" />
          </div>
          <div className="h-9 w-2/3 rounded-full bg-neutral-200" />
          <div className="h-4 w-1/2 rounded-full bg-neutral-200" />
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div
        className={`relative overflow-hidden rounded-3xl border border-error-200/70 bg-error-50/80 p-6 shadow-sm ${className}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <div className="rounded-2xl bg-error-100 p-2 text-error-600">{icon}</div>
        </div>
        <div className="text-sm font-medium text-error-700">{data.error}</div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-white/80 p-6 shadow-[0_24px_80px_-40px_rgba(4,44,94,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_32px_90px_-40px_rgba(4,44,94,0.55)] backdrop-blur ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,160,186,0.08),transparent_55%)]" />
      <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-brand-teal via-primary-300 to-brand-navy opacity-80" />

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-[0.14em]">
              {title}
            </h3>
            {subtitle && <p className="mt-2 text-xs text-neutral-500">{subtitle}</p>}
            {filterLabel && (
              <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-teal/40 bg-brand-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-brand-teal">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />
                {filterLabel}
              </span>
            )}
          </div>
          <div className="rounded-2xl bg-brand-navy/10 p-2 text-brand-navy">
            {icon}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-neutral-900">
              {data.formattedValue}
            </p>
          </div>
          {getTrendBadge()}
        </div>

        {children && <div className="mt-6 text-sm text-neutral-600">{children}</div>}

        {onNavigate && (
          <button
            onClick={onNavigate}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition hover:border-brand-teal/60 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60"
          >
            Ver detalles
            <svg
              className="h-4 w-4 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardBlockBase;