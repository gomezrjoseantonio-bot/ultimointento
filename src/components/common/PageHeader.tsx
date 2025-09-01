import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle }) => {
  const { currentModule } = useTheme();
  
  const titleColorClass = currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal';
  
  return (
    <div>
      <h1 className={`font-semibold tracking-[-0.01em] mb-4 ${titleColorClass} text-[22px] leading-[28px] sm:text-[24px] sm:leading-[30px]`}>
        {title}
      </h1>
      {subtitle && (
        <p className="text-neutral-600 text-sm leading-5 font-normal">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default PageHeader;