import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  lucideIcon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  lucideIcon: LIcon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={className} style={{ textAlign: 'center', padding: '48px 24px' }}>
      {LIcon && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <LIcon size={48} style={{ color: 'var(--grey-400)' }} />
        </div>
      )}
      {icon && !LIcon && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', color: 'var(--grey-400)' }}>
          {icon}
        </div>
      )}

      <h3 style={{
        fontSize: 'var(--t-md)',
        fontWeight: 600,
        color: 'var(--grey-700)',
        marginBottom: 4,
      }}>
        {title}
      </h3>

      {description && (
        <p style={{
          fontSize: 'var(--t-sm)',
          fontWeight: 400,
          color: 'var(--grey-500)',
          marginBottom: 24,
          maxWidth: 320,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 'var(--r-md)',
            border: 'none',
            background: 'var(--navy-900)',
            color: 'var(--white)',
            fontSize: 'var(--t-base)',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-base)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
