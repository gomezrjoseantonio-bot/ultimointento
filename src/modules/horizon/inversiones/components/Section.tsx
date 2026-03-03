// Section.tsx
// ATLAS HORIZON: Form section with title and optional icon

import React from 'react';
import { LucideIcon } from 'lucide-react';

type SectionColor = 'green' | 'blue' | 'gray' | 'orange' | 'purple';

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  color?: SectionColor;
  children: React.ReactNode;
}

const colorMap = {
  green: { bg: 'var(--hz-neutral-50)', border: 'var(--hz-neutral-300)', text: 'var(--atlas-navy-1)', iconBg: '#e6f9f6', iconColor: '#0f766e' },
  blue: { bg: 'var(--hz-neutral-50)', border: 'var(--hz-neutral-300)', text: 'var(--atlas-navy-1)', iconBg: '#e6efff', iconColor: 'var(--atlas-blue)' },
  gray: { bg: 'var(--hz-card-bg)', border: 'var(--hz-neutral-300)', text: 'var(--atlas-navy-1)', iconBg: 'var(--hz-neutral-100)', iconColor: 'var(--atlas-navy-1)' },
  orange: { bg: 'var(--hz-neutral-50)', border: 'var(--hz-neutral-300)', text: 'var(--atlas-navy-1)', iconBg: '#fff2e8', iconColor: '#c2410c' },
  purple: { bg: 'var(--hz-neutral-50)', border: 'var(--hz-neutral-300)', text: 'var(--atlas-navy-1)', iconBg: '#f2ecff', iconColor: '#6d28d9' },
};

const Section: React.FC<SectionProps> = ({ title, icon: Icon, color = 'gray', children }) => {
  const colors = colorMap[color];
  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      padding: '1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        {Icon && (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: colors.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon size={18} style={{ color: colors.iconColor }} />
          </div>
        )}
        <h3 style={{
          fontFamily: 'var(--font-inter)',
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: colors.text,
          margin: 0,
        }}>
          {title}
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {children}
      </div>
    </div>
  );
};

export default Section;
