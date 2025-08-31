import React from 'react';
import PageHeader from './PageHeader';
import SubTabs from './SubTabs';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ title, subtitle, children }) => {
  return (
    <div className="space-y-0">
      <PageHeader title={title} subtitle={subtitle} />
      <SubTabs />
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;