import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showInfoIcon?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, showInfoIcon = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const titleColorClass = '#022D5E'; // Always navy for H1 as per requirements
  
  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="font-semibold tracking-[-0.01em] text-[22px] leading-[28px] sm:text-[24px] sm:leading-[30px]" style={{ color: titleColorClass }}>
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
      {!showInfoIcon && subtitle && (
        <p className="text-neutral-600 text-sm leading-5 font-normal mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default PageHeader;