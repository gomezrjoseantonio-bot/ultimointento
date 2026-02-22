// Section.tsx
// ATLAS HORIZON: Form section with title and optional icon

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  color?: 'green' | 'blue' | 'gray';
  children: React.ReactNode;
}

const colorMap = {
  green: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', iconBg: '#dcfce7' },
  blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', iconBg: '#dbeafe' },
  gray: { bg: 'var(--hz-card-bg)', border: 'var(--hz-neutral-300)', text: 'var(--atlas-navy-1)', iconBg: 'var(--hz-neutral-100)' },
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
            <Icon size={18} style={{ color: colors.text }} />
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
