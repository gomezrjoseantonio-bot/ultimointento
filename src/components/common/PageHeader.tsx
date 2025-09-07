import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
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
  showInfoIcon = false,
  primaryAction,
  secondaryActions = []
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 
            className="font-semibold tracking-[-0.01em] text-[24px] leading-[32px]" 
            style={{ color: 'var(--hz-text)' }}
          >
            {title}
          </h1>
          {showInfoIcon && subtitle && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
                aria-describedby="page-info-tooltip"
              >
                <Info className="h-4 w-4" />
              </button>
              {showTooltip && (
                <div 
                  id="page-info-tooltip"
                  className="absolute top-6 left-0 bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 z-10 whitespace-nowrap max-w-xs"
                  role="tooltip"
                >
                  {subtitle}
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