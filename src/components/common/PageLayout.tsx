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
      {/* Row 1: H1 + CTA - 16px spacing to Row 2 */}
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
      
      {/* Row 2: SubTabs - 16px spacing to Row 3 */}
      <div className="mb-4">
        <SubTabs />
      </div>
      
      {/* Row 3 & Content: Segment controls with 12px spacing to content */}
      <div>
        {children}
      </div>
    </div>
  );
};

export default PageLayout;