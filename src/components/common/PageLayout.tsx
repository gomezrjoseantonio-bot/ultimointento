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
      <div className="sticky top-0 z-10 bg-neutral-50 pb-4">
        <PageHeader title={title} subtitle={subtitle} />
        <div className="mt-4">
          <SubTabs />
        </div>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;