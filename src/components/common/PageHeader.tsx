import React, { useState } from 'react';
import { Info, ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  infoText?: string;
  breadcrumb?: BreadcrumbItem[];
  showInfoIcon?: boolean;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  secondaryActions?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }[];
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  infoText,
  breadcrumb,
  showInfoIcon = false,
  primaryAction,
  secondaryActions = []
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex mb-2" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            {breadcrumb.map((item, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                )}
                <a
                  href={item.href}
                  className={`text-sm ${
                    index === breadcrumb.length - 1
                      ? 'text-gray-500'
                      : 'text-atlas-blue hover:text-primary-800'
                  }`}
                >
                  {item.name}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <h1 
            className="font-semibold tracking-[-0.01em] text-[24px] leading-[32px]" 
            style={{ color: 'var(--n-700)' }}
          >
            {title}
          </h1>
          {showInfoIcon && infoText && !subtitle && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="inline-flex items-center justify-center h-4 w-4 rounded-full border transition-colors"
                style={{ borderColor: 'var(--n-300)', color: 'var(--n-500)' }}
                aria-describedby="page-info-tooltip"
                aria-label="Más información"
              >
                <Info className="h-3 w-3" />
              </button>
              {showTooltip && (
                <div 
                  id="page-info-tooltip"
                  className="absolute top-6 left-0 text-sm rounded-md px-3 py-2 z-10 max-w-xs border shadow-md"
                  style={{ background: 'var(--white)', color: 'var(--n-700)', borderColor: 'var(--n-300)' }}
                  role="tooltip"
                >
                  {infoText}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Primary Action Button - Top Right as per specification */}
        <div className="flex items-center gap-2">
          {secondaryActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              disabled={action.disabled}
              className="horizon-secondary px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.label}
            </button>
          ))}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="horizon-primary px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
      
      {/* Subtitle below title when not using info icon */}
      {!showInfoIcon && subtitle && (
        <p className="text-neutral-600 text-sm leading-5 font-normal mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default PageHeader;
