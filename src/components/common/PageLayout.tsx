import React from 'react';
import { LucideIcon } from 'lucide-react';
import PageHeader from './PageHeader';
import SubTabs from './SubTabs';

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  showInfoIcon?: boolean;
  icon?: LucideIcon;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'header';
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    icon?: LucideIcon;
  };
  tabs?: { label: string; path: string }[];
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  subtitle,
  showInfoIcon,
  icon,
  primaryAction,
  secondaryAction,
  tabs,
  children
}) => {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        showInfoIcon={showInfoIcon}
        icon={icon}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
      />
      <SubTabs tabs={tabs} />
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
