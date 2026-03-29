import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'active' | 'pending' | 'declared';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<string, { background: string; color: string }> = {
  success: { background: 'var(--teal-100)', color: 'var(--teal-600)' },
  active: { background: 'var(--teal-100)', color: 'var(--teal-600)' },
  warning: { background: 'var(--grey-100)', color: 'var(--grey-700)' },
  pending: { background: 'var(--grey-100)', color: 'var(--grey-700)' },
  error: { background: 'var(--grey-100)', color: 'var(--grey-700)' },
  info: { background: 'var(--navy-100)', color: 'var(--navy-900)' },
  declared: { background: 'var(--navy-100)', color: 'var(--navy-900)' },
  neutral: { background: 'var(--grey-100)', color: 'var(--grey-400)' },
};

const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  size = 'md',
  className = ''
}) => {
  const style = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 6,
        fontWeight: 600,
        fontSize: size === 'sm' ? 'var(--t-xs)' : 'var(--t-xs)',
        padding: size === 'sm' ? '2px 8px' : '2px 10px',
        background: style.background,
        color: style.color,
      }}
    >
      {children}
    </span>
  );
};

export default Badge;
