import React from 'react';
import PageHeader from './PageHeader';
import SubTabs from './SubTabs';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  showInfoIcon?: boolean;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryActions?: {
    label: string;
    onClick: () => void;
  }[];
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ 
  title, 
  subtitle, 
  showInfoIcon = false,
  primaryAction,
  secondaryActions,
  children 
}) => {
  return (
    <div>
      {/* Standardized Page Header */}
      <PageHeader 
        title={title} 
        subtitle={subtitle} 
        showInfoIcon={showInfoIcon}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
      
      {/* SubTabs */}
      <SubTabs />
      
      {/* Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;