import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
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
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  primaryAction,
  secondaryAction,
}) => {
  return (
    <div style={{
      background: 'var(--white)',
      borderBottom: '1px solid var(--grey-200)',
      padding: '16px 24px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {Icon && (
            <Icon size={20} style={{ color: 'var(--grey-500)', flexShrink: 0 }} />
          )}
          <div>
            <h1 style={{
              fontSize: 'var(--t-xl)',
              fontWeight: 700,
              color: 'var(--grey-900)',
              lineHeight: 1.3,
              margin: 0,
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{
                fontSize: 'var(--t-sm)',
                fontWeight: 400,
                color: 'var(--grey-500)',
                margin: '2px 0 0',
                lineHeight: 1.4,
              }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className="btn-header"
            >
              {secondaryAction.icon && <secondaryAction.icon size={16} />}
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className={primaryAction.variant === 'header' ? 'btn-header' : ''}
              style={primaryAction.variant !== 'header' ? {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 'var(--r-md)',
                border: 'none',
                background: 'var(--navy-900)',
                color: 'var(--white)',
                fontSize: 'var(--t-base)',
                fontWeight: 500,
                cursor: primaryAction.disabled ? 'not-allowed' : 'pointer',
                opacity: primaryAction.disabled ? 0.4 : 1,
                fontFamily: 'var(--font-base)',
                transition: 'all 150ms ease',
              } : undefined}
            >
              {primaryAction.icon && <primaryAction.icon size={16} />}
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
