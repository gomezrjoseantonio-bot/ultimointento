import React from 'react';
import PageHeader from './PageHeader';
import SubTabs from './SubTabs';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  showInfoIcon?: boolean;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ 
  title, 
  subtitle, 
  showInfoIcon = false,
  primaryAction,
  children 
}) => {
  return (
    <div className="space-y-4">
      {/* Row 1: H1 + CTA */}
      <div className="flex justify-between items-start">
        <PageHeader 
          title={title} 
          subtitle={subtitle} 
          showInfoIcon={showInfoIcon}
        />
        {primaryAction && (
          <div className="ml-4">
            {primaryAction}
          </div>
        )}
      </div>
      
      {/* Row 2: SubTabs */}
      <div>
        <SubTabs />
      </div>
      
      {/* Row 3 & Content: Will be handled by individual pages for segment controls */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;